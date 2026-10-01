import { MAX_FOLLOW_UPS } from '@nlm/shared';

const normal = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * The questions the model suggested, tidied: not the one the reader just asked, none twice, at most
 * {@link MAX_FOLLOW_UPS}. They are no claims, so the citation contract does not apply to them.
 */
export function cleanFollowUps(suggested: readonly string[], question: string): string[] {
  const seen = new Set([normal(question)]);
  const kept: string[] = [];
  for (const text of suggested) {
    const key = normal(text);
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    kept.push(text.trim().replace(/\s+/g, ' '));
  }
  return kept.slice(0, MAX_FOLLOW_UPS);
}
