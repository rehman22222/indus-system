/**
 * Appointment reminder scheduler.
 *
 * Every tick it scans near-term appointments and dispatches reminders at three
 * windows: 2 hours before, 30 minutes before, and at the appointment start
 * time. Each window is delivered as both an in-app Notification (visible in the
 * app's list + a live `notification:new` socket ping) and an FCM push (queued
 * through the notification worker, so it reaches the phone even when the app is
 * backgrounded).
 *
 * Exactly-once: each window is claimed with an atomic `$addToSet` guarded by
 * `reminders_sent: { $ne: key }`. Only the instance whose update actually
 * modifies the document sends — so duplicates are impossible even when both the
 * local and the Render backend run the scheduler against the same database.
 *
 * Timezone: stored `date`/`time` are naive clinic-local strings. We interpret
 * them with CLINIC_UTC_OFFSET_MINUTES so a "09:30" appointment fires correctly
 * whether the server clock is PKT (dev) or UTC (Render).
 */
import { Appointment, Doctor, Notification, User } from '../models/index.js';
import { enqueueNotification } from './notificationQueue.service.js';
import { isPushReady } from './push.service.js';
import { emitToUser } from './realtime.service.js';
import { invalidateCache } from './cache.service.js';
import { env } from '../config/env.js';

const MINUTE = 60 * 1000;

// Reminder windows. `leadMs` is how long before the appointment start the
// reminder fires; `dueWindowMs` is how late we still allow it (covers a missed
// tick / brief downtime) before treating the window as missed.
const REMINDERS = [
    { key: '2h', leadMs: 120 * MINUTE, dueWindowMs: 15 * MINUTE, label: 'in about 2 hours' },
    { key: '30m', leadMs: 30 * MINUTE, dueWindowMs: 10 * MINUTE, label: 'in 30 minutes' },
    { key: 'start', leadMs: 0, dueWindowMs: 15 * MINUTE, label: 'now' },
];

// Only appointments still awaiting the patient get reminders.
const ACTIVE_STATUSES = ['scheduled', 'confirmed'];

let timer = null;
let ticking = false;

function clinicOffsetMs() {
    return env.CLINIC_UTC_OFFSET_MINUTES * MINUTE;
}

/** Parse "HH:MM" / "H:MM AM" into 24h { hh, mm }. */
function parseTime(time) {
    const match = String(time || '').trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
    if (!match) return null;
    let hh = Number(match[1]);
    const mm = Number(match[2]);
    const ampm = match[3]?.toLowerCase();
    if (ampm === 'pm' && hh < 12) hh += 12;
    if (ampm === 'am' && hh === 12) hh = 0;
    if (hh > 23 || mm > 59) return null;
    return { hh, mm };
}

/** Absolute UTC ms for a clinic-local date ("YYYY-MM-DD") + time. */
function appointmentStartMs(date, time) {
    const parsed = parseTime(time);
    const dateMatch = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!parsed || !dateMatch) return null;
    const [, y, m, d] = dateMatch.map(Number);
    // Date.UTC treats the parts as UTC; subtract the clinic offset to land on
    // the real instant (clinic-local -> UTC).
    return Date.UTC(y, m - 1, d, parsed.hh, parsed.mm) - clinicOffsetMs();
}

/** Clinic-local YYYY-MM-DD for yesterday/today/tomorrow — bounds the query. */
function candidateDates() {
    const offset = clinicOffsetMs();
    const toDate = (ms) => new Date(ms + offset).toISOString().slice(0, 10);
    const now = Date.now();
    return [toDate(now - 86_400_000), toDate(now), toDate(now + 86_400_000)];
}

function fcmTokenFor(user) {
    return (
        user?.fcm_token ||
        user?.push_tokens?.find((item) => item.provider === 'fcm' && item.token)?.token ||
        null
    );
}

function buildMessage(reminder, doctorName, time) {
    const doctor = doctorName ? `Dr. ${doctorName}` : 'your doctor';
    if (reminder.key === 'start') {
        return {
            title: 'Your appointment is now',
            body: `It's time for your appointment with ${doctor} (${time}). Please be ready to join.`,
        };
    }
    return {
        title: 'Appointment reminder',
        body: `Your appointment with ${doctor} is ${reminder.label} — today at ${time}.`,
    };
}

