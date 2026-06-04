import admin from 'firebase-admin';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

// Initialize Firebase Admin (only once)
let firebaseInitialized = false;

const initializeFirebase = () => {
    if (!firebaseInitialized && process.env.FCM_PROJECT_ID && process.env.FCM_PRIVATE_KEY) {
        try {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FCM_PROJECT_ID,
                    clientEmail: process.env.FCM_CLIENT_EMAIL,
                    privateKey: process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n')
                })
            });
            firebaseInitialized = true;
            console.log('✅ Firebase Admin initialized');
        } catch (error) {
            console.warn('⚠️  Firebase Admin initialization failed (FCM disabled)');
        }
    } else if (!firebaseInitialized) {
        console.log('ℹ️  Firebase Cloud Messaging disabled (no credentials)');
    }
};

initializeFirebase();

/**
 * Send push notification to a single user
 */
export const sendNotification = async (req, res) => {
    const { userId, title, body, data = {} } = req.body;

    // Get user's FCM token
    const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('fcm_token')
        .eq('id', userId)
        .single();

    if (userError || !user || !user.fcm_token) {
        throw new AppError('User not found or FCM token not available', 404);
    }

    try {
        // Send notification via FCM
        const message = {
            notification: {
                title,
                body
            },
            data: {
                ...data,
                timestamp: new Date().toISOString()
            },
            token: user.fcm_token
        };

        const response = await admin.messaging().send(message);

        // Log notification to database
        await supabaseAdmin
            .from('notifications')
            .insert({
                user_id: userId,
                title,
                body,
                data,
                sent_at: new Date().toISOString(),
                fcm_message_id: response
            });

        res.status(200).json({
            message: 'Notification sent successfully',
            messageId: response
        });
    } catch (error) {
        console.error('Error sending notification:', error);
        throw new AppError('Failed to send notification', 500);
    }
};

/**
 * Send push notification to multiple users
 */
export const sendBulkNotification = async (req, res) => {
    const { userIds, title, body, data = {} } = req.body;

    // Get users' FCM tokens
    const { data: users, error: usersError } = await supabaseAdmin
        .from('users')
        .select('id, fcm_token')
        .in('id', userIds);

    if (usersError || !users || users.length === 0) {
        throw new AppError('No users found with FCM tokens', 404);
    }

    const tokens = users
        .filter(u => u.fcm_token)
        .map(u => u.fcm_token);

    if (tokens.length === 0) {
        throw new AppError('No valid FCM tokens found', 400);
    }

    try {
        // Send notifications via FCM
        const message = {
            notification: {
                title,
                body
            },
            data: {
                ...data,
                timestamp: new Date().toISOString()
            },
            tokens
        };

        const response = await admin.messaging().sendEachForMulticast(message);

        // Log notifications to database
        const notificationRecords = users
            .filter(u => u.fcm_token)
            .map(u => ({
                user_id: u.id,
                title,
                body,
                data,
                sent_at: new Date().toISOString()
            }));

        await supabaseAdmin
            .from('notifications')
            .insert(notificationRecords);

        res.status(200).json({
            message: 'Bulk notifications sent',
            successCount: response.successCount,
            failureCount: response.failureCount,
            totalCount: tokens.length
        });
    } catch (error) {
        console.error('Error sending bulk notifications:', error);
        throw new AppError('Failed to send bulk notifications', 500);
    }
};
