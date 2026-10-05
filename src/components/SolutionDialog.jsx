import { useEffect, useRef, useState } from "react";
import { Check, Copy, Pencil, Plus } from "lucide-react";
import CodeBlock from "./CodeBlock";
import CodeEditor from "./CodeEditor";
import {
  LANGUAGES,
  MAX_SOLUTIONS,
  SOLUTION_MAX_LENGTH,
  SOLUTION_NAME_MAX_LENGTH,
} from "../lib/solutions";

const SOURCE_LABELS = {
  manual: "Written by you",
  "leetcode-api": "From LeetCode",
  extension: "From the extension",
  "import-file": "Imported",
};

const titleOf = (solution, index) => solution?.name || `Solution ${index + 1}`;
const languageLabel = (id) => LANGUAGES.find((language) => language.id === id)?.label ?? "Other";

const buttonBase = "px-4 py-2 rounded-lg text-sm font-medium transition-colors";
const secondary = `${buttonBase} bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100`;
const primary = `${buttonBase} flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white`;

// The solutions of a problem (up to MAX_SOLUTIONS) in a centered dialog
// (native <dialog>), behaving like NoteDialog: a problem with solutions opens
// to READ the code right away (that is looking it up, reported once with
// `onRead` when it opens), with Close, Copy, Add another and Edit; a problem
// with none opens straight in the editor. In the editor Save (or Ctrl/Cmd+Enter)
// saves and closes, and Close closes without saving. Saving an unchanged
// solution changes nothing, so it stays just read; a change is a new version
// written by the user, which the caller does not count as help. `onSave(index,
// solution)` gets the new solution, or null to remove it; what is saved from
// here is always "manual". `defaultLanguage` preselects the language of a new
// solution; the editor of an existing one starts with its own.
const SolutionDialog = ({ label, solutions, defaultLanguage, onSave, onRead, onClose, initialIndex = 0 }) => {
  const dialogRef = useRef(null);
  const codeRef = useRef(null);
  const copiedTimer = useRef(null);
  const [active, setActive] = useState(initialIndex);
  // null = reading; { index, code, language, name } = editing that slot
  const [draft, setDraft] = useState(() =>
    solutions.length === 0
      ? { index: 0, code: "", language: defaultLanguage, name: "" }
      : null,
  );
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    // opening a problem that has code is reading it
    if (solutions.length > 0) onRead?.();
    return () => clearTimeout(copiedTimer.current);
  }, []);

  const editing = draft !== null;

  // The code is what is written, so it gets the focus whenever the editor is
  // shown (also right after showModal(), which would pick the first field).
  const editingIndex = draft?.index;
  useEffect(() => {
    if (editing) codeRef.current?.focus();
  }, [editing, editingIndex]);

  const current = solutions[Math.min(active, solutions.length - 1)];
  const currentIndex = Math.min(active, solutions.length - 1);

  const startEdit = (index) => {
    const existing = solutions[index];
    setConfirmRemove(false);
    setDraft({
      index,
      code: existing?.code ?? "",
      language: existing?.language ?? defaultLanguage,
      name: existing?.name ?? "",
    });
  };
  const save = () => {
    if (draft.code.trim() === "") {
      if (draft.index < solutions.length) onSave(draft.index, null);
    } else {
      onSave(draft.index, {
        code: draft.code,
        language: draft.language,
        name: draft.name,
        source: "manual",
      });
    }
    onClose();
  };
  const remove = () => {
    onSave(draft.index, null);
    onClose();
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(current.code);
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // no clipboard (insecure context): the code can still be selected by hand
    }
  };

  // The dialog sits inside a card that can be dragged: mouse, touch and keys
  // used here must not reach it (selecting code must not drag, Space must not
  // lift the card).
  const keep = (event) => event.stopPropagation();

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="solution-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        keep(event);
        if (event.target === dialogRef.current) onClose();
      }}
      onMouseDown={keep}
      onTouchStart={keep}
      onPointerDown={keep}
      onKeyDown={(event) => {
        keep(event);
        if (editing && event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          save();
        }
      }}
      className="cursor-default m-auto p-0 w-[calc(100%-2rem)] max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-2xl backdrop:bg-black/50"
    >
      <div className="p-6">
        <h2 id="solution-title" className="text-lg font-semibold">
          Solution
        </h2>
        <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{label}</p>

        {editing ? (
          <>
            <div className="mt-3">
              <CodeEditor
                ref={codeRef}
                value={draft.code}
                maxLength={SOLUTION_MAX_LENGTH}
                placeholder="Paste or write the code here. Ctrl+Enter to save."
                ariaLabel={`Code for ${label}`}
                onChange={(code) => setDraft({ ...draft, code })}
              />
            </div>
            <p aria-live="polite" className="mt-1 text-right text-xs text-gray-500 dark:text-gray-400">
              {draft.code.length}/{SOLUTION_MAX_LENGTH}
            </p>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <input
                value={draft.name}
                maxLength={SOLUTION_NAME_MAX_LENGTH}
                placeholder="Label (optional)"
                aria-label="Label (optional)"
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <select
                value={draft.language}
                aria-label="Language"
                onChange={(event) => setDraft({ ...draft, language: event.target.value })}
                className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {LANGUAGES.map((language) => (
                  <option key={language.id} value={language.id}>
                    {language.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              {draft.index < solutions.length && (
                <button
                  onClick={confirmRemove ? remove : () => setConfirmRemove(true)}
                  className={`${buttonBase} sm:mr-auto text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30`}
                >
                  {confirmRemove ? "Yes, remove it" : "Remove"}
                </button>
              )}
              <button onClick={onClose} className={secondary}>
                Close
              </button>
              <button onClick={save} className={primary}>
                Save
              </button>
            </div>
          </>
        ) : !current ? null : (
          <>
            {solutions.length > 1 && (
              <div role="tablist" aria-label="Solutions" className="mt-3 flex gap-1">
                {solutions.map((solution, index) => (
                  <button
                    key={index}
                    role="tab"
                    aria-selected={index === currentIndex}
                    onClick={() => setActive(index)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      index === currentIndex
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    {titleOf(solution, index)}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-3 mb-2 text-xs text-gray-500 dark:text-gray-400">
              {[
                solutions.length === 1 && current.name,
                languageLabel(current.language),
                SOURCE_LABELS[current.source] ?? current.source,
                current.savedAt,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="max-h-[50dvh] overflow-auto rounded-lg">
              <CodeBlock code={current.code} language={current.language} />
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button autoFocus onClick={onClose} className={secondary}>
                Close
              </button>
              <button onClick={copy} className={secondary}>
                <span className="flex items-center justify-center gap-1.5">
                  {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  {copied ? "Copied" : "Copy"}
                </span>
              </button>
              {solutions.length < MAX_SOLUTIONS && (
                <button onClick={() => startEdit(solutions.length)} className={secondary}>
                  <span className="flex items-center justify-center gap-1.5">
                    <Plus size={14} aria-hidden="true" />
                    Add another
                  </span>
                </button>
              )}
              <button onClick={() => startEdit(currentIndex)} className={primary}>
                <Pencil size={14} aria-hidden="true" />
                Edit
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
};

export default SolutionDialog;
