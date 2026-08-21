import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ShoppingBag,
  MapPin,
  Truck,
  HandshakeIcon,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  CreditCard,
  Tag,
  Calendar,
  Package,
  Store,
  Loader2,
  Info,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useNotification } from "../components/hooks/useNotification.js";
import { API_BASE_URL } from "../config/api.js";

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => `$${Number(n).toLocaleString("en-US")}`;

function itemSubtotal(item) {
  if (item.listingType === "rent") {
    return (
      (item.rentPricePerDay || 0) *
      (item.rentalDays || 1) *
      (item.quantity || 1)
    );
  }
  return (item.price || 0) * (item.quantity || 1);
}

function itemPriceLabel(item) {
  if (item.listingType === "rent") {
    return `${fmt(item.rentPricePerDay)}/day × ${item.rentalDays || 1}d × ${item.quantity}`;
  }
  return `${fmt(item.price)} × ${item.quantity}`;
}

const PAYMENT_OPTIONS = [
  { value: "cod", label: "Cash on Delivery" },
  //{ value: "mobile_banking", label: "Mobile Banking (bKash / Nagad)" },
  //{ value: "bank_transfer", label: "Bank Transfer" },
  //{ value: "cash_pickup", label: "Cash on Pickup" },
];

const DELIVERY_OPTIONS = [
  { value: "delivery", label: "Home Delivery", icon: Truck },
  { value: "pickup", label: "Meet & Pickup", icon: HandshakeIcon },
];

// ── per-item form state ───────────────────────────────────────────────────────
function defaultItemForm() {
  return {
    paymentMethod: "cod",
    deliveryMethod: "delivery",
    deliveryAddress: "",
    meetupLocation: "",
    buyerNote: "",
  };
}

