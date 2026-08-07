import { useState, useEffect } from "react";
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
import LoginModal from "../components/auth/LoginModal";
import { API_BASE_URL } from "../config/api.js";

// ── Leaflet bundler fix ───────────────────────────────────────
// Webpack / Vite break Leaflet's built-in icon URLs.
// We delete the broken getter and supply the CDN URLs manually.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Green marker for the selected location (instead of the default blue)
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

// ── MapController ─────────────────────────────────────────────
// A tiny component that lives INSIDE <MapContainer>.
// useMap() gives us the raw Leaflet map instance.
// We use useEffect to fly to new coords whenever they change.
function MapController({ coords }) {
  const map = useMap();

  // Fly smoothly whenever coords update
  useEffect(() => {
    if (coords) map.flyTo([coords.lat, coords.lng], 16, { duration: 1.2 });
  }, [coords, map]);
  // 16->zoom level, duration in seconds

  // Jump instantly on first mount (no animation)
  useEffect(() => {
    if (coords) map.setView([coords.lat, coords.lng], 16);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null; // renders nothing — it only provides behaviour
}

// ── MapClickHandler ───────────────────────────────────────────
// Also lives inside <MapContainer>.
// useMapEvents() attaches Leaflet event listeners to the map.
function MapClickHandler({ onLocationPick }) {
  useMapEvents({
    click(e) {
      onLocationPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ── Reverse geocode helper ────────────────────────────────────
// Nominatim is the free geocoding service from OpenStreetMap.
// No API key needed for low-volume personal use.
async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
  const res = await fetch(url, { headers: { "Accept-Language": "en" } });
  if (!res.ok) throw new Error("Geocoding failed");
  return res.json();
}

// {
//   display_name:
//     "Dhanmondi, Dhaka, Bangladesh",

//   address: {
//     road: "Road 27",
//     suburb: "Dhanmondi",
//     city: "Dhaka"
//   }
// }

// Build a readable street address from the Nominatim response object
function buildStreetAddress(nominatimData) {
  const a = nominatimData?.address || {};
  const parts = [
    a.house_number,
    a.road || a.pedestrian || a.footway || a.path,
    a.suburb || a.neighbourhood || a.quarter,
    a.city || a.town || a.village || a.county,
  ].filter(Boolean); // drop any undefined / empty values
  return parts.join(", ") || nominatimData.display_name || "";
}

// ── Main component ────────────────────────────────────────────
export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    phoneNumber: "",
    address: "",
    location: null, // { lat, lng } — null until the user picks a spot
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Map-specific state
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [mapCoords, setMapCoords] = useState(null); // { lat, lng }
  const [showMap, setShowMap] = useState(false);

  // ── Input handler (same as Step 2) ───────────────────────
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // ── applyCoords — the core map action ────────────────────
  // Called whenever we get new coordinates (from GPS or map click).
  // Reverse geocodes them and fills the address field automatically.
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
    } catch {
      setLocationError("Could not retrieve address. You can type it manually.");
      setFormData((prev) => ({ ...prev, location: coords }));
    } finally {
      setLocationLoading(false);
    }
  };

  // ── "Use Current Location" button ────────────────────────
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
        // Still show the map so the user can click manually
        setShowMap(true);
        if (!mapCoords) setMapCoords({ lat: 23.8103, lng: 90.4125 }); // Dhaka default
      },
    );
  };

  // ── Map click handler ─────────────────────────────────────
  const handleMapClick = async (lat, lng) => {
    await applyCoords(lat, lng);
  };

  // ── Validation (same as Step 2 + location check) ─────────
  const validateForm = () => {
    const newErrors = {};
    if (!formData.email.trim()) newErrors.email = "Email is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email))
      newErrors.email = "Please enter a valid email address";
    if (!formData.firstName.trim())
      newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!formData.phoneNumber.trim())
      newErrors.phoneNumber = "Phone number is required";
    const phoneRegex = /^[0-9+\-\s()]+$/;
    if (formData.phoneNumber && !phoneRegex.test(formData.phoneNumber))
      newErrors.phoneNumber = "Please enter a valid phone number";
    if (!formData.password) newErrors.password = "Password is required";
    if (formData.password && formData.password.length < 6)
      newErrors.password = "Password must be at least 6 characters long";
    if (!formData.confirmPassword)
      newErrors.confirmPassword = "Please confirm your password";
    if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";
    if (!formData.address.trim())
      newErrors.address = "Street address is required";
    if (!formData.location)
      newErrors.location = "Please pick a location on the map";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

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

  // ── Submit — still no API call (comes in Step 4) ─────────
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
          }
          return;
        }
      }
    } catch (error) {
      console.error("Registration failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = () => {
    setShowLoginModal(false);
    navigate("/");
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-400 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700 p-12 text-center">
          <h1 className="text-6xl font-black text-white tracking-wide mb-2">
            Gro<span className="text-yellow-300">Cart</span>
          </h1>
          <p className="text-green-50 text-2xl font-semibold">
            Create your account
          </p>
        </div>

        <div className="p-10 space-y-6">
          {/* Email */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter your email address"
              className={`w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                errors.email ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.email && (
              <p className="text-red-500 text-sm">{errors.email}</p>
            )}
          </div>

          {/* First Name + Last Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                First Name
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                placeholder="First name"
                className={`w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                  errors.firstName ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.firstName && (
                <p className="text-red-500 text-sm">{errors.firstName}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Last Name
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                placeholder="Last name"
                className={`w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                  errors.lastName ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.lastName && (
                <p className="text-red-500 text-sm">{errors.lastName}</p>
              )}
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Phone Number
            </label>
            <input
              type="tel"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleInputChange}
              placeholder="Enter your phone number"
              className={`w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                errors.phoneNumber ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.phoneNumber && (
              <p className="text-red-500 text-sm">{errors.phoneNumber}</p>
            )}
          </div>

          {/* Password + Confirm */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Create a strong password"
                  className={`w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                    errors.password ? "border-red-500" : "border-gray-300"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                >
                  {showPassword ? "Hide" : "Show"}
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
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm your password"
                  className={`w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                    errors.confirmPassword
                      ? "border-red-500"
                      : "border-gray-300"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-sm">{errors.confirmPassword}</p>
              )}
            </div>
          </div>

          {/* ── Delivery Address Section ── */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">
              Delivery Address
            </h3>

            {/* "Use Current Location" button */}
            <button
              type="button"
              onClick={getCurrentLocation}
              disabled={locationLoading}
              className="h-12 bg-gradient-to-r from-blue-800 to-blue-500 hover:from-blue-500 hover:to-blue-900 rounded-lg flex items-center gap-2 px-5 text-white disabled:opacity-60"
            >
              {locationLoading
                ? "Detecting location…"
                : "📍 Use Current Location"}
            </button>

            {/* Error / hint text below the button */}
            {locationError && (
              <p className="text-amber-600 text-sm">{locationError}</p>
            )}

            {/* ── Leaflet Map — only rendered when showMap is true ── */}
            {showMap && (
              <div className="rounded-xl overflow-hidden border-2 border-green-200 shadow-md">
                {/* Hint strip above the map */}
                <div className="bg-green-50 border-b border-green-200 px-4 py-2 text-sm text-green-700">
                  {mapCoords
                    ? "Drag the map or click anywhere to update your delivery location."
                    : "Click on the map to select your location."}
                </div>

                {/*
                  MapContainer is the root react-leaflet component.
                    center          — where the map is initially centred
                    zoom            — initial zoom (16 = street level)
                    key             — changing this forces a full re-mount;
                                      useful when coords jump far away
                    scrollWheelZoom — lets the user zoom with the mouse wheel
                */}
                <MapContainer
                  key={
                    mapCoords ? `${mapCoords.lat}-${mapCoords.lng}` : "default"
                  }
                  center={
                    mapCoords
                      ? [mapCoords.lat, mapCoords.lng]
                      : [23.8103, 90.4125]
                  }
                  zoom={mapCoords ? 16 : 12}
                  style={{ height: "320px", width: "100%" }}
                  scrollWheelZoom={true}
                >
                  {/* TileLayer fetches the actual map tile images from OpenStreetMap */}
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {/* Our two helper components live inside the map */}
                  {mapCoords && <MapController coords={mapCoords} />}
                  <MapClickHandler onLocationPick={handleMapClick} />

                  {/* Green marker at the selected position */}
                  {mapCoords && (
                    <Marker
                      position={[mapCoords.lat, mapCoords.lng]}
                      icon={greenIcon}
                    >
                      <Popup>
                        <p className="font-semibold text-green-700">
                          📍 Selected Location
                        </p>
                        {formData.address && (
                          <p className="text-gray-600 max-w-[200px]">
                            {formData.address}
                          </p>
                        )}
                        <p className="text-gray-400 text-xs mt-1">
                          {mapCoords.lat.toFixed(6)}, {mapCoords.lng.toFixed(6)}
                        </p>
                      </Popup>
                    </Marker>
                  )}
                </MapContainer>

                {/* Coordinates badge below the map */}
                {mapCoords && (
                  <div className="bg-gray-50 border-t border-gray-200 px-4 py-2 text-xs text-gray-500">
                    Lat: <strong>{mapCoords.lat.toFixed(6)}</strong> &nbsp; Lng:{" "}
                    <strong>{mapCoords.lng.toFixed(6)}</strong>
                    {locationLoading && (
                      <span className="ml-4 text-blue-500">
                        Fetching address…
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Street Address — auto-filled by reverse geocode, but editable */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Street Address{" "}
                <span className="text-xs text-gray-400 font-normal">
                  (auto-filled from map, you can edit)
                </span>
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Your delivery street address"
                className={`w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                  errors.address ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.address && (
                <p className="text-red-500 text-sm">{errors.address}</p>
              )}
            </div>

            {/* Location validation error — shown when no pin has been placed */}
            {errors.location && (
              <p className="text-red-500 text-sm">📍 {errors.location}</p>
            )}
          </div>

          {/* Submit button — no API call yet */}
          <button
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
          </button>
        </div>
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
