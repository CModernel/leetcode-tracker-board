import { useEffect } from "react";
import { X } from "lucide-react";

// A short message at the bottom of the screen that goes away by itself.
// Give it a new `key` to show the same message again and restart the timer.
// With `actionLabel` and `onAction` it also shows a button (for example
// "Undo"); pressing it runs the action and closes the message.
const Toast = ({
  message,
  onClose,
  duration = 4000,
  actionLabel,
  onAction,
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 max-w-[90vw] px-4 py-3 rounded-lg shadow-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm"
    >
      <span>{message}</span>
      {actionLabel && (
        <button
          onClick={() => {
            onAction?.();
            onClose();
          }}
          className="flex-shrink-0 font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
        >
          {actionLabel}
        </button>
      )}
      <button
        onClick={onClose}
        aria-label="Close message"
        className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default Toast;
