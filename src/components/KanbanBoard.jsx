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
    <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 md:grid md:grid-cols-2 lg:grid-cols-4 md:overflow-visible md:snap-none md:pb-0">
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
