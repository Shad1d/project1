import { useState, useEffect } from "react";

const LoginModal = ({ isOpen, onClose, onLoginSuccess }) => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (isOpen) {
      setFormData({ email: "", password: "" });
      setError("");
      setSuccess("");
      setShowPassword(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // -----------------------------------------------------------
  // ← NEW: handleInputChange
  // -----------------------------------------------------------
  // This single function handles BOTH the email and password fields.
  //
  // When the user types, the browser fires an "onChange" event
  // and passes an event object (e) to this function.
  //
  //   e.target       → the <input> element that was typed into
  //   e.target.name  → the "name" attribute of that input
  //                    ("email" or "password")
  //   e.target.value → whatever the user just typed
  //
  // We use "computed property keys" ([name]: value) to dynamically
  // set whichever key matches the input's name attribute.
  // -----------------------------------------------------------
  const handleInputChange = (e) => {
    const { name, value } = e.target; // pull name & value from the input

    setFormData((prev) => ({
      // ...prev copies ALL existing fields from the old state first.
      // Without this, updating email would wipe out the password field!
      ...prev,

      // Then we overwrite just the one field that changed.
      // [name] is a "computed property key" — it evaluates the variable
      // and uses its value as the key name.
      // If name === "email", this becomes { email: value }.
      [name]: value,
    }));

    // Clear any error message as soon as the user starts retyping.
    // This gives immediate feedback that they can try again.
    if (error) setError("");
  };

  // -----------------------------------------------------------
  // handleBackdropClick — close if user clicks the dark overlay
  // -----------------------------------------------------------
  // e.target  → what was actually clicked
  // e.currentTarget → the element this handler is attached to (the overlay div)
  //
  // If they are the same, the user clicked the overlay itself,
  // not something inside it (like the white card).
  // -----------------------------------------------------------
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.4)",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "1.5rem",
          padding: "2rem",
          width: "100%",
          maxWidth: "400px",
          margin: "0 1rem",
          position: "relative",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          style={{ position: "absolute", top: "1rem", right: "1rem" }}
        >
          ✕
        </button>

        <h2 style={{ marginBottom: "0.25rem" }}>Welcome Back</h2>
        <p style={{ color: "gray", marginBottom: "1.5rem" }}>
          Sign in to your account
        </p>

        {/* ← NEW: The actual form */}
        {/* onSubmit fires when the user presses Enter or clicks the submit button.
            We'll wire up handleSubmit in Step 3. */}
        <form onSubmit={(e) => e.preventDefault()}>
          {/* ── Email Field ── */}
          <div style={{ marginBottom: "1rem" }}>
            {/* htmlFor connects the label to the input by matching the input's id.
                Clicking the label focuses the input — improves accessibility. */}
            <label
              htmlFor="email"
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: 500,
              }}
            >
              Email address
            </label>

            {/* KEY CONCEPT: Controlled Input
                value={formData.email}       → React controls what's displayed
                onChange={handleInputChange} → React updates state on every keystroke
                
                With a controlled input, the displayed value ALWAYS matches
                what's in state. React is the single source of truth. */}
            <input
              type="email"
              id="email"
              name="email" // must match the key inside formData
              value={formData.email} // controlled: React owns the value
              onChange={handleInputChange} // update state on every keystroke
              placeholder="Enter your email address"
              required
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                border: "1px solid #d1d5db",
                borderRadius: "0.5rem",
                fontSize: "1rem",
              }}
            />
          </div>

          {/* ── Password Field ── */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: 500,
              }}
            >
              Password
            </label>

            <div style={{ position: "relative" }}>
              <input
                // ← This is why we track showPassword in state:
                // switching between "password" (shows dots) and "text" (shows chars)
                type={showPassword ? "text" : "password"}
                id="password"
                name="password" // must match the key inside formData
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter your password"
                required
                disabled={isLoading}
                style={{
                  width: "100%",
                  padding: "0.75rem 3rem 0.75rem 1rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                }}
              />

              {/* ← Show / Hide toggle
                  
                  IMPORTANT: type="button" is required here!
                  Inside a <form>, a <button> defaults to type="submit".
                  Without type="button", clicking "Show" would try to
                  submit the form before the user is ready. */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "gray",
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Submit button — disabled if fields are empty.
              We'll add the real submit logic in Step 3. */}
          <button
            type="submit"
            disabled={!formData.email || !formData.password}
            style={{
              width: "100%",
              padding: "0.75rem",
              background:
                !formData.email || !formData.password ? "#d1d5db" : "#f59e0b",
              color: "white",
              border: "none",
              borderRadius: "0.5rem",
              fontSize: "1rem",
              fontWeight: 600,
              cursor:
                !formData.email || !formData.password
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;

// =============================================================
// QUICK RECAP — Questions to ask the student:
//
// 1. What makes an input "controlled"?
//    → It has value={...} pointing to state, and onChange updates
//      that state on every keystroke.
//
// 2. What would happen if we removed ...prev from setFormData?
//    → Updating the email field would delete the password, and
//      vice versa — because we'd be replacing the whole object
//      with just one field.
//
// 3. Why does the show/hide button need type="button"?
//    → Without it, the browser defaults to type="submit" and
//      submits the form when the user clicks "Show".
//
// 4. Why do we use htmlFor on labels instead of just "for"?
//    → "for" is a reserved word in JavaScript. JSX uses htmlFor.
// =============================================================
