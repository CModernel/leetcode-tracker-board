import { useState, useEffect, useRef } from "react";
import { ProgressContext } from "./ProgressContext";
import { localToday } from "../lib/schedule";
import { getProblems } from "../lib/lists";
import { computeStats } from "../lib/stats";
import { titleWithCount } from "../lib/title";
import * as reducers from "./progressReducers";
import { DEFAULT_FILTERS, applyFilter } from "../lib/filters";
import {
  V3_KEY,
  loadProgress,
  migrate,
  parseStored,
  serializeProgress,
} from "../lib/migrate";

const LIST_KEY = "leetcode-selected-list";

export const ProgressProvider = ({ children }) => {
  const [progress, setProgress] = useState(() => {
    try {
      return loadProgress((key) => localStorage.getItem(key));
    } catch (error) {
      console.error("Error loading progress from localStorage:", error);
      return reducers.emptyProgress();
    }
  });
  const [selectedList, setSelectedList] = useState(() => {
    try {
      return reducers.parseSelectedList(localStorage.getItem(LIST_KEY));
    } catch {
      return reducers.DEFAULT_LIST;
    }
  });

  // Filters are shared by every page that lists problems (not saved)
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const setFilter = (key, value) =>
    setFilters((prev) => applyFilter(prev, key, value));

  // Save progress to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(V3_KEY, serializeProgress(progress));
    } catch (error) {
      console.error("Error saving progress to localStorage:", error);
    }
  }, [progress]);

  // Remember the selected list
  useEffect(() => {
    try {
      localStorage.setItem(LIST_KEY, selectedList);
    } catch (error) {
      console.error("Error saving selected list to localStorage:", error);
    }
  }, [selectedList]);

  // The reviews due show in the browser tab title: "(3) CodeTrack Pro". The
  // date is checked every minute so the number changes at midnight too.
  const [today, setToday] = useState(localToday);
  useEffect(() => {
    const timer = setInterval(() => setToday(localToday()), 60000);
    return () => clearInterval(timer);
  }, []);
  const baseTitle = useRef(document.title);
  const dueCount = computeStats(
    getProblems(selectedList),
    progress[selectedList] || {},
    today
  ).dueToday;
  useEffect(() => {
    document.title = titleWithCount(baseTitle.current, dueCount);
  }, [dueCount]);
  useEffect(() => {
    const base = baseTitle.current;
    return () => {
      document.title = base;
    };
  }, []);

  // Keep several open tabs in sync: the browser fires "storage" in the other
  // tabs when one of them saves. Applying the same text does not re-fire it.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.storageArea !== localStorage) return;
      if (event.key !== null && event.key !== V3_KEY) return;
      try {
        setProgress(parseStored(event.newValue));
      } catch (error) {
        console.error("Error reading progress from another tab:", error);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Actions apply to the selected list and stamp today's local date.
  const actions = {
    markSolved: (problemId) =>
      setProgress((prev) =>
        reducers.markSolved(prev, selectedList, problemId, localToday())
      ),
    unsolve: (problemId) =>
      setProgress((prev) => reducers.unsolve(prev, selectedList, problemId)),
    reorder: (orderedIds) =>
      setProgress((prev) => reducers.setOrder(prev, selectedList, orderedIds)),
    restoreEntries: (list, snapshot) =>
      setProgress((prev) => reducers.restoreEntries(prev, list, snapshot)),
    restoreEntry: (list, problemId, entry) =>
      setProgress((prev) => reducers.restoreEntry(prev, list, problemId, entry)),
    setStatus: (problemId, status) =>
      setProgress((prev) =>
        reducers.setStatus(
          prev,
          selectedList,
          problemId,
          status,
          localToday(),
          new Date().toISOString()
        )
      ),
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
    rewindReviews: (problemId, index) =>
      setProgress((prev) =>
        reducers.rewindReviews(prev, selectedList, problemId, index)
      ),
    // Old export files (plain progress) and v3 files both work
    importData: (data) => setProgress(migrate(data).progress),
    clearAll: () => setProgress(reducers.clearAll()),
  };

  return (
    <ProgressContext.Provider
      value={{
        progress,
        setProgress,
        selectedList,
        setSelectedList,
        filters,
        setFilter,
        ...actions,
      }}
    >
      {children}
    </ProgressContext.Provider>
  );
};
