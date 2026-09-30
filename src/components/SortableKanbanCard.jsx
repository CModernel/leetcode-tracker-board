import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import KanbanCard from "./KanbanCard";

// A card that can also be reordered inside its column (In Progress). It is
// dragged the same way as a DraggableKanbanCard: mouse, long press, keyboard.
// While dragged, this copy stays in its column, dimmed, and the other cards
// make room for it.
const SortableKanbanCard = ({ card, onComplete, onHelp }) => {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id: card.problem.id });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`cursor-grab rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <KanbanCard card={card} onComplete={onComplete} onHelp={onHelp} />
    </div>
  );
};

export default SortableKanbanCard;
