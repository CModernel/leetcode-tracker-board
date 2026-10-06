import { Pause, Play, RotateCcw } from "lucide-react";
import { formatDuration } from "../lib/timer";

// Colour of the time by how it stands against the limit: quiet while on time,
// amber past the limit (and its tolerance), red once it timed out.
const readoutStyles = {
  ontime: "text-gray-500 dark:text-gray-400",
  grace: "text-amber-600 dark:text-amber-400",
  late: "text-amber-600 dark:text-amber-400",
  timeout: "text-red-600 dark:text-red-400",
};

// The play / pause button of a card, in the column of icons under the menu.
export const KanbanCardTimerButton = ({ timer }) => {
  if (!timer) return null;
  const { running, activity } = timer;
  return (
    <button
      onClick={running ? timer.pause : timer.start}
      aria-label={running ? "Pause timer" : "Start timer"}
      title={`${running ? "Pause" : "Start"} timer (${activity.label})`}
      className={`p-1 rounded transition-colors ${
        running
          ? "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-600"
          : "text-gray-400 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600"
      }`}
    >
      {running ? <Pause size={16} fill="currentColor" fillOpacity={0.2} /> : <Play size={16} />}
    </button>
  );
};

// The time on the card, with what is being timed ("12:30 · R2"). Only shown
// when there is a time to show (running, or paused with some counted). Paused
// times can be thrown away with the small reset button.
export const KanbanCardTimerReadout = ({ timer }) => {
  if (!timer || !timer.hasTime) return null;
  return (
    <p className={`mt-1 flex items-center gap-1 text-[11px] leading-tight ${readoutStyles[timer.state]}`}>
      <span
        role="timer"
        aria-label={`Time on ${timer.activity.label}`}
        className="tabular-nums font-medium"
      >
        {formatDuration(timer.ms)}
      </span>
      <span aria-hidden="true">· {timer.activity.label}</span>
      {!timer.running && (
        <button
          onClick={timer.reset}
          aria-label="Reset timer"
          title="Reset timer"
          className="ml-0.5 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-600 dark:hover:text-gray-200"
        >
          <RotateCcw size={11} />
        </button>
      )}
    </p>
  );
};
