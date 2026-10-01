import { createContext, useContext } from "react";

// The board's message with Undo. `showNotice({ message, undo })` is given by
// the board to the parts that change progress from inside a card (its menu).
// Outside a board it does nothing.
export const NoticeContext = createContext(() => {});

export const useNotice = () => useContext(NoticeContext);
