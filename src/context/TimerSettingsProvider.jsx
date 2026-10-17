import { useCallback, useMemo, useState } from "react";
import { TimerSettingsContext } from "./TimerSettingsContext";
import {
  SHOW_TIMER_KEY,
  TIMER_LIMITS_KEY,
  parseShowTimer,
  parseTimerLimits,
  serializeLimits,
} from "../lib/timerSettings";

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error("Error saving the timer settings:", error);
  }
};

// Keeps the timer choices in the browser, next to (not inside) the progress.
export const TimerSettingsProvider = ({ children }) => {
  const [showTimer, setShow] = useState(() => parseShowTimer(read(SHOW_TIMER_KEY)));
  const [limits, setLimitsState] = useState(() => parseTimerLimits(read(TIMER_LIMITS_KEY)));

  const setShowTimer = useCallback((value) => {
    setShow(Boolean(value));
    write(SHOW_TIMER_KEY, String(Boolean(value)));
  }, []);
  const setLimits = useCallback((next) => {
    const clean = parseTimerLimits(JSON.stringify(next));
    setLimitsState(clean);
    write(TIMER_LIMITS_KEY, serializeLimits(clean));
  }, []);

  const value = useMemo(
    () => ({ showTimer, limits, setShowTimer, setLimits }),
    [showTimer, limits, setShowTimer, setLimits],
  );
  return <TimerSettingsContext.Provider value={value}>{children}</TimerSettingsContext.Provider>;
};
