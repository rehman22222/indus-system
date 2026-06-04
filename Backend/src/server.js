import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

// Import routes
import authRoutes from './routes/auth.routes.js';
import otpRoutes from './routes/otp.routes.js';
import videoRoutes from './routes/video.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import appointmentRoutes from './routes/appointment.routes.js';
import doctorRoutes from './routes/doctor.routes.js';
import patientRoutes from './routes/patient.routes.js';
import queueRoutes from './routes/queue.routes.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV
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
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/queue', queueRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.url} not found`,
        timestamp: new Date().toISOString()
    });
});

// Global error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    process.exit(0);
});

export default app;
