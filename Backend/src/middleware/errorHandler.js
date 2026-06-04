/**
 * Global error handling middleware
 */
export const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Default error
    let status = err.status || err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    let errors = err.errors || null;

    // Validation errors
    if (err.name === 'ValidationError') {
        status = 400;
        message = 'Validation Error';
        errors = Object.values(err.errors).map(e => e.message);
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        status = 401;
        message = 'Invalid token';
    }

    if (err.name === 'TokenExpiredError') {
        status = 401;
        message = 'Token expired';
    }

    // Supabase errors
    if (err.code) {
        switch (err.code) {
            case '23505': // Unique violation
                status = 409;
                message = 'Resource already exists';
                break;
            case '23503': // Foreign key violation
                status = 400;
                message = 'Invalid reference';
                break;
            case '23502': // Not null violation
                status = 400;
                message = 'Required field missing';
                break;
            case 'PGRST116': // No rows found
                status = 404;
                message = 'Resource not found';
                break;
        }
    }

    // Send response
    const response = {
        error: message,
        status,
        timestamp: new Date().toISOString()
    };

    if (errors) {
        response.errors = errors;
    }

    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
    }

    res.status(status).json(response);
};

/**
 * Async handler wrapper to catch errors in async routes
 */
export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Custom error class
 */
export class AppError extends Error {
    constructor(message, status = 500) {
        super(message);
        this.status = status;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
