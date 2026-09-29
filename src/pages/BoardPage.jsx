import { TrackerHeader } from "../components";
import { useProgress } from "../context/ProgressContext";

const BoardPage = () => {
  const { selectedList } = useProgress();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 transition-colors">
      <div className="max-w-7xl mx-auto">
        <TrackerHeader title={`CodeTrack Pro - ${selectedList} Board`} />

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 transition-colors">
          <p className="text-gray-600 dark:text-gray-300">
            The Kanban board is coming soon.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BoardPage;
