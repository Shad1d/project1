import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../components/hooks/useNotification";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  ShoppingCart,
  ArrowRight,
  Mail,
} from "lucide-react";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showSuccess, showError } = useNotification();

  const [status, setStatus] = useState("loading"); // "loading" | "success" | "error"
  const [message, setMessage] = useState("Verifying your email address...");
  const [countdown, setCountdown] = useState(3);
  const [visible, setVisible] = useState(false);

  const hasVerified = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (hasVerified.current) return;
    hasVerified.current = true;

    const verifyEmail = async () => {
      const token = searchParams.get("token");

      if (!token) {
        setStatus("error");
        setMessage("Verification token is missing from the link.");
        showError("Verification Error", "Verification token is missing from the link.");
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`,
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              data.message ||
              "Verification failed. Please try again.",
          );
        }

        if (data.user && data.token) {
          login(data.user, data.token);
        }

        setStatus("success");
        const successMsg = data.message || "Your email has been verified successfully!";
        setMessage(successMsg);
        showSuccess("Email Verified! 🎉", successMsg);
      } catch (error) {
        console.error("Verification error:", error);
        setStatus("error");
        setMessage(error.message || "Verification failed. Please try again.");
        showError("Verification Failed", error.message || "Verification failed. Please try again.");
      }
    };

    verifyEmail();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown redirect on success
  useEffect(() => {
    if (status !== "success") return;
    if (countdown <= 0) {
      navigate("/", { replace: true });
      return;
    }
    const id = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [status, countdown, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-emerald-100 to-emerald-200 flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute w-[400px] h-[400px] bg-emerald-300 rounded-full blur-[60px] opacity-30 pointer-events-none -top-24 -left-24" />
      <div className="absolute w-[300px] h-[300px] bg-emerald-400 rounded-full blur-[60px] opacity-30 pointer-events-none -bottom-20 -right-20" />
      <div className="absolute w-[200px] h-[200px] bg-amber-200 rounded-full blur-[60px] opacity-30 pointer-events-none top-1/2 left-[60%]" />

      {/* Card */}
      <div
        className={`w-full max-w-[500px] bg-white/90 backdrop-blur-xl rounded-[2rem] shadow-[0_25px_60px_rgba(6,78,59,0.12),0_0_0_1px_rgba(255,255,255,0.6)] overflow-hidden relative z-10 transition-all duration-[550ms] ease-[cubic-bezier(.22,1,.36,1)] ${
          visible
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-7 scale-[0.98]"
        }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-900 via-emerald-600 to-emerald-400 px-8 pt-10 pb-8 text-center relative overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.03) 20px, rgba(255,255,255,0.03) 40px)",
            }}
          />

          {/* Animated icon */}
          <div
            className="inline-flex items-center justify-center w-[88px] h-[88px] rounded-full bg-white/15 border-2 border-white/30 mb-5 relative"
            style={
              status === "loading"
                ? { animation: "pulse-ring 2s ease-in-out infinite" }
                : {}
            }
          >
            {status === "loading" && (
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            )}
            {status === "success" && (
              <CheckCircle className="w-10 h-10 text-white" />
            )}
            {status === "error" && (
              <AlertCircle className="w-10 h-10 text-white" />
            )}
          </div>

          <h1 className="text-[1.75rem] font-black text-white leading-tight mb-1">
            {status === "loading" && "Verifying Email"}
            {status === "success" && "All Set! 🎉"}
            {status === "error" && "Verification Failed"}
          </h1>
          <p className="text-white/75 text-sm">
            {status === "loading" && "Hang tight, just a moment…"}
            {status === "success" && "Your account is now active"}
            {status === "error" && "Something went wrong"}
          </p>
        </div>

        {/* Body */}
        <div className="p-8">
          {/* LOADING */}
          {status === "loading" && (
            <div className="text-center py-4">
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-emerald-100" />
                  <div
                    className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-emerald-500"
                    style={{ animation: "spin 0.8s linear infinite" }}
                  />
                </div>
              </div>
              <p className="text-gray-700 font-semibold text-lg mb-1">
                Verifying your account…
              </p>
              <p className="text-gray-400 text-sm">
                This will only take a moment.
              </p>
            </div>
          )}

          {/* SUCCESS */}
          {status === "success" && (
            <div className="text-center">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-11 h-11 text-emerald-500" />
              </div>

              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Welcome to GroCart!
              </h2>
              <p className="text-gray-500 text-sm mb-6">{message}</p>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium mb-1">
                  <CheckCircle size={15} />
                  You're now logged in
                </div>
                <p className="text-emerald-600 text-sm">
                  Redirecting to homepage in{" "}
                  <span className="font-bold text-emerald-800">
                    {countdown}s
                  </span>
                  …
                </p>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: `${((3 - countdown) / 3) * 100}%`,
                    transition: "width 1s linear",
                  }}
                />
              </div>
            </div>
          )}

          {/* ERROR */}
          {status === "error" && (
            <div className="text-center">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <AlertCircle className="w-11 h-11 text-red-400" />
              </div>

              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Verification Failed
              </h2>
              <p className="text-gray-500 text-sm mb-6">{message}</p>

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-700 text-sm mb-6">
                The link may have expired or already been used. Try registering
                again to get a new link.
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => navigate("/register")}
                  className="w-full bg-gradient-to-br from-emerald-900 to-emerald-500 hover:opacity-90 text-white py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <Mail size={16} />
                  Create New Account
                </button>
                <button
                  onClick={() => navigate("/")}
                  className="w-full border border-gray-200 text-gray-600 hover:bg-gray-50 py-3 rounded-xl font-semibold transition-all duration-200"
                >
                  Back to Homepage
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 bg-gray-50 px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-black text-base text-emerald-900">
            <ShoppingCart size={16} />
            Gro<span className="text-amber-400">Cart</span>
          </div>

          {status === "success" && (
            <button
              onClick={() => navigate("/", { replace: true })}
              className="flex items-center gap-1 text-[0.8rem] text-emerald-500 hover:text-emerald-900 transition-colors"
            >
              Go now
              <ArrowRight size={12} />
            </button>
          )}

          {status === "error" && (
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1 text-[0.8rem] text-emerald-500 hover:text-emerald-900 transition-colors"
            >
              Home
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.3); }
          50% { box-shadow: 0 0 0 14px rgba(255,255,255,0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}