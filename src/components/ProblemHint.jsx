import { Search } from "lucide-react";
import { hintFor } from "../lib/hints";

// The magnifier of a problem: a link (a plain hash link, as the app uses a
// HashRouter, so it works wherever it is drawn) to the pattern it is solved with, on the
// Patterns page. It is only a nudge, so opening it changes nothing in the
// progress (no timer, no help). No magnifier when there is no clear pattern.
// It is inside draggable cards, so mouse, touch and keys are kept from
// reaching the card.
const ProblemHint = ({ problem, className = "" }) => {
  const hint = hintFor(problem);
  if (!hint) return null;
  const keep = (event) => event.stopPropagation();
  return (
    <a
      href={`#/patterns?pattern=${hint.id}`}
      aria-label={`Hint: ${hint.title}`}
      title={`Hint: ${hint.title}`}
      onMouseDown={keep}
      onTouchStart={keep}
      onPointerDown={keep}
      onKeyDown={keep}
      className={`flex flex-shrink-0 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-blue-400 ${className}`}
    >
      <Search size={16} aria-hidden="true" />
    </a>
  );
};

export default ProblemHint;
