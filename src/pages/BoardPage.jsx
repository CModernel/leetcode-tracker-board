import { KanbanBoard, TrackerHeader } from "../components";
import { useProgress } from "../context/ProgressContext";

const BoardPage = () => {
  const { selectedList } = useProgress();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 transition-colors">
      <div className="max-w-7xl mx-auto">
        <TrackerHeader title={`CodeTrack Pro - ${selectedList} Board`} />

        <KanbanBoard />
      </div>
    </div>
  );
};

export default BoardPage;
