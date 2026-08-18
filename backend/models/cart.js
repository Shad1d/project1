import mongoose from "mongoose";

/**
 * Cart
 * ────
 * One cart document per user. Items reference Listing documents
 * and snapshot the key display fields at the time of adding so
 * the cart renders even if a listing is later edited.
 *
 * Cart is ephemeral — it is cleared once the buyer places an order.
 */

const cartItemSchema = new mongoose.Schema(
    {
        listing: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Listing",
            required: true,
        },

        // ── Snapshot fields (for display without re-fetching the listing) ──────
        title: { type: String, required: true },
        listingType: { type: String, enum: ["sell", "rent"], required: true },
        price: { type: Number },              // sell price
        rentPricePerDay: { type: Number },    // rent price
        image: { type: String, default: "" }, // first image URL (resolved)
        condition: { type: String },
        sellerName: { type: String },         // seller's full name

        // ── Buyer's intent ────────────────────────────────────────────────────
        quantity: {
            type: Number,
            default: 1,
            min: [1, "Quantity must be at least 1"],
        },

        // For rental items: how many days the buyer wants to rent
        rentalDays: {
            type: Number,
            min: [1, "Rental period must be at least 1 day"],
        },
    },
    { _id: true, timestamps: false }
);

const cartSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true, // one cart per user
            index: true,
        },
        items: [cartItemSchema],
    },
    { timestamps: true }
);

// ── Virtual: total estimated cost ─────────────────────────────────────────────
cartSchema.virtual("estimatedTotal").get(function () {
    return this.items.reduce((sum, item) => {
        if (item.listingType === "rent") {
            return sum + (item.rentPricePerDay ?? 0) * (item.rentalDays ?? 1) * item.quantity;
        }
        return sum + (item.price ?? 0) * item.quantity;
    }, 0);
});

export default mongoose.model("Cart", cartSchema);