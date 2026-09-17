import React, { useState, useEffect, useRef } from "react";
import {
  Heart,
  ShoppingCart,
  Star,
  Plus,
  Minus,
  Share2,
  Truck,
  Shield,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
  Flag,
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import LoginModal from "../components/auth/LoginModal.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useNotification } from "../components/hooks/useNotification.js";
import CartBar from "../components/layout/CartBar.jsx";
// Helper function to calculate rating distribution
const calculateRatingDistribution = (reviews) => {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach((review) => {
    if (review.rating >= 1 && review.rating <= 5) {
      distribution[review.rating]++;
    }
  });
  return distribution;
};

// Helper function to format date
const formatDate = (dateString) => {
  if (!dateString) return "Date not available";
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (error) {
    return "Date not available";
  }
};

const ProductDetailsPage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { user, token, isLoggedIn, updateUser } = useAuth();
  const { showSuccess, showError } = useNotification();
  const cartBarRef = useRef(null);

  // Base URL for serving listing images from the backend
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

  const [product, setProduct] = useState(null);
  const [productImages, setProductImages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [rentalDays, setRentalDays] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [activeTab, setActiveTab] = useState("description");
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState({});
  const [cartItems, setCartItems] = useState([]);

  // Loading states and login modal
  const [isCartLoading, setIsCartLoading] = useState(false);
  const [isLikesLoading, setIsLikesLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Sidebar and layout state
  const [selectedProducts, setSelectedProducts] = useState(null);
  const [categoryPath, setCategoryPath] = useState([]);

  // Fetch listing from real API: GET /api/listings/:id
  useEffect(() => {
    const fetchListing = async () => {
      if (!productId) return;
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${API_BASE}/api/listings/${productId}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error("Listing not found.");
          throw new Error("Failed to load listing.");
        }
        const { listing } = await res.json();

        // Normalise the listing into the shape the UI expects
        const normalised = {
          // IDs
          _id: listing._id,
          product_id: listing._id,

          // Core fields
          product_name: listing.title,
          name: listing.title,
          description: listing.description,
          category: listing.category,
          condition: listing.condition,
          listingType: listing.listingType,
          status: listing.status,

          // Pricing — sell listings use `price`, rent listings use `rentPricePerDay`
          price:
            listing.listingType === "sell"
              ? listing.price
              : listing.rentPricePerDay,
          rentPricePerDay: listing.rentPricePerDay,
          depositAmount: listing.depositAmount,
          minRentalDays: listing.minRentalDays,
          maxRentalDays: listing.maxRentalDays,
          rentTerms: listing.rentTerms,

          // Stock / availability
          quantity: listing.quantity ?? 1,
          is_available: listing.status === "active",

          // Extras
          negotiable: listing.negotiable,
          deliveryAvailable: listing.deliveryAvailable,

          // Seller info
          seller: listing.seller,

          // Images — supports both external Supabase URLs and legacy local uploads
          images: (listing.images || []).map((img, idx) => ({
            image_id: idx,
            image_url: img.url.startsWith("http") ? img.url : `${API_BASE}${img.url}`,
            filename: img.filename,
          })),

          // Fields that don't exist in this schema — keep falsy defaults
          // so the UI gracefully hides discount / rating / review sections
          origin: null,
          rating: null,
          avg_rating: null,
          review_count: 0,
          discount_percentage: 0,
          original_price: null,
          is_refundable: false,
          variants: [],
        };

        setProduct(normalised);
        setProductImages(normalised.images);
        // Initialise rentalDays to the listing's minimum (or 1 if unset)
        if (listing.listingType === "rent") {
          setRentalDays(listing.minRentalDays || 1);
        }
        // No category hierarchy in this API; use a single breadcrumb entry
        setCategories([
          { category_id: listing.category, name: listing.category },
        ]);
        // Reviews are not part of this API — leave empty
        setReviews([]);
        setReviewStats({
          totalReviews: 0,
          total_reviews: 0,
          averageRating: 0,
          average_rating: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        });
      } catch (err) {
        console.error("fetchListing error:", err);
        setError(err.message || "Something went wrong.");
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [productId]);

  // Check if product is favorited when component loads or user logs in
  useEffect(() => {
    if (
      isLoggedIn &&
      user &&
      (user._id || user.user_id) &&
      product &&
      product._id
    ) {
      checkIfLiked();
    }
  }, [isLoggedIn, user, product?._id]);

  const checkIfLiked = () => {
    if (!user || !product?._id) return;
    const wishlist = Array.isArray(user.wishlist) ? user.wishlist : [];
    setIsFavorite(wishlist.some((item) => item?.toString() === product._id));
  };

  const handleAddToCart = async () => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }

    if (!product?._id) return;

    // Validate rental days against listing constraints before hitting the API
    if (product.listingType === "rent") {
      if (!rentalDays || rentalDays < 1) return;
      if (product.minRentalDays && rentalDays < product.minRentalDays) return;
      if (product.maxRentalDays && rentalDays > product.maxRentalDays) return;
    }

    setIsCartLoading(true);
    try {
      const body = {
        listingId: product._id,
        quantity,
        ...(product.listingType === "rent" && { rentalDays }),
      };

      const res = await fetch(`${API_BASE}/api/cart/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showError("Cart Error", data.error || "Failed to add item to cart.");
        return;
      }

      showSuccess(
        "Added to Cart 🎉",
        `Added ${quantity} × "${product.name || product.product_name}" to your cart.`,
      );
      cartBarRef.current?.refreshCart();
    } catch (err) {
      console.error("handleAddToCart error:", err);
      showError("Cart Error", err.message || "Failed to add item to cart.");
    } finally {
      setIsCartLoading(false);
    }
  };

  const handleCategorySelect = (category, path) => {
    setCategoryPath(path);
    // Navigate to category products page
    navigate(`/category/${category.category_id}`);
  };

  const handleProductsView = (products, path) => {
    setSelectedProducts(products);
    setCategoryPath(path);
  };

  const handleFavoritesView = () => {
    navigate("/favorites");
  };

  const handleToggleFavorite = async () => {
    if (!isLoggedIn || !token) {
      setShowLoginModal(true);
      return;
    }

    if (!product?._id) return;

    setIsLikesLoading(true);
    try {
      const method = isFavorite ? "DELETE" : "POST";
      const res = await fetch(`${API_BASE}/api/auth/wishlist/${product._id}`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to update wishlist.");
      updateUser?.(body.user ?? null);
      showSuccess(
        isFavorite ? "Removed from Wishlist" : "Saved to Wishlist",
        `"${product.name || product.product_name}" ${isFavorite ? "removed from" : "added to"} your wishlist.`,
      );
      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error("Wishlist toggle failed:", error);
      showError("Wishlist Error", error.message || "Failed to update wishlist.");
    } finally {
      setIsLikesLoading(false);
    }
  };

  const handleWishlistLoginSuccess = async () => {
    setShowLoginModal(false);
    // Read fresh token directly — useAuth hasn't re-rendered yet
    const freshToken = localStorage.getItem("token");
    if (!freshToken || !product?._id) return;
    setIsLikesLoading(true);
    try {
      const method = isFavorite ? "DELETE" : "POST";
      const res = await fetch(`${API_BASE}/api/auth/wishlist/${product._id}`, {
        method,
        headers: { Authorization: `Bearer ${freshToken}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to update wishlist.");
      updateUser?.(body.user ?? null);
      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error("Wishlist toggle after login failed:", error);
    } finally {
      setIsLikesLoading(false);
    }
  };

  const handleQuantityChange = (change) => {
    const newQuantity = quantity + change;
    const maxQuantity = product?.quantity || 999; // Default to 999 if quantity is undefined
    if (newQuantity >= 1 && newQuantity <= maxQuantity) {
      setQuantity(newQuantity);
    }
  };

  const handleImageNavigation = (direction) => {
    if (direction === "prev") {
      setSelectedImageIndex(
        selectedImageIndex > 0
          ? selectedImageIndex - 1
          : productImages.length - 1,
      );
    } else {
      setSelectedImageIndex(
        selectedImageIndex < productImages.length - 1
          ? selectedImageIndex + 1
          : 0,
      );
    }
  };

  const renderStars = (rating) => {
    const numericRating = parseFloat(rating) || 0;
    return [...Array(5)].map((_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < Math.floor(numericRating)
            ? "fill-yellow-400 text-yellow-400"
            : "text-gray-300"
        }`}
      />
    ));
  };

  const renderBreadcrumb = () => {
    return (
      <nav className="flex mb-4 text-sm text-gray-600">
        <a href="/" className="hover:text-blue-600">
          Home
        </a>
        {product?.category && (
          <>
            <span className="mx-2">/</span>
            <span className="text-gray-800">{product.category}</span>
          </>
        )}
        {product?.name && (
          <>
            <span className="mx-2">/</span>
            <span className="text-gray-500 truncate max-w-xs">
              {product.name}
            </span>
          </>
        )}
      </nav>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      {/* CartBar Component */}
      <CartBar ref={cartBarRef} />

      <div className={`transition-all duration-300 } min-h-screen bg-gray-50`}>

        <div className="max-w-7xl mx-auto px-4 pt-0 pb-8">
          {renderBreadcrumb()}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Product Images */}
            <div className="space-y-4">
              <div className="relative bg-white rounded-lg shadow-sm overflow-hidden">
                <img
                  src={productImages[selectedImageIndex]?.image_url}
                  alt={product.name}
                  className="w-full h-96 object-cover"
                />
                {productImages.length > 1 && (
                  <>
                    <button
                      onClick={() => handleImageNavigation("prev")}
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleImageNavigation("next")}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>

              {/* Image Thumbnails */}
              <div className="flex space-x-2 overflow-x-auto">
                {productImages.map((image, index) => (
                  <button
                    key={image.image_id ?? index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${
                      selectedImageIndex === index
                        ? "border-blue-500"
                        : "border-gray-200"
                    }`}
                  >
                    <img
                      src={image.image_url}
                      alt={`${product.name || "Listing"} image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Product Information */}
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {product.product_name ||
                    product.name ||
                    "Product Name Not Available"}
                </h1>
                <p className="text-gray-600 mb-2">
                  Condition:{" "}
                  <span className="font-medium text-gray-800">
                    {product.condition || "Not specified"}
                  </span>
                </p>
                {product.seller && (
                  <p className="text-gray-600 mb-2">
                    Seller:{" "}
                    <span className="font-medium text-gray-800">
                      {product.seller.firstName} {product.seller.lastName}
                    </span>
                  </p>
                )}
                <div className="flex items-center gap-2 mb-4">
                  {product.listingType && (
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold uppercase tracking-wide ${
                        product.listingType === "rent"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {product.listingType === "rent" ? "For Rent" : "For Sale"}
                    </span>
                  )}
                  {product.negotiable && (
                    <span className="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-700">
                      Negotiable
                    </span>
                  )}
                  {product.deliveryAvailable && (
                    <span className="px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-700">
                      Delivery Available
                    </span>
                  )}
                </div>

                {/* Rating */}
                <div className="flex items-center space-x-2 mb-4">
                  <div className="flex">
                    {renderStars(product.rating || product.avg_rating || 0)}
                  </div>
                  <span className="text-sm text-gray-600">
                    ({product.review_count || 0} reviews)
                  </span>
                </div>

                {/* Price */}
                <div className="flex items-center space-x-3 mb-6">
                  {product.listingType === "rent" ? (
                    <div>
                      <span className="text-3xl font-bold text-gray-900">
                        ${parseFloat(product.rentPricePerDay || 0).toFixed(2)}
                        <span className="text-base font-normal text-gray-500">
                          {" "}
                          / day
                        </span>
                      </span>
                      {product.depositAmount > 0 && (
                        <p className="text-sm text-gray-500 mt-1">
                          Deposit: $
                          {parseFloat(product.depositAmount).toFixed(2)}
                        </p>
                      )}
                      {(product.minRentalDays || product.maxRentalDays) && (
                        <p className="text-sm text-gray-500">
                          Rental period:{" "}
                          {product.minRentalDays
                            ? `min ${product.minRentalDays}d`
                            : ""}
                          {product.minRentalDays && product.maxRentalDays
                            ? " – "
                            : ""}
                          {product.maxRentalDays
                            ? `max ${product.maxRentalDays}d`
                            : ""}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-3xl font-bold text-gray-900">
                      ${(parseFloat(product.price) || 0).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {/* Variants */}
              {product.variants && product.variants.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Color Options</h3>
                  <div className="flex space-x-3">
                    {product.variants.map((variant) => (
                      <button
                        key={variant.id}
                        onClick={() => setSelectedVariant(variant)}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg border ${
                          selectedVariant?.id === variant.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-300 hover:border-gray-400"
                        }`}
                      >
                        <div
                          className="w-6 h-6 rounded-full border"
                          style={{ backgroundColor: variant.color }}
                        ></div>
                        <span>{variant.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div>
                <h3 className="text-lg text-black font-semibold mb-3">
                  Quantity
                </h3>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center border rounded-lg">
                    <button
                      onClick={() => handleQuantityChange(-1)}
                      className="p-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={quantity <= 1}
                    >
                      <Minus className="w-4 h-4 text-black" />
                    </button>
                    <span className="px-4 py-2 font-medium text-black min-w-[3rem] text-center">
                      {quantity}
                    </span>
                    <button
                      onClick={() => handleQuantityChange(1)}
                      className="p-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={quantity >= (product?.quantity || 999)}
                    >
                      <Plus className="w-4 h-4 text-black" />
                    </button>
                  </div>
                  <span className="text-sm text-gray-600">
                    {product?.quantity || "In stock"} available
                  </span>
                </div>
              </div>

              {/* Rental days — only shown for rent listings */}
              {product?.listingType === "rent" && (
                <div>
                  <h3 className="text-lg text-black font-semibold mb-3">
                    Rental Duration (days)
                  </h3>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center border rounded-lg">
                      <button
                        onClick={() =>
                          setRentalDays((d) =>
                            Math.max(product.minRentalDays || 1, d - 1),
                          )
                        }
                        className="p-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={rentalDays <= (product.minRentalDays || 1)}
                      >
                        <Minus className="w-4 h-4 text-black" />
                      </button>
                      <span className="px-4 py-2 font-medium text-black min-w-[3rem] text-center">
                        {rentalDays}
                      </span>
                      <button
                        onClick={() =>
                          setRentalDays((d) =>
                            Math.min(product.maxRentalDays || 9999, d + 1),
                          )
                        }
                        className="p-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={
                          product.maxRentalDays
                            ? rentalDays >= product.maxRentalDays
                            : false
                        }
                      >
                        <Plus className="w-4 h-4 text-black" />
                      </button>
                    </div>
                    <span className="text-sm text-gray-600">
                      {product.minRentalDays && `min ${product.minRentalDays}d`}
                      {product.minRentalDays && product.maxRentalDays && " · "}
                      {product.maxRentalDays && `max ${product.maxRentalDays}d`}
                    </span>
                  </div>
                  {/* Running rental cost preview */}
                  <p className="text-sm text-gray-500 mt-2">
                    Estimated:{" "}
                    <span className="font-semibold text-gray-800">
                      $
                      {(
                        (product.rentPricePerDay || 0) * rentalDays
                      ).toLocaleString()}
                    </span>{" "}
                    for {rentalDays} day{rentalDays !== 1 ? "s" : ""}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-4">
                <button
                  onClick={handleAddToCart}
                  disabled={
                    isCartLoading ||
                    product?.is_available === false ||
                    (product?.quantity && product.quantity === 0) ||
                    quantity === 0
                  }
                  className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-colors"
                >
                  <ShoppingCart className="w-5 h-5" />
                  <span>{isCartLoading ? "Adding..." : "Add to Cart"}</span>
                </button>

                <button
                  onClick={handleToggleFavorite}
                  disabled={isLikesLoading}
                  className={`p-3 rounded-lg border transition-colors ${
                    isFavorite
                      ? "bg-red-50 border-red-300 text-red-600"
                      : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                  } ${isLikesLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <Heart
                    className={`w-5 h-5 ${isFavorite ? "fill-current" : ""}`}
                  />
                </button>

                {/* <button className="p-3 rounded-lg border bg-white border-gray-300 text-gray-600 hover:bg-gray-50">
                <Share2 className="w-5 h-5" />
              </button> */}
              </div>

              {/* Product Features */}
              <div className="space-y-3 pt-6 border-t">
                {/* <div className="flex items-center space-x-3">
                  <Truck className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-gray-700">
                    Free shipping on orders over $50
                  </span>
                </div> */}
                {product.is_refundable && (
                  <div className="flex items-center space-x-3">
                    <RotateCcw className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-gray-700">
                      30-day return policy
                    </span>
                  </div>
                )}
                {/* <div className="flex items-center space-x-3">
                  <Shield className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-gray-700">
                    {product.warranty} warranty
                  </span>
                </div> */}
              </div>
            </div>
          </div>

          {/* Product Details Tabs */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="border-b">
              <nav className="flex space-x-8 px-6">
                {["description", "specifications", "reviews"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-4 font-medium capitalize ${
                      activeTab === tab
                        ? "border-b-2 border-blue-500 text-blue-600"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {activeTab === "description" && (
                <div className="prose max-w-none">
                  <p className="text-gray-700 leading-relaxed">
                    {product.description
                      ? showFullDescription
                        ? product.description
                        : product.description.substring(0, 200) +
                          (product.description.length > 200 ? "..." : "")
                      : "No description available for this product."}
                  </p>
                  {product.description && product.description.length > 200 && (
                    <button
                      onClick={() =>
                        setShowFullDescription(!showFullDescription)
                      }
                      className="text-blue-600 hover:text-blue-700 mt-2"
                    >
                      {showFullDescription ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
              )}

              {activeTab === "specifications" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3 text-black">
                      Listing Details
                    </h4>
                    <dl className="space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Title:</dt>
                        <dd className="text-black font-medium">
                          {product.product_name || product.name || "N/A"}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Category:</dt>
                        <dd className="text-black font-medium">
                          {product.category || "Not specified"}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Condition:</dt>
                        <dd className="text-black font-medium">
                          {product.condition || "Not specified"}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Listing Type:</dt>
                        <dd className="text-black font-medium capitalize">
                          {product.listingType || "N/A"}
                        </dd>
                      </div>
                      {product.listingType === "sell" && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600">Price:</dt>
                          <dd className="text-black font-medium">
                            ${parseFloat(product.price || 0).toFixed(2)}
                          </dd>
                        </div>
                      )}
                      {product.listingType === "rent" && (
                        <>
                          <div className="flex justify-between">
                            <dt className="text-gray-600">Rent / Day:</dt>
                            <dd className="text-black font-medium">
                              $
                              {parseFloat(product.rentPricePerDay || 0).toFixed(
                                2,
                              )}
                            </dd>
                          </div>
                          {product.depositAmount > 0 && (
                            <div className="flex justify-between">
                              <dt className="text-gray-600">Deposit:</dt>
                              <dd className="text-black font-medium">
                                ${parseFloat(product.depositAmount).toFixed(2)}
                              </dd>
                            </div>
                          )}
                          {product.minRentalDays && (
                            <div className="flex justify-between">
                              <dt className="text-gray-600">
                                Min Rental Days:
                              </dt>
                              <dd className="text-black font-medium">
                                {product.minRentalDays}
                              </dd>
                            </div>
                          )}
                          {product.maxRentalDays && (
                            <div className="flex justify-between">
                              <dt className="text-gray-600">
                                Max Rental Days:
                              </dt>
                              <dd className="text-black font-medium">
                                {product.maxRentalDays}
                              </dd>
                            </div>
                          )}
                        </>
                      )}
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Quantity Available:</dt>
                        <dd className="text-black font-medium">
                          {product.quantity || "In stock"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3 text-black">
                      Listing Status
                    </h4>
                    <dl className="space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Status:</dt>
                        <dd>
                          <span
                            className={`px-2 py-1 rounded text-sm font-medium ${
                              product.status === "active"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {product.status
                              ? product.status.charAt(0).toUpperCase() +
                                product.status.slice(1)
                              : "Unknown"}
                          </span>
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Negotiable:</dt>
                        <dd>
                          <span
                            className={`px-2 py-1 rounded text-sm font-medium ${
                              product.negotiable
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {product.negotiable ? "Yes" : "No"}
                          </span>
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Delivery:</dt>
                        <dd>
                          <span
                            className={`px-2 py-1 rounded text-sm font-medium ${
                              product.deliveryAvailable
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {product.deliveryAvailable
                              ? "Available"
                              : "Not Available"}
                          </span>
                        </dd>
                      </div>
                      {product.seller && (
                        <>
                          <div className="flex justify-between">
                            <dt className="text-gray-600">Seller:</dt>
                            <dd className="text-black font-medium">
                              {product.seller.firstName}{" "}
                              {product.seller.lastName}
                            </dd>
                          </div>
                          {product.seller.phoneNumber && (
                            <div className="flex justify-between">
                              <dt className="text-gray-600">Contact:</dt>
                              <dd className="text-black font-medium">
                                {product.seller.phoneNumber}
                              </dd>
                            </div>
                          )}
                        </>
                      )}
                    </dl>
                  </div>
                </div>
              )}

              {activeTab === "reviews" && (
                <div className="space-y-6">
                  {/* Review Summary */}
                  <div className="flex items-start space-x-8">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-gray-900">
                        {reviewStats.average_rating || "0.0"}
                      </div>
                      <div className="flex justify-center mt-1">
                        {renderStars(reviewStats.average_rating || 0)}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {reviewStats.total_reviews || 0} reviews
                      </div>
                    </div>

                    <div className="flex-1 space-y-2">
                      {reviewStats.rating_distribution &&
                      Object.entries(reviewStats.rating_distribution).length >
                        0 ? (
                        Object.entries(reviewStats.rating_distribution)
                          .reverse()
                          .map(([rating, count]) => (
                            <div
                              key={rating}
                              className="flex items-center space-x-3"
                            >
                              <span className="text-sm w-6">{rating}★</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-yellow-400 h-2 rounded-full"
                                  style={{
                                    width: `${
                                      (count /
                                        (reviewStats.total_reviews || 1)) *
                                      100
                                    }%`,
                                  }}
                                ></div>
                              </div>
                              <span className="text-sm text-gray-600 w-8">
                                {count}
                              </span>
                            </div>
                          ))
                      ) : (
                        <div className="text-gray-500 text-center py-4">
                          No rating distribution available
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Reviews List */}
                  <div className="space-y-4">
                    {reviews && reviews.length > 0 ? (
                      reviews.map((review) => (
                        <div key={review.id} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-black">
                                  {review.user_name || "Anonymous"}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2 mt-1">
                                <div className="flex">
                                  {renderStars(review.rating || 0)}
                                </div>
                                <span className="text-sm text-gray-600">
                                  {formatDate(review.date)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <p className="text-gray-700 mb-3">
                            {review.comment || "No comment provided"}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          No reviews yet
                        </h3>
                        <p className="text-gray-500">
                          Be the first to review this product!
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleWishlistLoginSuccess}
      />
    </div>
  );
};

export default ProductDetailsPage;