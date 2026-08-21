import React, { useEffect } from "react";
import { CheckCircle, XCircle, X } from "lucide-react";

const Notification = ({ show, type = "success", title, message, onClose }) => {
  useEffect(() => {
    // Add custom CSS to document head if not already present
    if (!document.getElementById("notification-styles")) {
      const style = document.createElement("style");
      style.id = "notification-styles";
      style.textContent = `
        @keyframes slideInFromTop {
          0% {
            transform: translateX(-50%) translateY(-150px) scale(0.8) rotate(-5deg);
            opacity: 0;
            filter: blur(10px);
          }
          30% {
            transform: translateX(-50%) translateY(-20px) scale(1.05) rotate(2deg);
            opacity: 0.7;
            filter: blur(3px);
          }
          70% {
            transform: translateX(-50%) translateY(8px) scale(1.02) rotate(-1deg);
            opacity: 0.95;
            filter: blur(1px);
          }
          100% {
            transform: translateX(-50%) translateY(0) scale(1) rotate(0deg);
            opacity: 1;
            filter: blur(0px);
          }
        }
        
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
          }
          50% {
            transform: scale(1.1);
            opacity: 0.9;
            box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
          }
        }
        
        @keyframes glow {
          0%, 100% {
            box-shadow: 0 0 30px rgba(59, 130, 246, 0.4);
          }
          50% {
            box-shadow: 0 0 60px rgba(59, 130, 246, 0.8), 0 0 90px rgba(59, 130, 246, 0.3);
          }
        }
        
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
            opacity: 0.3;
          }
          50% {
            opacity: 0.8;
          }
          100% {
            background-position: 200% 0;
            opacity: 0.3;
          }
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        
        .notification-enter {
          animation: slideInFromTop 1s cubic-bezier(0.68, -0.55, 0.265, 1.8);
        }
        
        .notification-icon-pulse {
          animation: pulse 2.5s ease-in-out infinite, float 3s ease-in-out infinite;
        }
        
        .notification-glow {
          animation: glow 4s ease-in-out infinite;
        }
        
        .notification-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
          background-size: 200% 100%;
          animation: shimmer 3s linear infinite;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  if (!show) return null;

  const getNotificationStyles = () => {
    switch (type) {
      case "success":
        return {
          bgColor: "bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50",
          borderColor: "border-emerald-400",
          iconBg: "bg-gradient-to-br from-emerald-400 to-green-500",
          iconColor: "text-white",
          titleColor: "text-emerald-900",
          glowColor: "shadow-emerald-500/40",
          icon: CheckCircle,
          accentColor: "from-emerald-400 to-green-500",
        };
      case "error":
        return {
          bgColor: "bg-gradient-to-br from-red-50 via-rose-50 to-pink-50",
          borderColor: "border-red-400",
          iconBg: "bg-gradient-to-br from-red-400 to-rose-500",
          iconColor: "text-white",
          titleColor: "text-red-900",
          glowColor: "shadow-red-500/40",
          icon: XCircle,
          accentColor: "from-red-400 to-rose-500",
        };
      case "warning":
        return {
          bgColor: "bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50",
          borderColor: "border-amber-400",
          iconBg: "bg-gradient-to-br from-amber-400 to-orange-500",
          iconColor: "text-white",
          titleColor: "text-amber-900",
          glowColor: "shadow-amber-500/40",
          icon: XCircle,
          accentColor: "from-amber-400 to-orange-500",
        };
      case "info":
        return {
          bgColor: "bg-gradient-to-br from-blue-50 via-cyan-50 to-indigo-50",
          borderColor: "border-blue-400",
          iconBg: "bg-gradient-to-br from-blue-400 to-cyan-500",
          iconColor: "text-white",
          titleColor: "text-blue-900",
          glowColor: "shadow-blue-500/40",
          icon: CheckCircle,
          accentColor: "from-blue-400 to-cyan-500",
        };
      default:
        return {
          bgColor: "bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50",
          borderColor: "border-emerald-400",
          iconBg: "bg-gradient-to-br from-emerald-400 to-green-500",
          iconColor: "text-white",
          titleColor: "text-emerald-900",
          glowColor: "shadow-emerald-500/40",
          icon: CheckCircle,
          accentColor: "from-emerald-400 to-green-500",
        };
    }
  };

  const styles = getNotificationStyles();
  const IconComponent = styles.icon;

  // Helper function for bright gradient backgrounds
  const getBrightGradient = (notificationType) => {
    switch (notificationType) {
      case "success":
        return "rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 50%, rgba(6, 182, 212, 0.1) 100%";
      case "error":
        return "rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 127, 0.05) 50%, rgba(236, 72, 153, 0.1) 100%";
      case "warning":
        return "rgba(245, 158, 11, 0.1) 0%, rgba(251, 146, 60, 0.05) 50%, rgba(249, 115, 22, 0.1) 100%";
      case "info":
        return "rgba(59, 130, 246, 0.1) 0%, rgba(14, 165, 233, 0.05) 50%, rgba(99, 102, 241, 0.1) 100%";
      default:
        return "rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 50%, rgba(6, 182, 212, 0.1) 100%";
    }
  };

  // Helper function for glow shadows
  const getGlowShadow = (notificationType) => {
    switch (notificationType) {
      case "success":
        return "0 0 40px rgba(16, 185, 129, 0.4), 0 0 80px rgba(16, 185, 129, 0.2)";
      case "error":
        return "0 0 40px rgba(239, 68, 68, 0.4), 0 0 80px rgba(239, 68, 68, 0.2)";
      case "warning":
        return "0 0 40px rgba(245, 158, 11, 0.4), 0 0 80px rgba(245, 158, 11, 0.2)";
      case "info":
        return "0 0 40px rgba(59, 130, 246, 0.4), 0 0 80px rgba(59, 130, 246, 0.2)";
      default:
        return "0 0 40px rgba(16, 185, 129, 0.4), 0 0 80px rgba(16, 185, 129, 0.2)";
    }
  };

  return (
    <div className="fixed top-4 left-1/2 z-[99999] pointer-events-none w-full flex justify-center">
      <div
        className={`bg-white rounded-2xl shadow-2xl max-w-md w-11/12 sm:w-full transition-all duration-500 ease-in-out pointer-events-auto border-2 ${styles.borderColor} ${styles.glowColor} notification-enter backdrop-blur-lg relative overflow-hidden`}
        style={{
          width: "min(440px, calc(100vw - 32px))",
          transform: "translateX(-50%)",
          boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1), ${getGlowShadow(type)}`,
        }}
      >
        {/* Top accent gradient bar */}
        <div
          className={`h-1.5 bg-gradient-to-r ${styles.accentColor} w-full`}
        />

        {/* Shimmer overlay */}
        <div className="absolute inset-0 notification-shimmer pointer-events-none opacity-60" />

        {/* Main content area with enhanced background */}
        <div
          className={`px-6 py-6 rounded-t-2xl relative ${styles.bgColor} backdrop-blur-sm`}
          style={{
            background: `linear-gradient(135deg, ${getBrightGradient(type)})`,
          }}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <div
                className={`w-12 h-12 ${styles.iconBg} rounded-full flex items-center justify-center notification-icon-pulse shadow-xl ring-4 ring-white/50 backdrop-blur-sm`}
                style={{
                  boxShadow: `0 8px 25px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3)`,
                }}
              >
                <IconComponent
                  className={`w-7 h-7 ${styles.iconColor} drop-shadow-lg`}
                />
              </div>
            </div>
            <div className="ml-5 flex-1">
              <h3
                className={`text-xl font-bold ${styles.titleColor} drop-shadow-sm mb-1`}
              >
                {title}
              </h3>
              <p className="text-sm text-gray-800 leading-relaxed font-medium opacity-90">
                {message}
              </p>
            </div>
            <div className="ml-4 flex-shrink-0">
              <button
                onClick={onClose}
                className="inline-flex text-gray-400 hover:text-gray-700 focus:outline-none focus:text-gray-700 transition-all ease-in-out duration-200 rounded-full p-2.5 hover:bg-white/80 hover:shadow-lg hover:scale-110 active:scale-95 backdrop-blur-sm ring-2 ring-transparent hover:ring-white/30"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom glow effect */}
        <div
          className={`h-0.5 bg-gradient-to-r ${styles.accentColor} w-full opacity-70`}
        />
      </div>
    </div>
  );
};

export default Notification;


