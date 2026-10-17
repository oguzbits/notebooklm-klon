/**
 * Most starts per address within a window, counted in memory (a restart resets it, a second
 * instance would count on its own). It keeps one script from using up the hourly guest limit that
 * all visitors share.
 */
export function createIpLimit(max: number, windowMs: number) {
  const starts = new Map<string, number[]>();
  return (address: string, now: Date): boolean => {
    const since = now.getTime() - windowMs;
    for (const [key, times] of starts) {
      const recent = times.filter((time) => time > since);
      if (recent.length === 0) starts.delete(key);
      else starts.set(key, recent);
    }
    const recent = starts.get(address) ?? [];
    if (recent.length >= max) return false;
    starts.set(address, [...recent, now.getTime()]);
    return true;
  };
}
