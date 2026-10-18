import { createContext, useContext } from "react";
import { defaultLimits } from "../lib/timerSettings";

// The timer choices: `showTimer` (false hides every timer control) and `limits`
// (minutes by kind and difficulty, null = no limit). Without a provider (small
// tests) it is the defaults, and the setters do nothing.
export const TimerSettingsContext = createContext({
  showTimer: true,
  limits: defaultLimits(),
  setShowTimer: () => {},
  setLimits: () => {},
});

export const useTimerSettings = () => useContext(TimerSettingsContext);
