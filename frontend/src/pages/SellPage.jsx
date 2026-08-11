import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  X,
  Plus,
  Tag,
  Package,
  FileText,
  MapPin,
  ChevronDown,
  AlertCircle,
  Image,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import Notification from "../components/common/Notification.jsx";
import { useNotification } from "../components/hooks/useNotification.js";
import {API_BASE_URL} from "../config/api.js";

const CATEGORIES = [
  "Electronics & Gadgets",
  "Furniture & Home",
  "Clothing & Accessories",
  "Books & Stationery",
  "Sports & Outdoors",
  "Toys & Games",
  "Tools & Equipment",
  "Vehicles & Parts",
  "Kitchen & Appliances",
  "Musical Instruments",
  "Art & Collectibles",
  "Other",
];

const CONDITIONS = [
  { 
    value: "new", 
    label: "New", 
    desc: "Never used, original packaging" 
  },
  {
    value: "like_new",
    label: "Like new",
    desc: "Used once or twice, no visible wear",
  },
  {
    value: "good",
    label: "Good",
    desc: "Minor signs of use, fully functional",
  },
  { 
    value: "fair", 
    label: "Fair", 
    desc: "Visible wear, works as expected" 
  },
  { 
    value: "poor", 
    label: "For parts", 
    desc: "Damaged or incomplete" 
  },
];

const MAX_IMAGES = 6;

const Label = ({ children, required }) => (
  <label className="block text-sm font-medium text-gray-700 mb-1.5">
    {children}
    {required && <span className="text-red-400 ml-0.5">*</span>}
  </label>
);

const FieldError = ({ field, errors }) =>
  errors[field] ? (
    <p
      data-error
      className="mt-1.5 text-xs text-red-500 flex items-center gap-1"
    >
      <AlertCircle size={12} /> {errors[field]}
    </p>
  ) : null;

const SectionCard = ({ icon: Icon, title, children }) => (
  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
    <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 bg-gray-50/60">
      <Icon size={16} className="text-[#1D9E75]" />
      <h2 className="text-sm font-medium text-gray-800">{title}</h2>
    </div>
    <div className="p-5 space-y-4">{children}</div>
  </div>
);

