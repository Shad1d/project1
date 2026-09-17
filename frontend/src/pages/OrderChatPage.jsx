import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { io } from "socket.io-client";
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  XCircle,
  Truck,
  Trophy,
  Clock,
  Ban,
  AlertTriangle,
  Package,
  Star,
  ChevronDown,
  ChevronUp,
  Store,
  User,
  Tag,
  Calendar,
  MapPin,
  CreditCard,
  Loader2,
  MessageSquare,
  Circle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useNotification } from "../components/hooks/useNotification.js";
import { API_BASE_URL, SOCKET_URL } from "../config/api.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => `৳${Number(n || 0).toLocaleString("en-BD")}`;

function formatTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-BD", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function formatDateLabel(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Order stage definitions ───────────────────────────────────────────────────
const STAGES = [
  { key: "requested", label: "Request Sent", icon: Clock },
  { key: "accepted", label: "Accepted", icon: CheckCircle2 },
  { key: "delivered", label: "Delivered", icon: Truck },
  { key: "completed", label: "Completed", icon: Trophy },
];

const STATUS_META = {
  requested: {
    color: "amber",
    label: "Pending",
    description: "Waiting for seller to respond.",
  },
  accepted: {
    color: "blue",
    label: "Accepted",
    description: "Coordinate via chat.",
  },
  rejected: {
    color: "red",
    label: "Declined",
    description: "Seller declined this request.",
  },
  delivered: {
    color: "purple",
    label: "Delivered",
    description: "Confirm receipt when you have the item.",
  },
  completed: {
    color: "green",
    label: "Completed",
    description: "Order successfully completed.",
  },
  cancelled: {
    color: "gray",
    label: "Cancelled",
    description: "This order was cancelled.",
  },
  disputed: {
    color: "orange",
    label: "Disputed",
    description: "Dispute opened — our team will review.",
  },
};

const TERMINAL = ["rejected", "completed", "cancelled", "disputed"];

