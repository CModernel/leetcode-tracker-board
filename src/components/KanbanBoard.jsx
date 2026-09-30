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
import DoneDropZone from "./DoneDropZone";
import GroupByToggle from "./GroupByToggle";
import ReviewQueue from "./ReviewQueue";
import {
  COLUMNS,
  DONE_ZONE,
  URGENCY_COLUMNS,
  applyDrop,
  buildColumns,
  buildReviewQueue,
  buildUrgencyColumns,
  cardForColumn,
  moveCardInColumns,
  reorderIds,
  resolveDrop,
} from "../lib/board";
import {
  DRAG_INSTRUCTIONS,
  dragAnnouncements,
  moveToColumn,
} from "../lib/keyboardDnd";
import { filterProblems } from "../lib/filters";
import { localToday } from "../lib/schedule";
import { urgencyBadgeStyles } from "../lib/urgencyStyles";
import { getProblems } from "../lib/lists";
import { useProgress } from "../context/ProgressContext";
import { useConfirm } from "../context/ConfirmContext";

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
    unsolve,
    completeReview,
    uncompleteReview,
    restoreEntry,
    restoreEntries,
    reorder,
  } = useProgress();
  const confirm = useConfirm();
  // "stage": columns by stage. "urgency": only problems waiting for a review,
  // grouped by due date, for review sessions.
  const [groupBy, setGroupBy] = useState("stage");
  const byUrgency = groupBy === "urgency";
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [showQueue, setShowQueue] = useState(false);
  // A move that waits for the confirmation dialog: the card is shown in the
  // column it was dropped on meanwhile, and goes back if the answer is no
  const [pendingMove, setPendingMove] = useState(null);
  // Message after a drop (why it was not allowed, or "Moved to..." with Undo);
  // a new id shows it again
  const [notice, setNotice] = useState(null);
  const closeNotice = useCallback(() => setNotice(null), []);

  const today = localToday();
  const listProgress = progress[selectedList] || {};
  // Same filters as the tracker table, so both views show the same problems.
  // "Due today" is left out: the board has its own "Review today" queue.
  const problems = filterProblems(
    getProblems(selectedList),
    listProgress,
    { ...filters, dueToday: false },
    today
  );
  const queue = buildReviewQueue(problems, listProgress, today);
  const columns = byUrgency
    ? buildUrgencyColumns(problems, listProgress, today)
    : buildColumns(problems, listProgress, today);
  const shownColumns = pendingMove
    ? moveCardInColumns(columns, pendingMove.cardId, pendingMove.targetId)
    : columns;
  const activeCard = columns
    .flatMap((column) => column.cards)
    .find((card) => card.problem.id === activeId);

  const stopDragging = () => {
    setActiveId(null);
    setOverId(null);
  };

  // Mouse: a small movement starts a drag, so clicks on the title link and on
  // the "⋯" menu keep working. Touch: a short press-and-hold starts it, so a
  // swipe still scrolls the board. Keyboard: left and right jump between
  // columns, up and down move a card inside In Progress.
  const columnIds = new Set([...columns.map((c) => c.id), DONE_ZONE]);
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
    if (id === DONE_ZONE) return "the done zone";
    const column = [...COLUMNS, ...URGENCY_COLUMNS].find((c) => c.id === id);
    if (column) return column.title;
    // Over another card: name the column that card is in
    const holder = resolveDrop(id, columns);
    return holder.columnId ? columnTitle(holder.columnId) : "column";
  };

  // Column the card being dragged is over (also when over one of its cards)
  const overColumnId = overId === DONE_ZONE ? null : resolveDrop(overId, columns).columnId;

  // Completing a review from a card or from the queue: same action as
  // everywhere else, with Undo like the moves.
  const completeFromQueue = (item) => {
    const list = selectedList;
    const before = listProgress[item.problem.id];
    completeReview(item.problem.id, Number(item.stage.slice(1)) - 1);
    setNotice({
      id: Date.now(),
      message: `Completed ${item.stage}`,
      undo: () => restoreEntry(list, item.problem.id, before),
    });
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
    const target =
      over.id === DONE_ZONE ? DONE_ZONE : resolveDrop(over.id, columns).columnId;
    const { overCardId } = resolveDrop(over.id, columns);
    if (!target) return;

    // Inside In Progress: reorder. The whole column is used (not only the
    // visible cards), so filters cannot scramble the saved order.
    if (!byUrgency && card.stage === "in-progress" && target === "in-progress") {
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
        { setStatus, markSolved, unsolve, completeReview, uncompleteReview },
        askAndShow,
        groupBy
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
          target === DONE_ZONE
            ? `Completed ${card.stage}`
            : `Moved to ${columnTitle(target)}`,
        undo: () => restoreEntry(list, card.problem.id, before),
      });
    }
  };

  return (
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <GroupByToggle value={groupBy} onChange={setGroupBy} />
        <button
          onClick={() => setShowQueue((open) => !open)}
          aria-expanded={showQueue}
          className="flex items-center gap-2 rounded-lg bg-gray-200 dark:bg-gray-700 px-3 py-1.5 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          Review today
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              queue.length === 0
                ? "bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200"
                : queue.some((item) => item.urgency === "overdue")
                ? urgencyBadgeStyles.overdue
                : urgencyBadgeStyles.today
            }`}
          >
            {queue.length}
          </span>
        </button>
      </div>
      {showQueue && (
        <ReviewQueue items={queue} onComplete={completeFromQueue} />
      )}
      {byUrgency && (
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
          Problems waiting for a review, by due date. Drag a card to the green
          area, or use its menu, to complete the review.
        </p>
      )}
      <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 md:grid md:grid-cols-2 lg:grid-cols-4 md:overflow-visible md:snap-none md:pb-0">
        {shownColumns.map((column) => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            title={column.title}
            count={column.count}
            urgencyCounts={
              !byUrgency && column.id === "reviewing"
                ? column.urgencyCounts
                : undefined
            }
            tone={byUrgency ? column.id : undefined}
            droppable={!byUrgency}
            highlight={overColumnId === column.id}
          >
            {!byUrgency && column.id === "in-progress" ? (
              <SortableContext
                items={column.cards.map((card) => card.problem.id)}
                strategy={verticalListSortingStrategy}
              >
                {column.cards.map((card) => (
                  <SortableKanbanCard
                    key={card.problem.id}
                    card={card}
                    onComplete={completeFromQueue}
                  />
                ))}
              </SortableContext>
            ) : (
              column.cards.map((card) => (
                <DraggableKanbanCard
                  key={card.problem.id}
                  card={card}
                  onComplete={completeFromQueue}
                />
              ))
            )}
          </KanbanColumn>
        ))}
      </div>
      {byUrgency && <DoneDropZone />}
      <DragOverlay>
        {activeCard ? (
          <div className="cursor-grabbing shadow-xl rotate-2">
            {/* Dragged over To Do or In Progress it shows without the review */}
            <KanbanCard
              card={byUrgency ? activeCard : cardForColumn(activeCard, overColumnId)}
              onComplete={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
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
  );
};

export default KanbanBoard;
