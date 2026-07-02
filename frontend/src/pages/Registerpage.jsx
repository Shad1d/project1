export default function RegisterPage() {
  return (
    // Outer wrapper — full screen, gradient background, centered
    <div className="min-h-screen bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-400 flex items-center justify-center p-4">
      {/* White card */}
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* ── Header ── */}
        <div className="bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700 p-12 text-center">
          <h1 className="text-6xl font-black text-white tracking-wide mb-2">
            Gro<span className="text-yellow-300">Cart</span>
          </h1>
          <p className="text-green-50 text-2xl font-semibold">
            Create your account
          </p>
        </div>

        {/* ── Form ── */}
        <div className="p-10 space-y-6">
          {/* Email */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Email Address
            </label>
            {/*
              NOTE: This input is "uncontrolled" — React doesn't track its value yet.
              We will fix that in Step 2 when we add useState.
            */}
            <input
              type="email"
              placeholder="Enter your email address"
              className="w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {/* First Name + Last Name — side by side on medium screens */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                First Name
              </label>
              <input
                type="text"
                placeholder="First name"
                className="w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Last Name
              </label>
              <input
                type="text"
                placeholder="Last name"
                className="w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>

          {/* Phone Number */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Phone Number
            </label>
            <input
              type="tel"
              placeholder="Enter your phone number"
              className="w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {/* Password + Confirm Password — side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                placeholder="Create a strong password"
                className="w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <input
                type="password"
                placeholder="Confirm your password"
                className="w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>

          {/* Street Address */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Street Address
            </label>
            <input
              type="text"
              placeholder="Your delivery street address"
              className="w-full h-16 text-lg bg-white text-gray-900 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {/* Submit Button — does nothing yet */}
          <button
            type="button"
            className="w-full h-16 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold text-lg rounded-lg transition-all duration-300"
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}
