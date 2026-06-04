import { supabase } from '../config/supabase.js';

/**
 * Middleware to verify JWT token from Supabase Auth
 */
export const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Missing or invalid authorization header'
            });
        }

        const token = authHeader.substring(7);

        // Verify token with Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid or expired token'
            });
        }

        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Authentication failed'
        });
    }
};

/**
 * Middleware to check if user has specific role
 */
export const requireRole = (roles) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Authentication required'
                });
            }

            const { data: userData, error } = await supabase
                .from('users')
                .select('role')
                .eq('id', req.user.id)
                .single();

            if (error || !userData) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'User role not found'
                });
            }

            if (!roles.includes(userData.role)) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: `Required role: ${roles.join(' or ')}`
                });
            }

            req.userRole = userData.role;
            next();
        } catch (error) {
            console.error('Role check error:', error);
            return res.status(500).json({
                error: 'Internal Server Error',
                message: 'Role verification failed'
            });
        }
    };
};

/**
 * Optional auth - doesn't fail if no token
 */
export const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const { data: { user } } = await supabase.auth.getUser(token);
            req.user = user || null;
        }

        next();
    } catch (error) {
        console.error('Optional auth error:', error);
        next();
    }
};
