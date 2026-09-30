const OPTIONS = [
  { id: "stage", label: "Stage" },
  { id: "urgency", label: "Urgency" },
];

// Switches the board between columns by stage and columns by due date.
const GroupByToggle = ({ value, onChange }) => (
  <div className="flex items-center gap-2">
    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
      Group by
    </span>
    <div
      role="group"
      aria-label="Group by"
      className="inline-flex rounded-lg bg-gray-200 dark:bg-gray-700 p-1"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          onClick={() => onChange(option.id)}
          aria-pressed={value === option.id}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            value === option.id
              ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow"
              : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
);

export default GroupByToggle;
