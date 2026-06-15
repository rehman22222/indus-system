import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

import { connectMongoDB, disconnectMongoDB, mongoHealth } from './config/mongodb.js';
import { env } from './config/env.js';
import { appModels } from './models/index.js';
import { initCache, disconnectCache, cacheStatus } from './services/cache.service.js';
import { initRealtime, realtimeStatus } from './services/realtime.service.js';
import {
    startNotificationWorker,
    stopNotificationWorker,
    notificationQueueStatus,
} from './services/notificationQueue.service.js';
import {
    startReminderScheduler,
    stopReminderScheduler,
    reminderSchedulerStatus,
} from './services/reminderScheduler.service.js';
import { HybridRateLimitStore } from './middleware/rateLimitStore.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import otpRoutes from './routes/otp.routes.js';
import videoRoutes from './routes/video.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import appointmentRoutes from './routes/appointment.routes.js';
import dataRoutes from './routes/data.routes.js';
import doctorRoutes from './routes/doctor.routes.js';
import departmentRoutes from './routes/department.routes.js';
import patientRoutes from './routes/patient.routes.js';
import queueRoutes from './routes/queue.routes.js';
import slotRoutes from './routes/slot.routes.js';
import prescriptionRoutes from './routes/prescription.routes.js';
import documentRoutes from './routes/document.routes.js';
import adminRoutes from './routes/admin.routes.js';
import managementRoutes from './routes/management.routes.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = env.PORT;

app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY ? 1 : false);

// Security middleware
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
);

app.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
});

// CORS configuration
function isAllowedOrigin(origin) {
    if (!origin) return true;
    if (env.CORS_ORIGINS.includes('*') && !env.IS_PRODUCTION) return true;
    return env.CORS_ORIGINS.includes(origin);
}

const corsOptions = {
    origin(origin, callback) {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
    optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health',
    store: new HybridRateLimitStore('rl:api:'),
    message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    store: new HybridRateLimitStore('rl:auth:'),
    message: 'Too many authentication attempts, please try again later.',
});
app.use(['/api/auth/login', '/api/auth/send-otp', '/api/auth/resend-otp'], authLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(env.NODE_ENV === 'development' ? morgan('dev') : morgan('combined'));

// Health check endpoint
app.get('/health', (req, res) => {
    const database = mongoHealth();
    const cache = cacheStatus();
    const realtime = realtimeStatus();
    const notifications = notificationQueueStatus();
    const reminders = reminderSchedulerStatus();

    res.status(200).json({
        status: database.readyState === 1 ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: env.NODE_ENV,
        requestId: req.requestId,
        database,
        cache,
        realtime,
        notifications,
        reminders,
        redis: {
            cache: cache.redisReady,
            socketAdapter: realtime.redisAdapterReady,
            notificationQueue: notifications.backend === 'redis',
        },
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/v1/otp', otpRoutes);
app.use('/api/v1/video', videoRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/doctors', doctorRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/queue', queueRoutes);
app.use('/api/v1/slots', slotRoutes);
app.use('/api/v1/prescriptions', prescriptionRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/management', managementRoutes);
// Kept intentionally as an undo/legacy compatibility fallback while the UI
// moves to domain-specific routes.
app.use('/api/v1/data', dataRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.url} not found`,
        timestamp: new Date().toISOString(),
    });
});

// Global error handler
app.use(errorHandler);

let server;

async function ensureIndexesOnStartup() {
    if (!env.MONGODB_ENSURE_INDEXES_ON_STARTUP) return;

    for (const model of appModels) {
        await model.createIndexes();
    }
}

async function startServer() {
    await connectMongoDB();
    await initCache();
    await ensureIndexesOnStartup();

    const workerLabel = process.env.CLUSTER_WORKER ? ` (worker ${process.pid})` : '';

    server = app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}${workerLabel}`);
        console.log(`Environment: ${env.NODE_ENV}`);
        console.log(`Health check: http://localhost:${PORT}/health`);
    });

    // Keep-alive tuning for high-concurrency reuse behind load balancers.
    // headersTimeout must exceed keepAliveTimeout to avoid premature 502s.
    server.keepAliveTimeout = env.SERVER_KEEP_ALIVE_TIMEOUT_MS;
    server.headersTimeout = env.SERVER_HEADERS_TIMEOUT_MS;
    if (env.SERVER_REQUEST_TIMEOUT_MS > 0) {
        server.requestTimeout = env.SERVER_REQUEST_TIMEOUT_MS;
    }

    await initRealtime(server);
    await startNotificationWorker();
    startReminderScheduler();
}

let shuttingDown = false;

async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} signal received: closing HTTP server`);

    // Force-exit safety net so a hung connection can't block the drain forever.
    const forced = setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
    }, env.SHUTDOWN_TIMEOUT_MS);
    forced.unref();

    try {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
        stopReminderScheduler();
        await stopNotificationWorker();
        await disconnectCache();
        await disconnectMongoDB();
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Transient network/socket errors (e.g. a reset TLS socket to Upstash/Atlas on
// a flaky connection) are recoverable — they must not take the whole server
// down. Only exit on genuinely unexpected programmer errors.
const RECOVERABLE_ERROR_CODES = new Set([
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'EPIPE',
    'ENOTFOUND',
    'EAI_AGAIN',
]);

process.on('unhandledRejection', (reason) => {
    if (reason && RECOVERABLE_ERROR_CODES.has(reason.code)) {
        console.warn('Recoverable unhandled rejection (continuing):', reason.code, reason.message);
        return;
    }
    console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
    if (error && RECOVERABLE_ERROR_CODES.has(error.code)) {
        console.warn('Recoverable uncaught exception (continuing):', error.code, error.message);
        return;
    }
    console.error('Uncaught exception:', error);
    process.exit(1);
});

if (env.NODE_ENV !== 'test') {
    startServer().catch(async (error) => {
        console.error('Failed to start server:', error);
        await disconnectMongoDB();
        process.exit(1);
    });
}

export default app;
