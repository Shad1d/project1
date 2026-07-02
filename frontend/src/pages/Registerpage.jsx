

import { useState } from "react";

export default function RegisterPage() {
    // ── All form fields live in one state object ──────────────
    // This is a common pattern: instead of one useState per field,
    // we keep them all together. It makes handleInputChange simpler.
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        confirmPassword: "",
        firstName: "",
        lastName: "",
        phoneNumber: "",
        address: "",
    });

    // errors object: { email: "Email is required", password: "..." }
    // An empty object means no errors.
    const [errors, setErrors] = useState({});

    // Controls whether the password text is visible
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // ── Single handler for ALL inputs ────────────────────────
    // e.target.name tells us WHICH field changed (must match the
    // `name` attribute on each <input>).
    // NEED TO EXPLAIN OBJECTS
    const handleInputChange = (e) => {
        // event = {
        //   target: {
        //     name: "email",
        //     value: "a",
        //   },
        // };

        // <input name="email" value="john@gmail.com" />;
        const { name, value } = e.target;

        // Spread the previous state and only update the changed field
        setFormData((prev) => ({ ...prev, [name]: value }));
        //     { previous
        //         firstName: "John",
        //         email: "",
        //         password: ""
        //      }
        //     { after
        //         firstName: "John",
        //         email: "johndoe@gmail.com",
        //         password: ""
        //      }

        // Clear the error for this field as soon as the user starts typing
        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }
    };

    // ── Validation ────────────────────────────────────────────
    // Returns true when everything is valid, false otherwise.
    // Also populates the errors state so we can show messages.
    const validateForm = () => {
      const newErrors = {};

      if (!formData.email.trim()) {
        newErrors.email = "Email is required";
      }
      const emailRegex = /^[^\s]+@[^\s@]+\.[^\s@]+$/;
      if (formData.email && !emailRegex.test(formData.email))
        newErrors.email = "Please enter a valid email address";

      if (!formData.firstName.trim())
        newErrors.firstName = "First name is required";

      if (!formData.lastName.trim())
        newErrors.lastName = "Last name is required";

      if (!formData.phoneNumber.trim())
        newErrors.phoneNumber = "Phone number is required";

      const phoneRegex = /^[0-9+\-\s()]+$/;
      if (formData.phoneNumber && !phoneRegex.test(formData.phoneNumber))
      {
        newErrors.phoneNumber = "Please enter a valid phone number";
      }
      if (!formData.password) newErrors.password = "Password is required";

      if (formData.password && formData.password.length < 6)
        newErrors.password = "Password must be at least 6 characters long";

      if (!formData.confirmPassword)
        newErrors.confirmPassword = "Please confirm your password";

      if (formData.password !== formData.confirmPassword)
        newErrors.confirmPassword = "Passwords do not match";

      if (!formData.address.trim())
        newErrors.address = "Street address is required";

      setErrors(newErrors);

      // If newErrors has any keys, the form is invalid
      return Object.keys(newErrors).length === 0;
    };

    // ── Submit ────────────────────────────────────────────────
    // No API call yet — we just validate and log.
    // The real API call comes in Step 3.
    const handleSubmit = () => {
        if (!validateForm()) return; // Stop here if there are errors
        console.log("Form is valid! Data to send:", formData);
        alert("Form valid! Check the browser console. (API call added in Step 3)");
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

                {/* Form */}
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
                            className={`w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${errors.email ? "border-red-500" : "border-gray-300"
                                }`}
                        />
                        {/* Only render the error paragraph when there IS an error */}
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
                                className={`w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${errors.firstName ? "border-red-500" : "border-gray-300"
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
                                className={`w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${errors.lastName ? "border-red-500" : "border-gray-300"
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
                            className={`w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${errors.phoneNumber ? "border-red-500" : "border-gray-300"
                                }`}
                        />
                        {errors.phoneNumber && (
                            <p className="text-red-500 text-sm">{errors.phoneNumber}</p>
                        )}
                    </div>

                    {/* Password + Confirm — with show/hide toggle */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Password */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">
                                Password
                            </label>
                            {/*
                We wrap the input in a `relative` div so we can
                position the show/hide button absolutely on the right.
              */}
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    placeholder="Create a strong password"
                                    className={`w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${errors.password ? "border-red-500" : "border-gray-300"
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

                        {/* Confirm Password */}
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
                                    className={`w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${errors.confirmPassword
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

                    {/* Address */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            Street Address
                        </label>
                        <input
                            type="text"
                            name="address"
                            value={formData.address}
                            onChange={handleInputChange}
                            placeholder="Your delivery street address"
                            className={`w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${errors.address ? "border-red-500" : "border-gray-300"
                                }`}
                        />
                        {errors.address && (
                            <p className="text-red-500 text-sm">{errors.address}</p>
                        )}
                    </div>

                    {/* Submit */}
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="w-full h-16 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold text-lg rounded-lg transition-all duration-300"
                    >
                        Create Account
                    </button>
                </div>
            </div>
        </div>
    );
}
