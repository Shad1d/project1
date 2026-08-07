// src/components/layout/NavBar.jsx
import { useState, useEffect, useRef } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, User, PackageSearch } from "lucide-react";
import { Button } from "../ui/button.jsx";
import LoginModal from "../auth/LoginModal.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { API_BASE_URL } from "../../config/api.js";
import { Tag } from "lucide-react";

// ---------------------------------------------------------------------------
// NavBar
// ---------------------------------------------------------------------------
export default function NavBar() {
  const { user, isLoggedIn, logout: authLogout } = useAuth();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState(null);
  const [wishlistItemCount, setWishlistItemCount] = useState(0);

  // Search state — shared between desktop and mobile inputs
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // UI toggles
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // Refs for click-outside handling
  const desktopSearchRef = useRef(null);
  const mobileSearchRef = useRef(null);
  const userMenuRef = useRef(null);
  const navRef = useRef(null);

  const navigate = useNavigate();
  const currentPath = window.location.pathname;

  // ── Wishlist count ──────────────────────────────────────────────────────────
  useEffect(() => {
    setWishlistItemCount(isLoggedIn && user ? (user.wishlist?.length ?? 0) : 0);
  }, [isLoggedIn, user]);

  // ── Click / touch outside → close dropdowns ────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (
        desktopSearchRef.current &&
        !desktopSearchRef.current.contains(e.target) &&
        mobileSearchRef.current &&
        !mobileSearchRef.current.contains(e.target)
      ) {
        setShowResults(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  // ── Search helpers ──────────────────────────────────────────────────────────
  const runSearch = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/listings/search?q=${encodeURIComponent(query)}&limit=5`,
      );
      const data = await res.json();
      setSearchResults(data.listings || []);
      setShowResults(true);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchInput = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    clearTimeout(window._searchTimeout);
    window._searchTimeout = setTimeout(() => runSearch(value), 300);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setShowResults(false);
    setMobileSearchOpen(false);
    navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
  };

  const handleProductClick = (productId) => {
    setShowResults(false);
    setSearchTerm("");
    setMobileSearchOpen(false);
    navigate(`/product/${productId}`);
  };

  const clearSearch = () => {
    setSearchTerm("");
    setSearchResults([]);
    setShowResults(false);
  };

  // ── Auth / nav helpers ──────────────────────────────────────────────────────
  const handleWishlistClick = (e) => {
    if (isLoggedIn) return;
    e.preventDefault();
    setPendingRedirect("/wishlist");
    setIsLoginModalOpen(true);
  };

  const handleSellClick = (e) => {
    e.preventDefault();
    if (isLoggedIn) {
      navigate("/sell");
      return;
    }
    setPendingRedirect("/sell");
    setIsLoginModalOpen(true);
  };

  const handleLoginSuccess = () => {
    setIsLoginModalOpen(false);
    if (pendingRedirect) {
      navigate(pendingRedirect);
      setPendingRedirect(null);
    }
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      /* swallow */
    } finally {
      authLogout();
      navigate("/");
    }
  };

  // ── Shared search results dropdown markup ──────────────────────────────────
  const SearchDropdown = () =>
    showResults ? (
      <div className="absolute z-50 w-full bg-slate-800/95 border border-slate-600 rounded-xl shadow-2xl mt-2 max-h-96 overflow-y-auto backdrop-blur-md animate-in slide-in-from-top-2 duration-300">
        {searchLoading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
            <span className="ml-2 text-slate-300">Searching...</span>
          </div>
        ) : searchResults.length > 0 ? (
          <>
            {searchResults.map((product, index) => (
              <div
                key={product.id}
                className="flex items-center p-3 hover:bg-slate-700/70 cursor-pointer border-b border-slate-700 last:border-b-0 transition-all duration-300 hover:translate-x-1 animate-in slide-in-from-left-1"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => handleProductClick(product.id)}
              >
                <img
                  src={product.image_url || "/default-product.png"}
                  alt={product.name}
                  className="w-12 h-12 object-cover rounded-lg mr-3 transition-transform duration-300 hover:scale-110"
                />
                <div className="flex-1">
                  <div className="font-medium text-white text-sm">
                    {product.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {product.category_name || "Uncategorized"}
                  </div>
                  <div className="text-sm font-semibold text-emerald-400">
                    ৳{parseFloat(product.price)?.toFixed(2) || "N/A"}
                  </div>
                </div>
              </div>
            ))}
            {searchTerm && (
              <div
                className="p-3 text-center text-emerald-400 hover:bg-slate-700/70 cursor-pointer border-t border-slate-700 font-medium transition-all duration-300 hover:text-emerald-300"
                onClick={() => {
                  setShowResults(false);
                  navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
                }}
              >
                View all results for &ldquo;{searchTerm}&rdquo;
              </div>
            )}
          </>
        ) : (
          searchTerm && (
            <div className="p-4 text-center text-slate-400">
              No products found for &ldquo;{searchTerm}&rdquo;
            </div>
          )
        )}
      </div>
    ) : null;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <nav
        ref={navRef}
        className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 backdrop-blur-md shadow-2xl sticky top-0 z-50 border-b border-slate-700/50"
      >
        {/* ── Main row ── */}
        <div className="px-4 sm:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between max-w-screen-xl mx-auto gap-3">
            {/* Logo — always visible, scales with breakpoint */}
            <Link
              to="/"
              className="text-2xl sm:text-4xl font-extrabold flex items-center gap-1 sm:gap-3 text-white hover:text-emerald-400 transition-all duration-500 hover:scale-110 select-none group focus:outline-none shrink-0"
            >
              <span className="transition-transform duration-500 group-hover:rotate-12">
                🛒
              </span>
              <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent hover:from-yellow-400 hover:via-orange-400 hover:to-red-400 transition-all duration-500">
                GroCart
              </span>
            </Link>

            {/* ── Desktop search bar (hidden below sm) ── */}
            <div
              className="hidden sm:block flex-1 max-w-2xl mx-4 lg:mx-8 relative"
              ref={desktopSearchRef}
            >
              <form onSubmit={handleSearchSubmit}>
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 transition-colors duration-300 group-focus-within:text-emerald-400" />
                  <input
                    type="text"
                    placeholder="Search for products, categories..."
                    value={searchTerm}
                    onChange={handleSearchInput}
                    className="w-full pl-10 pr-10 py-3 bg-slate-800/90 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-white placeholder-slate-400 transition-all duration-300 hover:bg-slate-700/90 focus:bg-slate-700/90 backdrop-blur-sm"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-400 transition-all duration-300 hover:scale-110 hover:rotate-90"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </form>
              <SearchDropdown />
            </div>

            {/* ── Right controls ── */}
            <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 text-white shrink-0">
              {/* Mobile-only: search icon toggle */}
              <button
                className="sm:hidden p-1 text-white hover:text-emerald-400 transition-colors"
                onClick={() => setMobileSearchOpen((v) => !v)}
                aria-label="Toggle search"
              >
                {mobileSearchOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Search className="w-6 h-6" />
                )}
              </button>

              {/* Orders — hide on smallest mobile to save space */}
              {isLoggedIn && (
                <Link
                  to="/orders"
                  className="hidden sm:inline hover:text-emerald-400 transition-all duration-300 hover:scale-110 group"
                  title="My Orders"
                >
                  <PackageSearch className="w-6 h-6 sm:w-7 sm:h-7 group-hover:drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                </Link>
              )}

              {/* Wishlist */}
              <Link
                to="/wishlist"
                onClick={handleWishlistClick}
                className="relative hover:text-emerald-400 transition-all duration-300 hover:scale-110 group"
                title="Wishlist"
              >
                <Heart className="w-6 h-6 sm:w-7 sm:h-7 group-hover:drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                {wishlistItemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                    {wishlistItemCount}
                  </span>
                )}
              </Link>

              {/* Sell */}
              <button
                onClick={handleSellClick}
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-[#1D9E75] hover:bg-[#0F6E56] text-white text-sm font-medium rounded-full transition-colors"
              >
                <Tag size={14} />
                <span className="hidden sm:inline">Sell</span>
              </button>

              {/* User dropdown — click-based, works on all devices */}
              <div className="relative" ref={userMenuRef}>
                <Button
                  variant="ghost"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="p-0 rounded-full hover:bg-slate-700/50 focus:ring-4 focus:ring-emerald-500/30 transition-all duration-300 flex items-center gap-2 hover:scale-105"
                >
                  <User className="w-6 h-6 sm:w-7 sm:h-7 text-white hover:text-emerald-400 transition-all duration-300 drop-shadow-none hover:drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  {isLoggedIn && (
                    <span className="hidden md:block text-white hover:text-emerald-400 font-medium transition-colors duration-300">
                      {user?.first_name}
                    </span>
                  )}
                </Button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-slate-800/95 backdrop-blur-md shadow-2xl rounded-xl border border-slate-600 z-50 animate-in slide-in-from-top-2">
                    {isLoggedIn ? (
                      <>
                        <div className="px-4 py-3 border-b border-slate-700 bg-gradient-to-r from-slate-800 to-slate-700 rounded-t-xl">
                          <p className="font-bold text-white">
                            {user?.first_name} {user?.last_name}
                          </p>
                          <p className="text-sm text-slate-300">
                            {user?.email}
                          </p>
                        </div>
                        <Link
                          to="/profile"
                          onClick={() => setUserMenuOpen(false)}
                          className="block hover:bg-slate-700/70 px-4 py-2 cursor-pointer transition-all duration-300 text-white hover:text-emerald-400 hover:translate-x-1"
                        >
                          Profile
                        </Link>
                        <Link
                          to="/orders"
                          onClick={() => setUserMenuOpen(false)}
                          className="block hover:bg-slate-700/70 px-4 py-2 cursor-pointer transition-all duration-300 text-white hover:text-emerald-400 hover:translate-x-1"
                        >
                          My Orders
                        </Link>
                        <Link
                          to="/my-orders"
                          onClick={() => setUserMenuOpen(false)}
                          className="block hover:bg-slate-700/70 px-4 py-2 cursor-pointer transition-all duration-300 text-white hover:text-emerald-400 hover:translate-x-1"
                        >
                          Order History
                        </Link>
                        <Link
                          to="/listings"
                          onClick={() => setUserMenuOpen(false)}
                          className="block hover:bg-slate-700/70 px-4 py-2 cursor-pointer transition-all duration-300 text-white hover:text-emerald-400 hover:translate-x-1"
                        >
                          My Listings
                        </Link>
                        <button
                          onClick={() => {
                            setUserMenuOpen(false);
                            handleLogout();
                          }}
                          className="block w-full text-left hover:bg-red-900/30 px-4 py-2 cursor-pointer transition-all duration-300 text-red-400 hover:text-red-300 border-t border-slate-700 hover:translate-x-1 rounded-b-xl"
                        >
                          Logout
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setUserMenuOpen(false);
                            setIsLoginModalOpen(true);
                          }}
                          className="block w-full text-left hover:bg-slate-700/70 px-4 py-2 cursor-pointer transition-all duration-300 text-white hover:text-emerald-400 font-medium hover:translate-x-1 rounded-t-xl"
                        >
                          Login
                        </button>
                        <Link
                          to="/register"
                          onClick={() => setUserMenuOpen(false)}
                          className="block hover:bg-slate-700/70 px-4 py-2 cursor-pointer transition-all duration-300 text-white hover:text-emerald-400 hover:translate-x-1 rounded-b-xl"
                        >
                          Register
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* end right controls */}
          </div>
          {/* end main row */}
        </div>

        {/* ── Mobile search row (below main bar, same nav bg, no magic px offset) ── */}
        {mobileSearchOpen && (
          <div className="sm:hidden border-t border-slate-700 px-4 py-2">
            <div className="relative" ref={mobileSearchRef}>
              <form onSubmit={handleSearchSubmit}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search for products, categories..."
                    value={searchTerm}
                    onChange={handleSearchInput}
                    autoFocus
                    className="w-full pl-9 pr-9 py-2.5 bg-slate-700/90 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-slate-400 text-sm"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </form>
              <SearchDropdown />
            </div>
          </div>
        )}
      </nav>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        currentPath={currentPath}
      />
    </>
  );
}
