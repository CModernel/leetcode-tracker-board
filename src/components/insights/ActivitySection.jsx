import { formatShortDate } from "../../lib/schedule";

// Colour of a day in the heat map by how many things were done.
const shade = (count) => {
  if (count === 0) return "bg-gray-100 dark:bg-gray-700";
  if (count === 1) return "bg-green-200 dark:bg-green-900";
  if (count <= 3) return "bg-green-400 dark:bg-green-700";
  return "bg-green-600 dark:bg-green-500";
};

const actions = (count) => `${count} ${count === 1 ? "action" : "actions"}`;

// The streak, the active days of this week and a heat map of the last weeks
// (columns are weeks, Monday at the top).
const ActivitySection = ({ streak, thisWeek, grid }) => (
  <div>
    <div className="flex flex-wrap gap-6">
      <div>
        <p className="text-2xl font-bold text-gray-800 dark:text-white tabular-nums">
          {streak} {streak === 1 ? "day" : "days"}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">Current streak</p>
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-800 dark:text-white tabular-nums">{thisWeek}/7</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">Active days this week</p>
      </div>
    </div>
    <div className="mt-4 overflow-x-auto">
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
                  className={`h-3 w-3 rounded-sm ${shade(day.count)}`}
                />
              ) : (
                <div key={`empty-${d}`} className="h-3 w-3" />
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
  </div>
);

export default ActivitySection;
