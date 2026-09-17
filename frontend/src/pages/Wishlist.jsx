import { useCallback, useEffect, useState } from "react";
import { Heart, ArrowRight, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import ProductCard from "../components/layout/ProductCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { API_BASE_URL } from "../config/api.js";

export default function Wishlist() {
  const navigate = useNavigate();
  const { token, isLoggedIn } = useAuth();
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchWishlist = useCallback(async () => {
    if (!token) {
      setWishlist([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/wishlist`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.error || "Failed to load wishlist.");
      }

      setWishlist(body.wishlist ?? []);
    } catch (fetchError) {
      setError(fetchError.message || "Failed to load wishlist.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const handleWishlistChange = () => {
    fetchWishlist();
  };

  const handleLoginRedirect = () => {
    navigate("/register");
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(circle at top, rgba(99, 102, 241, 0.16), transparent 34%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="relative overflow-hidden rounded-3xl border border-white/70 bg-slate-950 text-white shadow-[0_30px_80px_rgba(15,23,42,0.24)] mb-8 sm:mb-10">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(59,130,246,0.22),rgba(99,102,241,0.18))]" />
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl" />

          <div className="relative p-6 sm:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
              <Sparkles className="h-3.5 w-3.5" />
              Saved products
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
                  Your Wishlist
                </h1>
                <p className="mt-2 max-w-2xl text-sm sm:text-base text-slate-200/80">
                  Keep track of products you want to revisit. Hearted listings
                  are saved per account and stay available across devices.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-200/90">
                <Heart className="h-4 w-4 fill-red-400 text-red-400" />
                <span>
                  {wishlist.length} saved item{wishlist.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {!isLoggedIn ? (
          <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Heart className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">
              Log in to save products
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Your wishlist is tied to your account. Use the login menu in the
              navbar or create an account to start saving items.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={handleLoginRedirect}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Create account
                <ArrowRight className="h-4 w-4" />
              </button>
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Browse products
              </Link>
            </div>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 bg-white animate-pulse"
                style={{ height: 340 }}
              >
                <div className="h-44 rounded-t-2xl bg-slate-200" />
                <div className="p-4 space-y-3">
                  <div className="h-4 w-3/4 rounded bg-slate-200" />
                  <div className="h-4 w-1/2 rounded bg-slate-200" />
                  <div className="h-9 rounded bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
            <p className="font-semibold">{error}</p>
            <button
              onClick={fetchWishlist}
              className="mt-4 inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Try again
            </button>
          </div>
        ) : wishlist.length === 0 ? (
          <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Heart className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">
              Nothing saved yet
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Tap the heart on any product card to add it here.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Explore products
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {wishlist.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                showQuantityControls={false}
                showAddToCartButton={false}
                onProductClick={() => navigate(`/product/${product._id}`)}
                onWishlistChange={handleWishlistChange}
                className="h-full"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
