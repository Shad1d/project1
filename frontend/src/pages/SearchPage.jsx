import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  Search,
  SlidersHorizontal,
  MapPin,
  Truck,
  ShieldCheck,
  X,
  Filter,
  ArrowUpDown,
  RefreshCw,
  Tag,
  AlertCircle,
  LayoutGrid,
  List,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { API_BASE_URL } from "../config/api";
import ProductCard, { ProductCardSkeleton } from "../components/layout/ProductCard";
import CartBar from "../components/layout/CartBar";
import { useAuth } from "../context/AuthContext";

const CATEGORIES = [
  "Electronics & Gadgets",
  "Furniture & Home",
  "Clothing & Accessories",
  "Books & Stationery",
  "Sports & Outdoors",
  "Toys & Games",
  "Tools & Equipment",
  "Vehicles & Parts",
  "Kitchen & Appliances",
  "Musical Instruments",
  "Art & Collectibles",
  "Other",
];

const CONDITIONS = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
];

const DISTANCE_OPTIONS = [
  { value: "", label: "Any Distance" },
  { value: "5", label: "Within 5 km" },
  { value: "10", label: "Within 10 km" },
  { value: "20", label: "Within 20 km" },
  { value: "50", label: "Within 50 km" },
  { value: "100", label: "Within 100 km" },
];

