import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

// How long the fade takes. The message starts fading this long before
// `duration` ends, so it is gone right at `duration`.
export const FADE_MS = 200;

// A short message at the bottom of the screen that fades in, and fades out
// before it goes away by itself. Give it a new `key` to show the same message
// again and restart the timer. With `actionLabel` and `onAction` it also shows
// a button (for example "Undo"); pressing it runs the action and closes the
// message.
const Toast = ({
  message,
  onClose,
  duration = 4000,
  actionLabel,
  onAction,
}) => {
  const [leaving, setLeaving] = useState(false);
  const closeTimer = useRef(null);

  // Fade out, then close
  const dismiss = () => {
    setLeaving(true);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(onClose, FADE_MS);
  };

  useEffect(() => {
    const fade = setTimeout(
      () => setLeaving(true),
      Math.max(0, duration - FADE_MS)
    );
    const close = setTimeout(onClose, duration);
    return () => {
      clearTimeout(fade);
      clearTimeout(close);
      clearTimeout(closeTimer.current);
    };
  }, [onClose, duration]);

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 pointer-events-none">
      <div
        role="status"
        aria-live="polite"
        data-leaving={leaving}
        style={{ animation: leaving ? undefined : "toast-in 200ms ease-out" }}
        className={`pointer-events-auto flex items-center gap-3 max-w-full px-4 py-3 rounded-lg shadow-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm transition duration-200 ease-in motion-reduce:transition-none ${
          leaving ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
        }`}
      >
        <span>{message}</span>
        {actionLabel && (
          <button
            onClick={() => {
              onAction?.();
              dismiss();
            }}
            className="flex-shrink-0 font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            {actionLabel}
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Close message"
          className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default Toast;
