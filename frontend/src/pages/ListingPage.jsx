import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../config/api";
import ProductCard from "../components/layout/ProductCard";
import { useNotification } from "../components/hooks/useNotification";

// ── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 12;

const STATUS_LABELS = {
  active: { label: "Active", classes: "bg-green-100 text-green-700" },
  sold: { label: "Sold", classes: "bg-gray-100 text-gray-600" },
  rented: { label: "Rented", classes: "bg-blue-100 text-blue-700" },
  archived: { label: "Archived", classes: "bg-yellow-100 text-yellow-700" },
};

// ── Sub-components ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-pulse">
      <div className="h-40 bg-gray-200" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="h-3 bg-gray-200 rounded w-1/3" />
        <div className="h-8 bg-gray-200 rounded mt-3" />
      </div>
    </div>
  );
}

function EmptyState({ filtered }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <svg
        className="w-12 h-12 text-gray-300 mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4"
        />
      </svg>
      <p className="text-gray-500 font-medium">
        {filtered
          ? "No listings match your filters."
          : "You haven't posted any listings yet."}
      </p>
      {!filtered && (
        <p className="text-sm text-gray-400 mt-1">
          Create your first listing to get started.
        </p>
      )}
    </div>
  );
}

/**
 * ListingCard — wraps ProductCard (display) with seller management controls
 * (status change + delete) appended below.
 */
function ListingCard({ listing, onDelete, onStatusChange, actionLoading }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isLoading = actionLoading === listing._id;

  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow bg-white">
      {/* ── Display section: reuse ProductCard in view-only mode ── */}
      <ProductCard
        product={listing}
        showQuantityControls={false}
        showAddToCartButton={false}
        showFavoriteButton={false}
        imageHeight="h-40"
        cardPadding="p-4"
        // Disable card-level hover lift so the management wrapper controls shadow
        className="!shadow-none !hover:shadow-none !hover:translate-y-0 !rounded-none border-0"
      />

      {/* ── Management controls ── */}
      <div className="px-4 pb-4 pt-0 border-t border-gray-100 flex items-center gap-2">
        {/* Status badge (read-only display) */}
        <div className="flex-1">
          {(() => {
            const { label, classes } = STATUS_LABELS[listing.status] ?? {
              label: listing.status,
              classes: "bg-gray-100 text-gray-600",
            };
            return (
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${classes}`}
              >
                {label}
              </span>
            );
          })()}
        </div>

        {/* Status select */}
        <select
          className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:opacity-50"
          value={listing.status}
          disabled={isLoading}
          onChange={(e) => onStatusChange(listing._id, e.target.value)}
        >
          {Object.entries(STATUS_LABELS).map(([val, { label }]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>

        {/* Delete */}
        {confirmDelete ? (
          <div className="flex gap-1">
            <button
              className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-1.5 rounded disabled:opacity-50"
              disabled={isLoading}
              onClick={() => onDelete(listing._id)}
            >
              {isLoading ? "…" : "Yes"}
            </button>
            <button
              className="text-xs text-gray-600 border border-gray-200 px-2 py-1.5 rounded hover:bg-gray-50"
              onClick={() => setConfirmDelete(false)}
            >
              No
            </button>
          </div>
        ) : (
          <button
            className="text-xs text-red-500 border border-red-200 hover:bg-red-50 px-2 py-1.5 rounded disabled:opacity-50"
            disabled={isLoading}
            onClick={() => setConfirmDelete(true)}
            title="Delete listing"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MyListingsPage() {
  const { token } = useAuth();
  const { showSuccess, showError } = useNotification();

  const [listings, setListings] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page,
        limit: PAGE_SIZE,
        ...(statusFilter && { status: statusFilter }),
        ...(typeFilter && { listingType: typeFilter }),
      });

      const res = await fetch(`${API_BASE_URL}/api/listings/my?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load listings.");
      }

      const data = await res.json();
      setListings(data.listings);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, page, statusFilter, typeFilter]);

  useEffect(() => {
    if (!token) return;
    fetchListings();
  }, [token, fetchListings]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (id) => {
      setActionLoading(id);
      try {
        const res = await fetch(`${API_BASE_URL}/api/listings/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Delete failed.");
        setListings((prev) => prev.filter((l) => l._id !== id));
        setTotal((prev) => prev - 1);
        showSuccess("Listing Deleted", "The listing was successfully removed.");
      } catch (err) {
        showError(
          "Delete Failed",
          err.message || "Could not delete listing. Please try again.",
        );
      } finally {
        setActionLoading(null);
      }
    },
    [token, showSuccess, showError],
  );

  const handleStatusChange = useCallback(
    async (id, status) => {
      setActionLoading(id);
      try {
        const res = await fetch(`${API_BASE_URL}/api/listings/${id}/status`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Status update failed.");
        setListings((prev) =>
          prev.map((l) => (l._id === id ? { ...l, status } : l)),
        );
        showSuccess("Status Updated", `Listing status changed to ${status}.`);
      } catch (err) {
        showError(
          "Update Failed",
          err.message || "Could not update status. Please try again.",
        );
      } finally {
        setActionLoading(null);
      }
    },
    [token, showSuccess, showError],
  );

  const isFiltered = Boolean(statusFilter || typeFilter);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Listings</h1>
          {!loading && (
            <p className="text-sm text-gray-500 mt-0.5">
              {total} listing{total !== 1 ? "s" : ""} total
            </p>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <select
            className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([val, { label }]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>

          <select
            className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All types</option>
            <option value="sell">For Sale</option>
            <option value="rent">For Rent</option>
          </select>

          {isFiltered && (
            <button
              className="text-sm text-gray-500 hover:text-gray-800 underline"
              onClick={() => {
                setStatusFilter("");
                setTypeFilter("");
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 flex items-center justify-between">
          <span>{error}</span>
          <button
            className="underline ml-4 hover:no-underline"
            onClick={fetchListings}
          >
            Retry
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <SkeletonCard key={i} />
          ))
        ) : listings.length === 0 ? (
          <EmptyState filtered={isFiltered} />
        ) : (
          listings.map((listing) => (
            <ListingCard
              key={listing._id}
              listing={listing}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              actionLoading={actionLoading}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {!loading && pages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-1">
          <button
            className="px-3 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Prev
          </button>

          {Array.from({ length: pages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1)
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && arr[idx - 1] !== p - 1) acc.push("...");
              acc.push(p);
              return acc;
            }, [])
            .map((item, idx) =>
              item === "..." ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 text-gray-400 text-sm"
                >
                  …
                </span>
              ) : (
                <button
                  key={item}
                  className={`px-3 py-1.5 text-sm border rounded ${
                    page === item
                      ? "bg-gray-900 text-white border-gray-900"
                      : "border-gray-200 hover:bg-gray-50 text-gray-700"
                  }`}
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              ),
            )}

          <button
            className="px-3 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
            disabled={page === pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
