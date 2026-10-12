import { CheckCircle, XCircle, X } from "lucide-react";

const Notification = ({ show, type = "success", title, message, onClose }) => {
  if (!show) return null;

  const notificationStyles = {
    success: {
      background: "bg-[#edf2ed]",
      border: "border-[#1d4d3e]",
      iconBackground: "bg-[#1d4d3e]",
      title: "text-[#153a30]",
      icon: CheckCircle,
    },
    error: {
      background: "bg-red-50",
      border: "border-red-300",
      iconBackground: "bg-red-500",
      title: "text-red-800",
      icon: XCircle,
    },
    warning: {
      background: "bg-[#f4e6df]",
      border: "border-[#d66b4a]",
      iconBackground: "bg-[#d66b4a]",
      title: "text-[#8f432e]",
      icon: XCircle,
    },
    info: {
      background: "bg-[#f5f2e9]",
      border: "border-[#1d4d3e]",
      iconBackground: "bg-[#1d4d3e]",
      title: "text-[#153a30]",
      icon: CheckCircle,
    },
  };

  const styles = notificationStyles[type] ?? notificationStyles.success;
  const IconComponent = styles.icon;

  return (
    <div className="fixed top-4 left-1/2 z-[99999] pointer-events-none w-full flex justify-center">
      <div
        className={`w-11/12 max-w-md rounded-xl border bg-white shadow-lg transition-all duration-200 pointer-events-auto relative overflow-hidden ${styles.border}`}
        style={{ width: "min(440px, calc(100vw - 32px))" }}
      >
        <div className="h-1 w-full bg-[#1d4d3e]" />

        <div className={`px-5 py-4 relative ${styles.background}`}>
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <div
                className={`w-10 h-10 ${styles.iconBackground} rounded-full flex items-center justify-center`}
              >
                <IconComponent
                  className="w-5 h-5 text-white"
                />
              </div>
            </div>
            <div className="ml-5 flex-1">
              <h3
                className={`text-base font-bold ${styles.title} mb-1`}
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
                className="inline-flex text-gray-400 hover:text-gray-700 focus:outline-none focus:text-gray-700 transition-colors rounded-full p-2 hover:bg-white/80"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Notification;