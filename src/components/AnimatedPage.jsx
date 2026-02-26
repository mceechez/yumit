/**
 * Wraps a page's root element to add the fade-up entrance animation.
 * Use as the outermost element of every page component.
 */
export function AnimatedPage({ children, className = '' }) {
  return (
    <div className={`animate-fade-up ${className}`}>
      {children}
    </div>
  );
}

export default AnimatedPage;
