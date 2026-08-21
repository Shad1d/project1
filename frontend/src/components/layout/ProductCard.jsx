import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Heart, Star, ShoppingCart, Truck, Tag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config/api";
import { useAuth } from "../../context/AuthContext.jsx";
import LoginModal from "../auth/LoginModal.jsx";
import { useNotification } from "../hooks/useNotification.js";
import Notification from "../common/Notification.jsx";

/**
 * ProductCard — works with both the Listing schema shape (from API) and the
 * legacy transformed shape used on the homepage during transition.
 *
 * Listing schema fields used:
 *   _id, title, listingType, price, rentPricePerDay, images[],
 *   condition, negotiable, deliveryAvailable, quantity, rating?, reviews?
 */
const ProductCard = ({
  product,
  onProductClick,
  onAddToCart,
  onWishlistChange,
  showQuantityControls = true,
  showFavoriteButton = true,
  showAddToCartButton = true,
  className = "",
  imageHeight = "h-48",
  cardPadding = "p-4",
}) => {
  const navigate = useNavigate();
  const { user, token, isLoggedIn, updateUser } = useAuth();
  const { showSuccess, showError } = useNotification();

  // Support both Listing schema (_id) and legacy shape (product_id / id)
  const productId = product?._id || product?.product_id || product?.id;

  const [quantity, setQuantity] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  useEffect(() => {
    if (!productId) return;

    const wishlist = Array.isArray(user?.wishlist) ? user.wishlist : [];
    setIsLiked(wishlist.some((item) => item?.toString?.() === productId));
  }, [productId, user]);

  // ── Derived display values ─────────────────────────────────────────────────

  // Image: Listing schema stores images as [{ url, filename }]
  // Legacy shape stores image as a plain string URL
  const resolveImage = () => {
    if (product?.images?.length) {
      const url = product.images[0].url;
      // If it's already an absolute URL (e.g. placehold.co), use as-is
      return url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
    }
    if (product?.image_url) return product.image_url;
    if (product?.image) return product.image;
    return "https://placehold.co/600x400?text=No+Image";
  };

  // Price display: sell vs rent
  const resolvePrice = () => {
    if (product?.listingType === "rent") {
      return product.rentPricePerDay != null
        ? `৳${Number(product.rentPricePerDay).toLocaleString()}/day`
        : (product.price ?? "—");
    }
    if (product?.price != null) {
      // If price is already a formatted string (legacy), return as-is
      return typeof product.price === "number"
        ? `৳${Number(product.price).toLocaleString()}`
        : product.price;
    }
    return "—";
  };

  const isRental = product?.listingType === "rent";

  const handleLoginSuccess = () => {
    setIsLoginModalOpen(false);
    if (pendingAction === "wishlist") {
      handleToggleFavorite({ stopPropagation: () => {} });
    }
    if (pendingAction === "cart") {
      performAddToCart();
    }
    setPendingAction(null);
  };

  const performAddToCart = async () => {
    if (!productId) return;
    if (quantity <= 0) return;
    if (!isLoggedIn || !token) return;

    setIsLoading(true);
    try {
      const body = {
        listingId: productId,
        quantity,
      };

      if (isRental) {
        body.rentalDays = product.minRentalDays ?? 1;
      }

      const res = await fetch(`${API_BASE_URL}/api/cart/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg = data.error || "Failed to add item to cart.";
        showError("Error", errorMsg);
        return;
      }

      showSuccess(
        "Added to Cart",
        `Added ${quantity} × "${product.title || product.product_name || "item"}" to cart.`,
      );
      onAddToCart?.(product, quantity);
      setQuantity(0);
    } catch (error) {
      console.error("performAddToCart error:", error);
      showError("Error", error?.message || "Failed to add item to cart.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFavorite = async (e) => {
    e.stopPropagation();

    if (!isLoggedIn || !token) {
      setPendingAction("wishlist");
      setIsLoginModalOpen(true);
      return;
    }

    if (!productId) return;

    setIsLoading(true);
    try {
      const method = isLiked ? "DELETE" : "POST";
      const res = await fetch(
        `${API_BASE_URL}/api/auth/wishlist/${productId}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Failed to update wishlist.");
      }

      updateUser?.(
        body.user ?? { ...user, wishlist: body.user?.wishlist ?? [] },
      );
      onWishlistChange?.(body.user ?? null);
      showSuccess(
        isLiked ? "Removed from Wishlist" : "Saved to Wishlist",
        `"${product.title || product.product_name || "Item"}" ${isLiked ? "removed from" : "added to"} your wishlist.`,
      );
      setIsLiked(!isLiked);
    } catch (error) {
      console.error("Wishlist toggle failed:", error);
      showError(
        "Wishlist Error",
        error?.message || "Failed to update wishlist.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleProductClick = () => {
    if (onProductClick) {
      onProductClick(product);
    } else {
      navigate(`/product/${productId}`);
    }
  };

  const handleAddToCart = () => {
    if (quantity <= 0) return;

    if (!isLoggedIn || !token) {
      setPendingAction("cart");
      setIsLoginModalOpen(true);
      return;
    }

    performAddToCart();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className={`bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-gray-100 overflow-hidden ${className}`}
    >
      {/* Image */}
      <div className="relative overflow-hidden">
        <img
          src={resolveImage()}
          alt={product?.name || product?.title || "Product"}
          onClick={handleProductClick}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "https://placehold.co/600x400?text=No+Image";
          }}
          className={`w-full ${imageHeight} object-cover cursor-pointer hover:scale-110 transition-transform duration-500`}
          loading="lazy"
        />

        {/* Rental / For Sale badge */}
        {product?.listingType && (
          <span
            className={`absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full ${
              isRental ? "bg-amber-500 text-white" : "bg-violet-600 text-white"
            }`}
          >
            {isRental ? "Rent" : "Sale"}
          </span>
        )}

        {/* Favourite button */}
        {showFavoriteButton && (
          <button
            onClick={handleToggleFavorite}
            aria-label={isLiked ? "Remove from wishlist" : "Add to wishlist"}
            title={
              isLoggedIn
                ? isLiked
                  ? "Remove from wishlist"
                  : "Add to wishlist"
                : "Log in to save items"
            }
            className={`absolute top-2 right-2 p-1.5 rounded-full bg-white/90 shadow transition-transform ${
              isLoading ? "opacity-60 cursor-wait" : "hover:scale-110"
            }`}
          >
            <Heart
              className={`w-4 h-4 ${
                isLiked ? "fill-red-500 text-red-500" : "text-gray-400"
              }`}
            />
          </button>
        )}
      </div>

      {/* Body */}
      <div className={cardPadding}>
        {/* Title */}
        <h3
          onClick={handleProductClick}
          className="font-bold text-sm text-gray-800 cursor-pointer mb-1 line-clamp-2 leading-snug"
        >
          {product?.name || product?.title}
        </h3>

        {/* Stars — shown only when rating data is present */}
        {product?.rating != null && (
          <div className="flex items-center mb-2">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-3.5 h-3.5 ${
                  i < (product.rating || 4)
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-gray-200"
                }`}
              />
            ))}
            <span className="ml-1.5 text-xs text-gray-400">
              ({product.reviews ?? 0})
            </span>
          </div>
        )}

        {/* Price row */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-lg font-bold text-purple-600">
            {resolvePrice()}
          </span>
          {product?.condition && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full capitalize">
              {product.condition.replace("_", " ")}
            </span>
          )}
          {/* Legacy quantity/unit badge */}
          {!product?.condition && (product?.quantity || product?.unit) && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {product.quantity ?? 1} {product.unit ?? "pc"}
            </span>
          )}
        </div>

        {/* Negotiable / Delivery badges */}
        {(product?.negotiable || product?.deliveryAvailable) && (
          <div className="flex gap-1.5 mb-3">
            {product.negotiable && (
              <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                <Tag className="w-3 h-3" />
                Negotiable
              </span>
            )}
            {product.deliveryAvailable && (
              <span className="flex items-center gap-1 text-xs text-sky-700 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-full">
                <Truck className="w-3 h-3" />
                Delivery
              </span>
            )}
          </div>
        )}

        {/* Quantity controls */}
        {showQuantityControls && (
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => setQuantity((prev) => Math.max(0, prev - 1))}
              className="w-8 h-8 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition-colors"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-semibold text-gray-700">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((prev) => prev + 1)}
              className="w-8 h-8 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition-colors"
            >
              +
            </button>
          </div>
        )}

        {/* Add to cart */}
        {showAddToCartButton && (
          <>
            <button
              disabled={quantity === 0 || isLoading}
              onClick={handleAddToCart}
              className={`w-full py-2.5 rounded-lg text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                quantity > 0
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              {isLoading ? (
                "Adding…"
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4" />
                  {quantity > 0 ? `Add ${quantity} to Cart` : "Select Quantity"}
                </>
              )}
            </button>
            {showSuccessMessage && (
              <p className="mt-2 text-sm text-emerald-600 font-medium text-center">
                Added to cart!
              </p>
            )}
          </>
        )}
      </div>

      {/* Login Modal — portalled to body so it's never clipped by card overflow */}
      {isLoginModalOpen &&
        createPortal(
          <LoginModal
            isOpen={isLoginModalOpen}
            onClose={() => setIsLoginModalOpen(false)}
            onLoginSuccess={handleLoginSuccess}
            currentPath={`/product/${productId}`}
          />,
          document.body,
        )}
    </div>
  );
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
export const ProductCardSkeleton = ({
  imageHeight = "h-48",
  cardPadding = "p-4",
}) => (
  <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden animate-pulse">
    <div className={`${imageHeight} bg-gray-200`} />
    <div className={cardPadding}>
      <div className="h-4 bg-gray-200 rounded mb-2 w-3/4" />
      <div className="h-3 bg-gray-200 rounded mb-2 w-1/2" />
      <div className="h-6 bg-gray-200 rounded w-24 mb-3" />
      <div className="h-9 bg-gray-200 rounded" />
    </div>
  </div>
);

export default ProductCard;
