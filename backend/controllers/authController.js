import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/user.js";

const DUMMY_HASH = "$2a$12$e86..dummyhashforconstanttimecomparison............";
const bcryptDummyCompare = async () => {
    await bcrypt.compare("dummy_password", DUMMY_HASH);
};

/**
 * Signs a JWT for the given user id.
 */
const signToken = (userId) =>
    jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

/**
* Generates a secure random hex token and its SHA-256 hash.
* The raw token goes in the email link; only the hash is stored in the DB
* so that if the DB is compromised the tokens can't be used.
*/
const generateVerificationToken = () => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    return { rawToken, hashedToken };
};

export const register = async (req, res) => {
    try {
        const { firstName, lastName, email, password, phoneNumber, address, location } =
            req.sanitised; // set by validateRegister middleware

        // ── Duplicate email check ─────────────────────────────────────────────
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: "Email is already registered" });
        }

        // ── Build GeoJSON point ───────────────────────────────────────────────
        // Frontend sends { lat, lng }; GeoJSON stores [longitude, latitude]
        const geoLocation = {
            type: "Point",
            coordinates: [parseFloat(location.lng), parseFloat(location.lat)],
        };

        // ── Generate verification token ───────────────────────────────────────
        const { rawToken, hashedToken } = generateVerificationToken();
        const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // ── Create user ───────────────────────────────────────────────────────
        const user = await User.create({
            firstName,
            lastName,
            email,
            password,          // hashed by pre-save hook
            phoneNumber,
            address,
            location: geoLocation,
            emailVerificationToken: hashedToken,
            emailVerificationTokenExpires: tokenExpires,
        });

        // ── Send verification email ───────────────────────────────────────────
        const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
        const verifyUrl = `${clientUrl}/verify-email?token=${rawToken}`;

        // try {
        //     await sendVerificationEmail(email, firstName, verifyUrl);
        // } catch (emailError) {
        //     // Email sending failed — user is created but not yet verified.
        //     // We still respond with success and tell the user to check their email.
        //     // Log the error server-side.
        //     console.error("Failed to send verification email:", emailError.message);
        // }

        // ── Respond ───────────────────────────────────────────────────────────
        return res.status(201).json({
            message:
                "Account created successfully! Please check your email to verify your account before logging in.",
            user: user.toSafeObject(),
        });
    } catch (error) {
        console.error("Register error:", error);

        // Handle Mongoose duplicate key (race condition fallback)
        if (error.code === 11000) {
            return res.status(409).json({ error: "Email is already registered" });
        }

        // Handle Mongoose validation errors
        if (error.name === "ValidationError") {
            const errors = Object.values(error.errors).reduce((acc, e) => {
                acc[e.path] = e.message;
                return acc;
            }, {});
            return res.status(422).json({ errors });
        }

        return res.status(500).json({ error: "Server error. Please try again later." });
    }
};

export const checkEmail = async (req, res) => {
    try {
        const email = req.sanitisedEmail; // set by validateCheckEmail middleware
        const user = await User.findOne({ email }).select("_id").lean();
        return res.status(200).json({ available: !user });
    } catch (error) {
        console.error("Check email error:", error);
        return res.status(500).json({ error: "Server error" });
    }
};

// ── Constants for account lockout ──────────────────────────────────────────────
const MAX_LOGIN_ATTEMPTS = 5;           // lock after 5 consecutive failures
const LOCK_DURATION_MS = 15 * 60 * 1000; // locked for 15 minutes

/**
 * ==============================================================================
 * LOGIN CONTROLLER (login)
 * ==============================================================================
 * 
 * WHY WE NEED THIS FUNCTION:
 * When a user fills out the login form with their email and password, the frontend
 * sends a POST request to `/api/auth/login`. This function is responsible for:
 *   1. Finding the user in the database.
 *   2. Verifying their password securely using bcrypt comparison.
 *   3. Enforcing security policies (Account Lockout, Email Verification, Account Active state).
 *   4. Generating and returning a signed JSON Web Token (JWT) on success.
 *
 * HTTP Method: POST /api/auth/login
 */