const PRICE_PRESETS = [
  { label: "Under $1,000", min: "", max: "1000" },
  { label: "$1,000 – $5,000", min: "1000", max: "5000" },
  { label: "$5,000 – $20,000", min: "5000", max: "20000" },
  { label: "Over $20,000", min: "20000", max: "" },
];

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // State derived from URL search params
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") || "");
  const [maxDistance, setMaxDistance] = useState(searchParams.get("maxDistance") || "");
  const [deliveryAvailable, setDeliveryAvailable] = useState(searchParams.get("deliveryAvailable") === "true");
  const [sellerVerified, setSellerVerified] = useState(searchParams.get("sellerVerified") === "true");
  const [listingType, setListingType] = useState(searchParams.get("listingType") || "all");
  const [condition, setCondition] = useState(searchParams.get("condition") || "all");
  const [sort, setSort] = useState(searchParams.get("sort") || "relevance");
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1", 10));

  // UI state: Grid vs List view
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "list"

  // User location state for distance calculation
  const [userCoords, setUserCoords] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle");

  // Search API Response state
  const [listings, setListings] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [ragInsights, setRagInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Sync state with URL changes
  useEffect(() => {
    setQuery(searchParams.get("q") || "");
    setCategory(searchParams.get("category") || "");
    setMinPrice(searchParams.get("minPrice") || "");
    setMaxPrice(searchParams.get("maxPrice") || "");
    setMaxDistance(searchParams.get("maxDistance") || "");
    setDeliveryAvailable(searchParams.get("deliveryAvailable") === "true");
    setSellerVerified(searchParams.get("sellerVerified") === "true");
    setListingType(searchParams.get("listingType") || "all");
    setCondition(searchParams.get("condition") || "all");
    setSort(searchParams.get("sort") || "relevance");
    setPage(parseInt(searchParams.get("page") || "1", 10));
  }, [searchParams]);

  // Try using logged in user's saved profile coordinates initially
  useEffect(() => {
    if (user?.location?.coordinates?.length === 2) {
      setUserCoords({
        lng: user.location.coordinates[0],
        lat: user.location.coordinates[1],
      });
      setLocationStatus("saved");
    }
  }, [user]);

  // Acquire browser Geolocation
  const requestGeolocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus("unsupported");
      return;
    }
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocationStatus("success");
      },
      (err) => {
        console.warn("Geolocation error:", err);
        setLocationStatus("denied");
      },
      { timeout: 8000 }
    );
  };

  // Perform search fetch
  const executeSearch = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (category) params.set("category", category);
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      if (deliveryAvailable) params.set("deliveryAvailable", "true");
      if (sellerVerified) params.set("sellerVerified", "true");
      if (listingType && listingType !== "all") params.set("listingType", listingType);
      if (condition && condition !== "all") params.set("condition", condition);
      if (sort) params.set("sort", sort);
      params.set("page", page.toString());
      params.set("limit", "16");

      if (userCoords?.lat && userCoords?.lng) {
        params.set("lat", userCoords.lat.toString());
        params.set("lng", userCoords.lng.toString());
        if (maxDistance) params.set("maxDistance", maxDistance);
      }

      const res = await fetch(`${API_BASE_URL}/api/listings/search?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch search results");
      }

      const data = await res.json();
      setListings(data.listings || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
      setRagInsights(data.ragInsights || null);
    } catch (err) {
      console.error("Search error:", err);
      setError("Unable to load products. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, [query, category, minPrice, maxPrice, deliveryAvailable, sellerVerified, listingType, condition, sort, page, userCoords, maxDistance]);

  useEffect(() => {
    executeSearch();
  }, [executeSearch]);

  // Update URL search parameters
  const updateUrlParams = (newFilters = {}) => {
    const params = new URLSearchParams(searchParams);

    const state = {
      q: query,
      category,
      minPrice,
      maxPrice,
      maxDistance,
      deliveryAvailable: deliveryAvailable ? "true" : "",
      sellerVerified: sellerVerified ? "true" : "",
      listingType,
      condition,
      sort,
      page: 1,
      ...newFilters,
    };

    Object.entries(state).forEach(([key, val]) => {
      if (val && val !== "all" && val !== "false") {
        params.set(key, val);
      } else {
        params.delete(key);
      }
    });

    setSearchParams(params);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    updateUrlParams({ q: query, page: 1 });
  };

  const handleClearFilters = () => {
    setQuery("");
    setCategory("");
    setMinPrice("");
    setMaxPrice("");
    setMaxDistance("");
    setDeliveryAvailable(false);
    setSellerVerified(false);
    setListingType("all");
    setCondition("all");
    setSort("relevance");
    setSearchParams(new URLSearchParams());
  };

  const isAnyFilterActive =
    Boolean(category) ||
    Boolean(minPrice) ||
    Boolean(maxPrice) ||
    Boolean(maxDistance) ||
    deliveryAvailable ||
    sellerVerified ||
    listingType !== "all" ||
    condition !== "all";

  const activeQueryDisplay = query.trim();

  return (
    <CartBar>
      <div className="min-h-screen bg-gray-50 text-gray-900 pb-20">
        {/* ── Top Breadcrumbs & Search Bar ── */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-8 py-5">
          <div className="max-w-7xl mx-auto space-y-4">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Link to="/" className="hover:text-emerald-600 transition-colors">Home</Link>
              <ChevronRight className="w-3 h-3 text-gray-400" />
              <Link to="/search" className="hover:text-emerald-600 transition-colors">Marketplace</Link>
              {category && (
                <>
                  <ChevronRight className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-700 truncate max-w-[200px]">{category}</span>
                </>
              )}
              {activeQueryDisplay && (
                <>
                  <ChevronRight className="w-3 h-3 text-gray-400" />
                  <span className="text-emerald-600 font-medium truncate max-w-[200px]">&ldquo;{activeQueryDisplay}&rdquo;</span>
                </>
              )}
            </div>

            {/* In-page Search Bar */}
            <form onSubmit={handleSearchSubmit} className="max-w-3xl">
              <div className="relative flex items-center rounded-xl overflow-hidden border border-gray-300 bg-white shadow-sm focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-all">
                <Search className="w-5 h-5 text-gray-400 ml-4 shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search products by title, category, or brand..."
                  className="w-full px-4 py-3 bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none text-sm sm:text-base"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      updateUrlParams({ q: "" });
                    }}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors mr-1 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="submit"
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm transition-colors shrink-0 cursor-pointer"
                >
                  Search
                </button>
              </div>
            </form>

            {/* Category Quick Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
              <button
                type="button"
                onClick={() => {
                  setCategory("");
                  updateUrlParams({ category: "" });
                }}
                className={`px-3.5 py-1.5 rounded-full border transition-all shrink-0 cursor-pointer ${
                  !category
                    ? "bg-emerald-500 text-white border-emerald-500 font-semibold shadow-sm"
                    : "bg-gray-100 text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-200"
                }`}
              >
                All Departments
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    const next = category === cat ? "" : cat;
                    setCategory(next);
                    updateUrlParams({ category: next });
                  }}
                  className={`px-3.5 py-1.5 rounded-full border transition-all shrink-0 cursor-pointer ${
                    category === cat
                      ? "bg-emerald-500 text-white border-emerald-500 font-semibold shadow-sm"
                      : "bg-gray-100 text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Related search suggestions (Tasteful e-commerce pills) */}
            {ragInsights?.expandedKeywords?.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap text-xs pt-1 border-t border-gray-200">
                <span className="text-gray-500 font-medium">Related searches:</span>
                {ragInsights.expandedKeywords.slice(0, 6).map((kw, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setQuery(kw);
                      updateUrlParams({ q: kw });
                    }}
                    className="inline-flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-emerald-700 px-2.5 py-1 rounded-md border border-gray-200 transition-colors cursor-pointer"
                  >
                    <Search className="w-3 h-3 text-gray-400" />
                    <span>{kw}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Main Catalog Section (Sidebar + Product Grid) ── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          {/* Mobile Filter Button & Sort Header */}
          <div className="flex lg:hidden items-center justify-between gap-3 mb-4 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
            <button
              onClick={() => setMobileFilterOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Filters {isAnyFilterActive && `• Active`}</span>
            </button>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  updateUrlParams({ sort: e.target.value });
                }}
                className="bg-white text-gray-700 text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="relevance">Featured</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="newest">Newest Arrivals</option>
                <option value="distance">Distance: Nearest</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* ── Desktop Filters Sidebar ── */}
            <div className="hidden lg:block lg:col-span-1 space-y-6 bg-white border border-gray-200 p-5 rounded-2xl h-fit shadow-sm sticky top-24">
              <div className="flex items-center justify-between pb-3 border-b border-gray-150">
                <div className="flex items-center gap-2 text-gray-900 font-bold text-base">
                  <Filter className="w-4 h-4 text-emerald-600" />
                  <span>Filter Products</span>
                </div>
                {isAnyFilterActive && (
                  <button
                    onClick={handleClearFilters}
                    className="text-xs text-gray-500 hover:text-red-500 transition-colors cursor-pointer"
                  >
                    Reset All
                  </button>
                )}
              </div>

              {/* Department / Category */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    updateUrlParams({ category: e.target.value });
                  }}
                  className="w-full bg-white text-gray-900 text-sm border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price Range & Quick Presets */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Price ($)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    onBlur={() => updateUrlParams({ minPrice })}
                    className="w-full bg-white text-gray-900 text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    onBlur={() => updateUrlParams({ maxPrice })}
                    className="w-full bg-white text-gray-900 text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                  />
                </div>

                {/* Quick Price Range Presets */}
                <div className="flex flex-col gap-1.5 mt-2.5">
                  {PRICE_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setMinPrice(preset.min);
                        setMaxPrice(preset.max);
                        updateUrlParams({ minPrice: preset.min, maxPrice: preset.max });
                      }}
                      className={`text-left text-xs py-1 px-2 rounded-lg transition-colors cursor-pointer ${
                        minPrice === preset.min && maxPrice === preset.max
                          ? "bg-emerald-50 text-emerald-700 font-semibold"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Buying Format (Sale vs Rent) */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Listing Type
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 border border-gray-200 rounded-xl">
                  {["all", "sell", "rent"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setListingType(t);
                        updateUrlParams({ listingType: t });
                      }}
                      className={`py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors cursor-pointer ${
                        listingType === t
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {t === "all" ? "All" : t === "sell" ? "Buy" : "Rent"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Item Condition */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Item Condition
                </label>
                <select
                  value={condition}
                  onChange={(e) => {
                    setCondition(e.target.value);
                    updateUrlParams({ condition: e.target.value });
                  }}
                  className="w-full bg-white text-gray-900 text-sm border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="all">Any Condition</option>
                  {CONDITIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Distance & Location Filter */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Location Radius</span>
                  </label>
                  <button
                    type="button"
                    onClick={requestGeolocation}
                    className="text-xs text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <RefreshCw className={`w-3 h-3 ${locationStatus === "loading" ? "animate-spin" : ""}`} />
                    <span>{userCoords ? "Update" : "Use GPS"}</span>
                  </button>
                </div>

                <select
                  value={maxDistance}
                  onChange={(e) => {
                    setMaxDistance(e.target.value);
                    updateUrlParams({ maxDistance: e.target.value });
                  }}
                  disabled={!userCoords}
                  className="w-full bg-white text-gray-900 text-sm border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {DISTANCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {!userCoords && (
                  <p className="text-[11px] text-gray-500 mt-1">
                    Enable GPS or set profile location to filter nearby items.
                  </p>
                )}
              </div>

              {/* Delivery & Seller Badges */}
              <div className="space-y-3 pt-3 border-t border-gray-150">
                <label className="flex items-center gap-3 cursor-pointer text-sm text-gray-700 hover:text-gray-900 select-none">
                  <input
                    type="checkbox"
                    checked={deliveryAvailable}
                    onChange={(e) => {
                      setDeliveryAvailable(e.target.checked);
                      updateUrlParams({ deliveryAvailable: e.target.checked ? "true" : "" });
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-400 accent-emerald-500"
                  />
                  <Truck className="w-4 h-4 text-sky-600" />
                  <span>Delivery Available</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer text-sm text-gray-700 hover:text-gray-900 select-none">
                  <input
                    type="checkbox"
                    checked={sellerVerified}
                    onChange={(e) => {
                      setSellerVerified(e.target.checked);
                      updateUrlParams({ sellerVerified: e.target.checked ? "true" : "" });
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-400 accent-emerald-500"
                  />
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Verified Sellers Only</span>
                </label>
              </div>
            </div>

            {/* ── Main Catalog Results Section ── */}
            <div className="lg:col-span-3 space-y-4">
              {/* Header Toolbar */}
              <div className="hidden lg:flex items-center justify-between bg-white border border-gray-200 px-5 py-3 rounded-2xl shadow-sm">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {activeQueryDisplay ? `Results for "${activeQueryDisplay}"` : category ? category : "All Products"}
                  </h2>
                  <p className="text-xs text-gray-500">
                    Showing {listings.length} of {total} item{total !== 1 ? "s" : ""}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  {/* Sort By */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-medium">Sort by:</span>
                    <select
                      value={sort}
                      onChange={(e) => {
                        setSort(e.target.value);
                        updateUrlParams({ sort: e.target.value });
                      }}
                      className="bg-white text-gray-700 text-xs border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="relevance">Best Match</option>
                      <option value="price_asc">Price: Low to High</option>
                      <option value="price_desc">Price: High to Low</option>
                      <option value="newest">Newest Arrivals</option>
                      <option value="distance">Nearest Distance</option>
                    </select>
                  </div>

                  {/* Grid / List View Toggle */}
                  <div className="flex items-center bg-gray-100 border border-gray-200 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setViewMode("grid")}
                      className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                        viewMode === "grid" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                      }`}
                      title="Grid view"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("list")}
                      className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                        viewMode === "list" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                      }`}
                      title="List view"
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Filter Pills Bar */}
              {isAnyFilterActive && (
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-gray-500 font-medium">Filters:</span>
                  {category && (
                    <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full shadow-sm">
                      <span>Category: {category}</span>
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-red-500"
                        onClick={() => {
                          setCategory("");
                          updateUrlParams({ category: "" });
                        }}
                      />
                    </span>
                  )}
                  {(minPrice || maxPrice) && (
                    <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full shadow-sm">
                      <span>Price: ${minPrice || "0"} – ${maxPrice || "∞"}</span>
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-red-500"
                        onClick={() => {
                          setMinPrice("");
                          setMaxPrice("");
                          updateUrlParams({ minPrice: "", maxPrice: "" });
                        }}
                      />
                    </span>
                  )}
                  {listingType !== "all" && (
                    <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full shadow-sm">
                      <span>Format: {listingType === "sell" ? "Buy Now" : "Rent"}</span>
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-red-500"
                        onClick={() => {
                          setListingType("all");
                          updateUrlParams({ listingType: "all" });
                        }}
                      />
                    </span>
                  )}
                  {condition !== "all" && (
                    <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full shadow-sm">
                      <span className="capitalize">Condition: {condition.replace("_", " ")}</span>
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-red-500"
                        onClick={() => {
                          setCondition("all");
                          updateUrlParams({ condition: "all" });
                        }}
                      />
                    </span>
                  )}
                  {deliveryAvailable && (
                    <span className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-700 border border-sky-200 px-3 py-1 rounded-full shadow-sm">
                      <Truck className="w-3 h-3" />
                      <span>Delivery Only</span>
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-red-500"
                        onClick={() => {
                          setDeliveryAvailable(false);
                          updateUrlParams({ deliveryAvailable: "" });
                        }}
                      />
                    </span>
                  )}
                  {sellerVerified && (
                    <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full shadow-sm">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Verified Sellers</span>
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-red-500"
                        onClick={() => {
                          setSellerVerified(false);
                          updateUrlParams({ sellerVerified: "" });
                        }}
                      />
                    </span>
                  )}
                  {maxDistance && (
                    <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full shadow-sm">
                      <span>Within {maxDistance} km</span>
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-red-500"
                        onClick={() => {
                          setMaxDistance("");
                          updateUrlParams({ maxDistance: "" });
                        }}
                      />
                    </span>
                  )}
                  <button
                    onClick={handleClearFilters}
                    className="text-gray-500 hover:text-red-500 text-xs underline cursor-pointer ml-1"
                  >
                    Clear all
                  </button>
                </div>
              )}

              {/* Catalog Products Display */}
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <ProductCardSkeleton key={i} imageHeight="h-48" />
                  ))}
                </div>
              ) : error ? (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-6 text-center">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
                  <p>{error}</p>
                  <button
                    onClick={executeSearch}
                    className="mt-4 px-5 py-2 bg-red-600 text-white rounded-xl font-medium text-sm hover:bg-red-700 transition-colors cursor-pointer shadow-sm"
                  >
                    Retry Search
                  </button>
                </div>
              ) : listings.length === 0 ? (
                /* E-Commerce Empty State */
                <div className="bg-white border border-gray-200 rounded-2xl p-10 sm:p-14 text-center max-w-lg mx-auto my-8 shadow-sm">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4 text-gray-500">
                    <Search className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">No matching products found</h3>
                  <p className="text-gray-500 text-xs sm:text-sm mb-6 leading-relaxed">
                    We couldn&apos;t find any listings matching your search. Try checking spelling, broadening your price range, or clearing filters.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      onClick={handleClearFilters}
                      className="w-full sm:w-auto px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer shadow-sm"
                    >
                      Clear All Filters
                    </button>
                    <Link
                      to="/"
                      className="w-full sm:w-auto px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-colors text-center border border-gray-200"
                    >
                      Browse Featured Deals
                    </Link>
                  </div>
                </div>
              ) : viewMode === "grid" ? (
                /* Grid View */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {listings.map((item) => (
                    <div key={item._id} className="relative group h-full">
                      <ProductCard
                        product={item}
                        onProductClick={() => navigate(`/product/${item._id}`)}
                        showQuantityControls={false}
                        imageHeight="h-48"
                      />

                      {/* Custom Overlay Badges for Distance & Seller Verification */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1 z-10 pointer-events-none">
                        {item.seller?.isEmailVerified && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-emerald-600 text-white px-2 py-0.5 rounded-md shadow backdrop-blur-sm">
                            <ShieldCheck className="w-3 h-3" />
                            Verified Seller
                          </span>
                        )}
                        {item.distanceKm !== null && item.distanceKm !== undefined && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-900/90 text-emerald-300 px-2 py-0.5 rounded-md shadow border border-emerald-500/30">
                            <MapPin className="w-3 h-3 text-emerald-400" />
                            {item.distanceKm} km away
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* List View (Horizontal E-Commerce Cards) */
                <div className="space-y-4">
                  {listings.map((item) => {
                    const imgUrl = item.images?.[0]?.url
                      ? item.images[0].url.startsWith("http")
                        ? item.images[0].url
                        : `${API_BASE_URL}${item.images[0].url}`
                      : "https://placehold.co/400x300?text=No+Image";

                    const isRent = item.listingType === "rent";
                    const price = isRent ? item.rentPricePerDay : item.price;

                    return (
                      <div
                        key={item._id}
                        onClick={() => navigate(`/product/${item._id}`)}
                        className="flex flex-col sm:flex-row items-stretch bg-white hover:bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer group shadow-sm hover:shadow-md"
                      >
                        {/* Thumbnail */}
                        <div className="sm:w-56 h-48 sm:h-auto shrink-0 relative bg-gray-100 overflow-hidden">
                          <img
                            src={imgUrl}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {item.seller?.isEmailVerified && (
                            <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded shadow">
                              <ShieldCheck className="w-3 h-3" /> Verified
                            </span>
                          )}
                        </div>

                        {/* Content */}
                        <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="text-xs text-gray-500 font-medium">
                                {item.category}
                              </span>
                              <span className="text-gray-300">•</span>
                              {isRent ? (
                                <span className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded font-semibold">
                                  For Rent
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-semibold">
                                  For Sale
                                </span>
                              )}
                              {item.condition && (
                                <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded capitalize">
                                  {item.condition.replace("_", " ")}
                                </span>
                              )}
                            </div>

                            <h3 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-emerald-600 transition-colors line-clamp-1">
                              {item.title}
                            </h3>

                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {item.description}
                            </p>
                          </div>

                          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-150">
                            <div>
                              <div className="text-lg font-extrabold text-emerald-600">
                                {price != null
                                  ? `$${Number(price).toLocaleString()}${isRent ? "/day" : ""}`
                                  : "—"}
                              </div>
                              {item.deliveryAvailable && (
                                <div className="text-[11px] text-sky-700 flex items-center gap-1 mt-0.5">
                                  <Truck className="w-3 h-3" /> Delivery Available
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              className="px-4 py-2 bg-gray-100 group-hover:bg-emerald-500 group-hover:text-white text-gray-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer border border-gray-200 group-hover:border-transparent"
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {!loading && pages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-6">
                  <button
                    disabled={page === 1}
                    onClick={() => {
                      const newPage = page - 1;
                      setPage(newPage);
                      updateUrlParams({ page: newPage });
                    }}
                    className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-gray-500 px-3 font-medium">
                    Page {page} of {pages}
                  </span>
                  <button
                    disabled={page === pages}
                    onClick={() => {
                      const newPage = page + 1;
                      setPage(newPage);
                      updateUrlParams({ page: newPage });
                    }}
                    className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Mobile Filter Modal ── */}
        {mobileFilterOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end">
            <div className="w-full max-w-xs bg-white border-l border-gray-200 h-full p-6 overflow-y-auto space-y-6 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-gray-150">
                <span className="font-bold text-gray-900 text-base">Filter Products</span>
                <button
                  onClick={() => setMobileFilterOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Category */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Category</label>
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    updateUrlParams({ category: e.target.value });
                  }}
                  className="w-full bg-white text-gray-900 text-sm border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Mobile Price */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Price Range ($)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full bg-white text-gray-900 text-sm border border-gray-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full bg-white text-gray-900 text-sm border border-gray-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Mobile Listing Type */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Listing Type</label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 border border-gray-200 rounded-xl">
                  {["all", "sell", "rent"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setListingType(t);
                        updateUrlParams({ listingType: t });
                      }}
                      className={`py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
                        listingType === t ? "bg-emerald-500 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {t === "all" ? "All" : t === "sell" ? "Buy" : "Rent"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile Verification & Delivery */}
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={deliveryAvailable}
                    onChange={(e) => {
                      setDeliveryAvailable(e.target.checked);
                      updateUrlParams({ deliveryAvailable: e.target.checked ? "true" : "" });
                    }}
                    className="w-4.5 h-4.5 rounded accent-emerald-500"
                  />
                  <span>Delivery Available</span>
                </label>

                <label className="flex items-center gap-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={sellerVerified}
                    onChange={(e) => {
                      setSellerVerified(e.target.checked);
                      updateUrlParams({ sellerVerified: e.target.checked ? "true" : "" });
                    }}
                    className="w-4.5 h-4.5 rounded accent-emerald-500"
                  />
                  <span>Verified Sellers Only</span>
                </label>
              </div>

              <button
                onClick={() => {
                  updateUrlParams();
                  setMobileFilterOpen(false);
                }}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl cursor-pointer shadow-md transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}
      </div>
    </CartBar>
  );
}