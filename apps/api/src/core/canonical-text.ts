// Control characters except tab (\u0009) and line feed (\u000A), plus the byte order mark.
// eslint-disable-next-line no-control-regex
const UNWANTED = /[\u{0}-\u{8}\u{B}-\u{1F}\u{7F}\u{FEFF}]/gu;

/**
 * The one text a source is stored and chunked as. Chunk offsets and the reader highlight point into
 * it, so every parser feeds its output through this before anything else happens. Idempotent.
 */
export function toCanonicalText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(UNWANTED, '')
    .normalize('NFC')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
