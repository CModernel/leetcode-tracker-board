import { problemLists } from "../lib/lists";
import { useProgress } from "../context/ProgressContext";

// The problem list being shown (Blind 75, LeetCode 75, NeetCode 150). Every page
// works on this one list; the choice is remembered by the progress provider.
const ListSelect = () => {
  const { selectedList, setSelectedList } = useProgress();
  return (
    <select
      id="problem-list"
      value={selectedList}
      title="Select a problem list"
      aria-label="Problem list"
      onChange={(e) => setSelectedList(e.target.value)}
      className="px-4 py-2 cursor-pointer rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none"
    >
      <option value="" disabled>
        Select List
      </option>
      {Object.keys(problemLists).map((listName) => (
        <option key={listName} value={listName}>
          {listName}
        </option>
      ))}
    </select>
  );
};

export default ListSelect;
