import { createContext, useContext } from "react";

export const ConfirmContext = createContext();

// confirm({ title, message, confirmLabel }) -> Promise<boolean>
export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return context;
};
