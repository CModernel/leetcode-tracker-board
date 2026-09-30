import { useDroppable } from "@dnd-kit/core";
import { CheckCircle2 } from "lucide-react";
import { DONE_ZONE } from "../lib/board";

// Where a card is dropped to complete its review in the "by urgency" view.
const DoneDropZone = () => {
  const { setNodeRef, isOver } = useDroppable({ id: DONE_ZONE });

  return (
    <div
      ref={setNodeRef}
      className={`mt-4 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-sm font-medium transition-colors ${
        isOver
          ? "border-green-500 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
          : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400"
      }`}
    >
      <CheckCircle2 size={18} />
      Drop a card here to complete its review
    </div>
  );
};

export default DoneDropZone;
