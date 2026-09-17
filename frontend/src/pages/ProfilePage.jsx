import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Save,
  Navigation,
  Loader2,
  Package,
  Heart,
  Calendar,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useAuth } from "../context/AuthContext.jsx";
import { useNotification } from "../components/hooks/useNotification.js";
import { API_BASE_URL } from "../config/api.js";
import { Button } from "../components/ui/button.jsx";

// Fix Leaflet default marker icons broken by bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

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

function MapController({ coords }) {
  const map = useMap();

  useEffect(() => {
    if (coords && coords.lat && coords.lng) {
      map.flyTo([coords.lat, coords.lng], 15, { duration: 1 });
    }
  }, [coords, map]);

  return null;
}

function MapClickHandler({ onLocationPick }) {
  useMapEvents({
    click(e) {
      onLocationPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "en" },
  });
  if (!res.ok) throw new Error("Geocoding failed");
  return res.json();
}

function buildStreetAddress(data) {
  const a = data?.address || {};
  const parts = [
    a.house_number,
    a.road || a.pedestrian || a.footway || a.path,
    a.suburb || a.neighbourhood || a.quarter,
    a.city || a.town || a.village || a.county,
  ].filter(Boolean);
  return parts.join(", ") || data?.display_name || "";
}

export default function ProfilePage() {
  const { user, token, isLoggedIn, isHydrating, updateUser } = useAuth();
  const { showSuccess, showError } = useNotification();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("profile"); // "profile" | "location" | "security"

  // Profile Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState({ lat: 40.758, lng: -73.9855 }); // default New York
  const [profileSaving, setProfileSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  // Security Form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Initialize form data from user
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setPhoneNumber(user.phoneNumber || "");
      setAddress(user.address || "");

      if (
        user.location?.coordinates &&
        Array.isArray(user.location.coordinates) &&
        user.location.coordinates.length === 2
      ) {
        setCoords({
          lng: user.location.coordinates[0],
          lat: user.location.coordinates[1],
        });
      }
    }
  }, [user]);

  // Handle map click
  const handleMapLocationPick = async (lat, lng) => {
    setCoords({ lat, lng });
    setGeocoding(true);
    try {
      const geoData = await reverseGeocode(lat, lng);
      const generatedAddress = buildStreetAddress(geoData);
      if (generatedAddress) {
        setAddress(generatedAddress);
      }
    } catch (err) {
      console.warn("Reverse geocode error:", err);
    } finally {
      setGeocoding(false);
    }
  };

  // Browser geolocation detection
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      showError("Geolocation Error", "Your browser does not support geolocation.");
      return;
    }

    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });

        try {
          const geoData = await reverseGeocode(latitude, longitude);
          const genAddr = buildStreetAddress(geoData);
          if (genAddr) {
            setAddress(genAddr);
          }
        } catch (err) {
          console.warn("Reverse geocoding error:", err);
        } finally {
          setDetectingLocation(false);
          showSuccess("Location Detected", "Coordinates updated to your current position.");
        }
      },
      (err) => {
        setDetectingLocation(false);
        showError("Location Permission", "Could not retrieve your position: " + err.message);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Submit profile details
  const handleProfileSubmit = async (e) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      showError("Validation Error", "First and last name are required.");
      return;
    }

    if (!phoneNumber.trim()) {
      showError("Validation Error", "Phone number is required.");
      return;
    }

    if (!address.trim()) {
      showError("Validation Error", "Address is required.");
      return;
    }

    setProfileSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phoneNumber: phoneNumber.trim(),
          address: address.trim(),
          location: {
            lat: coords.lat,
            lng: coords.lng,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile.");
      }

      updateUser(data.user);
      showSuccess("Success", "Your profile has been updated.");
    } catch (err) {
      showError("Update Failed", err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  // Submit password change
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (!currentPassword) {
      showError("Validation Error", "Please enter your current password.");
      return;
    }

    if (newPassword.length < 8) {
      showError("Validation Error", "New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      showError("Validation Error", "New passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to change password.");
      }

      showSuccess("Password Changed", "Your password was successfully updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      showError("Password Update Failed", err.message);
    } finally {
      setPasswordSaving(false);
    }
  };

  if (isHydrating) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!isLoggedIn || !user) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
          <AlertCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Required</h2>
          <p className="text-gray-600 text-sm mb-6">
            Please log in to your GroCart account to view and edit your profile.
          </p>
          <Button
            onClick={() => navigate("/")}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2.5 rounded-xl"
          >
            Go to Homepage
          </Button>
        </div>
      </div>
    );
  }

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "Member";

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ── Page Header ── */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-white text-2xl sm:text-3xl font-extrabold shadow-lg shadow-emerald-500/20">
              {user.firstName ? user.firstName[0].toUpperCase() : "U"}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                  {user.firstName} {user.lastName}
                </h1>
                {user.isEmailVerified ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" /> Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                    Unverified
                  </span>
                )}
              </div>
              <p className="text-gray-500 text-sm mt-0.5">{user.email}</p>
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-2">
                <Calendar className="w-3.5 h-3.5" />
                <span>Member since {memberSince}</span>
              </div>
            </div>
          </div>

          {/* Quick Stats / Navigation */}
          <div className="grid grid-cols-3 gap-3">
            <Link
              to="/listings"
              className="p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-center transition-all group"
            >
              <Package className="w-5 h-5 text-emerald-600 mx-auto mb-1 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-semibold text-gray-800">My Listings</div>
            </Link>
            <Link
              to="/orders"
              className="p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-center transition-all group"
            >
              <CheckCircle2 className="w-5 h-5 text-sky-600 mx-auto mb-1 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-semibold text-gray-800">My Orders</div>
            </Link>
            <Link
              to="/wishlist"
              className="p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-center transition-all group"
            >
              <Heart className="w-5 h-5 text-rose-500 mx-auto mb-1 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-semibold text-gray-800">Wishlist</div>
            </Link>
          </div>
        </div>

        {/* ── Main Profile Body (Tabs + Content) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Navigation Tabs */}
          <div className="lg:col-span-1 space-y-2 bg-white border border-gray-200 p-3 rounded-2xl h-fit shadow-sm">
            <button
              onClick={() => setActiveTab("profile")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-left ${
                activeTab === "profile"
                  ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <User className="w-4 h-4 shrink-0" />
              <span>Personal Info</span>
            </button>

            <button
              onClick={() => setActiveTab("location")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-left ${
                activeTab === "location"
                  ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <MapPin className="w-4 h-4 shrink-0" />
              <span>Address &amp; Location</span>
            </button>

            <button
              onClick={() => setActiveTab("security")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-left ${
                activeTab === "security"
                  ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Lock className="w-4 h-4 shrink-0" />
              <span>Login &amp; Security</span>
            </button>
          </div>

          {/* Form Content Cards */}
          <div className="lg:col-span-3 space-y-6">
            {/* ── TAB 1: Personal Info ── */}
            {activeTab === "profile" && (
              <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
                <div className="border-b border-gray-150 pb-4 mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Personal Information</h2>
                  <p className="text-gray-500 text-xs mt-1">
                    Manage your identity, contact details, and account preferences.
                  </p>
                </div>

                <form onSubmit={handleProfileSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                        First Name
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Your first name"
                          className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-gray-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                        Last Name
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Your last name"
                          className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-gray-400"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        value={user.email}
                        disabled
                        readOnly
                        className="w-full bg-gray-50 border border-gray-200 text-gray-500 text-sm rounded-xl pl-10 pr-24 py-3 cursor-not-allowed select-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-medium flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5 text-amber-500" /> Locked
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Email address is permanently linked to your account and cannot be changed.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="e.g. +880 1700 000000"
                        className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-gray-400"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-gray-150">
                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors flex items-center gap-2 shadow-md shadow-emerald-500/20 cursor-pointer"
                    >
                      {profileSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ── TAB 2: Address & Location ── */}
            {activeTab === "location" && (
              <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
                <div className="border-b border-gray-150 pb-4">
                  <h2 className="text-xl font-bold text-gray-900">Address &amp; Delivery Location</h2>
                  <p className="text-gray-500 text-xs mt-1">
                    Your location is used for calculated shipping distances, nearby marketplace search, and order delivery.
                  </p>
                </div>

                <form onSubmit={handleProfileSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                      Street Address
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
                      <textarea
                        rows={3}
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Apartment, building, street, area, city..."
                        className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none placeholder:text-gray-400"
                      />
                    </div>
                  </div>

                  {/* Interactive Map Picker */}
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                        <span>Pinpoint on Map</span>
                        {geocoding && (
                          <span className="text-emerald-600 text-[11px] font-normal flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Fetching address...
                          </span>
                        )}
                      </label>

                      <button
                        type="button"
                        onClick={handleDetectLocation}
                        disabled={detectingLocation}
                        className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer w-fit"
                      >
                        {detectingLocation ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Detecting...</span>
                          </>
                        ) : (
                          <>
                            <Navigation className="w-3.5 h-3.5" />
                            <span>Detect My Location</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="rounded-xl overflow-hidden border border-gray-200 h-72 w-full relative z-0 shadow-inner">
                      <MapContainer
                        center={[coords.lat, coords.lng]}
                        zoom={15}
                        scrollWheelZoom={false}
                        className="h-full w-full"
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <Marker position={[coords.lat, coords.lng]} icon={greenIcon}>
                          <Popup>
                            Selected Location: <br />
                            {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                          </Popup>
                        </Marker>
                        <MapController coords={coords} />
                        <MapClickHandler onLocationPick={handleMapLocationPick} />
                      </MapContainer>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                      <span>Click anywhere on the map to place your pin.</span>
                      <span className="font-mono text-gray-400">
                        {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-gray-150">
                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors flex items-center gap-2 shadow-md shadow-emerald-500/20 cursor-pointer"
                    >
                      {profileSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving Location...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Save Address &amp; Location</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ── TAB 3: Security / Password ── */}
            {activeTab === "security" && (
              <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
                <div className="border-b border-gray-150 pb-4 mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Login &amp; Password</h2>
                  <p className="text-gray-500 text-xs mt-1">
                    Keep your account secure by using a strong, unique password.
                  </p>
                </div>

                <form onSubmit={handlePasswordSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                      Current Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type={showCurrentPass ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter your current password"
                        className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-xl pl-10 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-gray-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type={showNewPass ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-xl pl-10 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-gray-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type={showConfirmPass ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-type new password"
                        className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-xl pl-10 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-gray-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-gray-150">
                    <button
                      type="submit"
                      disabled={passwordSaving}
                      className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors flex items-center gap-2 shadow-md shadow-emerald-500/20 cursor-pointer"
                    >
                      {passwordSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Updating Password...</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" />
                          <span>Update Password</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}