/**
 * Try to claim + deliver one reminder window for one appointment.
 * Returns true when this instance won the claim (and delivered).
 */
async function claimAndDeliver(apt, reminder, doctorName, patientUser) {
    const claim = await Appointment.updateOne(
        { _id: apt._id, reminders_sent: { $ne: reminder.key } },
        { $addToSet: { reminders_sent: reminder.key } },
    );
    if (claim.modifiedCount !== 1) return false; // another instance got it

    const { title, body } = buildMessage(reminder, doctorName, apt.time);
    const data = {
        type: 'appointment_reminder',
        reminder: reminder.key,
        appointmentId: apt._id.toString(),
        token: apt.token,
    };

    const notification = await Notification.create({
        user_id: apt.patient_id,
        title,
        body,
        data,
        sent_at: new Date(),
    });

    emitToUser(apt.patient_id.toString(), 'notification:new', { title, body, data });

    const token = fcmTokenFor(patientUser);
    if (token && isPushReady()) {
        await enqueueNotification({
            type: 'push',
            token,
            title,
            body,
            data,
            notificationId: notification._id.toString(),
        });
    }

    await invalidateCache(['notifications:*', 'dashboard:*']);
    return true;
}

async function tick() {
    if (ticking) return; // never overlap ticks
    ticking = true;
    try {
        const appts = await Appointment.find({
            date: { $in: candidateDates() },
            status: { $in: ACTIVE_STATUSES },
        })
            .select('_id patient_id doctor_id date time token reminders_sent')
            .lean()
            .maxTimeMS(8000);

        const now = Date.now();

        for (const apt of appts) {
            const startMs = appointmentStartMs(apt.date, apt.time);
            if (startMs === null) continue;

            const alreadySent = new Set(apt.reminders_sent || []);
            const due = REMINDERS.filter((reminder) => {
                if (alreadySent.has(reminder.key)) return false;
                const fireMs = startMs - reminder.leadMs;
                return now >= fireMs && now <= fireMs + reminder.dueWindowMs;
            });
            if (due.length === 0) continue;

            // Load doctor name + patient token only when a reminder is actually due.
            const [doctor, patientUser] = await Promise.all([
                Doctor.findById(apt.doctor_id).select('name').lean().maxTimeMS(5000),
                User.findById(apt.patient_id).select('fcm_token push_tokens').lean().maxTimeMS(5000),
            ]);

            for (const reminder of due) {
                try {
                    await claimAndDeliver(apt, reminder, doctor?.name, patientUser);
                } catch (error) {
                    console.warn(`Reminder (${reminder.key}) for ${apt._id} failed:`, error.message);
                }
            }
        }
    } catch (error) {
        console.warn('Reminder scheduler tick failed:', error.message);
    } finally {
        ticking = false;
    }
}

export function startReminderScheduler() {
    if (timer) return;
    if (!env.REMINDER_SCHEDULER_ENABLED) {
        console.log('Appointment reminder scheduler disabled');
        return;
    }
    const intervalMs = env.REMINDER_CHECK_INTERVAL_SECONDS * 1000;
    timer = setInterval(() => { void tick(); }, intervalMs);
    timer.unref?.();
    console.log(
        `Appointment reminder scheduler started (every ${env.REMINDER_CHECK_INTERVAL_SECONDS}s, ` +
        `clinic offset ${env.CLINIC_UTC_OFFSET_MINUTES}m, push ${isPushReady() ? 'ready' : 'disabled'})`,
    );
    // Run one tick shortly after boot so reminders aren't delayed a full interval.
    setTimeout(() => { void tick(); }, 4000).unref?.();
}

export function stopReminderScheduler() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}

export function reminderSchedulerStatus() {
    return {
        enabled: env.REMINDER_SCHEDULER_ENABLED,
        running: Boolean(timer),
        intervalSeconds: env.REMINDER_CHECK_INTERVAL_SECONDS,
    };
}
