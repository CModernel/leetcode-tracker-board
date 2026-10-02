import { useCallback, useState } from "react";
import { Download, Upload, Trash2 } from "lucide-react";
import Toast from "./Toast";
import { useProgress } from "../context/ProgressContext";
import { useConfirm } from "../context/ConfirmContext";

// Asked before everything is erased. It is the only thing that wipes all three
// lists at once, so it says so.
const CLEAR_ALL_CONFIRM = {
  title: "Clear all progress?",
  message:
    "This erases the progress, notes and attempt history of all three lists (Blind 75, LeetCode 75 and NeetCode 150).",
  confirmLabel: "Clear all",
};

const ExportImportControls = () => {
  const { progress, setProgress, importData: applyImport, clearAll } = useProgress();
  const confirm = useConfirm();
  // Message with Undo after clearing ({ id, undo })
  const [notice, setNotice] = useState(null);
  const closeNotice = useCallback(() => setNotice(null), []);

  const exportData = () => {
    const dataStr = JSON.stringify(progress, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `leetcode-progress-${
      new Date().toISOString().split("T")[0]
    }.json`;
    link.click();
  };

  const importData = (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          applyImport(imported);
          alert("Progress imported successfully!");
        } catch {
          alert("Error importing file. Please check the file format.");
        }
      };
      reader.readAsText(file);
    }
  };

  const clearAllData = async () => {
    if (!(await confirm(CLEAR_ALL_CONFIRM))) return;
    // Everything as it was, so Undo can put it all back
    const before = progress;
    clearAll();
    setNotice({ id: Date.now(), undo: () => setProgress(before) });
  };

  return (
    <div className="flex flex-wrap gap-2 my-6">
      <button
        onClick={exportData}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded transition-colors"
      >
        <Download size={16} /> Export Progress
      </button>
      <label className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white rounded transition-colors cursor-pointer">
        <Upload size={16} /> Import Progress
        <input
          type="file"
          accept=".json"
          onChange={importData}
          className="hidden"
        />
      </label>
      <button
        onClick={clearAllData}
        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white rounded transition-colors"
      >
        <Trash2 size={16} /> Clear All
      </button>
      {notice && (
        <Toast
          key={notice.id}
          message="All progress cleared"
          onClose={closeNotice}
          duration={6000}
          actionLabel="Undo"
          onAction={notice.undo}
        />
      )}
    </div>
  );
};

export default ExportImportControls;
