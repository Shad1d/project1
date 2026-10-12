import React, {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  ShoppingCart,
  X,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  CreditCard,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { API_BASE_URL } from "../../config/api.js";
import LoginModal from "../auth/LoginModal.jsx";

const CartSidebarLayout = forwardRef(({ children }, ref) => {
  const { isLoggedIn, token } = useAuth();

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // ── Derived totals ──────────────────────────────────────────────────────────
  const itemCount = cartItems.reduce(
    (sum, item) => sum + (item.quantity || 0),
    0,
  );

  const estimatedTotal = cartItems.reduce((sum, item) => {
    if (item.listingType === "rent") {
      return (
        sum +
        (item.rentPricePerDay || 0) *
          (item.rentalDays || 1) *
          (item.quantity || 1)
      );
    }
    return sum + (item.price || 0) * (item.quantity || 1);
  }, 0);

  // ── API helpers ─────────────────────────────────────────────────────────────
  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  const fetchCartItems = async () => {
    if (!isLoggedIn || !token) {
      setCartItems([]);
      return;
    }

    setIsLoading(true);
    setFetchError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/cart`, {
        headers: authHeaders(),
      });

      if (!res.ok) {
        setFetchError("Failed to load cart.");
        return;
      }

      const data = await res.json();
      setCartItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      console.error("fetchCartItems error:", err);
      setFetchError("Network error while loading cart.");
    } finally {
      setIsLoading(false);
    }
  };

  // Expose refreshCart so ProductDetail / ProductCard can trigger a refresh
  useImperativeHandle(ref, () => ({
    refreshCart: fetchCartItems,
  }));

  // Fetch on mount and whenever login state changes
  useEffect(() => {
    if (isLoggedIn) {
      fetchCartItems();
    } else {
      setCartItems([]);
    }
  }, [isLoggedIn]);

  // ── Quantity update ─────────────────────────────────────────────────────────
  const updateQuantity = async (itemId, newQuantity) => {
    if (!isLoggedIn || !itemId) return;

    if (newQuantity < 1) {
      await removeItem(itemId);
      return;
    }

    // Optimistic update
    setCartItems((prev) =>
      prev.map((item) =>
        item._id === itemId ? { ...item, quantity: newQuantity } : item,
      ),
    );

    try {
      const res = await fetch(`${API_BASE_URL}/api/cart/items/${itemId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ quantity: newQuantity }),
      });

      if (!res.ok) {
        // Roll back on failure
        await fetchCartItems();
      }
    } catch (err) {
      console.error("updateQuantity error:", err);
      await fetchCartItems();
    }
  };

  // ── Remove item ─────────────────────────────────────────────────────────────
  const removeItem = async (itemId) => {
    if (!isLoggedIn || !itemId) return;

    // Optimistic update
    setCartItems((prev) => prev.filter((item) => item._id !== itemId));

    try {
      const res = await fetch(`${API_BASE_URL}/api/cart/items/${itemId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (!res.ok) {
        await fetchCartItems();
      }
    } catch (err) {
      console.error("removeItem error:", err);
      await fetchCartItems();
    }
  };

  // ── Clear cart ──────────────────────────────────────────────────────────────
  const clearCart = async () => {
    if (!isLoggedIn) return;

    setCartItems([]);

    try {
      await fetch(`${API_BASE_URL}/api/cart`, {
        method: "DELETE",
        headers: authHeaders(),
      });
    } catch (err) {
      console.error("clearCart error:", err);
      await fetchCartItems();
    }
  };

  // ── Toggle sidebar ──────────────────────────────────────────────────────────
  const toggleCart = () => {
    if (isAnimating) return;

    if (!isCartOpen) {
      if (!isLoggedIn) {
        setIsLoginModalOpen(true);
        return;
      }
      fetchCartItems();
    }

    setIsAnimating(true);
    setIsCartOpen((prev) => !prev);
    setTimeout(() => setIsAnimating(false), 500);
  };

  const handleLoginSuccess = () => {
    setIsLoginModalOpen(false);
    setIsCartOpen(true);
    fetchCartItems();
  };

  // Lock body scroll when sidebar is open
  useEffect(() => {
    document.body.style.overflow = isCartOpen ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isCartOpen]);

  // ── Price display helper ────────────────────────────────────────────────────
  const itemPrice = (item) => {
    if (item.listingType === "rent") {
      return `$${(item.rentPricePerDay || 0).toLocaleString("en-US")}/day${
        item.rentalDays ? ` × ${item.rentalDays}d` : ""
      }`;
    }
    return `$${(item.price || 0).toLocaleString("en-US")}`;
  };

  const itemSubtotal = (item) => {
    if (item.listingType === "rent") {
      return (
        (item.rentPricePerDay || 0) *
        (item.rentalDays || 1) *
        (item.quantity || 1)
      );
    }
    return (item.price || 0) * (item.quantity || 1);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {children}

      {/* Floating cart button */}
      <button
        onClick={toggleCart}
        disabled={isAnimating}
        className={`fixed right-6 top-1/2 -translate-y-1/2 z-50 group transition-all duration-300 ${
          isCartOpen ? "scale-95 opacity-75" : "hover:scale-110"
        }`}
      >
        <div className="relative">
          <div className="w-14 h-14 bg-[#1d4d3e] rounded-full shadow-lg flex items-center justify-center">
            <ShoppingCart className="w-7 h-7 text-white relative z-10 transition-transform duration-300 group-hover:scale-110" />
          </div>

          {itemCount > 0 && (
            <div className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg animate-bounce">
              {itemCount > 99 ? "99+" : itemCount}
            </div>
          )}

          {isLoading && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          <div className="absolute inset-0 rounded-full border-2 border-blue-300 opacity-0 group-hover:opacity-60 animate-ping" />
        </div>
      </button>

      {/* Overlay */}
      {isCartOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
          onClick={toggleCart}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 transform transition-all duration-500 ease-in-out flex flex-col ${
          isCartOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="relative z-10 p-6 border-b border-[#dedbd1] bg-[#fffdf7] flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-[#e9e4d8]">
                <ShoppingBag className="w-6 h-6 text-[#1d4d3e]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  🛒 Shopping Cart
                </h2>
                <p className="text-sm text-gray-500 font-medium">
                  {itemCount} items
                </p>
              </div>
            </div>
            <button
              onClick={toggleCart}
              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-all duration-200 shadow-md"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Items */}
        <div className="relative z-10 overflow-y-auto p-6 space-y-4 h-[calc(100vh-400px)] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-8 h-8 border-4 border-[#1d4d3e] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-500 font-medium">Loading cart…</p>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <X className="w-10 h-10 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Error loading cart
              </h3>
              <p className="text-gray-500 mb-4 font-medium">{fetchError}</p>
              <button
                onClick={fetchCartItems}
                className="px-6 py-3 bg-[#1d4d3e] hover:bg-[#153a30] text-white rounded-lg shadow-lg font-bold transition-colors"
              >
                Retry
              </button>
            </div>
          ) : cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <ShoppingCart className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Your cart is empty
              </h3>
              <p className="text-gray-500 mb-6 font-medium">
                Add some products to get started!
              </p>
              <button
                onClick={toggleCart}
                className="px-6 py-3 bg-[#1d4d3e] text-white rounded-xl font-bold hover:bg-[#153a30] transition-all duration-300 shadow-lg"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            cartItems.map((item, index) => (
              <div
                key={item._id}
                className="flex items-center space-x-4 p-4 bg-[#fffdf7] border border-[#dedbd1] rounded-xl hover:shadow-md hover:border-[#1d4d3e]/40 transition-all duration-300 animate-slideInRight"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Thumbnail */}
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-800 truncate">
                    {item.title}
                  </h4>

                  {/* Rental badge */}
                  {item.listingType === "rent" && (
                    <span className="inline-block text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full mb-1">
                      Rental{item.rentalDays ? ` · ${item.rentalDays}d` : ""}
                    </span>
                  )}

                  <div className="flex items-center justify-between mt-1">
                    <span className="font-bold text-[#1d4d3e]">
                      {itemPrice(item)}
                    </span>

                    {/* Quantity controls */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() =>
                          updateQuantity(item._id, item.quantity - 1)
                        }
                        className="w-6 h-6 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-sm"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-5 text-center font-bold text-gray-800">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item._id, item.quantity + 1)
                        }
                        className="w-6 h-6 rounded-lg bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-colors shadow-sm"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Line subtotal */}
                  <p className="text-xs text-gray-400 mt-0.5">
                    Subtotal: ${itemSubtotal(item).toLocaleString()}
                  </p>
                </div>

                {/* Remove */}
                <button
                  onClick={() => removeItem(item._id)}
                  className="p-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 transition-colors flex-shrink-0 shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cartItems.length > 0 && (
          <div className="relative z-10 p-6 border-t border-[#dedbd1] bg-[#fffdf7] flex-shrink-0">
            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-gray-600 font-medium">
                <span>Estimated Total</span>
                <span>${estimatedTotal.toLocaleString()}</span>
              </div>
            </div>

            <Link to="/checkout">
              <button className="w-full bg-[#1d4d3e] hover:bg-[#153a30] text-white py-4 rounded-xl font-bold text-lg transition-colors duration-300 flex items-center justify-center space-x-2 group shadow-md">
                <CreditCard className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>

            <button
              onClick={toggleCart}
              className="w-full mt-3 text-gray-600 hover:text-gray-800 py-2 font-bold transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        )}
      </div>

      {/* Login modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        currentPath="/cart"
      />

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .animate-slideInRight {
          animation: slideInRight 0.5s ease-out forwards;
          opacity: 0;
        }
        .scrollbar-thin::-webkit-scrollbar { width: 6px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .scrollbar-thin { scrollbar-width: thin; scrollbar-color: #cbd5e1 #f1f5f9; }
      `}</style>
    </>
  );
});

export default CartSidebarLayout;