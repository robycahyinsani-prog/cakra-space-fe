export default function Button({ 
  children, 
  type = "button", 
  variant = "primary", 
  loading = false,
  disabled = false,
  onClick,
  className = ""
}) {
  const baseStyle = "px-4 py-2 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-brown-500 text-white hover:bg-brown-600",
    secondary: "bg-gray-200 text-brown-900 hover:bg-gray-300",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };

  return (
    <button
      type={type}
      className={`${baseStyle} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? "Memproses..." : children}
    </button>
  );
}