export default function SellPage() {
  const { token, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const { notification, hideNotification, showSuccess, showError } =
    useNotification();

  const [listingType, setListingType] = useState("sell"); // "sell" | "rent"
  const [images, setImages] = useState([]); // { file, preview }[]
  const [dragOver, setDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    title: "",
    category: "",
    condition: "",
    description: "",
    price: "",
    // rent-specific
    rentPricePerDay: "",
    minRentalDays: "",
    maxRentalDays: "",
    depositAmount: "",
    rentTerms: "",
    // extra
    quantity: "1",
    isBrandNew: false,
    negotiable: false,
    deliveryAvailable: false,
  });

  const set = (field) => (e) => {
    const value =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  // ── Image handling ──────────────────────────────────────────────────────────

  const addImages = (files) => {
    const valid = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const remaining = MAX_IMAGES - images.length;
    const toAdd = valid.slice(0, remaining).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setImages((prev) => [...prev, ...toAdd]);
    if (errors.images) setErrors((prev) => ({ ...prev, images: null }));
  };

  const removeImage = (idx) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addImages(e.dataTransfer.files);
  };

  // ── Validation ──────────────────────────────────────────────────────────────

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (form.title.length > 100) e.title = "Max 100 characters";
    if (!form.category) e.category = "Select a category";
    if (!form.condition) e.condition = "Select a condition";
    if (!form.description.trim()) e.description = "Description is required";
    if (form.description.length > 2000) e.description = "Max 2000 characters";
    if (images.length === 0) e.images = "At least one photo is required";

    if (listingType === "sell") {
      if (!form.price) e.price = "Price is required";
      else if (isNaN(form.price) || +form.price < 0)
        e.price = "Enter a valid price";
    } else {
      if (!form.rentPricePerDay) e.rentPricePerDay = "Daily price is required";
      else if (isNaN(form.rentPricePerDay) || +form.rentPricePerDay < 0)
        e.rentPricePerDay = "Enter a valid price";
      if (form.minRentalDays && isNaN(form.minRentalDays))
        e.minRentalDays = "Must be a number";
      if (form.maxRentalDays && isNaN(form.maxRentalDays))
        e.maxRentalDays = "Must be a number";
      if (form.depositAmount && isNaN(form.depositAmount))
        e.depositAmount = "Must be a number";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isLoggedIn) {
      navigate("/");
      return;
    }

    if (!validate()) {
      document
        .querySelector("[data-error]")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = new FormData();

      payload.append("listingType", listingType);
      Object.entries(form).forEach(([k, v]) => payload.append(k, v));
      images.forEach(({ file }) => payload.append("images", file));

      const res = await fetch(`${API_BASE_URL}/api/listings`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: payload,
      });

      const data = await res.json();

      if (res.ok) {
        showSuccess(
          "Listing Published! 🎉",
          `"${form.title}" is now live on the marketplace.`,
        );
        setTimeout(() => navigate(`/listings`), 2000);
      } else {
        showError(
          "Failed to Publish",
          data.error || "Something went wrong. Please try again.",
        );
      }
    } catch {
      showError(
        "Network Error",
        "Could not reach the server. Please check your connection.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Field helpers ───────────────────────────────────────────────────────────

  const inputCls = (field) =>
    `w-full px-3 py-2.5 rounded-lg border text-sm bg-white text-gray-900 outline-none transition
     focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]
     ${errors[field] ? "border-red-400 bg-red-50" : "border-gray-200 hover:border-gray-300"}`;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50/70">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">
            List a product up for sale or rent
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Fill in the details below to post your item to the marketplace.
          </p>
        </div>

        {/* Listing type toggle */}
        <div className="w-full flex rounded-xl border border-gray-200 bg-white p-1 mb-6 w-fit gap-1">
          {[
            { value: "sell", label: "For sale", icon: Plus },
            { value: "rent", label: "For rent", icon: Plus },
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setListingType(value)}
              className={`w-full flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all
                ${
                  listingType === value
                    ? "bg-[#1D9E75] text-white"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Photos */}
          <SectionCard
            icon={Image}
            title="Upload one or more photos of the product"
          >
            <div>
              {errors.images && (
                <p
                  data-error
                  className="mb-3 text-xs text-red-500 flex items-center gap-1"
                >
                  <AlertCircle size={12} /> {errors.images}
                </p>
              )}

              {/* Drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() =>
                  images.length < MAX_IMAGES && fileInputRef.current.click()
                }
                className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
                  ${dragOver ? "border-[#1D9E75] bg-[#1D9E75]/5" : "border-gray-200 hover:border-gray-300 bg-gray-50/50"}
                  ${images.length >= MAX_IMAGES ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <Upload size={22} className="mx-auto mb-2 text-gray-400" />
                <p className="text-sm font-medium text-gray-600">
                  {dragOver
                    ? "Drop to add"
                    : "Drag photos here or click to browse"}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {images.length}/{MAX_IMAGES} photos · JPG, PNG, WEBP
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => addImages(e.target.files)}
                />
              </div>

              {/* Image previews */}
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {images.map(({ preview }, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group"
                    >
                      <img
                        src={preview}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      {idx === 0 && (
                        <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded font-medium">
                          Cover
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove photo"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {images.length < MAX_IMAGES && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current.click()}
                      className="aspect-square rounded-lg border-2 border-dashed border-gray-200 hover:border-[#1D9E75] flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-[#1D9E75] transition-colors"
                    >
                      <Plus size={18} />
                      <span className="text-xs">Add more</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </SectionCard>

          {/* Basic details */}
          <SectionCard icon={FileText} title="Details">
            <div>
              <Label required>Name of the product</Label>
              <input
                className={inputCls("title")}
                placeholder="e.g. Sony WH-1000XM5 Headphones"
                value={form.title}
                onChange={set("title")}
                maxLength={100}
              />
              <div className="flex justify-between items-start">
                <FieldError field="title" errors={errors} />
                <span className="text-xs text-gray-400 mt-1 ml-auto">
                  {form.title.length}/100
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label required>Category</Label>
                <div className="relative">
                  <select
                    className={`${inputCls("category")} appearance-none pr-8`}
                    value={form.category}
                    onChange={set("category")}
                  >
                    <option value="">Select category</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={15}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
                <FieldError field="category" errors={errors} />
              </div>

              <div>
                <Label>Quantity</Label>
                <input
                  type="number"
                  min="1"
                  className={inputCls("quantity")}
                  value={form.quantity}
                  onChange={set("quantity")}
                />
              </div>
            </div>

            <div>
              <Label required>Condition</Label>
              <div className="grid grid-cols-1 gap-2">
                {CONDITIONS.map(({ value, label, desc }) => (
                  <label
                    key={value}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg border cursor-pointer transition-all
                      ${
                        form.condition === value
                          ? "border-[#1D9E75] bg-[#1D9E75]/5"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors
                      ${form.condition === value ? "border-[#1D9E75]" : "border-gray-300"}`}
                    >
                      {form.condition === value && (
                        <div className="w-2 h-2 rounded-full bg-[#1D9E75]" />
                      )}
                    </div>
                    <input
                      type="radio"
                      name="condition"
                      value={value}
                      onChange={set("condition")}
                      className="hidden"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-800">
                        {label}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">{desc}</span>
                    </div>
                  </label>
                ))}
              </div>
              <FieldError field="condition" errors={errors} />
            </div>

            <div>
              <Label required>Description</Label>
              <textarea
                className={`${inputCls("description")} resize-none`}
                rows={4}
                placeholder="Describe your item — brand, model, specs, any defects, reason for selling…"
                value={form.description}
                onChange={set("description")}
                maxLength={2000}
              />
              <div className="flex justify-between items-start">
                <FieldError field="description" errors={errors} />
                <span className="text-xs text-gray-400 mt-1 ml-auto">
                  {form.description.length}/2000
                </span>
              </div>
            </div>
          </SectionCard>

          {/* Pricing */}
          <SectionCard
            icon={Tag}
            title={listingType === "sell" ? "Pricing" : "Rental terms"}
          >
            {listingType === "sell" ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label required>Price (৳)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                        ৳
                      </span>
                      <input
                        type="number"
                        min="0"
                        className={`${inputCls("price")} pl-7`}
                        placeholder="0"
                        value={form.price}
                        onChange={set("price")}
                      />
                    </div>
                    <FieldError field="price" errors={errors} />
                  </div>
                </div>

                <div className="flex items-center gap-5 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div
                      onClick={() =>
                        setForm((p) => ({ ...p, negotiable: !p.negotiable }))
                      }
                      className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5
                        ${form.negotiable ? "bg-[#1D9E75]" : "bg-gray-200"}`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${form.negotiable ? "translate-x-4" : "translate-x-0"}`}
                      />
                    </div>
                    <span className="text-sm text-gray-700">
                      Price negotiable
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          deliveryAvailable: !p.deliveryAvailable,
                        }))
                      }
                      className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5
                        ${form.deliveryAvailable ? "bg-[#1D9E75]" : "bg-gray-200"}`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${form.deliveryAvailable ? "translate-x-4" : "translate-x-0"}`}
                      />
                    </div>
                    <span className="text-sm text-gray-700">
                      Delivery available
                    </span>
                  </label>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label required>Price per day (৳)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                        ৳
                      </span>
                      <input
                        type="number"
                        min="0"
                        className={`${inputCls("rentPricePerDay")} pl-7`}
                        placeholder="0"
                        value={form.rentPricePerDay}
                        onChange={set("rentPricePerDay")}
                      />
                    </div>
                    <FieldError field="rentPricePerDay" errors={errors} />
                  </div>

                  <div>
                    <Label>Security deposit (৳)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                        ৳
                      </span>
                      <input
                        type="number"
                        min="0"
                        className={`${inputCls("depositAmount")} pl-7`}
                        placeholder="Optional"
                        value={form.depositAmount}
                        onChange={set("depositAmount")}
                      />
                    </div>
                    <FieldError field="depositAmount" errors={errors} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Min. rental (days)</Label>
                    <input
                      type="number"
                      min="1"
                      className={inputCls("minRentalDays")}
                      placeholder="e.g. 1"
                      value={form.minRentalDays}
                      onChange={set("minRentalDays")}
                    />
                    <FieldError field="minRentalDays" errors={errors} />
                  </div>
                  <div>
                    <Label>Max. rental (days)</Label>
                    <input
                      type="number"
                      min="1"
                      className={inputCls("maxRentalDays")}
                      placeholder="e.g. 30"
                      value={form.maxRentalDays}
                      onChange={set("maxRentalDays")}
                    />
                    <FieldError field="maxRentalDays" errors={errors} />
                  </div>
                </div>

                <div>
                  <Label>Rental terms & conditions</Label>
                  <textarea
                    className={`${inputCls("rentTerms")} resize-none`}
                    rows={3}
                    placeholder="Any special conditions — pickup/return instructions, wear & tear policy, ID required, etc."
                    value={form.rentTerms}
                    onChange={set("rentTerms")}
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        deliveryAvailable: !p.deliveryAvailable,
                      }))
                    }
                    className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5
                      ${form.deliveryAvailable ? "bg-[#1D9E75]" : "bg-gray-200"}`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${form.deliveryAvailable ? "translate-x-4" : "translate-x-0"}`}
                    />
                  </div>
                  <span className="text-sm text-gray-700">
                    Pickup / delivery available
                  </span>
                </label>
              </>
            )}
          </SectionCard>

          {/* Submit */}
          <div className="flex gap-3 pt-1 pb-6">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-[2] py-2.5 rounded-xl bg-[#1D9E75] hover:bg-[#0F6E56] text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Publishing…
                </>
              ) : (
                `Publish ${listingType === "sell" ? "sale" : "rental"} listing`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