// ── Star rating ───────────────────────────────────────────────────────────────
function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          onMouseEnter={() => setHovered(s)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={`w-6 h-6 ${
              s <= (hovered || value)
                ? "fill-amber-400 text-amber-400"
                : "text-gray-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// ── Order tracker panel ───────────────────────────────────────────────────────
function OrderTracker({ order, role, onAction, actionLoading }) {
  const [showDetails, setShowDetails] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  if (!order) return null;

  const meta = STATUS_META[order.status] || STATUS_META.requested;
  const isTerminal = TERMINAL.includes(order.status);
  const isBuyer = role === "buyer";
  const isSeller = role === "seller";

  // Which stage index is active?
  const terminalBranch = ["rejected", "cancelled", "disputed"].includes(
    order.status,
  );
  const activeIdx = terminalBranch
    ? 0
    : STAGES.findIndex((s) => s.key === order.status);
  const displayStages = terminalBranch ? null : STAGES;

  const colorMap = {
    amber: { badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
    blue: { badge: "bg-blue-100 text-blue-700", dot: "bg-blue-400" },
    red: { badge: "bg-red-100 text-red-600", dot: "bg-red-400" },
    purple: { badge: "bg-purple-100 text-purple-700", dot: "bg-purple-400" },
    green: { badge: "bg-green-100 text-green-700", dot: "bg-green-400" },
    gray: { badge: "bg-gray-100 text-gray-500", dot: "bg-gray-400" },
    orange: { badge: "bg-orange-100 text-orange-700", dot: "bg-orange-400" },
  };
  const clr = colorMap[meta.color] || colorMap.gray;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Listing snapshot */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex gap-3">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
            {order.snapshot?.image ? (
              <img
                src={order.snapshot.image}
                alt={order.snapshot.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-6 h-6 text-gray-300" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-800 text-sm leading-tight truncate">
              {order.snapshot?.title}
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${clr.badge}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${clr.dot}`} />
                {meta.label}
              </span>
              {order.snapshot?.listingType === "rent" ? (
                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                  Rental
                </span>
              ) : (
                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                  Sale
                </span>
              )}
            </div>
            <p className="text-base font-bold text-blue-600 mt-1">
              {fmt(order.totalAmount)}
            </p>
          </div>
        </div>
      </div>

      {/* Parties */}
      <div className="px-4 py-3 border-b border-gray-100 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-gray-400 mb-0.5 flex items-center gap-1">
            <User className="w-3 h-3" /> Buyer
          </p>
          <p className="font-semibold text-gray-700">
            {order.snapshot?.buyerName || "—"}
          </p>
        </div>
        <div>
          <p className="text-gray-400 mb-0.5 flex items-center gap-1">
            <Store className="w-3 h-3" /> Seller
          </p>
          <p className="font-semibold text-gray-700">
            {order.snapshot?.sellerName || "—"}
          </p>
        </div>
      </div>

      {/* Progress tracker (not shown for terminal branch) */}
      {displayStages && (
        <div className="px-4 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Order Progress
          </p>
          <div className="relative">
            {displayStages.map((stage, idx) => {
              const StageIcon = stage.icon;
              const done = idx <= activeIdx;
              const current = idx === activeIdx;
              return (
                <div
                  key={stage.key}
                  className="flex items-start gap-3 relative"
                >
                  {/* Connector line */}
                  {idx < displayStages.length - 1 && (
                    <div
                      className={`absolute left-[15px] top-8 w-0.5 h-6 ${done ? "bg-blue-400" : "bg-gray-200"}`}
                    />
                  )}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                      current
                        ? "bg-blue-500 text-white ring-4 ring-blue-100"
                        : done
                          ? "bg-blue-400 text-white"
                          : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    <StageIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="pb-6">
                    <p
                      className={`text-sm font-semibold ${current ? "text-blue-600" : done ? "text-gray-700" : "text-gray-400"}`}
                    >
                      {stage.label}
                    </p>
                    {current && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {meta.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Terminal status banner */}
      {terminalBranch && (
        <div
          className={`mx-4 my-3 p-3 rounded-xl border text-sm ${
            order.status === "rejected"
              ? "bg-red-50 border-red-200 text-red-700"
              : order.status === "cancelled"
                ? "bg-gray-50 border-gray-200 text-gray-600"
                : "bg-orange-50 border-orange-200 text-orange-700"
          }`}
        >
          <p className="font-semibold mb-0.5">{meta.label}</p>
          <p className="text-xs opacity-80">{meta.description}</p>
          {order.cancellationReason && (
            <p className="text-xs mt-1 opacity-70">
              Reason: {order.cancellationReason}
            </p>
          )}
          {order.disputeReason && (
            <p className="text-xs mt-1 opacity-70">
              Reason: {order.disputeReason}
            </p>
          )}
        </div>
      )}

      {/* Order details accordion */}
      <div className="px-4 py-2 border-b border-gray-100">
        <button
          onClick={() => setShowDetails((v) => !v)}
          className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 py-1"
        >
          Order Details
          {showDetails ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
        {showDetails && (
          <div className="mt-2 space-y-2 pb-2">
            {order.deliveryMethod && (
              <div className="flex items-center gap-2 text-xs">
                <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-gray-500">Delivery:</span>
                <span className="font-medium text-gray-700 capitalize">
                  {order.deliveryMethod}
                </span>
              </div>
            )}
            {order.deliveryAddress && (
              <div className="flex items-start gap-2 text-xs">
                <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                <span className="font-medium text-gray-700">
                  {order.deliveryAddress}
                </span>
              </div>
            )}
            {order.meetupLocation && (
              <div className="flex items-start gap-2 text-xs">
                <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                <span className="text-gray-500">Meetup:</span>
                <span className="font-medium text-gray-700">
                  {order.meetupLocation}
                </span>
              </div>
            )}
            {order.paymentMethod && (
              <div className="flex items-center gap-2 text-xs">
                <CreditCard className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-gray-500">Payment:</span>
                <span className="font-medium text-gray-700 capitalize">
                  {order.paymentMethod.replace(/_/g, " ")}
                </span>
              </div>
            )}
            {order.rentalDays && (
              <div className="flex items-center gap-2 text-xs">
                <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-gray-500">Rental:</span>
                <span className="font-medium text-gray-700">
                  {order.rentalDays} days ({formatDate(order.rentalStartDate)} →{" "}
                  {formatDate(order.rentalEndDate)})
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs">
              <Tag className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="text-gray-500">Total:</span>
              <span className="font-bold text-blue-600">
                {fmt(order.totalAmount)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="text-gray-500">Placed:</span>
              <span className="font-medium text-gray-700">
                {formatDate(order.createdAt)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="p-4 space-y-2 flex-1">
        {/* SELLER actions */}
        {isSeller && order.status === "requested" && (
          <>
            <button
              onClick={() => onAction("accept")}
              disabled={actionLoading}
              className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Accept Order
            </button>
            <button
              onClick={() => setShowCancelForm((v) => !v)}
              disabled={actionLoading}
              className="w-full py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <XCircle className="w-4 h-4" /> Decline Order
            </button>
          </>
        )}
        {isSeller && order.status === "accepted" && (
          <button
            onClick={() => onAction("deliver")}
            disabled={actionLoading}
            className="w-full py-2.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {actionLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Truck className="w-4 h-4" />
            )}
            Mark as Delivered
          </button>
        )}

        {/* BUYER actions */}
        {isBuyer && order.status === "requested" && (
          <button
            onClick={() => setShowCancelForm((v) => !v)}
            disabled={actionLoading}
            className="w-full py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Ban className="w-4 h-4" /> Cancel Request
          </button>
        )}
        {isBuyer && order.status === "accepted" && (
          <button
            onClick={() => setShowCancelForm((v) => !v)}
            disabled={actionLoading}
            className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Ban className="w-4 h-4" /> Cancel Order
          </button>
        )}
        {isBuyer && order.status === "delivered" && (
          <>
            <button
              onClick={() => onAction("complete")}
              disabled={actionLoading}
              className="w-full py-2.5 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Confirm Receipt
            </button>
            <button
              onClick={() => setShowDisputeForm((v) => !v)}
              disabled={actionLoading}
              className="w-full py-2.5 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-600 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <AlertTriangle className="w-4 h-4" /> Report a Problem
            </button>
          </>
        )}
        {isBuyer &&
          order.status === "completed" &&
          !order.review?.submittedAt && (
            <button
              onClick={() => setShowReviewForm((v) => !v)}
              className="w-full py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Star className="w-4 h-4" /> Leave a Review
            </button>
          )}
        {isBuyer &&
          order.status === "completed" &&
          order.review?.submittedAt && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <div className="flex items-center gap-1 mb-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-4 h-4 ${s <= order.review.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
                  />
                ))}
              </div>
              {order.review.comment && (
                <p className="text-xs text-gray-600">
                  "{order.review.comment}"
                </p>
              )}
            </div>
          )}

        {/* Inline cancel form */}
        {showCancelForm && (
          <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-600">
              {isSeller && order.status === "requested"
                ? "Decline reason (optional)"
                : "Cancellation reason (optional)"}
            </p>
            <textarea
              rows={2}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Let the other party know why…"
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-200 resize-none placeholder-gray-300"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelForm(false)}
                className="flex-1 py-2 text-xs bg-white border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-100 transition-colors font-semibold"
              >
                Back
              </button>
              <button
                onClick={() => {
                  const action =
                    isSeller && order.status === "requested"
                      ? "reject"
                      : "cancel";
                  onAction(action, { reason: cancelReason });
                  setShowCancelForm(false);
                }}
                disabled={actionLoading}
                className="flex-1 py-2 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-semibold disabled:opacity-60"
              >
                Confirm
              </button>
            </div>
          </div>
        )}

        {/* Inline dispute form */}
        {showDisputeForm && (
          <div className="mt-2 bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-orange-700">
              Describe the issue
            </p>
            <textarea
              rows={3}
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="What went wrong? Be as specific as possible…"
              className="w-full px-3 py-2 text-xs border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 resize-none placeholder-orange-200"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowDisputeForm(false)}
                className="flex-1 py-2 text-xs bg-white border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-100 transition-colors font-semibold"
              >
                Back
              </button>
              <button
                onClick={() => {
                  onAction("dispute", { reason: disputeReason });
                  setShowDisputeForm(false);
                }}
                disabled={!disputeReason.trim() || actionLoading}
                className="flex-1 py-2 text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-lg transition-colors font-semibold"
              >
                Open Dispute
              </button>
            </div>
          </div>
        )}

        {/* Inline review form */}
        {showReviewForm && (
          <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-amber-700">Your rating</p>
            <StarPicker value={reviewRating} onChange={setReviewRating} />
            <textarea
              rows={2}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Share your experience (optional)…"
              className="w-full px-3 py-2 text-xs border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200 resize-none placeholder-amber-200"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowReviewForm(false)}
                className="flex-1 py-2 text-xs bg-white border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-100 transition-colors font-semibold"
              >
                Back
              </button>
              <button
                onClick={() => {
                  onAction("review", {
                    rating: reviewRating,
                    comment: reviewComment,
                  });
                  setShowReviewForm(false);
                }}
                disabled={reviewRating < 1 || actionLoading}
                className="flex-1 py-2 text-xs bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-lg transition-colors font-semibold"
              >
                Submit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ message, isOwn }) {
  if (message.senderRole === "system") {
    return (
      <div className="flex justify-center my-3">
        <div className="max-w-xs text-center px-4 py-2 bg-gray-100 border border-gray-200 rounded-2xl text-xs text-gray-500 leading-relaxed">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-2`}>
      <div
        className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
          isOwn
            ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-sm"
            : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm"
        }`}
      >
        <p>{message.text}</p>
        <p
          className={`text-[10px] mt-1 ${isOwn ? "text-blue-200 text-right" : "text-gray-400"}`}
        >
          {formatTime(message.createdAt)}
          {isOwn && message.readBy?.length > 1 && (
            <span className="ml-1">· Seen</span>
          )}
        </p>
      </div>
    </div>
  );
}

// ── Date separator ────────────────────────────────────────────────────────────
function DateSeparator({ date }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-gray-100" />
      <span className="text-xs text-gray-400 font-medium">
        {formatDateLabel(date)}
      </span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OrderChatPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { showSuccess, showError } = useNotification();

  const [conversation, setConversation] = useState(null);
  const [order, setOrder] = useState(null);
  const [role, setRole] = useState(null); // "buyer" | "seller"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [otherTyping, setOtherTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [showTracker, setShowTracker] = useState(true);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);
  const inputRef = useRef(null);

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Fetch conversation ──────────────────────────────────────────────────────
  const fetchConversation = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/conversations/order/${orderId}`,
        {
          headers: authHeaders,
        },
      );
      if (!res.ok) throw new Error("Could not load conversation.");
      const data = await res.json();
      setConversation(data.conversation);
      setOrder(data.conversation.order);
      setRole(data.role);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [orderId, authHeaders]);

  useEffect(() => {
    fetchConversation();
  }, [fetchConversation]);

  // ── Scroll to bottom ────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages?.length, otherTyping]);

  // ── Socket.IO ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !orderId) return;

    const socket = io(SOCKET_URL || API_BASE_URL, {
      auth: { token },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.emit("join_order", { orderId });

    socket.on("new_message", ({ message }) => {
      setConversation((prev) => {
        if (!prev) return prev;
        // Deduplicate by persisted ID.
        if (prev.messages.some((m) => m._id === message._id)) return prev;

        // If a pending optimistic message matches the incoming one, replace it.
        const pendingMatch = prev.messages.find(
          (m) =>
            m._id?.startsWith("temp-") &&
            m.text === message.text &&
            (m.sender?._id?.toString() || m.sender?.toString()) ===
              user?._id?.toString(),
        );

        if (pendingMatch) {
          return {
            ...prev,
            messages: prev.messages.map((m) =>
              m._id === pendingMatch._id ? message : m,
            ),
          };
        }

        return { ...prev, messages: [...prev.messages, message] };
      });
    });

    socket.on("order_update", ({ status, order: updatedOrder }) => {
      setOrder((prev) => ({ ...prev, ...updatedOrder, status }));
      setConversation((prev) =>
        prev ? { ...prev, orderStatus: status } : prev,
      );
    });

    socket.on("typing_start", () => setOtherTyping(true));
    socket.on("typing_stop", () => setOtherTyping(false));
    socket.on("user_online", () => setOtherOnline(true));
    socket.on("user_offline", () => setOtherOnline(false));

    return () => {
      socket.emit("leave_order", { orderId });
      socket.disconnect();
    };
  }, [token, orderId, user]);

  // ── Typing indicator ────────────────────────────────────────────────────────
  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (socketRef.current) {
      socketRef.current.emit("typing_start", { orderId });
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        socketRef.current?.emit("typing_stop", { orderId });
      }, 1500);
    }
  };

  // ── Send message ────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const tempMsg = {
      _id: tempId,
      sender: user?._id,
      senderRole: role,
      type: "text",
      text,
      createdAt: new Date().toISOString(),
      readBy: [user?._id],
    };
    setConversation((prev) => ({
      ...prev,
      messages: [...(prev?.messages || []), tempMsg],
    }));
    setInputText("");
    setSending(true);
    socketRef.current?.emit("typing_stop", { orderId });

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/conversations/order/${orderId}/messages`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ text }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send.");

      // Replace temp with real message
      setConversation((prev) => {
        if (!prev) return prev;
        const alreadyHasMessage = prev.messages.some(
          (m) => m._id === data.message._id,
        );
        if (alreadyHasMessage) {
          return {
            ...prev,
            messages: prev.messages.filter((m) => m._id !== tempId),
          };
        }
        return {
          ...prev,
          messages: prev.messages.map((m) =>
            m._id === tempId ? data.message : m,
          ),
        };
      });
    } catch (err) {
      // Remove temp message on failure
      setConversation((prev) => ({
        ...prev,
        messages: prev.messages.filter((m) => m._id !== tempId),
      }));
      showError("Chat Error", err.message);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // ── Order actions ───────────────────────────────────────────────────────────
  const handleAction = async (action, body = {}) => {
    setActionLoading(true);
    try {
      if (action === "review") {
        const res = await fetch(
          `${API_BASE_URL}/api/conversations/order/${orderId}/review`,
          {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify(body),
          },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to submit review.");
        setOrder((prev) => ({ ...prev, review: data.review }));
        showSuccess("Review Submitted", "Thank you for your feedback!");
      } else {
        const res = await fetch(
          `${API_BASE_URL}/api/conversations/order/${orderId}/${action}`,
          {
            method: "PATCH",
            headers: authHeaders,
            body: JSON.stringify(body),
          },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Action failed.");
        setOrder((prev) => ({ ...prev, ...data.order }));
        const successMessages = {
          accept: "Order accepted! Start coordinating via chat.",
          reject: "Order declined.",
          cancel: "Order cancelled.",
          deliver: "Marked as delivered. Waiting for buyer confirmation.",
          complete: "Receipt confirmed! Order completed.",
          dispute: "Dispute opened. Our team will review it.",
        };
        showSuccess("Order Updated", successMessages[action] || "Done.");
      }
    } catch (err) {
      showError("Order Action Failed", err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Group messages by date ──────────────────────────────────────────────────
  const groupedMessages = useMemo(() => {
    const messages = conversation?.messages || [];
    const groups = [];
    let lastDate = null;
    messages.forEach((msg) => {
      const d = msg.createdAt ? new Date(msg.createdAt).toDateString() : "";
      if (d !== lastDate) {
        groups.push({
          type: "date",
          date: msg.createdAt,
          id: `date-${msg.createdAt}`,
        });
        lastDate = d;
      }
      groups.push({ type: "message", message: msg, id: msg._id });
    });
    return groups;
  }, [conversation?.messages]);

  const isTerminal = order ? TERMINAL.includes(order.status) : false;
  const otherName =
    role === "buyer"
      ? conversation?.seller?.firstName
      : conversation?.buyer?.firstName;

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          <p className="text-sm font-medium">Loading conversation…</p>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-700 mb-2">
            Couldn't load chat
          </h2>
          <p className="text-gray-500 text-sm mb-5">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors text-sm"
          >
            Go Back
          </button>
        </div>
      </div>
    );

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 flex-shrink-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Other party info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {otherName?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-gray-800 text-sm truncate">
                  {otherName || "—"}
                </p>
                {otherOnline && (
                  <span className="flex items-center gap-1 text-xs text-green-500">
                    <Circle className="w-2 h-2 fill-green-500" /> Online
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 truncate">
                {order?.snapshot?.title}
              </p>
            </div>
          </div>
        </div>

        {/* Toggle tracker panel (mobile) */}
        <button
          onClick={() => setShowTracker((v) => !v)}
          className={`p-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5 ${
            showTracker
              ? "bg-blue-50 text-blue-600"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
        >
          <Package className="w-4 h-4" />
          <span className="hidden sm:inline text-xs">Order</span>
        </button>
      </div>

      {/* ── Main layout ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Chat panel ── */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5">
            {groupedMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                <MessageSquare className="w-12 h-12 mb-3 text-gray-200" />
                <p className="font-medium text-sm">No messages yet</p>
                <p className="text-xs mt-1">Start the conversation!</p>
              </div>
            )}

            {groupedMessages.map((item) =>
              item.type === "date" ? (
                <DateSeparator key={item.id} date={item.date} />
              ) : (
                <MessageBubble
                  key={item.id}
                  message={item.message}
                  isOwn={
                    item.message.senderRole === role ||
                    item.message.sender?.toString() === user?._id?.toString()
                  }
                />
              ),
            )}

            {/* Typing indicator */}
            {otherTyping && (
              <div className="flex justify-start mb-2">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-3">
            {isTerminal ? (
              <div className="text-center text-xs text-gray-400 py-1">
                This order is {order.status} — messaging is closed.
                {role === "buyer" && (
                  <Link
                    to="/my-orders"
                    className="ml-1 text-blue-500 hover:underline font-medium"
                  >
                    View orders
                  </Link>
                )}
                {role === "seller" && (
                  <Link
                    to="/seller/orders"
                    className="ml-1 text-blue-500 hover:underline font-medium"
                  >
                    Seller dashboard
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type a message… (Enter to send)"
                  className="flex-1 resize-none px-4 py-2.5 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all placeholder-gray-300 max-h-32 overflow-y-auto"
                  style={{ minHeight: "42px" }}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim() || sending}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 text-white flex items-center justify-center flex-shrink-0 transition-all shadow-md"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Order tracker panel ── */}
        {showTracker && (
          <div className="w-72 flex-shrink-0 bg-white border-l border-gray-200 overflow-hidden hidden md:flex flex-col">
            <OrderTracker
              order={order}
              role={role}
              onAction={handleAction}
              actionLoading={actionLoading}
            />
          </div>
        )}
      </div>

      {/* ── Mobile tracker drawer (slides up) ── */}
      {showTracker && (
        <div className="md:hidden fixed inset-0 z-40 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowTracker(false)}
          />
          <div className="relative bg-white rounded-t-3xl max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Order Details</h3>
              <button
                onClick={() => setShowTracker(false)}
                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-gray-500 text-xs font-semibold"
              >
                Close
              </button>
            </div>
            <OrderTracker
              order={order}
              role={role}
              onAction={(action, body) => {
                handleAction(action, body);
                setShowTracker(false);
              }}
              actionLoading={actionLoading}
            />
          </div>
        </div>
      )}
    </div>
  );
}