import { useState } from "react";
import SolutionDialog from "./SolutionDialog";
import { useProgress } from "../context/ProgressContext";
import { SOLUTION_LANGUAGE_KEY, parseSolutionLanguage } from "../lib/preferences";

const readLanguage = () => {
  try {
    return parseSolutionLanguage(localStorage.getItem(SOLUTION_LANGUAGE_KEY));
  } catch {
    return parseSolutionLanguage(null);
  }
};

// The solution dialog of one problem, wired to the saved progress: the card and
// the tracker both render this, so they behave the same. Revealing the code is
// remembered as looking it up today (it only matters when a review is completed
// the same day); opening, writing or editing is not. The language of the last
// solution saved is offered first the next time.
const ProblemSolutionDialog = ({ problem, solutions, onClose }) => {
  const { setSolution, markHelpViewed } = useProgress();
  const [defaultLanguage] = useState(readLanguage);

  return (
    <SolutionDialog
      label={problem.title}
      solutions={solutions}
      defaultLanguage={defaultLanguage}
      onReveal={() => markHelpViewed(problem.id, "solution")}
      onSave={(index, solution) => {
        setSolution(problem.id, index, solution);
        if (solution) {
          try {
            localStorage.setItem(SOLUTION_LANGUAGE_KEY, solution.language);
          } catch (error) {
            console.error("Error saving the solution language:", error);
          }
        }
      }}
      onClose={onClose}
    />
  );
};

export default ProblemSolutionDialog;
