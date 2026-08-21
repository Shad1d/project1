import jwt from "jsonwebtoken";
import User from "../models/user.js";

/**
 * ==============================================================================
 * AUTHENTICATION MIDDLEWARE (protect)
 * ==============================================================================
 * 
 * WHY WE NEED THIS:
 * In a web application, certain API endpoints (like viewing a user profile, 
 * updating account details, or making transactions) should only be accessible 
 * to logged-in users. 
 * 
 * This middleware acts as a "security guard" before Express runs your route controller. 
 * It checks if the request includes a valid JSON Web Token (JWT), verifies that the 
 * account exists and is active, and attaches the user data to `req.user`.
 *
 * HOW EXPRESS MIDDLEWARE WORKS:
 * An Express middleware function receives 3 parameters:
 *   1. `req`  - The incoming HTTP Request object (contains headers, body, query params, etc.)
 *   2. `res`  - The outgoing HTTP Response object (used to send responses back to the client)
 *   3. `next` - A callback function that tells Express to move to the next middleware or route handler
 *
 * Usage Example in Routes:
 *   router.get("/me", protect, getMe);
 */
export const protect = async (req, res, next) => {
    try {
        // ── 1. EXTRACT THE JWT TOKEN FROM HEADERS ─────────────────────────────
        // WHY: Clients (e.g. React frontend or Mobile App) send authentication tokens 
        // in the HTTP headers using the standard format: `Authorization: Bearer <token>`
        const authHeader = req.headers.authorization;

        // WHY: If the header is missing or does not start with "Bearer ", the user is not logged in.
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            // 401 Unauthorized: Tells the client they must authenticate first.
            return res.status(401).json({ error: "Authentication required. Please log in." });
        }

        // Split "Bearer <token_string>" by space and pick index 1 to get the actual token string.
        const token = authHeader.split(" ")[1];

        // ── 2. VERIFY TOKEN SIGNATURE & EXPIRATION ───────────────────────────
        // WHY: Anyone can create a fake string, but `jwt.verify()` uses our secret key 
        // (`process.env.JWT_SECRET`) to mathematically prove that the token was issued 
        // by our server and has not expired or been tampered with.
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtErr) {
            // WHY custom error messages: Gives clear feedback if the token expired versus if it is invalid.
            const message =
                jwtErr.name === "TokenExpiredError"
                    ? "Your session has expired. Please log in again."
                    : "Invalid token. Please log in again.";
            return res.status(401).json({ error: message });
        }

        // ── 3. LOAD USER FROM DATABASE ────────────────────────────────────────
        // WHY: Even if a token is valid, the user's account might have been deleted, 
        // suspended, or locked *after* the token was generated. Fetching the user 
        // from the database ensures real-time account validation on every request.
        // 
        // WHY `.select("+loginAttempts +lockUntil +location")`:
        // In Mongoose models, some sensitive or large fields may be hidden by default (`select: false`).
        // We explicitly include `+location`, `+loginAttempts`, and `+lockUntil` here so downstream 
        // handlers (e.g. location-based features) have access without making an additional database query.
        const user = await User.findById(decoded.id).select("+loginAttempts +lockUntil +location");

        // WHY: If the user was deleted from the database, block the request.
        if (!user) {
            return res.status(401).json({ error: "User no longer exists." });
        }

        // WHY: If the user account was deactivated by an admin or self-disabled, block access.
        if (!user.isActive) {
            // 403 Forbidden: The client is authenticated, but their account is forbidden from access.
            return res.status(403).json({ error: "This account has been deactivated." });
        }

        // ── 4. ATTACH USER TO REQUEST & PROCEED ──────────────────────────────
        // WHY: Storing the user document inside `req.user` makes it available to 
        // all subsequent route controllers (e.g., `getMe`, `createPost`) so they 
        // know exactly who is performing the action without querying the database again.
        req.user = user;

        // `next()` signals Express to pass control to the next middleware or controller function.
        next();
    } catch (error) {
        // WHY: Prevents the server from crashing if unexpected database or internal errors occur.
        console.error("Auth middleware error:", error);
        return res.status(500).json({ error: "Server error. Please try again later." });
    }
};

/**
 * ==============================================================================
 * AUTHORIZATION MIDDLEWARE (restrictTo)
 * ==============================================================================
 * 
 * WHY WE NEED THIS:
 * While `protect` checks WHO the user is (Authentication), `restrictTo` checks 
 * WHAT permissions the user has (Authorization / Role-Based Access Control - RBAC).
 * 
 * For example: All users can view products, but only users with the role "admin" 
 * should be allowed to delete a product or user.
 * 
 * WHY A FUNCTION THAT RETURNS A FUNCTION? (Higher-Order Function / Middleware Factory):
 * Express middleware expects a function signature of `(req, res, next)`. 
 * `restrictTo(...roles)` is a wrapper function that accepts allowed role strings 
 * (e.g. `restrictTo("admin", "seller")`) and returns the actual Express middleware function.
 *
 * Usage Example (Must be placed AFTER `protect` so that `req.user` is available):
 *   router.delete("/user/:id", protect, restrictTo("admin"), deleteUser);
 */
export const restrictTo = (...roles) => {
    return (req, res, next) => {
        // WHY: Check if the authenticated user's role (`req.user.role`) is included in the permitted `roles` array.
        if (!roles.includes(req.user.role)) {
            // 403 Forbidden: User is authenticated, but lacks permission for this action.
            return res.status(403).json({
                error: "You do not have permission to perform this action.",
            });
        }

        // User's role is authorized; proceed to the route controller.
        next();
    };
};
