/**
 * Server-side validation middleware.
 * Always validate on the server even if the frontend already does it —
 * frontend validation can be bypassed.
 */

/**
 * Sanitises a string: trims whitespace and removes null bytes.
 */
const clean = (val) =>
    typeof val === "string" ? val.trim().replace(/\0/g, "") : val;

/**
 * POST /api/auth/register
 */
export const validateRegister = (req, res, next) => {
    const errors = {};

    // Pull fields and sanitise strings
    const firstName = clean(req.body.firstName);
    const lastName = clean(req.body.lastName);
    const email = clean(req.body.email)?.toLowerCase();
    const password = req.body.password;          // do NOT trim passwords
    const phoneNumber = clean(req.body.phoneNumber);
    const address = clean(req.body.address);
    const location = req.body.location;          // { lat, lng }

    // ── Required fields ───────────────────────────────────────────────────────
    if (!firstName) errors.firstName = "First name is required";
    if (!lastName) errors.lastName = "Last name is required";
    if (!email) errors.email = "Email is required";
    if (!password) errors.password = "Password is required";
    if (!phoneNumber) errors.phoneNumber = "Phone number is required";
    if (!address) errors.address = "Address is required";
    if (!location) errors.location = "Location coordinates are required";

    // ── Format checks ─────────────────────────────────────────────────────────
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email))
        errors.email = "Invalid email address";

    // Minimum 8 chars, at least one uppercase, one lowercase, one digit
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (password && !passwordRegex.test(password))
        errors.password =
            "Password must be at least 8 characters and include uppercase, lowercase, and a number";

    const phoneRegex = /^[0-9+\-\s()]{7,20}$/;
    if (phoneNumber && !phoneRegex.test(phoneNumber))
        errors.phoneNumber = "Invalid phone number";

    if (firstName && firstName.length > 50)
        errors.firstName = "First name too long (max 50 chars)";
    if (lastName && lastName.length > 50)
        errors.lastName = "Last name too long (max 50 chars)";
    if (address && address.length > 300)
        errors.address = "Address too long (max 300 chars)";

    // ── Location ──────────────────────────────────────────────────────────────
    if (location) {
        const lat = parseFloat(location.lat);
        const lng = parseFloat(location.lng);
        if (
            isNaN(lat) || isNaN(lng) ||
            lat < -90 || lat > 90 ||
            lng < -180 || lng > 180
        ) {
            errors.location = "Invalid coordinates";
        }
    }

    if (Object.keys(errors).length > 0) {
        return res.status(422).json({ errors });
    }

    // Attach sanitised values so the controller doesn't have to repeat this
    req.sanitised = { firstName, lastName, email, password, phoneNumber, address, location };
    next();
};

/**
 * POST /api/auth/login
 */
export const validateLogin = (req, res, next) => {
    const email = clean(req.body.email)?.toLowerCase();
    const password = req.body.password; // never trim passwords

    const errors = {};

    if (!email) errors.email = "Email is required";
    if (!password) errors.password = "Password is required";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email))
        errors.email = "Invalid email address";

    // Hard cap: passwords over 1 KB are a bcrypt DoS vector
    if (password && password.length > 1024)
        errors.password = "Invalid credentials";

    if (Object.keys(errors).length > 0) {
        return res.status(422).json({ errors });
    }

    req.sanitised = { email, password };
    next();
};

/**
 * GET /api/auth/check-email/:email
 */
export const validateCheckEmail = (req, res, next) => {
    const email = decodeURIComponent(req.params.email || "").toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email address" });
    }
    req.sanitisedEmail = email;
    next();
};