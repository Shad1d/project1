import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MessageSquare,
  Package,
  Clock,
  CheckCircle2,
  Truck,
  Trophy,
  AlertTriangle,
  Ban,
  XCircle,
  RefreshCw,
  Loader2,
  Store,
  User,
  ShoppingBag,
  ArrowRight,
  Search,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { API_BASE_URL } from "../config/api.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => `$${Number(n || 0).toLocaleString("en-US")}`;

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
}

// ── Status pill config ────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  requested: {
    label: "Pending",
    badge: "bg-amber-100 text-amber-700",
    icon: Clock,
  },
  accepted: {
    label: "Accepted",
    badge: "bg-blue-100 text-blue-700",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Declined",
    badge: "bg-red-100 text-red-600",
    icon: XCircle,
  },
  delivered: {
    label: "Delivered",
    badge: "bg-purple-100 text-purple-700",
    icon: Truck,
  },
  completed: {
    label: "Completed",
    badge: "bg-green-100 text-green-700",
    icon: Trophy,
  },
  cancelled: {
    label: "Cancelled",
    badge: "bg-gray-100 text-gray-500",
    icon: Ban,
  },
  disputed: {
    label: "Disputed",
    badge: "bg-orange-100 text-orange-700",
    icon: AlertTriangle,
  },
};

