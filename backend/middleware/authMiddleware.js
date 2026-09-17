import jwt from "jsonwebtoken";
import User from "../models/user.js";

/**
 * protect
 *
 * Verifies the Bearer JWT in the Authorization header.
 * Attaches the full user document to req.user on success.
 *
 * Usage:  router.get("/me", protect, getMe);
 */
export const protect = async (req, res, next) => {
    try {
        // ── Extract token ─────────────────────────────────────────────────────
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Authentication required. Please log in." });
        }

        const token = authHeader.split(" ")[1];

        // ── Verify signature & expiry ─────────────────────────────────────────
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtErr) {
            const message =
                jwtErr.name === "TokenExpiredError"
                    ? "Your session has expired. Please log in again."
                    : "Invalid token. Please log in again.";
            return res.status(401).json({ error: message });
        }

        // ── Load user from DB ─────────────────────────────────────────────────
        // Always re-fetch so deactivated / deleted accounts are caught immediately.
        // `location` is included so getNearbyListings can read buyer coordinates
        // directly from req.user — no second DB round-trip needed in that handler.
        const user = await User.findById(decoded.id).select("+loginAttempts +lockUntil +location");

        if (!user) {
            return res.status(401).json({ error: "User no longer exists." });
        }

        if (!user.isActive) {
            return res.status(403).json({ error: "This account has been deactivated." });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error("Auth middleware error:", error);
        return res.status(500).json({ error: "Server error. Please try again later." });
    }
};

/**
 * restrictTo(...roles)
 *
 * Role-based access control. Use after `protect`.
 *
 * Usage:  router.delete("/user/:id", protect, restrictTo("admin"), deleteUser);
 */
export const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: "You do not have permission to perform this action.",
            });
        }
        next();
    };
};