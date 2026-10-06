import { useProgress } from "../context/ProgressContext";
import { useNow } from "../hooks/useNow";
import { activityOf, elapsedMs, limitMsFor, normalizeTimer, timeState } from "../lib/timer";

// What a card needs to show and control the timer of its problem: the timer
// (running or paused), the time counted, what is being timed (first solve or a
// review), how it stands against the limit, and the actions. `null` when there
// is nothing to time (every review is done).
export const useCardTimer = (problem, entry) => {
  const { startTimer, pauseTimer, resetTimer, setStatus } = useProgress();
  const timer = normalizeTimer(entry?.timer);
  const running = timer !== null && timer.runningSince !== null;
  const now = useNow(running);
  const activity = activityOf(entry);
  if (!activity) return null;

  const ms = timer ? elapsedMs(timer, running ? now : 0) : 0;
  const limitMs = limitMsFor(activity.kind, problem.difficulty);
  return {
    activity,
    running,
    hasTime: timer !== null,
    ms,
    state: timeState(ms, limitMs),
    // Starting the first solve is starting to work on it: it goes to In Progress
    start: () => {
      if (activity.kind === "first" && entry?.status !== "in-progress") {
        setStatus(problem.id, "in-progress");
      }
      startTimer(problem.id);
    },
    pause: () => pauseTimer(problem.id),
    reset: () => resetTimer(problem.id),
  };
};
