export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  ...props
}) {
  const baseClasses = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-50 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95';

  const variants = {
    // Dark text on bright green — meets contrast
    primary:   'bg-basket-green-500 hover:bg-basket-green-400 text-gray-50 focus:ring-basket-green-500',
    secondary: 'bg-basket-orange-500 hover:bg-basket-orange-400 text-gray-50 focus:ring-basket-orange-400',
    outline:   'border-2 border-basket-green-500 text-basket-green-500 hover:bg-basket-green-50 focus:ring-basket-green-500',
    ghost:     'text-gray-600 hover:bg-gray-200 focus:ring-gray-400',
    danger:    'bg-red-500 hover:bg-red-400 text-white focus:ring-red-500',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}

export default Button;
