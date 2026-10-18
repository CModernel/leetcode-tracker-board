import { Pause, Play } from "lucide-react";
import { barStyles } from "./KanbanCardTimer";
import { useCardTimer } from "./useCardTimer";
import { attemptsOf } from "../lib/attempts";
import { formatDuration, timeScore, timeState } from "../lib/timer";

// Text colour of a recorded time by how it stood against the limit it had.
const stateText = {
  ontime: "text-gray-600 dark:text-gray-300",
  grace: "text-gray-600 dark:text-gray-300",
  late: "text-amber-700 dark:text-amber-300",
  timeout: "text-red-700 dark:text-red-300",
};

// The last time that was recorded for a problem: the latest review attempt that
// has one, else the first solve. null when none was recorded (unknown, never 0).
const lastRecorded = (entry) => {
  const attempt = [...attemptsOf(entry)].reverse().find((a) => Number.isFinite(a?.ms));
  if (attempt) return { text: `Last review`, label: `R${attempt.review + 1}`, ms: attempt.ms, limitMs: attempt.limitMs };
  if (Number.isFinite(entry?.firstSolve?.ms)) {
    return { text: "Solved in", label: null, ms: entry.firstSolve.ms, limitMs: entry.firstSolve.limitMs };
  }
  return null;
};

// The Time column of a table row: the timer of the problem (pause or resume it
// here, or start it), and the last time recorded, with its colour and score.
const TimeCell = ({ problem, entry }) => {
  const timer = useCardTimer(problem, entry);
  const recorded = lastRecorded(entry);

  if (!timer && !recorded) return <span className="text-gray-400 dark:text-gray-500">-</span>;

  return (
    <div className="flex flex-col items-start gap-1">
      {timer && timer.hasTime && (
        <button
          onClick={timer.toggle}
          aria-label={`${timer.running ? "Pause" : "Resume"} timer (${timer.activity.label})`}
          title={`${timer.running ? "Pause" : "Resume"} timer (${timer.activity.label})`}
          className={`flex h-6 items-center gap-1 whitespace-nowrap rounded-lg border px-2 text-xs font-semibold transition hover:brightness-95 dark:hover:brightness-125 ${barStyles(timer)}`}
        >
          {timer.running ? <Pause size={12} aria-hidden="true" /> : <Play size={12} aria-hidden="true" />}
          <span role="timer" aria-label={`Time on ${timer.activity.label}`} className="tabular-nums">
            {formatDuration(timer.ms)}
          </span>
          <span aria-hidden="true" className="font-medium opacity-80">
            · {timer.activity.label}
          </span>
        </button>
      )}
      {timer && !timer.hasTime && (
        <button
          onClick={timer.start}
          aria-label={`Start timer (${timer.activity.label})`}
          title={`Start timer (${timer.activity.label})`}
          className="flex h-6 items-center gap-1 rounded-lg border border-gray-300 bg-gray-50 px-2 text-xs text-gray-500 hover:bg-gray-100 dark:border-gray-500 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <Play size={12} aria-hidden="true" />
          Start
        </button>
      )}
      {recorded && (
        <span
          className={`text-xs ${stateText[timeState(recorded.ms, recorded.limitMs)]}`}
          title={[
            Number.isFinite(recorded.limitMs) ? `Limit ${formatDuration(recorded.limitMs)}` : "No limit",
            timeScore(recorded.ms, recorded.limitMs) !== null
              ? `Score ${timeScore(recorded.ms, recorded.limitMs)}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          {recorded.text} <span className="tabular-nums font-medium">{formatDuration(recorded.ms)}</span>
          {recorded.label ? ` (${recorded.label})` : ""}
        </span>
      )}
    </div>
  );
};

export default TimeCell;
