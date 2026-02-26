import { useEffect, useState } from 'react';

/**
 * Toast notification — slides up from bottom, auto-dismisses.
 *
 * Props:
 *   message   string    Text to display
 *   type      'success' | 'error' | 'info'   (default 'success')
 *   duration  number    ms before auto-dismiss (default 2500)
 *   onDismiss function  Called when the toast finishes exiting
 */
export function Toast({ message, type = 'success', duration = 2500, onDismiss }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setExiting(true), duration);
    return () => clearTimeout(timer);
  }, [duration]);

  useEffect(() => {
    if (!exiting) return;
    const timer = setTimeout(() => onDismiss?.(), 250); // match toast-out duration
    return () => clearTimeout(timer);
  }, [exiting, onDismiss]);

  const colours = {
    success: 'bg-basket-green-500 text-gray-50',
    error:   'bg-red-500 text-white',
    info:    'bg-blue-500 text-white',
  };

  const icons = {
    success: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div className="fixed bottom-24 left-0 right-0 flex justify-center z-50 px-4 pointer-events-none">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg max-w-sm w-full pointer-events-auto
          ${colours[type]}
          ${exiting ? 'animate-toast-out' : 'animate-toast-in'}`}
      >
        {icons[type]}
        <span className="text-sm font-medium leading-snug">{message}</span>
      </div>
    </div>
  );
}

/**
 * Hook to manage toast state. Returns [toastProps, showToast].
 *
 * Usage:
 *   const [toast, showToast] = useToast();
 *   showToast('Saved!');
 *   ...
 *   {toast && <Toast {...toast} />}
 */
export function useToast() {
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success', duration = 2500) => {
    setToast({ message, type, duration, key: Date.now() });
  };

  const dismiss = () => setToast(null);

  return [
    toast ? { ...toast, onDismiss: dismiss } : null,
    showToast,
  ];
}

export default Toast;
