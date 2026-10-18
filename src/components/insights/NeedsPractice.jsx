import CategoryTable from "./CategoryTable";

const percent = (value) => `${Math.round(value * 100)}%`;

// The one sentence about a category that needs practice or is slow.
const sentence = (row, showTime) => {
  const parts = [];
  if (row.weak) parts.push(`${percent(row.helpRate)} of its reviews needed help`);
  if (row.slow && showTime) parts.push(`${percent(row.overLimitShare)} of its timed attempts went over the limit`);
  return parts.join(" · ");
};

// The categories that need practice or are slow, each in one sentence; the
// full table with every category is behind "See all categories".
const NeedsPractice = ({ rows, showTime, notStarted }) => {
  const flagged = rows.filter((row) => row.weak || row.slow);
  return (
    <>
      {flagged.length > 0 ? (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {flagged.map((row) => (
            <li key={row.category} className="py-2 text-sm text-gray-800 dark:text-gray-100">
              <span className="font-semibold">{row.category}</span>
              <span className="text-gray-600 dark:text-gray-300"> · {sentence(row, showTime) || "check it again soon"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No category needs practice yet. It shows here once a category has a few reviews that needed help.
        </p>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer select-none text-sm text-blue-600 dark:text-blue-400">
          See all categories
        </summary>
        <div className="mt-3">
          <CategoryTable rows={rows} showTime={showTime} notStarted={notStarted} />
        </div>
      </details>
    </>
  );
};

export default NeedsPractice;
