import React, { useState, useCallback, useEffect, useRef } from "react";
import ProductCard, {
  ProductCardSkeleton,
} from "../components/layout/ProductCard";
import CartBar from "../components/layout/CartBar.jsx";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../config/api";

// ── Constants ─────────────────────────────────────────────────────────────────
const VISIBLE_COUNT = 5;

const sectionMeta = {
  recent: {
    gradient: "from-violet-600 to-indigo-500",
    badge: "bg-violet-100 text-violet-700",
    dot: "bg-violet-500",
    accent: "#7c3aed",
  },
  nearby: {
    gradient: "from-emerald-500 to-teal-500",
    badge: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
    accent: "#059669",
  },
  rent: {
    gradient: "from-amber-500 to-orange-500",
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
    accent: "#d97706",
  },
};

// ── Empty state per section ───────────────────────────────────────────────────
const EMPTY_MESSAGES = {
  recent: {
    icon: "🛍️",
    heading: "No listings yet",
    sub: "Be the first to list something for sale!",
  },
  nearby: {
    icon: "📍",
    heading: "Nothing nearby right now",
    sub: "No sellers within 20 km of your location. Check back soon.",
  },
  rent: {
    icon: "🔑",
    heading: "No rentals available",
    sub: "Nobody has listed items for rent yet. Got something to offer?",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const getVisibleItems = (items, offset) => {
  const total = items.length;
  return Array.from(
    { length: Math.min(VISIBLE_COUNT, total) },
    (_, i) => items[(offset + i) % total],
  );
};

// ── ProductSection ─────────────────────────────────────────────────────────────
const ProductSection = ({
  sectionKey,
  title,
  tag,
  products,
  loading,
  error,
  onProductClick,
  onAddToCart,
}) => {
  const [offset, setOffset] = useState(0);
  const meta = sectionMeta[sectionKey];
  const total = products.length;
  const empty = EMPTY_MESSAGES[sectionKey];

  const handleNext = useCallback(
    () => setOffset((p) => (p + 1) % total),
    [total],
  );
  const handlePrev = useCallback(
    () => setOffset((p) => (p - 1 + total) % total),
    [total],
  );

  // Reset offset when products change (e.g. after load)
  useEffect(() => setOffset(0), [products]);

  const visibleProducts = getVisibleItems(products, offset);

  return (
    <section className="mb-20">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className={`w-1 h-10 rounded-full bg-gradient-to-b ${meta.gradient}`}
          />
          <div>
            <span
              className={`text-xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${meta.badge} mb-1 inline-block`}
            >
              {tag}
            </span>
            <h2 className="text-2xl font-extrabold text-gray-900 leading-tight">
              {title}
            </h2>
          </div>
        </div>

        {/* Nav — only show when there are products */}
        {!loading && total > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 mr-1">
              {offset + 1}–{Math.min(offset + VISIBLE_COUNT, total)} of {total}
            </span>
            <button
              onClick={handlePrev}
              aria-label="Previous"
              className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all"
            >
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  d="M15 18l-6-6 6-6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              onClick={handleNext}
              aria-label="Next"
              className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-all hover:opacity-90 hover:scale-105"
              style={{ background: meta.accent }}
            >
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  d="M9 18l6-6-6-6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: VISIBLE_COUNT }).map((_, i) => (
            <ProductCardSkeleton key={i} imageHeight="h-40" cardPadding="p-4" />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-12 px-4 bg-red-50 border border-red-100 rounded-2xl">
          <div className="text-center">
            <p className="text-red-500 font-medium text-sm">{error}</p>
            <p className="text-red-400 text-xs mt-1">
              Please try refreshing the page.
            </p>
          </div>
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-2xl border border-gray-100 text-center">
          <span className="text-4xl mb-3">{empty.icon}</span>
          <p className="font-semibold text-gray-700">{empty.heading}</p>
          <p className="text-sm text-gray-400 mt-1 max-w-xs">{empty.sub}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {visibleProducts.map((product, idx) => (
              <div
                key={`${product._id || product.id}-${offset}-${idx}`}
                className="animate-fadeSlide"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <ProductCard
                  product={product}
                  onProductClick={onProductClick}
                  onAddToCart={onAddToCart}
                  imageHeight="h-40"
                  cardPadding="p-4"
                />
              </div>
            ))}
          </div>

          {/* Dot indicators */}
          <div className="flex gap-1.5 mt-4 justify-center">
            {products.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setOffset(idx)}
                aria-label={`Go to product ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === offset ? `w-6 ${meta.dot}` : "w-1.5 bg-gray-300"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
};

// ── HomePage ──────────────────────────────────────────────────────────────────
const HomePage = () => {
  const navigate = useNavigate();
  const cartRef = useRef(null);
  const { token } = useAuth();

  const [data, setData] = useState({ recent: [], nearby: [], rent: [] });
  const [loading, setLoading] = useState({
    recent: true,
    nearby: true,
    rent: true,
  });
  const [errors, setErrors] = useState({
    recent: null,
    nearby: null,
    rent: null,
  });

  // ── API helpers ─────────────────────────────────────────────────────────────
  const fetchSection = useCallback(
    async (key, url, requiresAuth = false) => {
      try {
        const headers = {};
        if (requiresAuth && token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(url, { headers });

        // If nearby returns 400 (no location on profile), treat as empty with message
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Failed to load ${key} listings.`);
        }

        const json = await res.json();
        setData((prev) => ({ ...prev, [key]: json.listings ?? [] }));
      } catch (err) {
        setErrors((prev) => ({ ...prev, [key]: err.message }));
      } finally {
        setLoading((prev) => ({ ...prev, [key]: false }));
      }
    },
    [token],
  );

  useEffect(() => {
    // Recent: latest sell listings, public
    fetchSection(
      "recent",
      `${API_BASE_URL}/api/listings?listingType=sell&limit=10&status=active`,
    );

    // Rent: latest rent listings, public
    fetchSection(
      "rent",
      `${API_BASE_URL}/api/listings?listingType=rent&limit=10&status=active`,
    );

    // Nearby: protected, uses logged-in user's saved location
    if (token) {
      fetchSection(
        "nearby",
        `${API_BASE_URL}/api/listings/nearby?limit=10`,
        true,
      );
    } else {
      // Not logged in — show a friendly prompt instead of error
      setData((prev) => ({ ...prev, nearby: [] }));
      setErrors((prev) => ({
        ...prev,
        nearby: null, // no error, just empty — handled by empty state
      }));
      setLoading((prev) => ({ ...prev, nearby: false }));
    }
  }, [fetchSection, token]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleProductClick = (product) => {
    const id = product._id || product.id;
    navigate(`/product/${id}`);
  };

  const handleAddToCart = (product, quantity) => {
    console.log(`Added ${quantity} × ${product.name || product.title}`);
    cartRef.current?.refreshCart();
  };

  const sectionConfigs = [
    { key: "recent", title: "Recent Uploads", tag: "New" },
    { key: "nearby", title: "Nearby Products", tag: "Local" },
    { key: "rent", title: "Products For Rent", tag: "Rental" },
  ];

  return (
    <CartBar ref={cartRef}>
      <div className="min-h-screen bg-gray-50">
        {/* Hero Banner */}
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-700 via-indigo-700 to-sky-600 px-6 py-14 mb-12">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div className="relative container mx-auto max-w-3xl text-center">
            <span className="inline-block bg-white/20 text-white text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
              Community Marketplace
            </span>
            <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-4">
              Buy, Sell &amp; Rent
              <br />
              <span className="text-yellow-300">Anything, Anywhere</span>
            </h1>
            <p className="text-indigo-200 text-lg mb-8">
              Discover deals in your neighbourhood or list your items in
              seconds.
            </p>
          </div>
        </div>

        <main className="container mx-auto px-6 pb-16">
          {sectionConfigs.map((section) => (
            <ProductSection
              key={section.key}
              sectionKey={section.key}
              title={section.title}
              tag={section.tag}
              products={data[section.key]}
              loading={loading[section.key]}
              error={errors[section.key]}
              onProductClick={handleProductClick}
              onAddToCart={handleAddToCart}
            />
          ))}
        </main>

        <style>{`
          @keyframes fadeSlide {
            from { opacity: 0; transform: translateX(12px); }
            to   { opacity: 1; transform: translateX(0); }
          }
          .animate-fadeSlide {
            animation: fadeSlide 0.25s ease both;
          }
        `}</style>
      </div>
    </CartBar>
  );
};

export default HomePage;
