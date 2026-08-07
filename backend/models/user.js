import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
    {
        firstName: {
            type: String,
            required: [true, "First name is required"],
            trim: true,
            maxlength: [50, "First name cannot exceed 50 characters"],
        },
        lastName: {
            type: String,
            required: [true, "Last name is required"],
            trim: true,
            maxlength: [50, "Last name cannot exceed 50 characters"],
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please enter a valid email address"],
        },
        password: {
            type: String,
            required: [true, "Password is required"],
            minlength: [8, "Password must be at least 8 characters"],
            select: false, // never returned in queries by default
        },
        phoneNumber: {
            type: String,
            required: [true, "Phone number is required"],
            trim: true,
            match: [/^[0-9+\-\s()]{7,20}$/, "Please enter a valid phone number"],
        },
        address: {
            type: String,
            required: [true, "Address is required"],
            trim: true,
            maxlength: [300, "Address cannot exceed 300 characters"],
        },
        location: {
            type: {
                type: String,
                enum: ["Point"],
                default: "Point",
            },
            coordinates: {
                type: [Number], // [lng, lat]  ← GeoJSON order
                required: [true, "Location coordinates are required"],
                validate: {
                    validator: (v) =>
                        Array.isArray(v) &&
                        v.length === 2 &&
                        v[0] >= -180 && v[0] <= 180 &&
                        v[1] >= -90 && v[1] <= 90,
                    message: "Invalid coordinates",
                },
            },
        },
        role: {
            type: String,
            enum: ["user", "admin"],
            default: "user",
        },
        isEmailVerified: {
            type: Boolean,
            default: false,
        },
        emailVerificationToken: {
            type: String,
            select: false,
        },
        emailVerificationTokenExpires: {
            type: Date,
            select: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        // wishlist: [
        //     {
        //         type: mongoose.Schema.Types.ObjectId,
        //         ref: "Listing",
        //     },
        // ],
        lastLogin: {
            type: Date,
        },
        loginAttempts: {
            type: Number,
            default: 0,
            select: false,
        },
        lockUntil: {
            type: Date,
            select: false,
        },
    },
    {
    timestamps: true, // adds createdAt and updatedAt
    }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
userSchema.index({ location: "2dsphere" }); // enables geo queries
userSchema.index({ emailVerificationToken: 1 });

// ── Pre-save: hash password ───────────────────────────────────────────────────
userSchema.pre("save", async function () {
    // Only hash if password was modified
    if (!this.isModified("password")) return;

    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
});

// ── Instance method: compare passwords ───────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// ── Instance method: check if account is locked ───────────────────────────────
userSchema.methods.isLocked = function () {
    return this.lockUntil && this.lockUntil > Date.now();
};

// ── Virtual: full name ────────────────────────────────────────────────────────
userSchema.virtual("fullName").get(function () {
    return `${this.firstName} ${this.lastName}`;
});

// ── toJSON: strip sensitive fields before sending to client ───────────────────
userSchema.methods.toSafeObject = function () {
    return {
        _id: this._id,
        firstName: this.firstName,
        lastName: this.lastName,
        fullName: this.fullName,
        email: this.email,
        phoneNumber: this.phoneNumber,
        address: this.address,
        location: this.location,
        role: this.role,
        isEmailVerified: this.isEmailVerified,
        isActive: this.isActive,
        // wishlist: Array.isArray(this.wishlist)
        //     ? this.wishlist.map((item) => item?._id?.toString?.() || item.toString())
        //     : [],
        lastLogin: this.lastLogin,
        createdAt: this.createdAt,
    };
};

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;