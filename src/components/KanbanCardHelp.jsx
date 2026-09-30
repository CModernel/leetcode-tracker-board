import { useState } from "react";
import OutcomeDialog from "./OutcomeDialog";
import { outcomeOptions } from "../lib/outcomes";
import { localToday } from "../lib/schedule";

// The "Needed help…" link under a card's Complete button. It opens the three
// outcomes of the review (`index`, 0-based) with their consequences; the choice
// goes to `onChoose(option)`.
const KanbanCardHelp = ({ card, index, onChoose }) => {
  const [open, setOpen] = useState(false);
  // Dates are computed when the dialog opens, from today
  const options = open ? outcomeOptions(card.entry, index, localToday()) : [];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-1 w-full text-center text-xs text-gray-500 dark:text-gray-400 underline-offset-2 hover:underline hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        Needed help…
      </button>
      {open && options.length > 0 && (
        <OutcomeDialog
          title={`${card.problem.title} · ${card.stage}`}
          options={options}
          onChoose={(option) => {
            setOpen(false);
            onChoose(option);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default KanbanCardHelp;
