import { Notification, User } from '../models/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireObjectId, serialize } from '../utils/mongo.js';
import { buildListFilter, buildProjection, buildSort, getListOptions, pagedFind } from '../utils/api.js';
import { invalidateCache } from '../services/cache.service.js';
import { isPushReady } from '../services/push.service.js';
import { enqueueNotification } from '../services/notificationQueue.service.js';
import { emitToUser } from '../services/realtime.service.js';

const BROADCAST_ROLES = new Set(['admin', 'management', 'doctor', 'patient', 'receptionist']);

function fcmTokenFor(user) {
    return user?.fcm_token || user?.push_tokens?.find((item) => item.provider === 'fcm' && item.token)?.token;
}

const FIELD_MAP = {
    is_read: 'read',
    userId: 'user_id',
    user_id: 'user_id',
};

function serializeNotification(row) {
    const value = serialize(row);
    return {
        ...value,
        message: value.body,
        type: value.data?.type || 'info',
        is_read: Boolean(value.read),
    };
}

function serializeNotifications(rows = []) {
    return rows.map(serializeNotification);
}

export const listNotifications = async (req, res) => {
    const list = getListOptions(req.query);
    const filter = buildListFilter(req, { fieldMap: FIELD_MAP });

    if (req.userRole === 'patient' || req.userRole === 'doctor') {
        filter.user_id = requireObjectId(req.user.id, 'userId');
    } else if (req.query.user_id || req.query.userId) {
        filter.user_id = requireObjectId(req.query.user_id || req.query.userId, 'userId');
    }

    if (req.query.read !== undefined) filter.read = req.query.read === 'true';
    if (req.query.is_read !== undefined) filter.read = req.query.is_read === 'true';

    const sort = buildSort(req.query, {
        fieldMap: FIELD_MAP,
        allowed: ['created_at', 'sent_at', 'read', 'user_id'],
        fallback: { created_at: -1 },
    });
    const projection = buildProjection(req.query, [
        '_id',
        'id',
        'user_id',
        'title',
        'body',
        'data',
        'read',
        'sent_at',
        'read_at',
        'created_at',
        'updated_at',
    ], FIELD_MAP);

    const { items, pagination } = await pagedFind(Notification, filter, {
        ...list,
        sort,
        projection,
        maxTimeMS: 5000,
    });

    const notifications = serializeNotifications(items);
    res.status(200).json({ notifications, data: notifications, pagination });
};

export const updateNotification = async (req, res) => {
    const id = requireObjectId(req.params.id, 'notificationId');
    const filter = { _id: id };
    if (req.userRole === 'patient' || req.userRole === 'doctor') {
        filter.user_id = requireObjectId(req.user.id, 'userId');
    }

    const updates = { ...req.body };
    if ('is_read' in updates) {
        updates.read = Boolean(updates.is_read);
        delete updates.is_read;
    }
    if (updates.read === true && !updates.read_at) updates.read_at = new Date();

    const notification = await Notification.findOneAndUpdate(filter, updates, {
        new: true,
        runValidators: true,
    });

    if (!notification) throw new AppError('Notification not found', 404);
    await invalidateCache(['notifications:*', 'dashboard:*']);

    const data = serializeNotification(notification);
    res.status(200).json({ notification: data, data });
};

export const createNotification = async (req, res) => {
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    if (rows.length === 0) throw new AppError('Notification payload is required', 400);

    // Broadcast: a single payload with no recipient but is_broadcast / target_role
    // set. Fan it out to every active user of the target role (or everyone) so a
    // management announcement actually lands in each user's notification list.
    const head = rows[0] || {};
    const isBroadcast =
        rows.length === 1 &&
        !head.userId &&
        !head.user_id &&
        (head.is_broadcast || head.isBroadcast || head.target_role || head.targetRole);

    if (isBroadcast) {
        const title = head.title;
        const body = head.body || head.message;
        if (!title || !body) throw new AppError('Notification title and body are required', 400);

        const role = String(head.target_role || head.targetRole || 'all').toLowerCase();
        const userFilter = { is_active: true };
        if (role !== 'all') {
            if (!BROADCAST_ROLES.has(role)) throw new AppError(`Unknown target role: ${role}`, 400);
            userFilter.role = role;
        }

        const recipients = await User.find(userFilter).select('_id').lean().maxTimeMS(8000);
        if (recipients.length === 0) throw new AppError('No active recipients for this broadcast', 404);

        const now = new Date();
        const docs = recipients.map((u) => ({
            user_id: u._id,
            title,
            body,
            data: { ...(head.data || {}), broadcast: true, target_role: role },
            read: false,
            sent_at: now,
        }));

        const created = await Notification.insertMany(docs, { ordered: false });
        await invalidateCache(['notifications:*', 'dashboard:*']);

        // Best-effort live ping to any connected recipients.
        for (const u of recipients) {
            emitToUser(u._id.toString(), 'notification:new', { title, body, broadcast: true });
        }

        const data = serializeNotifications(created.slice(0, 1));
        return res.status(201).json({
            message: `Broadcast delivered to ${created.length} ${role === 'all' ? 'users' : `${role}s`}`,
            count: created.length,
            notifications: data,
            notification: data[0] || null,
            data: data[0] || null,
        });
    }

    const payload = rows.map((row) => ({
        user_id: requireObjectId(row.userId || row.user_id, 'userId'),
        title: row.title,
        body: row.body || row.message,
        data: row.data || {},
        read: Boolean(row.read ?? row.is_read ?? false),
        sent_at: row.sent_at ? new Date(row.sent_at) : new Date(),
    }));

    for (const row of payload) {
        if (!row.title || !row.body) {
            throw new AppError('Notification title and body are required', 400);
        }
    }

    const notifications = await Notification.insertMany(payload, { ordered: true });
    await invalidateCache(['notifications:*', 'dashboard:*']);

    const data = serializeNotifications(notifications);
    res.status(201).json({
        notifications: data,
        notification: data[0] || null,
        data: Array.isArray(req.body) ? data : data[0] || null,
    });
};

