import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

// A centered confirmation dialog, built on the native <dialog> element: the
// browser gives it a dimmed backdrop, keeps the focus inside and handles
// Escape. It is shown as soon as it is rendered. Cancel has the focus at the
// start, so pressing Enter by accident does not confirm something destructive.
const ConfirmDialog = ({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog.open) return;
    // Old browsers without showModal still get the dialog, just not modal
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }, []);

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      // Escape: let the app decide instead of closing the element itself
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      // A click on the backdrop lands on the dialog element itself
      onClick={(event) => {
        if (event.target === dialogRef.current) onCancel();
      }}
      className="m-auto p-0 w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-2xl backdrop:bg-black/50"
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
            <AlertTriangle
              size={20}
              className="text-red-600 dark:text-red-400"
            />
          </div>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-lg font-semibold">
              {title}
            </h2>
            <p
              id="confirm-message"
              className="mt-1 text-sm text-gray-600 dark:text-gray-300"
            >
              {message}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            autoFocus
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
};

export default ConfirmDialog;
