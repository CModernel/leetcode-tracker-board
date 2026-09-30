import { useCallback, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import KanbanColumn from "./KanbanColumn";
import KanbanCard from "./KanbanCard";
import DraggableKanbanCard from "./DraggableKanbanCard";
import Toast from "./Toast";
import DoneDropZone from "./DoneDropZone";
import GroupByToggle from "./GroupByToggle";
import {
  COLUMNS,
  DONE_ZONE,
  URGENCY_COLUMNS,
  applyDrop,
  buildColumns,
  buildUrgencyColumns,
} from "../lib/board";
import {
  DRAG_INSTRUCTIONS,
  dragAnnouncements,
  moveToColumn,
} from "../lib/keyboardDnd";
import { filterProblems } from "../lib/filters";
import { localToday } from "../lib/schedule";
import { getProblems } from "../lib/lists";
import { useProgress } from "../context/ProgressContext";
import { useConfirm } from "../context/ConfirmContext";

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
  } = useProgress();
  const confirm = useConfirm();
  // "stage": columns by stage. "urgency": only problems waiting for a review,
  // grouped by due date, for review sessions.
  const [groupBy, setGroupBy] = useState("stage");
  const byUrgency = groupBy === "urgency";
  const [activeId, setActiveId] = useState(null);
  // Message after a drop (why it was not allowed, or "Moved to..." with Undo);
  // a new id shows it again
  const [notice, setNotice] = useState(null);
  const closeNotice = useCallback(() => setNotice(null), []);

  // Mouse: a small movement starts a drag, so clicks on the title link and on
  // the "⋯" menu keep working. Touch: a short press-and-hold starts it, so a
  // swipe still scrolls the board. Keyboard: arrow keys jump between columns.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: (event, { context, currentCoordinates }) => {
        const direction =
          event.code === "ArrowRight" ? 1 : event.code === "ArrowLeft" ? -1 : 0;
        if (!direction || !context.collisionRect) return undefined;
        event.preventDefault();
        const columnRects = context.droppableContainers
          .getEnabled()
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

  const today = localToday();
  const listProgress = progress[selectedList] || {};
  // Same filters as the tracker table, so both views show the same problems
  const problems = filterProblems(
    getProblems(selectedList),
    listProgress,
    filters,
    today
  );
  const columns = byUrgency
    ? buildUrgencyColumns(problems, listProgress, today)
    : buildColumns(problems, listProgress, today);
  const activeCard = columns
    .flatMap((column) => column.cards)
    .find((card) => card.problem.id === activeId);

  const stopDragging = () => setActiveId(null);

  const cardTitle = (id) =>
    columns
      .flatMap((column) => column.cards)
      .find((card) => card.problem.id === id)?.problem.title ?? "card";
  const columnTitle = (id) =>
    id === DONE_ZONE
      ? "the done zone"
      : [...COLUMNS, ...URGENCY_COLUMNS].find((column) => column.id === id)
          ?.title ?? "column";

  // Dropping a card runs the same progress actions as the table and the card
  // menu, so the tracker shows the change too. A drop that is not allowed
  // sends the card back to its column and says why.
  const handleDragEnd = async ({ active, over }) => {
    stopDragging();
    const card = columns
      .flatMap((column) => column.cards)
      .find((c) => c.problem.id === active.id);
    if (!card || !over) return;
    // What this problem looked like, to bring it back on Undo
    const list = selectedList;
    const before = listProgress[card.problem.id];
    const result = await applyDrop(
      card,
      over.id,
      { setStatus, markSolved, unsolve, completeReview, uncompleteReview },
      confirm,
      groupBy
    );
    if (result.status === "rejected") {
      setNotice({ id: Date.now(), message: result.reason });
    } else if (result.status === "moved") {
      setNotice({
        id: Date.now(),
        message:
          over.id === DONE_ZONE
            ? `Completed ${card.stage}`
            : `Moved to ${columnTitle(over.id)}`,
        undo: () => restoreEntry(list, card.problem.id, before),
      });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      accessibility={{
        announcements: dragAnnouncements(cardTitle, columnTitle),
        screenReaderInstructions: { draggable: DRAG_INSTRUCTIONS },
      }}
      onDragStart={(event) => setActiveId(event.active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={stopDragging}
    >
      <GroupByToggle value={groupBy} onChange={setGroupBy} />
      {byUrgency && (
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
          Problems waiting for a review, by due date. Drag a card to the green
          area, or use its menu, to complete the review.
        </p>
      )}
      <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 md:grid md:grid-cols-2 lg:grid-cols-4 md:overflow-visible md:snap-none md:pb-0">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            title={column.title}
            count={column.count}
            droppable={!byUrgency}
          >
            {column.cards.map((card) => (
              <DraggableKanbanCard key={card.problem.id} card={card} />
            ))}
          </KanbanColumn>
        ))}
      </div>
      {byUrgency && <DoneDropZone />}
      <DragOverlay>
        {activeCard ? (
          <div className="cursor-grabbing shadow-xl rotate-2">
            <KanbanCard card={activeCard} />
          </div>
        ) : null}
      </DragOverlay>
      {notice && (
        <Toast
          key={notice.id}
          message={notice.message}
          onClose={closeNotice}
          duration={notice.undo ? 6000 : 4000}
          actionLabel={notice.undo ? "Undo" : undefined}
          onAction={notice.undo}
        />
      )}
    </DndContext>
  );
};

export default KanbanBoard;
