/**
 * Allows a key (a user, or one fixed key for everybody) a number of uses within a sliding window.
 * The clock is passed in, so it is deterministic. It lives in memory: with more than one server
 * process each would count on its own.
 */
export function createWindowLimit(options: { max: number; windowMs: number; now: () => number }) {
  const uses = new Map<string, number[]>();

  return {
    /** True and counted when the key may go on, false (not counted) when it used up its share. */
    take(key: string): boolean {
      const now = options.now();
      const recent = (uses.get(key) ?? []).filter((at) => now - at < options.windowMs);
      if (recent.length >= options.max) {
        uses.set(key, recent);
        return false;
      }
      recent.push(now);
      uses.set(key, recent);
      return true;
    },
  };
}
