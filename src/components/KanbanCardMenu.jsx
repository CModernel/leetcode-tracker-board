import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { cardActionMessage, getCardActions, runCardAction } from "../lib/board";
import { useProgress } from "../context/ProgressContext";
import { useNotice } from "../context/NoticeContext";
import { useConfirm } from "../context/ConfirmContext";

const MENU_WIDTH = 176;
const MENU_ITEM_HEIGHT = 36;

// The "⋯" menu of a card. It goes through the same progress actions as the
// tracker table, so a change here shows in the table and the other way round.
const KanbanCardMenu = ({ card }) => {
  const {
    setStatus,
    markSolved,
    unsolve,
    completeReview,
    uncompleteReview,
    rewindReviews,
    restoreEntry,
    selectedList,
  } = useProgress();
  const confirm = useConfirm();
  const showNotice = useNotice();
  const [position, setPosition] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const actions = getCardActions(card.stage, card.entry);

  const close = () => setPosition(null);

  const toggle = () => {
    if (position) return close();
    const rect = buttonRef.current.getBoundingClientRect();
    const height = actions.length * MENU_ITEM_HEIGHT + 8;
    // Open upwards when there is no room below the button
    const top =
      rect.bottom + height > window.innerHeight
        ? Math.max(8, rect.top - height)
        : rect.bottom + 4;
    const left = Math.max(8, rect.right - MENU_WIDTH);
    setPosition({ top, left });
  };

  useEffect(() => {
    if (!position) return undefined;
    const onPointerDown = (event) => {
      if (
        menuRef.current?.contains(event.target) ||
        buttonRef.current?.contains(event.target)
      ) {
        return;
      }
      close();
    };
    const onKeyDown = (event) => event.key === "Escape" && close();
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [position]);

  const choose = async (action) => {
    close();
    if (action.confirm && !(await confirm(action.confirm))) return;
    // What the problem looked like, to bring it back on Undo
    const list = selectedList;
    const before = card.entry;
    runCardAction(action, card.problem.id, {
      setStatus,
      markSolved,
      unsolve,
      completeReview,
      uncompleteReview,
      rewindReviews,
    });
    showNotice({
      message: cardActionMessage(action),
      undo: () => restoreEntry(list, card.problem.id, before),
    });
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggle}
        aria-label="Card actions"
        aria-haspopup="menu"
        aria-expanded={Boolean(position)}
        title="Actions"
        className="p-1 rounded text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
      >
        <MoreHorizontal size={16} />
      </button>
      {position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
            className="fixed z-50 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg"
          >
            {actions.map((action) => (
              <button
                key={action.type}
                role="menuitem"
                onClick={() => choose(action)}
                className={`w-full text-left px-3 h-9 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  action.type === "unsolve"
                    ? "text-red-600 dark:text-red-400"
                    : "text-gray-700 dark:text-gray-200"
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
};

export default KanbanCardMenu;
