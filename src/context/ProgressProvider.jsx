import { useState, useEffect } from "react";
import { ProgressContext } from "./ProgressContext";
import { localToday } from "../lib/schedule";
import * as reducers from "./progressReducers";

const STORAGE_KEY = "leetcode-progress-v2";

export const ProgressProvider = ({ children }) => {
  const [progress, setProgress] = useState(() => {
    try {
      const savedProgress = localStorage.getItem(STORAGE_KEY);
      return savedProgress
        ? JSON.parse(savedProgress)
        : reducers.emptyProgress();
    } catch (error) {
      console.error("Error loading progress from localStorage:", error);
      return reducers.emptyProgress();
    }
  });
  const [selectedList, setSelectedList] = useState("");

  // Save progress to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (error) {
      console.error("Error saving progress to localStorage:", error);
    }
  }, [progress]);

  // Actions apply to the selected list and stamp today's local date.
  const actions = {
    markSolved: (problemId) =>
      setProgress((prev) =>
        reducers.markSolved(prev, selectedList, problemId, localToday())
      ),
    unsolve: (problemId) =>
      setProgress((prev) => reducers.unsolve(prev, selectedList, problemId)),
    completeReview: (problemId, index) =>
      setProgress((prev) =>
        reducers.completeReview(
          prev,
          selectedList,
          problemId,
          index,
          localToday()
        )
      ),
    uncompleteReview: (problemId, index) =>
      setProgress((prev) =>
        reducers.uncompleteReview(prev, selectedList, problemId, index)
      ),
    importData: (data) => setProgress(reducers.importData(data)),
    clearAll: () => setProgress(reducers.clearAll()),
  };

  return (
    <ProgressContext.Provider
      value={{
        progress,
        setProgress,
        selectedList,
        setSelectedList,
        ...actions,
      }}
    >
      {children}
    </ProgressContext.Provider>
  );
};
