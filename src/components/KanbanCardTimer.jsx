import { formatDuration } from "../lib/timer";

// Colour of the time by how it stands against the limit: quiet while on time,
// amber past the limit (and its tolerance), red once it timed out.
const readoutStyles = {
  ontime: "text-gray-500 dark:text-gray-400",
  grace: "text-amber-600 dark:text-amber-400",
  late: "text-amber-600 dark:text-amber-400",
  timeout: "text-red-600 dark:text-red-400",
};

// The time on the card, with what is being timed ("12:30 · R2"). It appears
// when the timer starts by itself (opening the problem, Start, dragging to In
// Progress) and is also the control: tap it to pause or resume. A running one
// is marked with a small dot. Reset is in the card menu.
const KanbanCardTimerReadout = ({ timer }) => {
  if (!timer || !timer.hasTime) return null;
  const action = `${timer.running ? "Pause" : "Resume"} timer (${timer.activity.label})`;
  return (
    <button
      onClick={timer.toggle}
      title={action}
      aria-label={action}
      className={`mt-1 flex items-center gap-1 rounded text-[11px] leading-tight hover:opacity-80 ${readoutStyles[timer.state]}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${timer.running ? "bg-current animate-pulse" : "border border-current"}`}
      />
      <span role="timer" aria-label={`Time on ${timer.activity.label}`} className="tabular-nums font-medium">
        {formatDuration(timer.ms)}
      </span>
      <span aria-hidden="true">· {timer.activity.label}</span>
    </button>
  );
};

export default KanbanCardTimerReadout;
