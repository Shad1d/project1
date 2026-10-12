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
      <div className="absolute z-50 w-full bg-[#fffdf7] border border-[#dedbd1] rounded-xl shadow-xl mt-2 max-h-96 overflow-y-auto animate-in slide-in-from-top-2 duration-300">
        {searchLoading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
            <span className="ml-2 text-[#66716a]">Searching...</span>
          </div>
        ) : searchResults.length > 0 ? (
          <>
            {searchResults.map((product, index) => {
              const productId = product._id || product.id;
              const title = product.title || product.name || "Untitled Item";
              const category = product.category || product.category_name || "Uncategorized";
              const price = product.price ?? product.rentPricePerDay;
              const imgUrl = product.images?.[0]?.url
                ? (product.images[0].url.startsWith("http") ? product.images[0].url : `${API_BASE_URL}${product.images[0].url}`)
                : product.image_url || "https://placehold.co/100x100?text=Item";

              return (
                <div
                  key={productId || index}
                  className="flex items-center p-3 hover:bg-[#f5f2e9] cursor-pointer border-b border-[#dedbd1] last:border-b-0 transition-all duration-300 hover:translate-x-1 animate-in slide-in-from-left-1"
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => handleProductClick(productId)}
                >
                  <img
                    src={imgUrl}
                    alt={title}
                    className="w-12 h-12 object-cover rounded-lg mr-3 transition-transform duration-300 hover:scale-110"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-[#20332d] text-sm line-clamp-1">
                      {title}
                    </div>
                    <div className="text-xs text-[#66716a]">
                      {category}
                    </div>
                    <div className="text-sm font-semibold text-[#1d4d3e]">
                      {price != null ? `$${parseFloat(price).toFixed(2)}` : "—"}
                    </div>
                  </div>
                </div>
              );
            })}
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
        className="bg-[#f5f2e9] sticky top-0 z-50 border-b border-[#dedbd1]"
      >
        {/* ── Main row ── */}
        <div className="px-4 sm:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between max-w-screen-xl mx-auto gap-3">
            {/* Logo — always visible, scales with breakpoint */}
            <Link
              to="/"
              className="text-xl sm:text-2xl font-semibold flex items-center gap-1.5 sm:gap-2 text-[#1d4d3e] transition-colors hover:text-[#d66b4a] select-none group focus:outline-none shrink-0"
            >
              <span className="text-[#d66b4a]" aria-hidden="true">✳</span>
              <span className="font-display tracking-[-0.04em]">
                Cartivo
              </span>
            </Link>

            {/* ── Desktop search bar (hidden below sm) ── */}
            <div
              className="hidden sm:block flex-1 max-w-2xl mx-4 lg:mx-8 relative"
              ref={desktopSearchRef}
            >
              <form onSubmit={handleSearchSubmit}>
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#66716a] w-5 h-5 transition-colors duration-300 group-focus-within:text-[#1d4d3e]" />
                  <input
                    type="text"
                    placeholder="Search for products, categories..."
                    value={searchTerm}
                    onChange={handleSearchInput}
                    className="w-full pl-10 pr-10 py-3 bg-[#fffdf7] border border-[#dedbd1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1d4d3e]/20 focus:border-[#1d4d3e] text-[#20332d] placeholder-[#8b948e] transition-all duration-200"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#66716a] hover:text-[#d66b4a] transition-all duration-300 hover:scale-110 hover:rotate-90"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </form>
              <SearchDropdown />
            </div>

            {/* ── Right controls ── */}
            <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 text-[#20332d] shrink-0">
              {/* Mobile-only: search icon toggle */}
              <button
                className="sm:hidden p-1 text-[#20332d] hover:text-[#d66b4a] transition-colors"
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
                  className="hidden sm:inline hover:text-[#d66b4a] transition-all duration-300 hover:scale-110 group"
                  title="My Orders"
                >
                  <PackageSearch className="w-6 h-6 sm:w-7 sm:h-7" />
                </Link>
              )}

              {/* Wishlist */}
              <Link
                to="/wishlist"
                onClick={handleWishlistClick}
                className="relative hover:text-[#d66b4a] transition-all duration-300 hover:scale-110 group"
                title="Wishlist"
              >
                <Heart className="w-6 h-6 sm:w-7 sm:h-7" />
                {wishlistItemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-[#d66b4a] text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                    {wishlistItemCount}
                  </span>
                )}
              </Link>

              {/* Sell */}
              <button
                onClick={handleSellClick}
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-[#1d4d3e] hover:bg-[#153a30] text-white text-sm font-medium rounded-full transition-colors"
              >
                <Tag size={14} />
                <span className="hidden sm:inline">Sell</span>
              </button>

              {/* User dropdown — click-based, works on all devices */}
              <div className="relative" ref={userMenuRef}>
                <Button
                  variant="ghost"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="p-0 rounded-full hover:bg-[#ece8dc] focus:ring-4 focus:ring-[#1d4d3e]/15 transition-all duration-300 flex items-center gap-2 hover:scale-105"
                >
                  <User className="w-6 h-6 sm:w-7 sm:h-7 text-[#1d4d3e] hover:text-[#d66b4a] transition-all duration-300" />
                  {isLoggedIn && (
                    <span className="hidden md:block text-[#20332d] hover:text-[#d66b4a] font-medium transition-colors duration-300">
                      {user?.first_name}
                    </span>
                  )}
                </Button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-[#fffdf7] shadow-xl rounded-xl border border-[#dedbd1] z-50 animate-in slide-in-from-top-2">
                    {isLoggedIn ? (
                      <>
                        <div className="px-4 py-3 border-b border-[#dedbd1] bg-[#ece8dc] rounded-t-xl">
                          <p className="font-bold text-[#20332d]">
                            {user?.first_name} {user?.last_name}
                          </p>
                          <p className="text-sm text-[#66716a]">
                            {user?.email}
                          </p>
                        </div>
                        <Link
                          to="/profile"
                          onClick={() => setUserMenuOpen(false)}
                          className="block hover:bg-[#f5f2e9] px-4 py-2 cursor-pointer transition-all duration-300 text-[#20332d] hover:text-[#1d4d3e] hover:translate-x-1"
                        >
                          Profile
                        </Link>
                        <Link
                          to="/orders"
                          onClick={() => setUserMenuOpen(false)}
                          className="block hover:bg-[#f5f2e9] px-4 py-2 cursor-pointer transition-all duration-300 text-[#20332d] hover:text-[#1d4d3e] hover:translate-x-1"
                        >
                          My Orders
                        </Link>
                        <Link
                          to="/my-orders"
                          onClick={() => setUserMenuOpen(false)}
                          className="block hover:bg-[#f5f2e9] px-4 py-2 cursor-pointer transition-all duration-300 text-[#20332d] hover:text-[#1d4d3e] hover:translate-x-1"
                        >
                          Order History
                        </Link>
                        <Link
                          to="/listings"
                          onClick={() => setUserMenuOpen(false)}
                          className="block hover:bg-[#f5f2e9] px-4 py-2 cursor-pointer transition-all duration-300 text-[#20332d] hover:text-[#1d4d3e] hover:translate-x-1"
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
                          className="block w-full text-left hover:bg-[#f5f2e9] px-4 py-2 cursor-pointer transition-all duration-300 text-[#20332d] hover:text-[#1d4d3e] font-medium hover:translate-x-1 rounded-t-xl"
                        >
                          Login
                        </button>
                        <Link
                          to="/register"
                          onClick={() => setUserMenuOpen(false)}
                          className="block hover:bg-[#f5f2e9] px-4 py-2 cursor-pointer transition-all duration-300 text-[#20332d] hover:text-[#1d4d3e] hover:translate-x-1 rounded-b-xl"
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
          <div className="sm:hidden border-t border-[#dedbd1] px-4 py-2">
            <div className="relative" ref={mobileSearchRef}>
              <form onSubmit={handleSearchSubmit}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#66716a] w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search for products, categories..."
                    value={searchTerm}
                    onChange={handleSearchInput}
                    autoFocus
                    className="w-full pl-9 pr-9 py-2.5 bg-[#fffdf7] border border-[#dedbd1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1d4d3e]/20 text-[#20332d] placeholder-[#8b948e] text-sm"
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