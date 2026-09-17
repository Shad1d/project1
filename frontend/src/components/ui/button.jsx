export function Button({ children, variant, className = "", ...props }) {
  const getVariantStyles = (variant) => {
    switch (variant) {
      case 'outline':
        return 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50';
      case 'ghost':
        return 'bg-transparent text-gray-700 hover:bg-gray-100';
      default:
        return 'bg-blue-500 text-white hover:bg-blue-600';
    }
  };

  const baseClasses = "px-3 py-1 rounded transition-colors duration-200";
  const variantClasses = getVariantStyles(variant);
  const finalClasses = `${baseClasses} ${variantClasses} ${className}`;

  return (
    <button 
      className={finalClasses}
      {...props}
    >
      {children}
    </button>
  );
}