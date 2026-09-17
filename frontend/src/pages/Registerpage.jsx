import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api.js";
import {
  Eye,
  EyeOff,
  User,
  Mail,
  Phone,
  MapPin,
  ArrowLeft,
  Sparkles,
  Shield,
  CheckCircle,
  ShoppingCart,
  Leaf,
  Star,
  Navigation,
  Loader2,
} from "lucide-react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import LoginModal from "../components/auth/LoginModal.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import Notification from "../components/common/Notification.jsx";
import useNotification from "../components/hooks/useNotification.js";

// Fix Leaflet default marker icon broken by bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Custom green marker icon for the selected location
const greenIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Component to fly/pan map to new coords
function MapController({ coords }) {
  const map = useMap();

  useEffect(() => {
    if (coords) {
      map.flyTo([coords.lat, coords.lng], 16, { duration: 1.2 });
    }
  }, [coords, map]); // already correct

  // Add this — fly immediately on mount if coords exist
  useEffect(() => {
    if (coords) {
      map.setView([coords.lat, coords.lng], 16);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// Component to handle click on map to pick a location
function MapClickHandler({ onLocationPick }) {
  useMapEvents({
    click(e) {
      onLocationPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Reverse geocode using Nominatim (free, no API key)
async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "en" },
  });
  if (!res.ok) throw new Error("Geocoding failed");
  return res.json();
}

function buildStreetAddress(nominatimData) {
  const a = nominatimData?.address || {};
  const parts = [
    a.house_number,
    a.road || a.pedestrian || a.footway || a.path,
    a.suburb || a.neighbourhood || a.quarter,
    a.city || a.town || a.village || a.county,
  ].filter(Boolean);
  return parts.join(", ") || nominatimData.display_name || "";
}

export default function RegisterPage() {
  const {
    notification,
    showSuccess,
    showError,
    showWarning,
    hideNotification,
  } = useNotification();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    phoneNumber: "",
    address: "Times Square, New York, NY 10036, USA",
    // location stores { lat, lng } as an object; serialised to string for display/validation
    location: { lat: 40.758, lng: -73.9855 },
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [mapCoords, setMapCoords] = useState({ lat: 40.758, lng: -73.9855 }); // New York default
  const [showMap, setShowMap] = useState(true);

  // ── helpers ─────────────────────────────────────────────────────────────────

  const checkEmailAvailability = async (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) return;
    try {
      const response = fetch(
        `${API_BASE_URL}/api/auth/check-email/${encodeURIComponent(email)}`,
      );
      if (response.ok) {
        const data = await response.json();
        if (!data.available) {
          setErrors((prev) => ({
            ...prev,
            email: "Email is already registered",
          }));
        }
      }
    } catch (error) {
      console.error("Error checking email:", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    if (name === "email") {
      clearTimeout(window.emailTimeout);
      window.emailTimeout = setTimeout(
        () => checkEmailAvailability(value),
        500,
      );
    }
  };

  // Apply a picked lat/lng: reverse geocode → fill address field
  const applyCoords = async (lat, lng) => {
    setLocationLoading(true);
    setLocationError("");
    const coords = { lat, lng };
    setMapCoords(coords);
    setShowMap(true);

    try {
      const geoData = await reverseGeocode(lat, lng);
      const streetAddr = buildStreetAddress(geoData);
      setFormData((prev) => ({
        ...prev,
        address: streetAddr,
        location: coords,
      }));
      setErrors((prev) => ({ ...prev, address: "", location: "" }));
    } catch (err) {
      setLocationError("Could not retrieve address. You can type it manually.");
      setFormData((prev) => ({ ...prev, location: coords }));
    } finally {
      setLocationLoading(false);
    }
  };

  // "Use Current Location" button
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }
    setLocationLoading(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await applyCoords(position.coords.latitude, position.coords.longitude);
      },
      (err) => {
        setLocationLoading(false);
        setLocationError(
          err.code === 1
            ? "Location permission denied. Please allow access or pick on the map."
            : "Unable to retrieve your location. Try picking on the map.",
        );
        // Still show map so user can pick manually
        setShowMap(true);
        // Default to New York if no coords yet
        if (!mapCoords) setMapCoords({ lat: 40.758, lng: -73.9855 }); // New York default
      },
    );
  };

  // Map click handler
  const handleMapClick = async (lat, lng) => {
    await applyCoords(lat, lng);
  };

  // ── validation ───────────────────────────────────────────────────────────────

  const validateForm = () => {
    const newErrors = {};
    if (!formData.email.trim()) newErrors.email = "Email is required";
    if (!formData.password) newErrors.password = "Password is required";
    if (!formData.confirmPassword)
      newErrors.confirmPassword = "Please confirm your password";
    if (!formData.firstName.trim())
      newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!formData.phoneNumber.trim())
      newErrors.phoneNumber = "Phone number is required";
    if (!formData.address.trim())
      newErrors.address = "Street address is required";
    if (!formData.location)
      newErrors.location = "Please pick a location on the map";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email))
      newErrors.email = "Please enter a valid email address";

    if (formData.password && formData.password.length < 6)
      newErrors.password = "Password must be at least 6 characters long";

    if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";

    const phoneRegex = /^[0-9+\-\s()]+$/;
    if (formData.phoneNumber && !phoneRegex.test(formData.phoneNumber))
      newErrors.phoneNumber = "Please enter a valid phone number";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phoneNumber: formData.phoneNumber,
          address: formData.address,
          location: formData.location, // { lat, lng }
        }),
      });

      const data = await response.json();
      if (response.ok) {
        showSuccess(
          "Success",
          data.message ||
            "Account created! Please verify your email before logging in.",
        );

        navigate("/check-email", {
          state: {
            email: formData.email,
          },
        });

        return;
      } else {
        if (!response.ok) {
          console.log(data);

          if (data.errors) {
            setErrors(data.errors);
          } else {
            showError(
              "Error",
              data.error || "An error occurred during registration.",
            );
          }

          return;
        }
      }
    } catch (error) {
      console.error("Registration failed:", error);
      showError("Error", "Something went wrong. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = () => {
    setShowLoginModal(false);
    navigate("/");
  };

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-400 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-white/30 overflow-hidden">
        {/* ── Header ── */}
        <div className="bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700 p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-8 left-12 text-6xl animate-bounce">
              🥕
            </div>
            <div className="absolute top-12 right-16 text-5xl animate-pulse">
              🍎
            </div>
            <div className="absolute bottom-10 left-20 text-4xl animate-bounce delay-300">
              🥬
            </div>
            <div className="absolute bottom-12 right-12 text-5xl animate-pulse delay-500">
              🛒
            </div>
            <div className="absolute top-1/2 left-1/3 text-3xl animate-bounce delay-700">
              🥛
            </div>
            <div className="absolute top-1/3 right-1/3 text-4xl animate-pulse delay-200">
              🍞
            </div>
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-white/25 backdrop-blur-lg rounded-full p-6 mr-6 border-3 border-white/40 shadow-2xl">
                <div className="flex items-center justify-center relative">
                  <ShoppingCart className="w-12 h-12 text-white mr-2" />
                  <Leaf className="w-8 h-8 text-yellow-300 absolute -top-1 -right-1" />
                  <Star className="w-4 h-4 text-yellow-400 absolute top-0 left-0 animate-pulse" />
                </div>
              </div>
              <div className="text-left">
                <h1 className="text-6xl font-black text-white tracking-wide mb-2">
                  Gro
                  <span className="text-yellow-300 drop-shadow-lg">Cart</span>
                </h1>
                <div className="flex items-center text-green-100 text-lg">
                  <Star className="w-4 h-4 mr-1 text-yellow-300" />
                  <span className="font-semibold">Fresh • Fast • Reliable</span>
                  <Star className="w-4 h-4 ml-1 text-yellow-300" />
                </div>
              </div>
            </div>
            <div className="max-w-2xl mx-auto">
              <p className="text-green-50 text-2xl font-semibold leading-relaxed">
                Create your account
              </p>
            </div>
          </div>
        </div>

        {/* ── Form Section ── */}
        <div className="p-10 space-y-6">
          {/* Email */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center">
              <Mail className="w-4 h-4 mr-2 text-green-600" />
              Email Address
            </label>
            <Input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter your email address"
              className={`w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${errors.email ? "border-red-500" : "border-gray-300"}`}
            />
            {errors.email && (
              <p className="text-red-500 text-sm">{errors.email}</p>
            )}
          </div>

          {/* Name Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                First Name
              </label>
              <Input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                placeholder="First name"
                className={`w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${errors.firstName ? "border-red-500" : "border-gray-300"}`}
              />
              {errors.firstName && (
                <p className="text-red-500 text-sm">{errors.firstName}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Last Name
              </label>
              <Input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                placeholder="Last name"
                className={`w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${errors.lastName ? "border-red-500" : "border-gray-300"}`}
              />
              {errors.lastName && (
                <p className="text-red-500 text-sm">{errors.lastName}</p>
              )}
            </div>
          </div>

          {/* Phone Number */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center">
              <Phone className="w-4 h-4 mr-2 text-green-600" />
              Phone Number
            </label>
            <Input
              type="tel"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleInputChange}
              placeholder="Enter your phone number"
              className={`w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${errors.phoneNumber ? "border-red-500" : "border-gray-300"}`}
            />
            {errors.phoneNumber && (
              <p className="text-red-500 text-sm">{errors.phoneNumber}</p>
            )}
          </div>

          {/* Password Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <Shield className="w-4 h-4 mr-2 text-green-600" />
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Create a strong password"
                  className={`w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 pr-10 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${errors.password ? "border-red-500" : "border-gray-300"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-sm">{errors.password}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm your password"
                  className={`w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 pr-10 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${errors.confirmPassword ? "border-red-500" : "border-gray-300"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-sm">{errors.confirmPassword}</p>
              )}
            </div>
          </div>

          {/* ── Delivery Address Section ── */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <MapPin className="w-5 h-5 mr-2 text-green-600" />
              Delivery Address
            </h3>

            {/* Use Current Location Button */}
            <Button
              type="button"
              onClick={getCurrentLocation}
              disabled={locationLoading}
              className="h-12 bg-gradient-to-r from-blue-800 to-blue-500 hover:from-blue-500 hover:to-blue-900 hover:shadow-xl hover:scale-102 rounded-lg flex items-center gap-2 px-5 text-white"
            >
              {locationLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Navigation className="w-4 h-4" />
              )}
              {locationLoading ? "Detecting location…" : "Use Current Location"}
            </Button>

            {/* Location error hint */}
            {locationError && (
              <p className="text-amber-600 text-sm flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {locationError}
              </p>
            )}

            {/* ── Leaflet Map ── */}
            {showMap && (
              <div className="rounded-xl overflow-hidden border-2 border-green-200 shadow-md">
                {/* Map hint */}
                <div className="bg-green-50 border-b border-green-200 px-4 py-2 text-sm text-green-700 flex items-center gap-2">
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  <span>
                    {mapCoords
                      ? "Drag the map or click anywhere to update your delivery location."
                      : "Click on the map to select your location."}
                  </span>
                </div>

                <MapContainer
                  key={
                    mapCoords ? `${mapCoords.lat}-${mapCoords.lng}` : "default"
                  }
                  center={
                    mapCoords
                      ? [mapCoords.lat, mapCoords.lng]
                      : [40.758, -73.9855]
                  }
                  zoom={mapCoords ? 16 : 12}
                  style={{ height: "320px", width: "100%" }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {/* Fly to new coords when they change */}
                  {mapCoords && <MapController coords={mapCoords} />}

                  {/* Click anywhere to pick a new location */}
                  <MapClickHandler onLocationPick={handleMapClick} />

                  {/* Marker at selected location */}
                  {mapCoords && (
                    <Marker
                      position={[mapCoords.lat, mapCoords.lng]}
                      icon={greenIcon}
                    >
                      <Popup>
                        <div className="text-sm">
                          <p className="font-semibold text-green-700 mb-1">
                            📍 Selected Location
                          </p>
                          {formData.address && (
                            <p className="text-gray-600 max-w-[200px]">
                              {formData.address}
                            </p>
                          )}
                          <p className="text-gray-400 text-xs mt-1">
                            {mapCoords.lat.toFixed(6)},{" "}
                            {mapCoords.lng.toFixed(6)}
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                </MapContainer>

                {/* Coordinates badge */}
                {mapCoords && (
                  <div className="bg-gray-50 border-t border-gray-200 px-4 py-2 text-xs text-gray-500 flex items-center gap-2">
                    <Navigation className="w-3 h-3 text-green-600" />
                    <span>
                      Lat: <strong>{mapCoords.lat.toFixed(6)}</strong> &nbsp;
                      Lng: <strong>{mapCoords.lng.toFixed(6)}</strong>
                    </span>
                    {locationLoading && (
                      <span className="ml-auto flex items-center gap-1 text-blue-500">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Fetching address…
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Street Address (auto-filled, also manually editable) */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-green-600" />
                Street Address
                <span className="text-xs text-gray-400 font-normal">
                  (auto-filled from map, you can edit)
                </span>
              </label>
              <Input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Your delivery street address"
                className={`w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${errors.address ? "border-red-500" : "border-gray-300"}`}
              />
              {errors.address && (
                <p className="text-red-500 text-sm">{errors.address}</p>
              )}
            </div>

            {/* location hidden validation error */}
            {errors.location && (
              <p className="text-red-500 text-sm flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {errors.location}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full h-16 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 hover:shadow-xl hover:scale-105 text-white font-semibold text-lg rounded-lg transition-all duration-300 flex items-center justify-center transform"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Creating Account…
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Create Account
              </>
            )}
          </Button>

          {/* Sign In Link */}
          <div className="text-center text-sm text-gray-600">
            Already have an account?{" "}
            <button
              onClick={() => setShowLoginModal(true)}
              className="text-green-600 hover:text-green-700 font-medium underline"
            >
              Sign in here
            </button>
          </div>
        </div>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
    </div>
  );
}