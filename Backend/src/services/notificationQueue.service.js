/**
 * Background notification job queue + worker.
 *
 * Decouples notification delivery (FCM push, Resend email) from the request
 * path so API calls return immediately instead of waiting on third parties.
 *
 *   Appointment created / send endpoint
 *        -> enqueueNotification(job)
 *        -> Redis list  (or in-memory queue when Redis is down)
 *        -> worker loop -> push.service / email.service
 *
 * Graceful degradation: when Redis is unavailable the queue runs fully
 * in-process on an in-memory array, so notifications still flow.
 */
import { getRedisClient, isRedisReady } from './cache.service.js';
import { sendPushToToken, sendPushToTokens, isPushReady } from './push.service.js';
import { sendOTPEmail, sendAppointmentConfirmation } from './email.service.js';
import { Notification } from '../models/index.js';

const QUEUE_KEY = 'jobs:notifications';
// Idle BRPOP block length. Delivery is still immediate (a pushed item unblocks
// BRPOP at once); this only bounds idle polling. Higher = fewer hosted-Redis
// commands (important on Upstash free tier), at the cost of slower shutdown.
const POLL_SECONDS = Math.min(Math.max(parseInt(process.env.NOTIFICATION_POLL_SECONDS, 10) || 5, 1), 60);
const memoryQueue = [];

let running = false;
let workerClient = null;
let loopPromise = null;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Add a delivery job. Jobs:
 *   { type: 'push', token | tokens[], title, body, data?, notificationId? }
 *   { type: 'email', kind: 'otp', to, code, name }
 *   { type: 'email', kind: 'appointment_confirmation', to, details }
 */
export async function enqueueNotification(job) {
    if (!job || !job.type) return;

    if (isRedisReady()) {
        try {
            await getRedisClient().lPush(QUEUE_KEY, JSON.stringify(job));
            return;
        } catch (error) {
            console.warn('Notification enqueue to Redis failed, using memory:', error.message);
        }
    }
    memoryQueue.push(job);
}

async function processJob(job) {
    try {
        if (job.type === 'push') {
            if (!isPushReady()) return; // FCM not configured — skip silently

            let messageId;
            if (Array.isArray(job.tokens)) {
                const res = await sendPushToTokens(job.tokens, job);
                messageId = `multicast:${res.successCount}/${job.tokens.length}`;
            } else if (job.token) {
                messageId = await sendPushToToken(job.token, job);
            }

            if (job.notificationId && messageId) {
                await Notification.findByIdAndUpdate(job.notificationId, {
                    fcm_message_id: messageId,
                }).catch(() => {});
            }
        } else if (job.type === 'email') {
            if (job.kind === 'otp') {
                await sendOTPEmail(job.to, job.code, job.name);
            } else if (job.kind === 'appointment_confirmation') {
                await sendAppointmentConfirmation(job.to, job.details);
            }
        }
    } catch (error) {
        // Delivery failures must not crash the worker; log and move on.
        console.warn(`Notification job (${job.type}) failed:`, error.message);
    }
}

async function runLoop() {
    while (running) {
        let didWork = false;

        if (workerClient) {
            try {
                const item = await workerClient.brPop(QUEUE_KEY, POLL_SECONDS);
                if (item?.element) {
                    await processJob(JSON.parse(item.element));
                    didWork = true;
                }
            } catch (error) {
                if (running) console.warn('Notification worker Redis loop error:', error.message);
                await delay(500);
            }
        }

        // Always drain the in-memory queue (fallback + Redis-enqueue failures).
        while (memoryQueue.length) {
            await processJob(memoryQueue.shift());
            didWork = true;
        }

        if (!workerClient && !didWork) await delay(500);
    }
}

export async function startNotificationWorker() {
    if (running) return;
    running = true;

    if (isRedisReady()) {
        try {
            workerClient = getRedisClient().duplicate();
            // Must have an 'error' listener — otherwise a dropped TLS socket
            // (e.g. Upstash on a flaky network) becomes an uncaught exception.
            workerClient.on('error', (err) => console.warn('Notification worker Redis error:', err.message));
            await workerClient.connect();
            console.log('Notification worker started (Redis queue)');
        } catch (error) {
            workerClient = null;
            console.warn('Notification worker Redis unavailable, using in-memory queue:', error.message);
        }
    } else {
        console.log('Notification worker started (in-memory queue)');
    }

    loopPromise = runLoop();
}

export async function stopNotificationWorker() {
    running = false;
    try {
        await loopPromise;
    } catch {
        /* ignore */
    }
    if (workerClient?.isOpen) {
        await workerClient.quit().catch(() => {});
    }
    workerClient = null;
}

export function notificationQueueStatus() {
    return {
        backend: workerClient ? 'redis' : 'memory',
        pending: memoryQueue.length,
        running,
    };
}
