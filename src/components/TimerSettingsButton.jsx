import { useState } from "react";
import { Timer } from "lucide-react";
import TimerSettingsDialog from "./TimerSettingsDialog";

// The navbar button that opens the timer settings. The dialog is only mounted
// while open, so it starts from the saved values every time.
const TimerSettingsButton = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="h-10 w-10 flex items-center justify-center rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-all duration-300"
        aria-label="Timer settings"
        title="Timer settings"
      >
        <Timer size={20} aria-hidden="true" />
      </button>
      {open && <TimerSettingsDialog onClose={() => setOpen(false)} />}
    </>
  );
};

export default TimerSettingsButton;
