import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import NoteDialog from "./NoteDialog";
import Toast from "./Toast";
import { useProgress } from "../context/ProgressContext";
import { useTimerSettings } from "../context/TimerSettingsContext";
import { useNow } from "../hooks/useNow";
import { getProblems } from "../lib/lists";
import { activityOf, findRunningTimer, limitCrossing, limitMsFor } from "../lib/timer";

// How long the message stays: it is quiet, never a dialog in the way.
export const LIMIT_TOAST_MS = 15000;

// What this page session has seen, by problem and activity ("list:id:R3"), so
// leaving a page or remounting does not repeat the message: `shown` already
// said it; `under` was seen still under its limit (only then is a crossing
// news: a timer that is already past its limit when the page opens, after a
// reload, is not announced again, the card colour says it).
const shown = new Set();
const under = new Set();
export const resetTimeLimitMemory = () => {
  shown.clear();
  under.clear();
};

// Watches the running timer on every page. When it goes past its limit it says
// so once, with "Keep going", "Read the note" (only when the problem has a note
// and it is in the list being shown; it counts as help, like opening the note
// on the card) and "Learn" (the Patterns page). Nothing when the timer is off.
const TimeLimitWatcher = () => {
  const { progress, selectedList, setNote, markHelpViewed } = useProgress();
  const { showTimer, limits } = useTimerSettings();
  const navigate = useNavigate();
  const [message, setMessage] = useState(null);
  const [reading, setReading] = useState(null);

  const running = showTimer ? findRunningTimer(progress) : null;
  const now = useNow(running !== null);
  const entry = running ? progress[running.list][running.problemId] : null;
  const problem = running ? getProblems(running.list).find((p) => p.id === running.problemId) : null;
  const activity = activityOf(entry);
  const limitMs = problem && activity ? limitMsFor(activity.kind, problem.difficulty, limits) : null;
  const key = running && activity ? `${running.list}:${running.problemId}:${activity.label}` : null;

  useEffect(() => {
    if (!key || !limitMs || shown.has(key)) return;
    if (!limitCrossing(entry, limitMs, Date.now()).crossed) {
      under.add(key);
      return;
    }
    shown.add(key);
    if (!under.has(key)) return;
    setMessage({
      key,
      problemId: running.problemId,
      title: problem.title,
      label: activity.label,
      readable: running.list === selectedList && Boolean(entry.note),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, key, limitMs]);

  const close = useCallback(() => setMessage(null), []);

  const actions = message
    ? [
        { label: "Keep going" },
        ...(message.readable
          ? [
              {
                label: "Read the note",
                onClick: () => {
                  markHelpViewed(message.problemId, "note");
                  setReading({ problemId: message.problemId, title: message.title });
                },
              },
            ]
          : []),
        { label: "Learn", onClick: () => navigate("/patterns") },
      ]
    : [];

  return (
    <>
      {message && (
        <Toast
          key={message.key}
          raised
          message={`${message.title} · ${message.label}: you have used the time you planned.`}
          duration={LIMIT_TOAST_MS}
          onClose={close}
          actions={actions}
        />
      )}
      {reading && (
        <NoteDialog
          label={reading.title}
          note={progress[selectedList]?.[reading.problemId]?.note}
          onSave={(text) => setNote(reading.problemId, text)}
          onClose={() => setReading(null)}
        />
      )}
    </>
  );
};

export default TimeLimitWatcher;
