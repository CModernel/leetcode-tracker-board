import { useDraggable } from "@dnd-kit/core";
import KanbanCard from "./KanbanCard";

// A card that can be dragged with the mouse, a long press on touch screens, or
// the keyboard (focus the card, then space or enter). While it is dragged, this
// copy stays in its column, dimmed; the board shows the moving copy in a
// DragOverlay.
const DraggableKanbanCard = ({ card, onComplete }) => {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: card.problem.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`cursor-grab rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <KanbanCard card={card} onComplete={onComplete} />
    </div>
  );
};

export default DraggableKanbanCard;
