import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  Trophy,
  AlertTriangle,
  Ban,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  Store,
  Tag,
  Calendar,
  MessageSquare,
  Star,
  ArrowUpRight,
  Filter,
  ShoppingBag,
  MapPin,
  CreditCard,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useNotification } from "../components/hooks/useNotification.js";
import { API_BASE_URL } from "../config/api.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => `$${Number(n || 0).toLocaleString("en-US")}`;

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  requested: {
    label: "Pending",
    icon: Clock,
    badge: "bg-amber-100 text-amber-700",
    border: "border-amber-200",
    bg: "bg-amber-50",
    dot: "bg-amber-400",
    description: "Waiting for the seller to respond.",
  },
  accepted: {
    label: "Accepted",
    icon: CheckCircle2,
    badge: "bg-blue-100 text-blue-700",
    border: "border-blue-200",
    bg: "bg-blue-50",
    dot: "bg-blue-400",
    description: "Seller accepted. Coordinate via chat.",
  },
  rejected: {
    label: "Declined",
    icon: XCircle,
    badge: "bg-red-100 text-red-600",
    border: "border-red-200",
    bg: "bg-red-50",
    dot: "bg-red-400",
    description: "Seller declined this request.",
  },
  delivered: {
    label: "Delivered",
    icon: Truck,
    badge: "bg-purple-100 text-purple-700",
    border: "border-purple-200",
    bg: "bg-purple-50",
    dot: "bg-purple-400",
    description: "Seller marked as delivered — please confirm receipt.",
  },
  completed: {
    label: "Completed",
    icon: Trophy,
    badge: "bg-green-100 text-green-700",
    border: "border-green-200",
    bg: "bg-green-50",
    dot: "bg-green-400",
    description: "Order completed successfully.",
  },
  cancelled: {
    label: "Cancelled",
    icon: Ban,
    badge: "bg-gray-100 text-gray-500",
    border: "border-gray-200",
    bg: "bg-gray-50",
    dot: "bg-gray-400",
    description: "This order was cancelled.",
  },
  disputed: {
    label: "Disputed",
    icon: AlertTriangle,
    badge: "bg-orange-100 text-orange-700",
    border: "border-orange-200",
    bg: "bg-orange-50",
    dot: "bg-orange-400",
    description: "A dispute has been opened. Our team will review.",
  },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG);

// ── Star rating input ─────────────────────────────────────────────────────────
function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={`w-6 h-6 ${star <= (hovered || value) ? "fill-amber-400 text-amber-400" : "text-gray-300"}`}
          />
        </button>
      ))}
    </div>
  );
}

