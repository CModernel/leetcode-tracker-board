import { useProgress } from "../context/ProgressContext";
import { useNotice } from "../context/NoticeContext";
import { getProblems } from "../lib/lists";
import { activityOf, elapsedMs, findRunningTimer, formatDuration } from "../lib/timer";

// Starting to work on a problem starts its timer: there is no timer button, it
// starts when the problem is opened, started from the menu or dragged to In
// Progress. `startWork(problemId)`:
// - does nothing when there is nothing left to time (every review is done);
// - moves a first solve that is not In Progress yet to In Progress;
// - starts (or resumes) the timer, which pauses any other running timer (only
//   one runs at a time).
// It returns `{ paused }`: `paused` is null, or `{ title, time, resume }` for the
// timer it had to pause (`resume` brings it back, pausing the new one), so the
// caller can say so and offer Undo. `startAndTell` does the same and shows that
// message itself.
export const useStartWork = () => {
  const { progress, selectedList, setStatus, startTimer } = useProgress();
  const showNotice = useNotice();

  const startWork = (problemId) => {
    const entry = progress[selectedList]?.[problemId];
    const activity = activityOf(entry);
    if (!activity) return null;
    const running = findRunningTimer(progress);
    const other =
      running && !(running.list === selectedList && running.problemId === problemId) ? running : null;
    let paused = null;
    if (other) {
      const otherEntry = progress[other.list][other.problemId];
      paused = {
        title: getProblems(other.list).find((p) => p.id === other.problemId)?.title ?? "another problem",
        time: formatDuration(elapsedMs(otherEntry.timer, Date.now())),
        resume: () => startTimer(other.problemId, other.list),
      };
    }
    if (activity.kind === "first" && entry?.status !== "in-progress") {
      setStatus(problemId, "in-progress");
    }
    startTimer(problemId);
    return { paused };
  };

  const startAndTell = (problemId) => {
    const result = startWork(problemId);
    if (result?.paused) {
      showNotice({
        message: `Paused ${result.paused.title} at ${result.paused.time}`,
        undo: result.paused.resume,
      });
    }
    return result;
  };

  return { startWork, startAndTell };
};
