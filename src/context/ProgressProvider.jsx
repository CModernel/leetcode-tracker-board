import { useState, useEffect } from "react";
import { ProgressContext } from "./ProgressContext";

const STORAGE_KEY = "leetcode-progress-v2";

const emptyProgress = () => ({
  "Blind 75": {},
  "LeetCode 75": {},
  "NeetCode 150": {},
});

export const ProgressProvider = ({ children }) => {
  const [progress, setProgress] = useState(() => {
    try {
      const savedProgress = localStorage.getItem(STORAGE_KEY);
      return savedProgress ? JSON.parse(savedProgress) : emptyProgress();
    } catch (error) {
      console.error("Error loading progress from localStorage:", error);
      return emptyProgress();
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

  return (
    <ProgressContext.Provider
      value={{ progress, setProgress, selectedList, setSelectedList }}
    >
      {children}
    </ProgressContext.Provider>
  );
};
