import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api.js";
import {
  Mail,
  ArrowRight,
  RefreshCw,
  ShoppingCart,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

const RESEND_COOLDOWN = 60; // seconds

export const CheckEmail = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const email = location.state?.email;

  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [canResend, setCanResend] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState(null); // "success" | "error"
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const id = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [countdown]);
  useEffect(() => {
    if (!email) {
      navigate("/register");
    }
  }, [email, navigate]);
  const handleResend = async () => {
    if (!canResend || resending) return;
    setResending(true);
    setResendStatus(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/auth/resend-verification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );
      if (res.ok) {
        setResendStatus("success");
        setCountdown(RESEND_COOLDOWN);
        setCanResend(false);
      } else {
        setResendStatus("error");
      }
    } catch {
      setResendStatus("error");
    } finally {
      setResending(false);
    }
  };

  const steps = [
    {
      icon: "📬",
      title: "Open your inbox",
      desc: "Look for an email from GroCart",
    },
    {
      icon: "🔍",
      title: "Check spam / junk",
      desc: "Sometimes it lands there",
    },
    {
      icon: "✅",
      title: "Click the link",
      desc: "It activates your account instantly",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-emerald-100 to-emerald-200 flex items-center justify-center px-4 py-8 font-sans relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute w-[400px] h-[400px] bg-emerald-300 rounded-full blur-[60px] opacity-35 pointer-events-none -top-24 -left-24" />
      <div className="absolute w-[300px] h-[300px] bg-emerald-400 rounded-full blur-[60px] opacity-35 pointer-events-none -bottom-20 -right-20" />
      <div className="absolute w-[200px] h-[200px] bg-amber-200 rounded-full blur-[60px] opacity-35 pointer-events-none top-1/2 left-[60%]" />

      {/* Card */}
      <div
        className={`w-full max-w-[520px] bg-white/85 backdrop-blur-xl rounded-[2rem] shadow-[0_25px_60px_rgba(6,78,59,0.12),0_0_0_1px_rgba(255,255,255,0.6)] overflow-hidden relative z-10 transition-all duration-[550ms] ease-[cubic-bezier(.22,1,.36,1)] ${
          visible
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-7 scale-[0.98]"
        }`}
      >
        {/* Banner */}
        <div className="bg-gradient-to-br from-emerald-900 via-emerald-600 to-emerald-400 px-8 pt-10 pb-8 text-center relative overflow-hidden">
          {/* Stripe overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.03) 20px, rgba(255,255,255,0.03) 40px)",
            }}
          />

          {/* Floating dots */}
          {[
            "top-[18%] left-[10%] animate-[float-dot_3s_ease-in-out_infinite] [animation-delay:0s]",
            "top-[30%] right-[12%] animate-[float-dot_3s_ease-in-out_infinite] [animation-delay:0.6s]",
            "bottom-[20%] left-[18%] animate-[float-dot_3s_ease-in-out_infinite] [animation-delay:1.2s]",
          ].map((cls, i) => (
            <span
              key={i}
              className={`absolute w-1.5 h-1.5 bg-white/50 rounded-full ${cls}`}
            />
          ))}

          {/* Envelope icon */}
          <div className="inline-flex items-center justify-center w-22 h-22 bg-white/15 rounded-full border-2 border-white/30 mb-5 relative animate-[pulse-ring_2.5s_ease-in-out_infinite]">
            <Mail size={38} strokeWidth={1.5} className="text-white" />
          </div>

          <h1 className="font-serif text-[1.75rem] font-black text-white leading-tight mb-1 relative">
            Check your email
          </h1>
          <p className="text-white/75 text-sm relative">
            One step away from your first order 🛒
          </p>
        </div>

        {/* Body */}
        <div className="p-8">
          {/* Success badge */}
          <div className="flex items-center gap-2 mb-5">
            <CheckCircle size={18} className="text-emerald-500" />
            <span className="text-[0.9rem] font-semibold text-emerald-900">
              Account created successfully!
            </span>
          </div>

          {/* Email pill */}
          <div className="flex items-center gap-3 bg-emerald-50 border-[1.5px] border-emerald-300 rounded-[0.875rem] px-5 py-[0.875rem] mb-7">
            <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
              <Mail size={16} className="text-emerald-500" />
            </div>
            <div>
              <div className="text-[0.7rem] text-gray-500 font-medium uppercase tracking-[0.07em]">
                Verification sent to
              </div>
              <div className="text-[0.95rem] text-emerald-900 font-semibold break-all">
                {email}
              </div>
            </div>
          </div>

          {/* Expiry warning */}
          <div className="flex items-center gap-2 text-[0.78rem] text-amber-700 bg-amber-50 border border-amber-200 rounded-[0.625rem] px-[0.875rem] py-[0.6rem] mb-6">
            <Clock size={14} className="text-amber-700 shrink-0" />
            This verification link expires in{" "}
            <strong className="ml-0.5">24 hours</strong>. Please verify soon.
          </div>

          {/* Steps */}
          <p className="font-serif text-base font-bold text-gray-800 mb-4">
            What to do next
          </p>
          <div className="flex flex-col gap-3 mb-7">
            {steps.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-4 bg-gray-50 border border-gray-100 rounded-xl px-4 py-[0.875rem] transition-colors duration-200 hover:bg-emerald-50 hover:border-emerald-200"
              >
                <span className="text-[1.4rem] shrink-0">{s.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {s.title}
                  </div>
                  <div className="text-[0.78rem] text-gray-400">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-gray-200 my-6" />

          {/* Resend section */}
          <div className="text-center">
            <p className="text-[0.85rem] text-gray-500 mb-3">
              Didn't receive anything?
            </p>
            <button
              onClick={handleResend}
              disabled={!canResend || resending}
              className="inline-flex items-center gap-2 bg-gradient-to-br from-emerald-900 to-emerald-500 text-white border-none rounded-[0.625rem] px-6 py-[0.7rem] text-sm font-semibold cursor-pointer transition-all duration-200 disabled:opacity-45 disabled:cursor-not-allowed hover:not-disabled:opacity-90 hover:not-disabled:-translate-y-px"
            >
              <RefreshCw
                size={14}
                className={resending ? "animate-spin" : ""}
              />
              {resending ? "Sending…" : "Resend verification email"}
            </button>

            {!canResend && !resendStatus && (
              <div className="inline-flex items-center gap-1.5 text-[0.78rem] text-gray-400 mt-2.5">
                <Clock size={12} />
                Resend available in {countdown}s
              </div>
            )}

            {resendStatus === "success" && (
              <div className="flex items-center gap-2 text-[0.82rem] text-emerald-900 bg-emerald-100 rounded-lg px-[0.875rem] py-[0.6rem] mt-3">
                <CheckCircle size={14} />
                Email resent! Check your inbox again.
              </div>
            )}
            {resendStatus === "error" && (
              <div className="flex items-center gap-2 text-[0.82rem] text-red-800 bg-red-100 rounded-lg px-[0.875rem] py-[0.6rem] mt-3">
                <AlertCircle size={14} />
                Couldn't resend. Please try again later.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-1.5 font-serif font-black text-base text-emerald-900">
            <ShoppingCart size={16} />
            Gro<span className="text-amber-400">Cart</span>
          </div>
          <button
            onClick={() => navigate("/register")}
            className="flex items-center gap-1 text-[0.8rem] text-emerald-500 bg-transparent border-none cursor-pointer underline underline-offset-2 hover:text-emerald-900 transition-colors"
          >
            Wrong email? Re-register
            <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* Keyframe styles for animations not supported natively in Tailwind */}
      <style>{`
        @keyframes pulse-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.3); }
          50% { box-shadow: 0 0 0 14px rgba(255,255,255,0); }
        }
        @keyframes float-dot {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
};

export default CheckEmail;