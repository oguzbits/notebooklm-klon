/** Where saving a text stands, for the line that tells the reader. */
export const SAVE_STATE = {
  SAVING: 'SAVING',
  SAVED: 'SAVED',
  // Not 'FAILED': every value of a dictionary is unique across the code base (`pnpm audit:magic`).
  FAILED: 'SAVE_FAILED',
} as const;

export type SaveEvent =
  | { state: typeof SAVE_STATE.SAVING | typeof SAVE_STATE.SAVED }
  | { state: typeof SAVE_STATE.FAILED; error: unknown };

/**
 * Saves a text that is typed continuously: after a pause, never two saves at once, and what was typed
 * while one was open goes right after it. A failed text is kept, so `flush` sends it again. The
 * latest text always wins, an older one is never written over a newer one.
 */
export function createSaveQueue({
  delayMs,
  write,
  onChange,
}: {
  delayMs: number;
  write: (text: string) => Promise<void>;
  onChange: (event: SaveEvent) => void;
}) {
  // Null means nothing is waiting. An empty string is a text (the reader deleted everything).
  let waiting: string | null = null;
  let open = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const run = async (): Promise<void> => {
    if (open || waiting === null) return;
    const text = waiting;
    waiting = null;
    open = true;
    onChange({ state: SAVE_STATE.SAVING });
    try {
      await write(text);
    } catch (error) {
      open = false;
      // Text typed during the save is newer and replaces the one that failed.
      waiting ??= text;
      onChange({ state: SAVE_STATE.FAILED, error });
      return;
    }
    open = false;
    if (waiting !== null) await run();
    else onChange({ state: SAVE_STATE.SAVED });
  };

  return {
    /** Takes the latest text and saves it after a pause. */
    push(text: string) {
      waiting = text;
      clearTimeout(timer);
      timer = setTimeout(() => void run(), delayMs);
    },
    /** Saves now what is waiting: when the note is closed, or to try a failed save again. */
    flush(): Promise<void> {
      clearTimeout(timer);
      return run();
    },
  };
}
