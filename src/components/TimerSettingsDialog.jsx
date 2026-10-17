import { useEffect, useRef, useState } from "react";
import { useProgress } from "../context/ProgressContext";
import { useTimerSettings } from "../context/TimerSettingsContext";
import { LIMITS_MIN, findRunningTimer } from "../lib/timer";
import {
  DIFFICULTIES,
  KINDS,
  MAX_LIMIT,
  MIN_LIMIT,
  validateMinutes,
} from "../lib/timerSettings";

const ROW_LABEL = { first: "First solve", review: "Review" };

// What the inputs start with: the saved minutes as text, a row with no limit
// shows the defaults (they come back when "No limit" is unchecked).
const draftOf = (limits) =>
  Object.fromEntries(
    KINDS.map((kind) => [
      kind,
      Object.fromEntries(
        DIFFICULTIES.map((difficulty) => [
          difficulty,
          String(limits[kind][difficulty] ?? LIMITS_MIN[kind][difficulty]),
        ]),
      ),
    ]),
  );
const noLimitOf = (limits) =>
  Object.fromEntries(KINDS.map((kind) => [kind, DIFFICULTIES.every((d) => limits[kind][d] === null)]));

// The timer settings in a centered dialog (native <dialog>, like the note's):
// the "Show timer" switch and the time limits in minutes by difficulty, for the
// first solve and for a review, each row with "No limit". Nothing changes until
// Save; Close, Escape and a click on the backdrop leave everything as it was.
// Turning the timer off pauses the one that runs, so nothing counts unseen.
const TimerSettingsDialog = ({ onClose }) => {
  const dialogRef = useRef(null);
  const { showTimer, limits, setShowTimer, setLimits } = useTimerSettings();
  const { progress, pauseTimer } = useProgress();
  const [show, setShow] = useState(showTimer);
  const [text, setText] = useState(() => draftOf(limits));
  const [noLimit, setNoLimit] = useState(() => noLimitOf(limits));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }, []);

  // The limits the inputs describe (null = no limit), and whether every cell is valid
  const next = Object.fromEntries(
    KINDS.map((kind) => [
      kind,
      Object.fromEntries(
        DIFFICULTIES.map((d) => [d, noLimit[kind] ? null : validateMinutes(text[kind][d])]),
      ),
    ]),
  );
  const invalid = (kind, difficulty) => !noLimit[kind] && next[kind][difficulty] === null;
  const valid = KINDS.every((kind) => DIFFICULTIES.every((d) => !invalid(kind, d)));

  const save = () => {
    if (!valid) return;
    if (!show && showTimer) {
      const running = findRunningTimer(progress);
      if (running) pauseTimer(running.problemId, running.list);
    }
    setShowTimer(show);
    setLimits(next);
    onClose();
  };

  const reset = () => {
    setText(draftOf(LIMITS_MIN));
    setNoLimit(noLimitOf(LIMITS_MIN));
  };

  const setCell = (kind, difficulty, value) =>
    setText((current) => ({ ...current, [kind]: { ...current[kind], [difficulty]: value } }));

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="timer-settings-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className="cursor-default m-auto p-0 w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-2xl backdrop:bg-black/50"
    >
      <div className="p-6">
        <h2 id="timer-settings-title" className="text-lg font-semibold">
          Timer settings
        </h2>

        <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 text-sm font-medium">
          Show timer
          <input
            type="checkbox"
            role="switch"
            checked={show}
            onChange={(event) => setShow(event.target.checked)}
            className="h-5 w-9 cursor-pointer accent-blue-600"
          />
        </label>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Off hides every timer control and the time on the cards. Times already saved are kept.
        </p>

        <h3 className="mt-5 text-sm font-semibold">Time limits (minutes)</h3>
        <div className="mt-2 grid grid-cols-[auto_repeat(3,minmax(0,1fr))] items-center gap-x-2 gap-y-2 text-sm">
          <span />
          {DIFFICULTIES.map((difficulty) => (
            <span key={difficulty} className="text-center text-xs font-semibold text-gray-500 dark:text-gray-300">
              {difficulty}
            </span>
          ))}
          {KINDS.map((kind) => (
            <LimitsRow
              key={kind}
              label={ROW_LABEL[kind]}
              kind={kind}
              text={text[kind]}
              noLimit={noLimit[kind]}
              invalid={(difficulty) => invalid(kind, difficulty)}
              onText={(difficulty, value) => setCell(kind, difficulty, value)}
              onNoLimit={(checked) => setNoLimit((current) => ({ ...current, [kind]: checked }))}
            />
          ))}
        </div>
        {!valid && (
          <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
            Use whole minutes from {MIN_LIMIT} to {MAX_LIMIT}.
          </p>
        )}
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Full score up to 1.25 times the limit; counted as forgotten at 2 times. Times already
          saved keep the limit they had.
        </p>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={reset}
            className="px-3 py-2 rounded-lg text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Reset limits
          </button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button
              autoFocus
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 transition-colors"
            >
              Close
            </button>
            <button
              onClick={save}
              disabled={!valid}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
};

// One row of the table: its name, three minute inputs and the "No limit" box
const LimitsRow = ({ label, kind, text, noLimit, invalid, onText, onNoLimit }) => (
  <>
    <div className="pr-1">
      <span className="font-medium">{label}</span>
      <label className="mt-0.5 flex cursor-pointer items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        <input
          type="checkbox"
          checked={noLimit}
          onChange={(event) => onNoLimit(event.target.checked)}
          aria-label={`No limit for ${label.toLowerCase()}`}
        />
        No limit
      </label>
    </div>
    {DIFFICULTIES.map((difficulty) => (
      <input
        key={difficulty}
        type="text"
        inputMode="numeric"
        value={text[difficulty]}
        disabled={noLimit}
        aria-label={`${label} ${difficulty} limit in minutes`}
        aria-invalid={invalid(difficulty) || undefined}
        data-kind={kind}
        onChange={(event) => onText(difficulty, event.target.value)}
        className={`w-full rounded border bg-white p-1.5 text-center text-sm dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-40 ${
          invalid(difficulty)
            ? "border-red-400 dark:border-red-500"
            : "border-gray-300 dark:border-gray-600"
        }`}
      />
    ))}
  </>
);

export default TimerSettingsDialog;
