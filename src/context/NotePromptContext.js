import { createContext, useContext } from "react";

// `askNote(problem)` offers to write the note of a problem that was just marked
// as solved. The board gives it to the parts that solve from inside a card (its
// menu). Outside a board it does nothing.
export const NotePromptContext = createContext(() => {});

export const useNotePrompt = () => useContext(NotePromptContext);
