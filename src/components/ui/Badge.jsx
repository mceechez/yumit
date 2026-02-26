export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className = '',
}) {
  const variants = {
    default:   'bg-gray-200 text-gray-700',
    primary:   'bg-basket-green-100 text-basket-green-700',
    secondary: 'bg-basket-orange-100 text-basket-orange-700',
    success:   'bg-green-100 text-green-700',
    warning:   'bg-amber-100 text-amber-700',
    danger:    'bg-red-100 text-red-700',
    info:      'bg-blue-100 text-blue-700',
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-0.5',
    lg: 'text-base px-3 py-1',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </span>
  );
}

export function GradeBadge({ grade, size = 'lg' }) {
  const gradeVariants = {
    A: 'bg-green-100 text-green-700',
    B: 'bg-blue-100 text-blue-700',
    C: 'bg-amber-100 text-amber-700',
    D: 'bg-red-100 text-red-700',
  };

  const sizes = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-lg',
    xl: 'w-14 h-14 text-2xl',
  };

  return (
    <span
      className={`inline-flex items-center justify-center font-bold rounded-full ${gradeVariants[grade] || gradeVariants.D} ${sizes[size]}`}
    >
      {grade}
    </span>
  );
}

export default Badge;