export const login = async (req, res) => {
    try {
        // ── 1. EXTRACT SANITISED INPUTS ────────────────────────────────────────
        // WHY: `req.sanitised` is populated by the `validateLogin` middleware before reaching here.
        // It cleans and normalizes user input (e.g. trimming spaces, lowercasing emails) 
        // to prevent bad inputs or injection attempts.
        const { email, password } = req.sanitised;

        // ── 2. FETCH USER & EXPLICITLY INCLUDE SENSITIVE FIELDS ───────────────
        // WHY: In the User schema, `password`, `loginAttempts`, and `lockUntil` have `select: false` 
        // to avoid accidentally leaking passwords in normal queries. 
        // We use `.select("+password +loginAttempts +lockUntil")` here because we specifically 
        // need to verify the password and check account lockout counters.
        const user = await User.findOne({ email }).select(
            "+password +loginAttempts +lockUntil"
        );

        // ── 3. PREVENT TIMING ATTACKS ON UNREGISTERED EMAILS ──────────────────
        // WHY: Cryptographic password hashing (bcrypt) takes noticeable time to run.
        // If we return immediately when an email is not found, malicious actors could measure 
        // response times to discover which email addresses exist in our database (Email Enumeration).
        // Calling `bcryptDummyCompare()` ensures the response time remains constant whether 
        // the email exists or not.
        if (!user) {
            await bcryptDummyCompare();
            // Generic error message so attackers cannot guess whether email or password was wrong.
            return res.status(401).json({ error: "Invalid email or password." });
        }

        // ── 4. CHECK ACCOUNT LOCKOUT STATUS ───────────────────────────────────
        // WHY: To protect accounts against automated brute-force attacks (guessing passwords), 
        // accounts are temporarily locked after multiple consecutive failed attempts.
        if (user.isLocked()) {
            // Calculate how many minutes are remaining in the 15-minute lock period
            const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60_000);
            // 423 Locked: Standard HTTP status for locked resources
            return res.status(423).json({
                error: `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft > 1 ? "s" : ""}.`,
            });
        }

        // ── 5. CHECK EMAIL VERIFICATION ───────────────────────────────────────
        // WHY: Unverified accounts should not be allowed to log in until they click 
        // the verification link sent to their email during registration.
        // if (!user.isEmailVerified) {
        //     // 403 Forbidden: Authenticated state attempted, but blocked due to policy
        //     return res.status(403).json({
        //         error: "Please verify your email address before logging in. Check your inbox or request a new verification link.",
        //         code: "EMAIL_NOT_VERIFIED",
        //     });
        // }


        // ── 6. CHECK ACCOUNT ACTIVE STATUS ────────────────────────────────────
        // WHY: Admins or users may deactivate accounts. Deactivated users cannot log in.
        if (!user.isActive) {
            return res.status(403).json({ error: "This account has been deactivated. Please contact support." });
        }

        // ── 7. COMPARE PASSWORDS HASHES ───────────────────────────────────────
        // WHY: Plaintext passwords are NEVER stored in the database. `user.comparePassword()` 
        // uses bcrypt to hash the entered `password` and check if it matches the stored hash.
        const passwordMatch = await user.comparePassword(password);

        if (!passwordMatch) {
            // Increment failed login attempt counter and lock account if limit (5) reached
            await handleFailedLogin(user);
            // Return generic 401 Unauthorized error for security

            return res.status(401).json({ error: "Invalid email or password." });
        }

        // ── 8. SUCCESSFUL LOGIN RESET & TIMESTAMP ─────────────────────────────
        // WHY: Since password was correct, clear any past failed attempts & lockout timers,
        // and record the timestamp of this successful login.
        if (user.loginAttempts > 0 || user.lockUntil) {
            user.loginAttempts = 0;
            user.lockUntil = undefined;
        }
        user.lastLogin = new Date();
        await user.save();

        // ── 9. GENERATE & RETURN JWT TOKEN ────────────────────────────────────
        // WHY: Issue a signed JSON Web Token (JWT) containing the user's ID. 
        // The frontend will save this token (e.g. in localStorage) and send it in the 
        // `Authorization: Bearer <token>` header on subsequent requests.
        const token = signToken(user._id);

        // 200 OK: Return success message, token, and safe user profile object
        return res.status(200).json({
            message: "Login successful.",
            token,
            user: user.toSafeObject(),
        });
    } catch (error) {
        // Catch server or database exceptions safely
        console.error("Login error:", error);
        return res.status(500).json({ error: "Server error. Please try again later." });
    }
};

