import { formatShortDate } from "../../lib/schedule";

// Colour of a day in the heat map by how many things were done.
const shade = (count) => {
  if (count === 0) return "bg-gray-100 dark:bg-gray-700";
  if (count === 1) return "bg-green-200 dark:bg-green-900";
  if (count <= 3) return "bg-green-400 dark:bg-green-700";
  return "bg-green-600 dark:bg-green-500";
};

const actions = (count) => `${count} ${count === 1 ? "action" : "actions"}`;

const Stat = ({ value, label, alert = false }) => (
  <div>
    <p
      className={`text-xl font-bold tabular-nums ${
        alert ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-white"
      }`}
    >
      {value}
    </p>
    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
  </div>
);

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// The heat map of the last weeks (columns are weeks, Monday at the top), like
// GitHub's, with the numbers that go with it: streak, active days this week,
// reviews overdue and due tomorrow, and the actions of those weeks.
const ActivitySection = ({ streak, thisWeek, overdue, tomorrow, grid }) => {
  const total = grid.flat().reduce((sum, day) => sum + (day?.count ?? 0), 0);
  return (
    <div className="mt-4 flex flex-col items-center gap-5 border-t border-gray-100 px-5 pb-0 pt-5 dark:border-gray-700 md:flex-row md:justify-center md:gap-12 md:px-6 md:pt-6">
      <div className="flex max-w-full flex-col items-center overflow-x-auto">
        <div className="flex gap-1" role="img" aria-label="Activity of the last weeks">
          {grid.map((week, w) => (
            <div key={w} className="flex flex-col gap-1">
              {week.map((day, d) =>
                day ? (
                  <div
                    key={day.date}
                    data-count={day.count}
                    title={`${formatShortDate(day.date)}: ${actions(day.count)}`}
                    aria-label={`${formatShortDate(day.date)}: ${actions(day.count)}`}
                    className={`h-3.5 w-3.5 rounded-sm ${shade(day.count)}`}
                  />
                ) : (
                  <div key={`empty-${d}`} className="h-3.5 w-3.5" />
                ),
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400" aria-hidden="true">
          Less
          {[0, 1, 2, 4].map((count) => (
            <span key={count} className={`h-3 w-3 rounded-sm ${shade(count)}`} />
          ))}
          More
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-center sm:grid-cols-3 md:grid-cols-5">
        <Stat value={plural(streak, "day")} label="Current streak" />
        <Stat value={`${thisWeek}/7`} label="Active days this week" />
        <Stat value={overdue} label="Reviews overdue" alert={overdue > 0} />
        <Stat value={tomorrow} label="Due tomorrow" />
        <Stat value={total} label="Actions, last 12 weeks" />
      </div>
    </div>
  );
};

export default ActivitySection;