// ── Review modal ──────────────────────────────────────────────────────────────
function ReviewModal({ order, onClose, onSubmit, submitting }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-1">Leave a Review</h2>
        <p className="text-sm text-gray-500 mb-5">
          How was your experience with{" "}
          <span className="font-semibold text-gray-700">
            {order.snapshot?.sellerName}
          </span>{" "}
          for{" "}
          <span className="font-semibold text-gray-700">
            {order.snapshot?.title}
          </span>
          ?
        </p>
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Rating
          </label>
          <StarRating value={rating} onChange={setRating} />
        </div>
        <div className="mb-6">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Comment{" "}
            <span className="text-gray-300 normal-case font-normal">
              (optional)
            </span>
          </label>
          <textarea
            rows={3}
            placeholder="Share your experience…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none placeholder-gray-300"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(order._id, rating, comment)}
            disabled={rating < 1 || submitting}
            className="flex-1 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Star className="w-4 h-4" />
            )}
            Submit Review
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Dispute modal ─────────────────────────────────────────────────────────────
function DisputeModal({ order, onClose, onSubmit, submitting }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-1">Open a Dispute</h2>
        <p className="text-sm text-gray-500 mb-5">
          Describe the issue with your order for{" "}
          <span className="font-semibold text-gray-700">
            {order.snapshot?.title}
          </span>
          .
        </p>
        <div className="mb-6">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Reason <span className="text-red-400">*</span>
          </label>
          <textarea
            rows={4}
            placeholder="What went wrong? Be as specific as possible…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none placeholder-gray-300"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(order._id, reason)}
            disabled={!reason.trim() || submitting}
            className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            Open Dispute
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, colorClass }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
      <div className={`p-2.5 rounded-xl ${colorClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
      </div>
    </div>
  );
}

// ── Single order card ─────────────────────────────────────────────────────────
function OrderCard({ order, onDispute, onReview, onAction, actionLoadingId }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.requested;
  const Icon = cfg.icon;
  const isLoading = actionLoadingId === order._id;
  const isActive = ["requested", "accepted", "delivered"].includes(
    order.status,
  );

  return (
    <div
      className={`bg-white rounded-2xl border-2 ${cfg.border} overflow-hidden shadow-sm hover:shadow-md transition-shadow`}
    >
      {/* Status header */}
      <div className={`${cfg.bg} px-5 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.badge}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
          <span className="text-xs text-gray-400">
            #{order._id?.slice(-6).toUpperCase()}
          </span>
        </div>
        <span className="text-xs text-gray-400">
          {formatDate(order.createdAt)}
        </span>
      </div>

      <div className="p-5">
        <div className="flex gap-4">
          {/* Thumbnail */}
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
            {order.snapshot?.image ? (
              <img
                src={order.snapshot.image}
                alt={order.snapshot.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-7 h-7 text-gray-300" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-800 leading-tight truncate mb-1">
              {order.snapshot?.title || "Untitled"}
            </h3>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {order.snapshot?.listingType === "rent" ? (
                <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  <Calendar className="w-3 h-3" /> Rental
                  {order.rentalDays ? ` · ${order.rentalDays}d` : ""}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  <Tag className="w-3 h-3" /> For Sale
                </span>
              )}
              {order.quantity > 1 && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  ×{order.quantity}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Store className="w-3.5 h-3.5 text-gray-400" />
                {order.snapshot?.sellerName || "—"}
              </span>
              <span className="text-lg font-bold text-blue-600">
                {fmt(order.totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Status description */}
        <p className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
          {cfg.description}
        </p>

        {/* Existing review */}
        {order.review?.submittedAt && (
          <div className="mt-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <div className="flex items-center gap-1 mb-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-3.5 h-3.5 ${s <= order.review.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
                />
              ))}
              <span className="text-xs text-gray-400 ml-1">Your review</span>
            </div>
            {order.review.comment && (
              <p className="text-xs text-gray-600">{order.review.comment}</p>
            )}
          </div>
        )}

        {/* Cancellation / dispute note */}
        {order.cancellationReason && (
          <p className="text-xs text-gray-400 mt-2">
            Reason: {order.cancellationReason}
          </p>
        )}

        {/* Actions row */}
        <div className="mt-4 flex flex-wrap gap-2">
          {/* Chat button — always visible for active orders */}
          {isActive && (
            <Link
              to={`/chat/order/${order._id}`}
              className="flex-1 min-w-[120px] py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <MessageSquare className="w-4 h-4" /> Open Chat
            </Link>
          )}

          {/* Cancel — pending */}
          {order.status === "requested" && (
            <button
              onClick={() => onAction(order._id, "cancel")}
              disabled={isLoading}
              className="py-2.5 px-4 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Ban className="w-4 h-4" />
              )}
              Cancel
            </button>
          )}

          {/* Confirm receipt — delivered */}
          {order.status === "delivered" && (
            <>
              <button
                onClick={() => onAction(order._id, "complete")}
                disabled={isLoading}
                className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Confirm Receipt
              </button>
              <button
                onClick={() => onDispute(order)}
                disabled={isLoading}
                className="py-2.5 px-4 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-600 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                Problem?
              </button>
            </>
          )}

          {/* Review — completed, no review yet */}
          {order.status === "completed" && !order.review?.submittedAt && (
            <button
              onClick={() => onReview(order)}
              className="flex-1 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"
            >
              <Star className="w-4 h-4" /> Leave a Review
            </button>
          )}

          {/* View chat for non-active (read-only) */}
          {!isActive && (
            <Link
              to={`/chat/order/${order._id}`}
              className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors"
            >
              <MessageSquare className="w-4 h-4" /> View Chat
            </Link>
          )}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-gray-600 py-1 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" /> Less details
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" /> More details
            </>
          )}
        </button>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {order.deliveryMethod && (
              <div>
                <p className="text-xs text-gray-400">Delivery</p>
                <p className="font-medium text-gray-700 capitalize">
                  {order.deliveryMethod}
                </p>
              </div>
            )}
            {order.paymentMethod && (
              <div>
                <p className="text-xs text-gray-400">Payment</p>
                <p className="font-medium text-gray-700 capitalize">
                  {order.paymentMethod.replace(/_/g, " ")}
                </p>
              </div>
            )}
            {order.deliveryAddress && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400">Address</p>
                <p className="font-medium text-gray-700">
                  {order.deliveryAddress}
                </p>
              </div>
            )}
            {order.meetupLocation && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400">Meetup</p>
                <p className="font-medium text-gray-700">
                  {order.meetupLocation}
                </p>
              </div>
            )}
            {order.rentalStartDate && (
              <div>
                <p className="text-xs text-gray-400">Rental start</p>
                <p className="font-medium text-gray-700">
                  {formatDate(order.rentalStartDate)}
                </p>
              </div>
            )}
            {order.rentalEndDate && (
              <div>
                <p className="text-xs text-gray-400">Rental end</p>
                <p className="font-medium text-gray-700">
                  {formatDate(order.rentalEndDate)}
                </p>
              </div>
            )}
            {order.buyerNote && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400">Your note</p>
                <p className="font-medium text-gray-700">{order.buyerNote}</p>
              </div>
            )}
            {order.disputeReason && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400">Dispute reason</p>
                <p className="font-medium text-gray-700">
                  {order.disputeReason}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BuyerOrdersPage() {
  const { token } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [disputeTarget, setDisputeTarget] = useState(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/buyer`, {
        headers: authHeaders,
      });
      if (!res.ok) throw new Error("Failed to load orders");
      const data = await res.json();
      const list = Array.isArray(data.orders)
        ? data.orders
        : Array.isArray(data)
          ? data
          : [];
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setOrders(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Generic action — uses conversation-based endpoints so socket events fire
  const handleAction = async (orderId, action, body = {}) => {
    setActionLoadingId(orderId);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/conversations/order/${orderId}/${action}`,
        {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify(body),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, ...data.order } : o)),
      );
      const msgs = {
        complete: "Receipt confirmed! Order completed.",
        cancel: "Order cancelled.",
        dispute: "Dispute opened.",
      };
      showSuccess("Order Updated", msgs[action] || "Done.");
    } catch (err) {
      showError("Order Error", err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReviewSubmit = async (orderId, rating, comment) => {
    setReviewSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/conversations/order/${orderId}/review`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ rating, comment }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit review");
      setOrders((prev) =>
        prev.map((o) =>
          o._id === orderId ? { ...o, review: data.review } : o,
        ),
      );
      setReviewTarget(null);
      showSuccess("Review Submitted", "Thank you for your feedback!");
    } catch (err) {
      showError("Review Error", err.message);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleDisputeSubmit = async (orderId, reason) => {
    setDisputeSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/conversations/order/${orderId}/dispute`,
        {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({ reason }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, ...data.order } : o)),
      );
      setDisputeTarget(null);
      showSuccess("Dispute Opened", "Our team will review your case.");
    } catch (err) {
      showError("Dispute Error", err.message);
    } finally {
      setDisputeSubmitting(false);
    }
  };

  const counts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = orders.filter((o) => o.status === s).length;
    return acc;
  }, {});
  const filtered =
    activeFilter === "all"
      ? orders
      : orders.filter((o) => o.status === activeFilter);

  return (
    <div className="min-h-screen bg-gray-50">
      {reviewTarget && (
        <ReviewModal
          order={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSubmit={handleReviewSubmit}
          submitting={reviewSubmitting}
        />
      )}
      {disputeTarget && (
        <DisputeModal
          order={disputeTarget}
          onClose={() => setDisputeTarget(null)}
          onSubmit={handleDisputeSubmit}
          submitting={disputeSubmitting}
        />
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">My Orders</h1>
              <p className="text-sm text-gray-500">
                Track all your purchase requests
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/inbox"
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-sm font-semibold transition-colors"
            >
              <MessageSquare className="w-4 h-4" /> Inbox
            </Link>
            <button
              onClick={fetchOrders}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />{" "}
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Stats */}
        {!loading && !error && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Pending"
              value={counts.requested}
              icon={Clock}
              colorClass="bg-amber-100 text-amber-600"
            />
            <StatCard
              label="Active"
              value={counts.accepted + counts.delivered}
              icon={Package}
              colorClass="bg-blue-100 text-blue-600"
            />
            <StatCard
              label="Completed"
              value={counts.completed}
              icon={Trophy}
              colorClass="bg-green-100 text-green-600"
            />
            <StatCard
              label="Total"
              value={orders.length}
              icon={ShoppingBag}
              colorClass="bg-purple-100 text-purple-600"
            />
          </div>
        )}

        {/* Filter tabs */}
        {!loading && !error && orders.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-gray-400 mr-1" />
            <button
              onClick={() => setActiveFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeFilter === "all" ? "bg-gray-800 text-white" : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"}`}
            >
              All ({orders.length})
            </button>
            {ALL_STATUSES.filter((s) => counts[s] > 0).map((s) => {
              const cfg = STATUS_CONFIG[s];
              return (
                <button
                  key={s}
                  onClick={() => setActiveFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeFilter === s ? `${cfg.badge} border-2 ${cfg.border}` : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"}`}
                >
                  {cfg.label} ({counts[s]})
                </button>
              );
            })}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-400" />
            <p className="font-medium">Loading your orders…</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="text-center py-16">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-gray-700 mb-2">
              Couldn't load orders
            </h2>
            <p className="text-gray-500 mb-5 text-sm">{error}</p>
            <button
              onClick={fetchOrders}
              className="px-5 py-2.5 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors text-sm"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty — no orders */}
        {!loading && !error && orders.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-9 h-9 text-gray-300" />
            </div>
            <h2 className="text-xl font-bold text-gray-700 mb-2">
              No orders yet
            </h2>
            <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
              When you request an item from a seller, it'll show up here.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors text-sm"
            >
              Browse Listings <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Filtered empty */}
        {!loading && !error && orders.length > 0 && filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="font-medium">
              No {STATUS_CONFIG[activeFilter]?.label.toLowerCase()} orders.
            </p>
          </div>
        )}

        {/* Cards */}
        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((order) => (
              <OrderCard
                key={order._id}
                order={order}
                onAction={handleAction}
                onDispute={setDisputeTarget}
                onReview={setReviewTarget}
                actionLoadingId={actionLoadingId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
