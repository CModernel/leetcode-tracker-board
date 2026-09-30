import { useCallback, useState } from "react";
import { ConfirmContext } from "./ConfirmContext";
import ConfirmDialog from "../components/ConfirmDialog";

// Lets any component ask "are you sure?" with `await confirm({...})` and shows
// one dialog at a time. A new question answers the open one with "no".
export const ConfirmProvider = ({ children }) => {
  const [pending, setPending] = useState(null);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        setPending((current) => {
          current?.resolve(false);
          return { options, resolve };
        });
      }),
    []
  );

  const answer = (value) => {
    pending.resolve(value);
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <ConfirmDialog
          {...pending.options}
          onConfirm={() => answer(true)}
          onCancel={() => answer(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
};
