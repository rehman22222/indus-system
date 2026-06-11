import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { normalizeRole } from '../utils/mongo.js';
import { env } from '../config/env.js';

function getBearerToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.substring(7);
}

/**
 * Verify the application JWT and hydrate req.user from MongoDB.
 */
export const authMiddleware = async (req, res, next) => {
    try {
        const token = getBearerToken(req);

        if (!token) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Missing or invalid authorization header',
            });
        }

        const payload = jwt.verify(token, env.JWT_SECRET);
        const userId = payload.userId || payload.sub;

        const user = await User.findById(userId).lean();
        if (!user || !user.is_active) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid or inactive user',
            });
        }

        req.auth = payload;
        req.user = {
            ...user,
            id: user._id.toString(),
        };
        req.userRole = normalizeRole(user.role);

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Unauthorized',
                message: error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token',
            });
        }

        console.error('Auth middleware error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Authentication failed',
        });
    }
};

/**
 * Require one of the provided lower/upper-case role names.
 */
export const requireRole = (roles) => {
    const allowedRoles = roles.map(normalizeRole);

    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required',
            });
        }

        if (!allowedRoles.includes(normalizeRole(req.user.role))) {
            return res.status(403).json({
                error: 'Forbidden',
                message: `Required role: ${roles.join(' or ')}`,
            });
        }

        next();
    };
};

/**
 * Optional auth - attaches req.user when a valid token is present.
 */
export const optionalAuth = async (req, res, next) => {
    try {
        const token = getBearerToken(req);
        if (!token) return next();

        const payload = jwt.verify(token, env.JWT_SECRET);
        const userId = payload.userId || payload.sub;
        const user = await User.findById(userId).lean();

        if (user && user.is_active) {
            req.auth = payload;
            req.user = { ...user, id: user._id.toString() };
            req.userRole = normalizeRole(user.role);
        }

        next();
    } catch {
        next();
    }
};
