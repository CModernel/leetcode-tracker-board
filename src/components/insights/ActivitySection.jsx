import { formatShortDate } from "../../lib/schedule";
import { formatDuration } from "../../lib/timer";

// Colour of a day in the heat map by how many things were done.
const shade = (count) => {
  if (count === 0) return "bg-gray-100 dark:bg-gray-700";
  if (count === 1) return "bg-green-200 dark:bg-green-900";
  if (count <= 3) return "bg-green-400 dark:bg-green-700";
  return "bg-green-600 dark:bg-green-500";
};

const actions = (count) => `${count} ${count === 1 ? "action" : "actions"}`;

const TONES = {
  alert: "text-red-600 dark:text-red-400",
  good: "text-green-600 dark:text-green-400",
  warn: "text-amber-600 dark:text-amber-400",
  muted: "text-gray-400 dark:text-gray-500",
  plain: "text-gray-800 dark:text-white",
};

const Stat = ({ value, label, note, tone = "plain" }) => (
  <div>
    <p className={`text-xl font-bold tabular-nums ${TONES[tone]}`}>{value}</p>
    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    {note && <p className="text-[11px] text-gray-400 dark:text-gray-500">{note}</p>}
  </div>
);

// The average time against the limit: "12% under limit" (green), "15% over limit"
// (amber), or "-" with the reason when there is nothing to say yet.
export const MIN_TIME_RECORDS = 3;
const timeStat = (time) => {
  if (time.state === "off") return { value: "-", note: "Timer is off", tone: "muted" };
  if (time.count < MIN_TIME_RECORDS) {
    return { value: "-", note: `Needs ${MIN_TIME_RECORDS} timed attempts (${time.count})`, tone: "muted" };
  }
  const change = Math.round(Math.abs(1 - time.averageRatio) * 100);
  const note = `avg ${formatDuration(time.averageMs)} of ${formatDuration(time.averageLimitMs)}`;
  if (change === 0) return { value: "On the limit", note, tone: "plain" };
  return time.averageRatio < 1
    ? { value: `${change}% under limit`, note, tone: "good" }
    : { value: `${change}% over limit`, note, tone: "warn" };
};

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// The heat map of the last weeks (columns are weeks, Monday at the top), like
// GitHub's, with the numbers that go with it: streak, active days this week,
// mastered problems, the average time against the limit, and the reviews
// overdue and due tomorrow, in a grid of three columns by two rows.
const ActivitySection = ({ streak, thisWeek, mastered, total, time, overdue, tomorrow, grid }) => {
  const average = timeStat(time);
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
      <div className="grid grid-cols-3 gap-x-8 gap-y-4 text-center">
        <Stat value={plural(streak, "day")} label="Current streak" />
        <Stat value={`${thisWeek}/7`} label="Active days this week" />
        <Stat value={`${mastered}/${total}`} label="Mastered" />
        <Stat value={average.value} label="Average time" note={average.note} tone={average.tone} />
        <Stat value={overdue} label="Reviews overdue" tone={overdue > 0 ? "alert" : "plain"} />
        <Stat value={tomorrow} label="Due tomorrow" />
      </div>
    </div>
  );
};

export default ActivitySection;
