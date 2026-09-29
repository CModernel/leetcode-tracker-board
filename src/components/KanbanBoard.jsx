import KanbanColumn from "./KanbanColumn";
import KanbanCard from "./KanbanCard";
import { buildColumns } from "../lib/board";
import { filterProblems } from "../lib/filters";
import { localToday } from "../lib/schedule";
import { getProblems } from "../lib/lists";
import { useProgress } from "../context/ProgressContext";

const KanbanBoard = () => {
  const { progress, selectedList, filters } = useProgress();

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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {columns.map((column) => (
        <KanbanColumn key={column.id} title={column.title} count={column.count}>
          {column.cards.map((card) => (
            <KanbanCard key={card.problem.id} card={card} />
          ))}
        </KanbanColumn>
      ))}
    </div>
  );
};

export default KanbanBoard;