// ── StatusBanner shown after placing orders ───────────────────────────────────
function StatusBanner({ results }) {
  const success = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
        <CheckCircle2 className="w-10 h-10 text-green-500" />
      </div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">
        {failed.length === 0 ? "All requests sent!" : "Some requests sent"}
      </h1>
      <p className="text-gray-500 mb-8 leading-relaxed">
        {success.length > 0 && (
          <>
            <span className="font-semibold text-green-600">
              {success.length}
            </span>{" "}
            order
            {success.length > 1 ? "s" : ""} sent to{" "}
            {success.length > 1 ? "sellers" : "seller"}.{" "}
          </>
        )}
        The seller will review your request and get back to you via chat.
        {failed.length > 0 && (
          <span className="block mt-2 text-red-500">
            {failed.length} item{failed.length > 1 ? "s" : ""} failed:{" "}
            {failed.map((r) => r.title).join(", ")}.
          </span>
        )}
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8 text-left">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            This marketplace works through direct chat. Once the seller accepts,
            you'll coordinate payment and delivery details with them in the
            chat.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to="/my-orders"
          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition-all shadow-md"
        >
          View My Orders
        </Link>
        <Link
          to="/"
          className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
        >
          Continue Browsing
        </Link>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CheckoutPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();

  const [cartItems, setCartItems] = useState([]);
  const [loadingCart, setLoadingCart] = useState(true);
  const [cartError, setCartError] = useState(null);

  // Per-item form data: { [itemId]: { paymentMethod, deliveryMethod, ... } }
  const [forms, setForms] = useState({});

  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null); // null = not yet submitted

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // ── Load cart ───────────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadCart() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/cart`, {
          headers: authHeaders,
        });
        if (!res.ok) throw new Error("Failed to load cart");
        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items : [];
        setCartItems(items);
        // Seed form state per item
        const initial = {};
        items.forEach((item) => {
          initial[item._id] = defaultItemForm();
        });
        setForms(initial);
      } catch (err) {
        setCartError(err.message);
      } finally {
        setLoadingCart(false);
      }
    }
    loadCart();
  }, []);

  // ── Form helpers ────────────────────────────────────────────────────────────
  const setField = (itemId, field, value) => {
    setForms((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  };

  // ── Computed totals ─────────────────────────────────────────────────────────
  const grandTotal = cartItems.reduce(
    (sum, item) => sum + itemSubtotal(item),
    0,
  );

  // Group items by seller for display
  const bySeller = cartItems.reduce((acc, item) => {
    const key = item.sellerName || item.seller || "Unknown Seller";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  // ── Submit all items ────────────────────────────────────────────────────────
  const handlePlaceOrders = async () => {
    setSubmitting(true);
    const outcomes = [];

    for (const item of cartItems) {
      const form = forms[item._id] || defaultItemForm();
      try {
        const body = {
          listingId: item.listing || item.listingId || item._id,
          buyerNote: form.buyerNote,
          paymentMethod: form.paymentMethod,
          deliveryMethod: form.deliveryMethod,
          deliveryAddress: form.deliveryAddress,
          meetupLocation: form.meetupLocation,
        };

        const res = await fetch(`${API_BASE_URL}/api/orders/from-cart`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(body),
        });

        const data = await res.json();
        outcomes.push({ ok: res.ok, title: item.title, data });
      } catch (err) {
        outcomes.push({ ok: false, title: item.title, error: err.message });
      }
    }

    const failed = outcomes.filter((r) => !r.ok);
    if (failed.length === 0) {
      showSuccess(
        "All Requests Sent! 🎉",
        `Sent ${outcomes.length} order request(s) to sellers.`,
      );
    } else if (failed.length < outcomes.length) {
      showSuccess(
        "Partial Requests Sent",
        `${outcomes.length - failed.length} request(s) sent, ${failed.length} failed.`,
      );
    } else {
      showError(
        "Order Submission Failed",
        "Could not send order requests. Please try again.",
      );
    }

    setResults(outcomes);
    setSubmitting(false);
  };

  // ── Render: loading ─────────────────────────────────────────────────────────
  if (loadingCart) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="font-medium">Loading your cart…</p>
        </div>
      </div>
    );
  }

  // ── Render: error ───────────────────────────────────────────────────────────
  if (cartError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-700 mb-2">
            Couldn't load your cart
          </h2>
          <p className="text-gray-500 mb-6">{cartError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Render: empty cart ──────────────────────────────────────────────────────
  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-700 mb-2">
            Your cart is empty
          </h2>
          <p className="text-gray-500 mb-6">
            Add some items before checking out.
          </p>
          <Link
            to="/"
            className="px-5 py-2.5 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
          >
            Browse Listings
          </Link>
        </div>
      </div>
    );
  }

  // ── Render: success ─────────────────────────────────────────────────────────
  if (results) {
    return (
      <div className="min-h-screen bg-gray-50">
        <StatusBanner results={results} />
      </div>
    );
  }

  // ── Render: main checkout ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-800">Checkout</h1>
            <p className="text-xs text-gray-500">
              {cartItems.length} item{cartItems.length > 1 ? "s" : ""} in cart
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: items ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-700 mb-0.5">
                How this works
              </p>
              <p className="text-sm text-blue-600 leading-relaxed">
                Sending a request notifies the seller. You'll finalize payment
                and delivery details with them directly via chat once they
                accept.
              </p>
            </div>
          </div>

          {/* Items grouped by seller */}
          {Object.entries(bySeller).map(([sellerName, sellerItems]) => (
            <div
              key={sellerName}
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm"
            >
              {/* Seller header */}
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                <Store className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-600">
                  {sellerName}
                </span>
              </div>

              {sellerItems.map((item, idx) => {
                const form = forms[item._id] || defaultItemForm();
                const isLast = idx === sellerItems.length - 1;

                return (
                  <div
                    key={item._id}
                    className={`${!isLast ? "border-b border-gray-100" : ""}`}
                  >
                    {/* Item row */}
                    <div className="p-5 flex gap-4">
                      {/* Thumbnail */}
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-8 h-8 text-gray-300" />
                          </div>
                        )}
                      </div>

                      {/* Item info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-semibold text-gray-800 leading-tight truncate">
                            {item.title}
                          </h3>
                          <span className="text-sm font-bold text-blue-600 flex-shrink-0">
                            {fmt(itemSubtotal(item))}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          {item.listingType === "rent" ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                              <Calendar className="w-3 h-3" /> Rental
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                              <Tag className="w-3 h-3" /> For Sale
                            </span>
                          )}
                          {item.condition && (
                            <span className="text-xs text-gray-400 capitalize">
                              {item.condition}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-gray-400 mt-1">
                          {itemPriceLabel(item)}
                        </p>
                      </div>
                    </div>

                    {/* Per-item form */}
                    <div className="px-5 pb-5 space-y-4">
                      {/* Delivery method */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          How would you like to receive this?
                        </label>
                        <div className="flex gap-3">
                          {DELIVERY_OPTIONS.map(
                            ({ value, label, icon: Icon }) => (
                              <button
                                key={value}
                                onClick={() =>
                                  setField(item._id, "deliveryMethod", value)
                                }
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                                  form.deliveryMethod === value
                                    ? "border-blue-500 bg-blue-50 text-blue-700"
                                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                                }`}
                              >
                                <Icon className="w-4 h-4" />
                                {label}
                              </button>
                            ),
                          )}
                        </div>
                      </div>

                      {/* Delivery address or meetup */}
                      {form.deliveryMethod === "delivery" ? (
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                            Delivery Address
                          </label>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Your full delivery address"
                              value={form.deliveryAddress}
                              onChange={(e) =>
                                setField(
                                  item._id,
                                  "deliveryAddress",
                                  e.target.value,
                                )
                              }
                              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all placeholder-gray-300"
                            />
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                            Preferred Meetup Spot
                          </label>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              placeholder="e.g. Bashundhara City, Gate 2"
                              value={form.meetupLocation}
                              onChange={(e) =>
                                setField(
                                  item._id,
                                  "meetupLocation",
                                  e.target.value,
                                )
                              }
                              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all placeholder-gray-300"
                            />
                          </div>
                        </div>
                      )}

                      {/* Payment method */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                          Preferred Payment
                        </label>
                        <select
                          value={form.paymentMethod}
                          onChange={(e) =>
                            setField(item._id, "paymentMethod", e.target.value)
                          }
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all bg-white text-gray-700"
                        >
                          {PAYMENT_OPTIONS.map(({ value, label }) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Buyer note */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                          Note to Seller{" "}
                          <span className="text-gray-300 normal-case font-normal">
                            (optional)
                          </span>
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Any questions, preferred schedule, or special requests…"
                          value={form.buyerNote}
                          onChange={(e) =>
                            setField(item._id, "buyerNote", e.target.value)
                          }
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all placeholder-gray-300 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* ── Right: order summary ── */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm sticky top-24">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-800 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-500" />
                Order Summary
              </h2>
            </div>

            <div className="p-5 space-y-3">
              {cartItems.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center justify-between text-sm gap-2"
                >
                  <span className="text-gray-500 truncate leading-tight">
                    {item.title}
                  </span>
                  <span className="font-semibold text-gray-700 flex-shrink-0">
                    {fmt(itemSubtotal(item))}
                  </span>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-gray-100">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-600">
                  Estimated Total
                </span>
                <span className="text-xl font-bold text-blue-600">
                  {fmt(grandTotal)}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Final amounts confirmed with each seller via chat.
              </p>
            </div>

            <div className="px-5 pb-5">
              <button
                onClick={handlePlaceOrders}
                disabled={submitting}
                className="w-full py-3.5 bg-gradient-to-r from-blue-500 via-purple-600 to-pink-500 hover:from-blue-600 hover:via-purple-700 hover:to-pink-600 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-bold text-base transition-all shadow-md flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending Requests…
                  </>
                ) : (
                  <>
                    Send {cartItems.length} Request
                    {cartItems.length > 1 ? "s" : ""}
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <p className="text-xs text-gray-400 text-center mt-3 leading-relaxed">
                No payment is taken now. You'll coordinate with the seller in
                chat.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
