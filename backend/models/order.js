import mongoose from "mongoose";

// ── Status history entry (audit log) ─────────────────────────────────────────
const statusEventSchema = new mongoose.Schema(
    {
        status: {
            type: String,
            enum: [
                "requested",
                "accepted",
                "rejected",
                "delivered",
                "completed",
                "cancelled",
                "disputed",
            ],
            required: true,
        },
        changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        note: { type: String, trim: true, maxlength: 500 },
        at: { type: Date, default: Date.now },
    },
    { _id: false }
);

// ── Main order schema ─────────────────────────────────────────────────────────
const orderSchema = new mongoose.Schema(
    {
        // ── Parties ──────────────────────────────────────────────────────────
        buyer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        seller: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        // ── Listing reference ─────────────────────────────────────────────────
        listing: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Listing",
            required: true,
            index: true,
        },

        snapshot: {
            title: { type: String, required: true },
            listingType: { type: String, enum: ["sell", "rent"], required: true },
            price: { type: Number },             // for sell
            rentPricePerDay: { type: Number },   // for rent
            image: { type: String },             // first image URL
            category: { type: String },
            condition: { type: String },
            sellerName: { type: String },
            buyerName: { type: String },
        },

        // ── Order details ─────────────────────────────────────────────────────
        quantity: {
            type: Number,
            default: 1,
            min: [1, "Quantity must be at least 1"],
        },

        // Rental-specific
        rentalDays: {
            type: Number,
            min: 1,
        },
        rentalStartDate: { type: Date },
        rentalEndDate: { type: Date },

        // ── Pricing (locked at order time) ────────────────────────────────────
        agreedPrice: {
            type: Number,
            min: 0,
        },
        // Total = agreedPrice × quantity   (or rentPricePerDay × rentalDays × qty)
        totalAmount: {
            type: Number,
            min: 0,
        },

        // ── Payment ───────────────────────────────────────────────────────────
        paymentMethod: {
            type: String,
            enum: ["cod", "mobile_banking", "bank_transfer", "cash_pickup"],
            // Currently only cash and delivery are supported. Other methods are a work in progress.
        },

        // ── Delivery / meetup ─────────────────────────────────────────────────
        deliveryMethod: {
            type: String,
            enum: ["delivery", "pickup"],
        },
        deliveryAddress: { type: String, trim: true },
        meetupLocation: { type: String, trim: true },

        // ── Buyer's initial message ───────────────────────────────────────────
        buyerNote: {
            type: String,
            trim: true,
            maxlength: 1000,
        },

        // ── Seller's response note ────────────────────────────────────────────
        sellerNote: {
            type: String,
            trim: true,
            maxlength: 1000,
        },

// ── Status ────────────────────────────────────────────────────────────
        status: {
            type: String,
            enum: [
                "requested",   // buyer sent request
                "accepted",    // seller agreed
                "rejected",    // seller declined
                "delivered",   // seller marked as delivered
                "completed",   // buyer confirmed receipt
                "cancelled",   // cancelled by either party
                "disputed",    // dispute opened
            ],
            default: "requested",
            index: true,
        },

        // Tracks which party cancelled/disputed (for analytics & dispute management)
        cancelledBy: {
            type: String,
            enum: ["buyer", "seller", "system"],
        },
        cancellationReason: { type: String, trim: true, maxlength: 500 },

        // ── Dispute details ───────────────────────────────────────────────────
        disputeReason: { type: String, trim: true, maxlength: 1000 },
        disputeOpenedBy: {
            type: String,
            enum: ["buyer", "seller"],
        },
        disputeResolvedAt: { type: Date },

        // ── Review (written after completion) ─────────────────────────────────
        review: {
            rating: { type: Number, min: 1, max: 5 },
            comment: { type: String, trim: true, maxlength: 1000 },
            submittedAt: { type: Date },
        },

        // ── Full audit trail ──────────────────────────────────────────────────
        statusHistory: [statusEventSchema],
    },
    { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Compound indexes for the two most common dashboard queries
orderSchema.index({ buyer: 1, status: 1, createdAt: -1 });
orderSchema.index({ seller: 1, status: 1, createdAt: -1 });


export default mongoose.model("Order", orderSchema);