import { useCallback, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import KanbanColumn from "./KanbanColumn";
import KanbanCard from "./KanbanCard";
import DraggableKanbanCard from "./DraggableKanbanCard";
import SortableKanbanCard from "./SortableKanbanCard";
import Toast from "./Toast";
import OutcomeDialog from "./OutcomeDialog";
import {
  COLUMNS,
  applyDrop,
  buildColumns,
  canDrop,
  cardForColumn,
  emptyMessage,
  moveCardInColumns,
  reorderIds,
  resolveDrop,
  reviewSections,
} from "../lib/board";
import {
  DRAG_INSTRUCTIONS,
  dragAnnouncements,
  moveToColumn,
} from "../lib/keyboardDnd";
import { HELP, suggestedHelp } from "../lib/attempts";
import { outcomeOptions } from "../lib/outcomes";
import { filterProblems } from "../lib/filters";
import { localToday } from "../lib/schedule";
import { urgencyBadgeStyles } from "../lib/urgencyStyles";
import { getProblems } from "../lib/lists";
import { useProgress } from "../context/ProgressContext";
import { useConfirm } from "../context/ConfirmContext";
import { NoticeContext } from "../context/NoticeContext";

// How long "Moved to ... Undo" stays: short, so it does not get in the way
const UNDO_TOAST_MS = 3000;
// A message saying why something was not allowed takes longer to read
const WARNING_TOAST_MS = 5000;

const KanbanBoard = () => {
  const {
    progress,
    selectedList,
    filters,
    setStatus,
    markSolved,
    markMastered,
    unsolve,
    completeReview,
    completeReviewWithHelp,
    uncompleteReview,
    restoreEntry,
    restoreEntries,
    reorder,
  } = useProgress();
  const confirm = useConfirm();
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);
  // The review whose outcome dialog is open
  const [helpItem, setHelpItem] = useState(null);
  // A move that waits for the confirmation dialog: the card is shown in the
  // column it was dropped on meanwhile, and goes back if the answer is no
  const [pendingMove, setPendingMove] = useState(null);
  // Message after a drop (why it was not allowed, or "Moved to..." with Undo);
  // a new id shows it again
  const [notice, setNotice] = useState(null);
  const closeNotice = useCallback(() => setNotice(null), []);
  // Lets a card's menu show the same message with Undo
  const showNotice = useCallback(
    (next) => setNotice({ id: Date.now(), ...next }),
    []
  );

  const today = localToday();
  const listProgress = progress[selectedList] || {};
  // Same filters as the tracker table, so both views show the same problems.
  // "Due today" is left out: it would empty the other columns. What is due is
  // in the Overdue and Today sections of Reviewing.
  const problems = filterProblems(
    getProblems(selectedList),
    listProgress,
    { ...filters, dueToday: false },
    today
  );
  const filtered = problems.length < getProblems(selectedList).length;
  const columns = buildColumns(problems, listProgress, today);
  const shownColumns = pendingMove
    ? moveCardInColumns(columns, pendingMove.cardId, pendingMove.targetId)
    : columns;
  const activeCard = columns
    .flatMap((column) => column.cards)
    .find((card) => card.problem.id === activeId);

  const helpOptions = helpItem
    ? outcomeOptions(
        listProgress[helpItem.problem.id],
        Number(helpItem.stage.slice(1)) - 1,
        today
      )
    : [];

  const stopDragging = () => {
    setActiveId(null);
    setOverId(null);
  };

  // Mouse: a small movement starts a drag, so clicks on the title link and on
  // the "⋯" menu keep working. Touch: a short press-and-hold starts it, so a
  // swipe still scrolls the board. Keyboard: left and right jump between
  // columns, up and down move a card inside In Progress.
  const columnIds = new Set(columns.map((c) => c.id));
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: (event, args) => {
        const { context, currentCoordinates } = args;
        if (event.code === "ArrowUp" || event.code === "ArrowDown") {
          return sortableKeyboardCoordinates(event, args);
        }
        const direction =
          event.code === "ArrowRight" ? 1 : event.code === "ArrowLeft" ? -1 : 0;
        if (!direction || !context.collisionRect) return undefined;
        event.preventDefault();
        // Only the columns: cards can be drop targets too (sorting)
        const columnRects = context.droppableContainers
          .getEnabled()
          .filter((container) => columnIds.has(container.id))
          .map((container) => ({
            id: container.id,
            rect: context.droppableRects.get(container.id),
          }))
          .filter((column) => column.rect);
        return (
          moveToColumn(direction, context.collisionRect, columnRects) ||
          currentCoordinates
        );
      },
    })
  );

  // Under the pointer first (a card wins over its column); with the keyboard
  // there is no pointer, so use the overlap.
  const collisionDetection = (args) => {
    const underPointer = pointerWithin(args);
    return underPointer.length ? underPointer : rectIntersection(args);
  };


  const cardTitle = (id) =>
    columns
      .flatMap((column) => column.cards)
      .find((card) => card.problem.id === id)?.problem.title ?? "card";
  const columnTitle = (id) => {
    const column = COLUMNS.find((c) => c.id === id);
    if (column) return column.title;
    // Over another card: name the column that card is in
    const holder = resolveDrop(id, columns);
    return holder.columnId ? columnTitle(holder.columnId) : "column";
  };

  // Column the card being dragged is over (also when over one of its cards)
  const overColumnId = resolveDrop(overId, columns).columnId;

  // Completing a review (card button, or the dialog's answer): same
  // action everywhere, written in the attempt history, with Undo. `option` says
  // how it went: { help, message }.
  const finishReview = (item, option) => {
    const list = selectedList;
    const before = listProgress[item.problem.id];
    completeReviewWithHelp(
      item.problem.id,
      Number(item.stage.slice(1)) - 1,
      option.help
    );
    setNotice({
      id: Date.now(),
      message: option.message,
      undo: () => restoreEntry(list, item.problem.id, before),
    });
  };

  // The Complete button: if the note or the solution was opened today, ask how
  // it went; if not, there is nothing to ask and it was solved alone.
  const completeReviewFromUi = (item) => {
    if (suggestedHelp(listProgress[item.problem.id], today) === null) {
      finishReview(item, { help: HELP.ALONE, message: `Completed ${item.stage}` });
    } else {
      setHelpItem(item);
    }
  };

  // Dropping a card runs the same progress actions as the table and the card
  // menu, so the tracker shows the change too. A drop that is not allowed
  // sends the card back to its column and says why.
  const handleDragEnd = async ({ active, over }) => {
    stopDragging();
    const card = columns
      .flatMap((column) => column.cards)
      .find((c) => c.problem.id === active.id);
    if (!card || !over) return;
    const list = selectedList;
    const { columnId: target, overCardId } = resolveDrop(over.id, columns);
    if (!target) return;

    // Inside In Progress: reorder. The whole column is used (not only the
    // visible cards), so filters cannot scramble the saved order.
    if (card.stage === "in-progress" && target === "in-progress") {
      if (!overCardId || overCardId === card.problem.id) return;
      const allIds = buildColumns(getProblems(list), listProgress, today)
        .find((column) => column.id === "in-progress")
        .cards.map((c) => c.problem.id);
      const newIds = reorderIds(allIds, card.problem.id, overCardId);
      if (newIds === allIds) return;
      const snapshot = Object.fromEntries(allIds.map((id) => [id, listProgress[id]]));
      reorder(newIds);
      setNotice({
        id: Date.now(),
        message: "Reordered In Progress",
        undo: () => restoreEntries(list, snapshot),
      });
      return;
    }

    // Mastered from R5 completes the last review like the Complete button: it
    // asks how it went when the note or the solution was opened, and the
    // attempt is written in the history (a plain drop would skip both).
    if (target === "mastered" && card.stage === "R5") {
      if (canDrop(card, target).allowed) {
        completeReviewFromUi({ problem: card.problem, stage: card.stage });
      }
      return;
    }

    // What this problem looked like, to bring it back on Undo
    const before = listProgress[card.problem.id];
    // While the dialog is open the card already sits in the column it was
    // dropped on. It stays until the move is done (yes) or undone (no).
    const askAndShow = (question) => {
      setPendingMove({ cardId: card.problem.id, targetId: target });
      return confirm(question);
    };
    let result;
    try {
      result = await applyDrop(
        card,
        target,
        {
          setStatus,
          markSolved,
          markMastered,
          unsolve,
          completeReview,
          uncompleteReview,
        },
        askAndShow
      );
    } finally {
      setPendingMove(null);
    }
    if (result.status === "rejected") {
      setNotice({ id: Date.now(), message: result.reason, variant: "warning" });
    } else if (result.status === "moved") {
      setNotice({
        id: Date.now(),
        message:
          target === "mastered"
            ? "Marked as mastered"
            : `Moved to ${columnTitle(target)}`,
        undo: () => restoreEntry(list, card.problem.id, before),
      });
    }
  };

  return (
    <NoticeContext.Provider value={showNotice}>
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      accessibility={{
        announcements: dragAnnouncements(cardTitle, columnTitle),
        screenReaderInstructions: { draggable: DRAG_INSTRUCTIONS },
      }}
      onDragStart={(event) => setActiveId(event.active.id)}
      onDragOver={(event) => setOverId(event.over?.id ?? null)}
      onDragEnd={handleDragEnd}
      onDragCancel={stopDragging}
    >
      <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 md:grid md:grid-cols-2 lg:grid-cols-4 md:overflow-visible md:snap-none md:pb-0">
        {shownColumns.map((column) => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            title={column.title}
            count={column.count}
            highlight={overColumnId === column.id}
            empty={
              column.cards.length === 0
                ? emptyMessage(column.id, filtered)
                : undefined
            }
          >
            {column.id === "in-progress" ? (
              <SortableContext
                items={column.cards.map((card) => card.problem.id)}
                strategy={verticalListSortingStrategy}
              >
                {column.cards.map((card) => (
                  <SortableKanbanCard
                    key={card.problem.id}
                    card={card}
                    onComplete={completeReviewFromUi}
                  />
                ))}
              </SortableContext>
            ) : column.id === "reviewing" ? (
              // Split by how urgent the next review is
              reviewSections(column.cards).map((section) => (
                <div
                  key={section.id}
                  role="group"
                  aria-label={section.title}
                  className="flex flex-col gap-2"
                >
                  <h3 className="mt-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {section.title}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal ${
                        urgencyBadgeStyles[section.id] ??
                        "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {section.cards.length}
                    </span>
                  </h3>
                  {section.cards.map((card) => (
                    <DraggableKanbanCard
                      key={card.problem.id}
                      card={card}
                      onComplete={completeReviewFromUi}
                    />
                  ))}
                </div>
              ))
            ) : (
              column.cards.map((card) => (
                <DraggableKanbanCard
                  key={card.problem.id}
                  card={card}
                  onComplete={completeReviewFromUi}
                />
              ))
            )}
          </KanbanColumn>
        ))}
      </div>
      <DragOverlay>
        {activeCard ? (
          <div className="cursor-grabbing shadow-xl rotate-2">
            {/* Dragged over To Do or In Progress it shows without the review */}
            <KanbanCard
              card={cardForColumn(activeCard, overColumnId)}
              onComplete={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
      {helpItem && helpOptions.length > 0 && (
        <OutcomeDialog
          title={`${helpItem.problem.title} · ${helpItem.stage}`}
          options={helpOptions}
          suggested={suggestedHelp(listProgress[helpItem.problem.id], today)}
          onChoose={(option) => {
            const item = helpItem;
            setHelpItem(null);
            finishReview(item, option);
          }}
          onClose={() => setHelpItem(null)}
        />
      )}
      {notice && (
        <Toast
          key={notice.id}
          message={notice.message}
          onClose={closeNotice}
          variant={notice.variant}
          duration={notice.undo ? UNDO_TOAST_MS : WARNING_TOAST_MS}
          actionLabel={notice.undo ? "Undo" : undefined}
          onAction={notice.undo}
        />
      )}
    </DndContext>
    </NoticeContext.Provider>
  );
};

export default KanbanBoard;
