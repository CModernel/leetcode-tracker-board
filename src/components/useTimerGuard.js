import { useProgress } from "../context/ProgressContext";
import { useConfirm } from "../context/ConfirmContext";
import { useTimerSettings } from "../context/TimerSettingsContext";
import { getProblems } from "../lib/lists";
import { activityOf, elapsedMs, findRunningTimer, formatDuration } from "../lib/timer";

// Only one timer runs, and it belongs to one problem. `guard(problemId, action)`
// runs `action` for completing, solving or mastering that problem. When ANOTHER
// problem is being timed it asks first: "Pause the timer and continue" pauses
// that timer and runs the action, Cancel does nothing. Acting on the problem
// being timed, or with no timer running, runs the action at once, in the same
// tick (completing it is what stops its timer and records the time).
export const useTimerGuard = () => {
  const { progress, selectedList, pauseTimer } = useProgress();
  const confirm = useConfirm();
  const { showTimer } = useTimerSettings();

  return (problemId, action) => {
    // A timer that is switched off in the settings is never in the way
    if (!showTimer) return action();
    const running = findRunningTimer(progress);
    if (!running || (running.list === selectedList && running.problemId === problemId)) return action();
    const entry = progress[running.list][running.problemId];
    const title = getProblems(running.list).find((p) => p.id === running.problemId)?.title ?? "Another problem";
    const label = activityOf(entry)?.label;
    return confirm({
      title: "A timer is running",
      message: `${title}${label ? ` (${label})` : ""} is being timed at ${formatDuration(
        elapsedMs(entry.timer, Date.now()),
      )}. Pause it and continue?`,
      confirmLabel: "Pause the timer and continue",
      tone: "neutral",
    }).then((ok) => {
      if (!ok) return undefined;
      pauseTimer(running.problemId, running.list);
      return action();
    });
  };
};
