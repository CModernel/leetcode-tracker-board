import { useState } from "react";
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
import { buildColumns } from "../lib/board";
import { filterProblems } from "../lib/filters";
import { localToday } from "../lib/schedule";
import { getProblems } from "../lib/lists";
import { useProgress } from "../context/ProgressContext";

const KanbanBoard = () => {
  const { progress, selectedList, filters } = useProgress();
  const [activeId, setActiveId] = useState(null);

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

  // For now dropping only ends the drag: the card goes back to its column and
  // nothing changes. Moving problems on drop comes in a later step.
  const stopDragging = () => setActiveId(null);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(event) => setActiveId(event.active.id)}
      onDragEnd={stopDragging}
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
    </DndContext>
  );
};

export default KanbanBoard;
