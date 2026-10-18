import { formatShortDate } from "../../lib/schedule";

const weekday = (date) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { weekday: "narrow" });
};
const reviews = (count) => `${count} ${count === 1 ? "review" : "reviews"}`;

// Reviews coming in the next days (one bar per day, today first) and how many
// are already overdue, to see a pile-up before it happens.
const LoadSection = ({ load }) => {
  const max = Math.max(1, ...load.days.map((day) => day.count));
  return (
    <div>
      <p className="text-sm text-gray-700 dark:text-gray-200">
        {load.overdue > 0 ? (
          <span className="font-semibold text-red-600 dark:text-red-400">{reviews(load.overdue)} overdue</span>
        ) : (
          "Nothing overdue"
        )}
      </p>
      <div className="mt-3 flex h-28 items-end gap-1" role="list" aria-label="Reviews due in the next days">
        {load.days.map((day, index) => (
          <div
            key={day.date}
            role="listitem"
            aria-label={`${index === 0 ? "Today" : formatShortDate(day.date)}: ${reviews(day.count)}`}
            title={`${formatShortDate(day.date)}: ${reviews(day.count)}`}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
          >
            <span className="text-[10px] tabular-nums text-gray-500 dark:text-gray-400">{day.count || ""}</span>
            <div
              className={`w-full rounded-t ${
                index === 0 ? "bg-yellow-400 dark:bg-yellow-500" : "bg-blue-400 dark:bg-blue-500"
              }`}
              style={{ height: `${(day.count / max) * 70}%`, minHeight: day.count ? 4 : 1 }}
            />
            <span className="text-[10px] text-gray-500 dark:text-gray-400">{weekday(day.date)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoadSection;