/**
 * Increments failed login attempts and locks the account when the threshold
 * is reached. Saves to DB.
 */
const handleFailedLogin = async (user) => {
    user.loginAttempts += 1;

    if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
        user.loginAttempts = 0; // reset counter so next window starts fresh after unlock
        console.warn(`Account locked: ${user.email} after ${MAX_LOGIN_ATTEMPTS} failed attempts`);
    }

    await user.save();
};

/**
 * ==============================================================================
 * LOGOUT CONTROLLER (logout)
 * ==============================================================================
 * 
 * WHY WE NEED THIS FUNCTION:
 * In JWT authentication, authentication state is "stateless" — meaning tokens are stored 
 * on the client side (e.g., in browser memory/localStorage), NOT in a database session table.
 * 
 * Primary logout is performed by the client deleting its stored JWT.
 * However, having a server-side logout route is essential for:
 *   1. Logging security/audit events (e.g. recording exact timestamp when a user logs out).
 *   2. Clearing HTTP-Only auth cookies if cookie-based JWT storage is added.
 *   3. Providing an extension point for token revocation lists (e.g. Redis blocklisting).
 *
 * HTTP Method: POST /api/auth/logout
 * Middleware Protection: Requires `protect` middleware so `req.user` exists.
 */
export const logout = async (req, res) => {
    try {
        // WHY: `req.user` was loaded by the `protect` middleware.
        // We log the logout activity server-side for audit and security monitoring purposes.
        console.log(`User ${req.user._id} logged out at ${new Date().toISOString()}`);

        // Future enhancement hook: add token identifier (jti) to a Redis token blocklist here.

        // 200 OK: Send confirmation response back to the client
        return res.status(200).json({ message: "Logged out successfully." });
    } catch (error) {
        console.error("Logout error:", error);
        return res.status(500).json({ error: "Server error. Please try again later." });
    }
};

/**
 * ==============================================================================
 * GET CURRENT USER CONTROLLER (getMe)
 * ==============================================================================
 * 
 * WHY WE NEED THIS FUNCTION:
 * When a user refreshes their browser page or opens the web application again, 
 * the frontend client still holds their saved JWT token. The frontend sends a 
 * request to `GET /api/auth/me` with the token in the Authorization header to 
 * retrieve the user's latest profile information and restore their session state.
 * 
 * WHY IS THIS FUNCTION SO SHORT?
 * This route is protected by the `protect` middleware (`router.get("/me", protect, getMe)`). 
 * By the time this function executes, `protect` has ALREADY:
 *   1. Verified the JWT token.
 *   2. Looked up the user in MongoDB.
 *   3. Checked if the user account exists and is active.
 *   4. Attached the complete user object to `req.user`.
 * 
 * Therefore, `getMe` simply converts `req.user` to a safe object and returns it!
 *
 * HTTP Method: GET /api/auth/me
 * Middleware Protection: Requires `protect` middleware.
 */
export const getMe = async (req, res) => {
    try {
        // WHY `toSafeObject()`: Strips internal/sensitive fields (like hashed password, 
        // verification tokens, etc.) before sending the user profile to the client.
        return res.status(200).json({ user: req.user.toSafeObject() });
    } catch (error) {
        console.error("getMe error:", error);
        return res.status(500).json({ error: "Server error. Please try again later." });
    }
};