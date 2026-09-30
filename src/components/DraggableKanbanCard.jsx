import { useDraggable } from "@dnd-kit/core";
import KanbanCard from "./KanbanCard";

// A card that can be dragged. While it is dragged, this copy stays in its
// column, dimmed; the board shows the moving copy in a DragOverlay.
const DraggableKanbanCard = ({ card }) => {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: card.problem.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      className={`cursor-grab ${isDragging ? "opacity-40" : ""}`}
    >
      <KanbanCard card={card} />
    </div>
  );
};

export default DraggableKanbanCard;
