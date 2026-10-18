import { useEffect, useReducer, useRef } from "react";

// Keeps showing the last value for `ms` after it goes away (null / undefined),
// so something can animate out instead of vanishing: returns the current value
// or, while it lingers, the last one. Use `!value && lingering` to know it is
// on its way out. The last value is kept in a ref (not in state): `value` is
// often a new object on every render, and saving it in state would loop.
export const useLingering = (value, ms) => {
  const last = useRef(value ?? null);
  const [, rerender] = useReducer((n) => n + 1, 0);

  useEffect(() => {
    if (value) {
      last.current = value;
      return undefined;
    }
    if (!last.current) return undefined;
    const id = setTimeout(() => {
      last.current = null;
      rerender();
    }, ms);
    return () => clearTimeout(id);
  }, [value, ms]);

  return value ?? last.current;
};
