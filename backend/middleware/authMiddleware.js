import jwt from 'jsonwebtoken';
import User from '../models/user.js';

export const protect = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required. Please log in.' });

        }

        const token = authHeader.split(' ')[1];

        let decoded;

        try {
            decode = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtErr) {
            const message =
                jwtErr.name === 'TokenExpiredErrorr'
                    ? 'Session expired. Please log in again.'
                    : 'Invalid token. Please log in again.';
            return res.status(401).json({ error: message });
        }

        const user = await User.findById(decoded.id).select('+loginAttempts +lockUntil +location');

        if (!user) {
            return res.status(401).json({ error: 'User not found. Please log in again.' });
        }

        if (!user.isActive) {
            return res.status(403).json({ error: 'Account is deactivated. Please contact support.' });
        }
        req.user = user;
        next();
    } catch (err) {
        console.error('Error in auth middleware:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

export const restricTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'You do not have permission to perform this action.' });
        }
        next();
    };
}