import { useDroppable } from "@dnd-kit/core";

// One board column and a place where cards can be dropped. `count` is
// optional: nothing is shown until it is given. `highlight` marks the column
// while a card is over one of its cards. `empty` is the text shown instead of
// the cards when there are none.
const KanbanColumn = ({
  id,
  title,
  count,
  highlight = false,
  empty,
  children,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <section
      ref={setNodeRef}
      className={`flex flex-col flex-shrink-0 w-[85%] snap-center md:w-auto md:flex-shrink bg-gray-100 dark:bg-gray-800 rounded-lg p-3 min-h-[200px] transition-colors ${
        isOver || highlight ? "ring-2 ring-blue-400" : ""
      }`}
    >
      <header className="flex items-center justify-between mb-3 px-1">
        <h2 className="font-semibold text-gray-800 dark:text-white">{title}</h2>
        {count !== undefined && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
            {count}
          </span>
        )}
      </header>
      <div className="board-scroll flex flex-col gap-2 max-h-[70vh] overflow-y-auto pr-2">
        {empty ? (
          <p className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {empty}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
};

export default KanbanColumn;
