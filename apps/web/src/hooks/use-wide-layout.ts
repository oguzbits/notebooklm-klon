import { useSyncExternalStore } from 'react';

// The same breakpoint as `--breakpoint-wide` in index.css (66rem): from here the notebook shows its
// three columns side by side, below it one column at a time.
const WIDE_QUERY = '(min-width: 66rem)';

function subscribe(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** Whether the three columns stand side by side. Only then can a column fold into a rail. */
export function useWideLayout(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true
  );
}
