// Review urgency and the Tailwind classes for each level. Full class names
// live here (not built dynamically) so Tailwind can find them.

export const getUrgency = (isCompleted, date, today) => {
  if (isCompleted) return "done";
  if (date < today) return "overdue";
  if (date === today) return "today";
  return "upcoming";
};

// Classes for the R1..R5 button.
export const urgencyButtonStyles = {
  done: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-600",
  overdue:
    "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-300 dark:border-red-600",
  today:
    "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-600",
  upcoming:
    "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600",
};

// The review button on a board card: a bit bigger and with a thicker border
// than the tracker chip, since it is the main action of the card. Overdue and
// today are filled and have a shadow; a review that is not due yet is only an
// outline, dashed, so it looks like something that can wait.
export const reviewButtonStyles = {
  overdue:
    "border-2 border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 shadow-sm",
  today:
    "border-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 shadow-sm",
  upcoming:
    "border-2 border-dashed border-gray-400 dark:border-gray-500 bg-transparent text-gray-600 dark:text-gray-300",
};

// Count badges in a column header.
export const urgencyBadgeStyles = {
  overdue: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
  today: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300",
};

// Colored stripe on the left of a board card: by urgency for a review, green
// for a problem in progress, and "none" for the rest (the space stays, so
// titles line up).
export const urgencyStripeStyles = {
  overdue: "border-l-4 border-red-500",
  today: "border-l-4 border-yellow-500",
  upcoming: "border-l-4 border-gray-300 dark:border-gray-500",
  inProgress: "border-l-4 border-green-500",
  none: "border-l-4 border-transparent",
};

// Classes for the due-date text under the button.
export const urgencyTextStyles = {
  done: "text-green-600 dark:text-green-400",
  overdue: "text-red-600 dark:text-red-400",
  today: "text-yellow-600 dark:text-yellow-400",
  upcoming: "text-gray-500 dark:text-gray-300",
};