export const registerDeviceToken = async (req, res) => {
    const token = String(req.body.token || req.body.fcm_token || req.body.device_token || '').trim();
    if (!token) throw new AppError('Device token is required', 400);

    const providerInput = String(req.body.provider || req.body.type || 'unknown').toLowerCase();
    const platformInput = String(req.body.platform || 'unknown').toLowerCase();
    const provider = ['fcm', 'apns', 'expo'].includes(providerInput) ? providerInput : 'unknown';
    const platform = ['android', 'ios', 'web'].includes(platformInput) ? platformInput : 'unknown';
    const deviceName = req.body.deviceName || req.body.device_name;
    const now = new Date();

    const user = await User.findById(req.user.id).select('fcm_token push_tokens');
    if (!user) throw new AppError('User not found', 404);

    const existingTokens = Array.isArray(user.push_tokens)
        ? user.push_tokens.filter((item) => item.token !== token)
        : [];

    user.push_tokens = [
        {
            token,
            provider,
            platform,
            device_name: deviceName,
            last_seen_at: now,
            created_at: now,
        },
        ...existingTokens,
    ].slice(0, 10);

    if (provider === 'fcm') {
        user.fcm_token = token;
    }

    await user.save();

    res.status(200).json({
        message: 'Device token registered successfully',
        data: {
            provider,
            platform,
            registered: true,
        },
    });
};

export const sendNotification = async (req, res) => {
    const userId = requireObjectId(req.body.userId || req.body.user_id, 'userId');
    const { title, body, data = {} } = req.body;

    if (!title || !body) {
        throw new AppError('Notification title and body are required', 400);
    }

    const user = await User.findById(userId).select('fcm_token push_tokens');
    if (!user) throw new AppError('User not found', 404);

    const fcmToken = fcmTokenFor(user);

    // Persist the in-app notification immediately (always visible in the UI).
    const notification = await Notification.create({
        user_id: userId,
        title,
        body,
        data,
        sent_at: new Date(),
    });
    await invalidateCache(['notifications:*', 'dashboard:*']);

    // Push delivery happens asynchronously via the worker queue.
    const willPush = Boolean(fcmToken) && isPushReady();
    if (willPush) {
        await enqueueNotification({
            type: 'push',
            token: fcmToken,
            title,
            body,
            data,
            notificationId: notification._id.toString(),
        });
    }

    res.status(202).json({
        message: 'Notification queued',
        data: serialize(notification),
        delivery: willPush ? 'queued' : 'stored_only',
    });
};

export const sendBulkNotification = async (req, res) => {
    const userIds = req.body.userIds || req.body.user_ids;
    const { title, body, data = {} } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
        throw new AppError('User IDs array is required', 400);
    }
    if (!title || !body) {
        throw new AppError('Notification title and body are required', 400);
    }

    const objectIds = userIds.map((id) => requireObjectId(id, 'userId'));
    const users = await User.find({ _id: { $in: objectIds } }).select('_id fcm_token push_tokens');

    // Persist in-app notifications for every recipient.
    await Notification.insertMany(
        users.map((user) => ({ user_id: user._id, title, body, data, sent_at: new Date() })),
    );
    await invalidateCache(['notifications:*', 'dashboard:*']);

    const tokens = users.map(fcmTokenFor).filter(Boolean);
    const willPush = tokens.length > 0 && isPushReady();
    if (willPush) {
        await enqueueNotification({ type: 'push', tokens, title, body, data });
    }

    res.status(202).json({
        message: 'Bulk notifications queued',
        recipients: users.length,
        pushTargets: tokens.length,
        delivery: willPush ? 'queued' : 'stored_only',
    });
};
