import { useState, useEffect } from 'react';

/**
 * Returns a value that updates only after `delayMs` of stability.
 * The source `value` updates immediately elsewhere (e.g. map pan); consumers
 * that are expensive (clustering) should read the debounced copy.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