// ── Single conversation row ───────────────────────────────────────────────────
function ConversationRow({ convo, currentUserId, role }) {
  const isBuyer =
    convo.buyer?._id === currentUserId ||
    convo.buyer?._id?.toString() === currentUserId;
  const unread = isBuyer ? convo.unreadBuyer : convo.unreadSeller;

  const otherParty = isBuyer ? convo.seller : convo.buyer;
  const otherName = otherParty
    ? `${otherParty.firstName || ""} ${otherParty.lastName || ""}`.trim()
    : "Unknown";

  const statusCfg = STATUS_CONFIG[convo.orderStatus] || STATUS_CONFIG.requested;
  const StatusIcon = statusCfg.icon;

  const listingTitle =
    convo.listingSnapshot?.title || convo.order?.snapshot?.title || "Listing";
  const totalAmount = convo.order?.totalAmount;

  return (
    <Link
      to={`/chat/order/${convo.order?._id || convo.order}`}
      className={`flex items-start gap-3 px-4 py-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${
        unread > 0 ? "bg-blue-50/40" : "bg-white"
      }`}
    >
      {/* Thumbnail */}
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
          {convo.listingSnapshot?.image ? (
            <img
              src={convo.listingSnapshot.image}
              alt={listingTitle}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-5 h-5 text-gray-300" />
            </div>
          )}
        </div>
        {/* Unread badge */}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <div className="min-w-0">
            <p
              className={`text-sm truncate ${unread > 0 ? "font-bold text-gray-900" : "font-semibold text-gray-800"}`}
            >
              {listingTitle}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isBuyer ? (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Store className="w-3 h-3" /> {otherName}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <User className="w-3 h-3" /> {otherName}
                </span>
              )}
              {totalAmount && (
                <span className="text-xs font-semibold text-blue-600">
                  {fmt(totalAmount)}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="text-[11px] text-gray-400">
              {timeAgo(convo.lastMessageAt)}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusCfg.badge}`}
            >
              <StatusIcon className="w-2.5 h-2.5" />
              {statusCfg.label}
            </span>
          </div>
        </div>

        {/* Last message preview */}
        <p
          className={`text-xs truncate mt-1 ${unread > 0 ? "text-gray-700 font-medium" : "text-gray-400"}`}
        >
          {convo.lastMessage || "No messages yet"}
        </p>
      </div>

      <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0 self-center" />
    </Link>
  );
}

// ── Filter tab ────────────────────────────────────────────────────────────────
function FilterTab({ label, active, count, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
        active
          ? "bg-blue-500 text-white shadow-sm"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      }`}
    >
      {label}
      {count > 0 && (
        <span
          className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${active ? "bg-blue-400 text-white" : "bg-gray-200 text-gray-600"}`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function InboxPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/conversations`, {
        headers: authHeaders,
      });
      if (!res.ok) throw new Error("Failed to load inbox.");
      const data = await res.json();
      setConversations(
        Array.isArray(data.conversations) ? data.conversations : [],
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInbox();
    // Poll unread every 30s as a lightweight fallback when socket is not open
    const interval = setInterval(fetchInbox, 30000);
    return () => clearInterval(interval);
  }, [fetchInbox]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const currentUserId = user?._id?.toString();

  const totalUnread = conversations.reduce((sum, c) => {
    const isBuyer = c.buyer?._id?.toString() === currentUserId;
    return sum + (isBuyer ? c.unreadBuyer : c.unreadSeller);
  }, 0);

  const activeConvos = conversations.filter((c) =>
    ["requested", "accepted", "delivered"].includes(c.orderStatus),
  ).length;

  // Status filter counts
  const statusCounts = conversations.reduce((acc, c) => {
    acc[c.orderStatus] = (acc[c.orderStatus] || 0) + 1;
    return acc;
  }, {});

  // Apply filters
  const filtered = conversations.filter((c) => {
    const matchesStatus =
      statusFilter === "all" || c.orderStatus === statusFilter;
    const title = (
      c.listingSnapshot?.title ||
      c.order?.snapshot?.title ||
      ""
    ).toLowerCase();
    const isBuyer = c.buyer?._id?.toString() === currentUserId;
    const other = isBuyer ? c.seller : c.buyer;
    const otherName = other
      ? `${other.firstName || ""} ${other.lastName || ""}`.toLowerCase()
      : "";
    const matchesSearch =
      !searchQuery ||
      title.includes(searchQuery.toLowerCase()) ||
      otherName.includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl relative">
                <MessageSquare className="w-5 h-5 text-white" />
                {totalUnread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {totalUnread > 9 ? "9+" : totalUnread}
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Inbox</h1>
                <p className="text-xs text-gray-500">
                  {activeConvos} active · {totalUnread} unread
                </p>
              </div>
            </div>
            <button
              onClick={fetchInbox}
              disabled={loading}
              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors text-gray-500 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by listing or contact name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all placeholder-gray-300 bg-gray-50"
            />
          </div>

          {/* Status filters */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <FilterTab
              label="All"
              active={statusFilter === "all"}
              count={0}
              onClick={() => setStatusFilter("all")}
            />
            {[
              "requested",
              "accepted",
              "delivered",
              "completed",
              "cancelled",
              "rejected",
              "disputed",
            ]
              .filter((s) => statusCounts[s] > 0)
              .map((s) => (
                <FilterTab
                  key={s}
                  label={STATUS_CONFIG[s]?.label || s}
                  active={statusFilter === s}
                  count={statusCounts[s] || 0}
                  onClick={() => setStatusFilter(s)}
                />
              ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-2xl mx-auto">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-400" />
            <p className="text-sm font-medium">Loading your inbox…</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="text-center py-16 px-4">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-gray-700 mb-2">
              Couldn't load inbox
            </h2>
            <p className="text-gray-500 text-sm mb-5">{error}</p>
            <button
              onClick={fetchInbox}
              className="px-5 py-2.5 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors text-sm"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty — no conversations at all */}
        {!loading && !error && conversations.length === 0 && (
          <div className="text-center py-20 px-4">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-9 h-9 text-gray-300" />
            </div>
            <h2 className="text-xl font-bold text-gray-700 mb-2">
              No conversations yet
            </h2>
            <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
              When you buy or sell something, you'll chat with the other party
              here.
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors text-sm"
              >
                <ShoppingBag className="w-4 h-4" /> Browse Listings
              </Link>
              <Link
                to="/orders"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-colors text-sm"
              >
                <Store className="w-4 h-4" /> Seller Dashboard
              </Link>
            </div>
          </div>
        )}

        {/* Empty — filter returned nothing */}
        {!loading &&
          !error &&
          conversations.length > 0 &&
          filtered.length === 0 && (
            <div className="text-center py-12 px-4 text-gray-400">
              <Search className="w-8 h-8 mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-sm">
                No conversations match your search.
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
                className="mt-3 text-blue-500 text-sm font-semibold hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}

        {/* Conversation list */}
        {!loading && !error && filtered.length > 0 && (
          <div className="bg-white border-x border-gray-200 shadow-sm">
            {filtered.map((convo) => (
              <ConversationRow
                key={convo._id}
                convo={convo}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        )}

        {/* Bottom padding */}
        <div className="h-8" />
      </div>
    </div>
  );
}