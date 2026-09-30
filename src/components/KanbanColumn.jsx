import { useDroppable } from "@dnd-kit/core";
import { urgencyBadgeStyles } from "../lib/urgencyStyles";

// One board column and a place where cards can be dropped (unless `droppable`
// is false). `count` is optional: nothing is shown until it is given.
// `highlight` marks the column while a card is over one of its cards.
// `urgencyCounts` ({ overdue, today }) adds a red and a yellow number for the
// cards that are overdue or due today. `tone` colors the main count
// ("overdue" red, "today" yellow) in the by-urgency view.
const KanbanColumn = ({
  id,
  title,
  count,
  urgencyCounts,
  tone,
  droppable = true,
  highlight = false,
  children,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !droppable });

  return (
    <section
      ref={setNodeRef}
      className={`flex flex-col flex-shrink-0 w-[85%] snap-center md:w-auto md:flex-shrink bg-gray-100 dark:bg-gray-800 rounded-lg p-3 min-h-[200px] transition-colors ${
        isOver || highlight ? "ring-2 ring-blue-400" : ""
      }`}
    >
      <header className="flex items-center justify-between mb-3 px-1">
        <h2 className="font-semibold text-gray-800 dark:text-white">{title}</h2>
        <div className="flex items-center gap-1.5">
          {urgencyCounts?.overdue > 0 && (
            <span
              title={`${urgencyCounts.overdue} overdue`}
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${urgencyBadgeStyles.overdue}`}
            >
              {urgencyCounts.overdue} overdue
            </span>
          )}
          {urgencyCounts?.today > 0 && (
            <span
              title={`${urgencyCounts.today} due today`}
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${urgencyBadgeStyles.today}`}
            >
              {urgencyCounts.today} today
            </span>
          )}
          {count !== undefined && (
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                urgencyBadgeStyles[tone] ??
                "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              }`}
            >
              {count}
            </span>
          )}
        </div>
      </header>
      <div className="flex flex-col gap-2 max-h-[70vh] overflow-y-auto">
        {children}
      </div>
    </section>
  );
};

export default KanbanColumn;
