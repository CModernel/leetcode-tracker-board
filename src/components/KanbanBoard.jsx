import { useCallback, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import KanbanColumn from "./KanbanColumn";
import KanbanCard from "./KanbanCard";
import DraggableKanbanCard from "./DraggableKanbanCard";
import Toast from "./Toast";
import { COLUMNS, applyDrop, buildColumns } from "../lib/board";
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
  const [activeId, setActiveId] = useState(null);
  // Message after a drop (why it was not allowed, or "Moved to..." with Undo);
  // a new id shows it again
  const [notice, setNotice] = useState(null);
  const closeNotice = useCallback(() => setNotice(null), []);

  // A small movement starts a drag, so clicks on the title link and on the
  // "⋯" menu keep working.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } })
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
  const columns = buildColumns(problems, listProgress, today);
  const activeCard = columns
    .flatMap((column) => column.cards)
    .find((card) => card.problem.id === activeId);

  const stopDragging = () => setActiveId(null);

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
      confirm
    );
    if (result.status === "rejected") {
      setNotice({ id: Date.now(), message: result.reason });
    } else if (result.status === "moved") {
      const column = COLUMNS.find((c) => c.id === over.id);
      setNotice({
        id: Date.now(),
        message: `Moved to ${column.title}`,
        undo: () => restoreEntry(list, card.problem.id, before),
      });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(event) => setActiveId(event.active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={stopDragging}
    >
      <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 md:grid md:grid-cols-2 lg:grid-cols-4 md:overflow-visible md:snap-none md:pb-0">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            title={column.title}
            count={column.count}
          >
            {column.cards.map((card) => (
              <DraggableKanbanCard key={card.problem.id} card={card} />
            ))}
          </KanbanColumn>
        ))}
      </div>
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
