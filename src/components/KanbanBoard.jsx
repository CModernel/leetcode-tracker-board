import KanbanColumn from "./KanbanColumn";
import { buildColumns } from "../lib/board";
import { localToday } from "../lib/schedule";
import { getProblems } from "../lib/lists";
import { useProgress } from "../context/ProgressContext";

const KanbanBoard = () => {
  const { progress, selectedList } = useProgress();

  const columns = buildColumns(
    getProblems(selectedList),
    progress[selectedList] || {},
    localToday()
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {columns.map((column) => (
        <KanbanColumn key={column.id} title={column.title} count={column.count} />
      ))}
    </div>
  );
};

export default KanbanBoard;
