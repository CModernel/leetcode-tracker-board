import { useSyncExternalStore } from "react";

// A clock shared by everything that shows a running time: ONE interval for the
// whole page, however many components use it, and it only exists while at
// least one of them is mounted and asked for it (`active`). The value is the
// current timestamp, refreshed every second.
let now = Date.now();
let id = null;
const listeners = new Set();

const subscribe = (listener) => {
  listeners.add(listener);
  if (id === null) {
    now = Date.now();
    id = setInterval(() => {
      now = Date.now();
      listeners.forEach((notify) => notify());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && id !== null) {
      clearInterval(id);
      id = null;
    }
  };
};
const getSnapshot = () => now;

const idle = () => () => {};

// The current timestamp, ticking every second while `active`; frozen (no
// interval, no re-render) when not.
export const useNow = (active) => useSyncExternalStore(active ? subscribe : idle, getSnapshot);
