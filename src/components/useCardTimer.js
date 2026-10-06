import { useProgress } from "../context/ProgressContext";
import { useNow } from "../hooks/useNow";
import { useStartWork } from "./useStartWork";
import { activityOf, elapsedMs, limitMsFor, normalizeTimer, timeState } from "../lib/timer";

// What a card needs to show and control the timer of its problem: the time
// counted, what is being timed (first solve or a review), how it stands against
// the limit, and the actions: `start` (the small play button), `toggle` (pause or
// resume) and `reset`. The timer also starts by itself (see useStartWork). `null` when there is
// nothing to time (every review is done).
export const useCardTimer = (problem, entry) => {
  const { pauseTimer, resetTimer } = useProgress();
  const { startAndTell } = useStartWork();
  const timer = normalizeTimer(entry?.timer);
  const running = timer !== null && timer.runningSince !== null;
  const now = useNow(running);
  const activity = activityOf(entry);
  if (!activity) return null;

  const ms = timer ? elapsedMs(timer, running ? now : 0) : 0;
  return {
    activity,
    running,
    hasTime: timer !== null,
    ms,
    state: timeState(ms, limitMsFor(activity.kind, problem.difficulty)),
    start: () => startAndTell(problem.id),
    toggle: () => (running ? pauseTimer(problem.id) : startAndTell(problem.id)),
    reset: () => resetTimer(problem.id),
  };
};
