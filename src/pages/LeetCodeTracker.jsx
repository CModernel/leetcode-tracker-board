import { ProblemTable, TrackerHeader } from "../components";
import { getProblems } from "../lib/lists";
import { useProgress } from "../context/ProgressContext";

const LeetCodeTracker = () => {
  const { progress, selectedList } = useProgress();

  const problems = getProblems(selectedList);
  const currentProgress = progress[selectedList] || {};

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 transition-colors">
      <div className="max-w-7xl mx-auto">
        <TrackerHeader
          title={`CodeTrack Pro - ${selectedList} Progress Tracker`}
        />

        {/* Problems Table */}
        <ProblemTable problems={problems} progress={currentProgress} />
      </div>
    </div>
  );
};

export default LeetCodeTracker;
