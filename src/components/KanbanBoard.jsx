import KanbanColumn from "./KanbanColumn";
import { COLUMNS } from "../lib/board";

const KanbanBoard = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    {COLUMNS.map((column) => (
      <KanbanColumn key={column.id} title={column.title} />
    ))}
  </div>
);

export default KanbanBoard;
