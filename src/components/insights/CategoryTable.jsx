import { useState } from "react";
import { HELP_WEAK, MIN_ATTEMPTS, MIN_TIMED, SLOW_SHARE } from "../../lib/insights";

const percent = (value) => (value === null || value === undefined ? "-" : `${Math.round(value * 100)}%`);

// The badge of a category by how it stands.
const Badge = ({ row }) => {
  if (row.weak && row.slow) return <Pill tone="red">Needs practice · slow</Pill>;
  if (row.weak) return <Pill tone="red">Needs practice</Pill>;
  if (row.slow) return <Pill tone="amber">Slow</Pill>;
  if (!row.enough) return <Pill tone="gray">Not enough data yet</Pill>;
  return <Pill tone="green">Doing well</Pill>;
};

const TONES = {
  red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  green: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  gray: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};
const Pill = ({ tone, children }) => (
  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${TONES[tone]}`}>
    {children}
  </span>
);

// Alone / note / solution as one bar, with the numbers as text for everyone.
const HelpBar = ({ row }) => {
  if (row.attempts === 0) return <span className="text-gray-400 dark:text-gray-500">-</span>;
  const width = (count) => `${(count / row.attempts) * 100}%`;
  const label = `${row.alone} alone, ${row.note} with the note, ${row.solution} with the solution`;
  return (
    <div className="min-w-[120px]">
      <div className="flex h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700" role="img" aria-label={label} title={label}>
        <div className="bg-green-500" style={{ width: width(row.alone) }} />
        <div className="bg-yellow-400" style={{ width: width(row.note) }} />
        <div className="bg-red-500" style={{ width: width(row.solution) }} />
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {percent(row.helpRate)} needed help
      </p>
    </div>
  );
};

// How many categories show before "Show more".
export const VISIBLE_CATEGORIES = 5;

// One row per category, the ones that need practice first. Only the first few
// show; "Show more" opens the rest. The categories not started yet are only
// named below.
const CategoryTable = ({ rows, showTime, notStarted = [] }) => {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, VISIBLE_CATEGORIES);
  return (
  <>
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
            <th className="py-2 pr-4">Category</th>
            <th className="py-2 pr-4">Solved</th>
            <th className="py-2 pr-4">Reviews</th>
            <th className="py-2 pr-4">Help needed</th>
            <th className="py-2 pr-4">Step-backs</th>
            {showTime && <th className="py-2 pr-4">Time</th>}
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {shown.map((row) => (
            <tr key={row.category} className="align-top text-gray-800 dark:text-gray-100">
              <td className="py-2 pr-4 font-medium">{row.category}</td>
              <td className="py-2 pr-4 whitespace-nowrap tabular-nums">
                {row.solved}/{row.problems}
              </td>
              <td className="py-2 pr-4 tabular-nums">{row.attempts}</td>
              <td className="py-2 pr-4">
                <HelpBar row={row} />
              </td>
              <td className="py-2 pr-4 tabular-nums">{row.stepBacks}</td>
              {showTime && (
                <td className="py-2 pr-4 whitespace-nowrap text-xs">
                  {row.timed === 0 ? (
                    <span className="text-gray-400 dark:text-gray-500">-</span>
                  ) : (
                    <>
                      <span className="tabular-nums">
                        {row.averageRatio === null ? "no limit" : `${row.averageRatio.toFixed(1)}x the limit`}
                      </span>
                      <span className="block text-gray-500 dark:text-gray-400">
                        {percent(row.overLimitShare)} over · {row.timed} timed
                      </span>
                    </>
                  )}
                </td>
              )}
              <td className="py-2">
                <Badge row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {rows.length > VISIBLE_CATEGORIES && (
      <button
        onClick={() => setAll(!all)}
        aria-expanded={all}
        className="mt-3 text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        {all ? "Show less" : `Show ${rows.length - VISIBLE_CATEGORIES} more`}
      </button>
    )}
    {notStarted.length > 0 && (
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Not started yet: {notStarted.join(", ")}.</p>
    )}
    <details className="mt-3 text-xs text-gray-500 dark:text-gray-400">
      <summary className="cursor-pointer select-none text-blue-600 dark:text-blue-400">
        How is this calculated?
      </summary>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>
          Reviews are the review attempts of the category. A category is judged after{" "}
          {MIN_ATTEMPTS} reviews.
        </li>
        <li>
          <strong>Needs practice</strong>: {Math.round(HELP_WEAK * 100)}% or more of the reviews needed the
          note or the solution.
        </li>
        <li>
          <strong>Step-backs</strong>: reviews that needed the solution (the problem went one review back).
        </li>
        <li>
          <strong>Slow</strong>: at least {MIN_TIMED} timed attempts or first solves, and{" "}
          {Math.round(SLOW_SHARE * 100)}% or more of them over the limit. Time is only counted when the timer
          was used.
        </li>
      </ul>
    </details>
  </>
  );
};

export default CategoryTable;
