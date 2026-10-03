// Control characters except tab (\u0009) and line feed (\u000A), plus the byte order mark.
// eslint-disable-next-line no-control-regex
const UNWANTED = /[\u{0}-\u{8}\u{B}-\u{1F}\u{7F}\u{FEFF}]/gu;

const DELIMITER_ROW = /^\|(?:\s*:?-+:?\s*\|)+$/;
const CELL_SEPARATOR = /(?<!\\)\|/;
const DEFAULT_DELIMITER_CELL = ':---';

const cellsOf = (row: string): string[] =>
  row.trim().replace(/^\|/, '').replace(/\|$/, '').split(CELL_SEPARATOR);

/**
 * A table needs a delimiter row with as many cells as its header, or Markdown shows it as running
 * text. A model that transcribes a PDF table sometimes gets the count wrong, so the delimiter row
 * is cut or padded to the header.
 */
function matchDelimiterToHeader(text: string): string {
  const lines = text.split('\n');
  for (let index = 1; index < lines.length; index += 1) {
    const header = (lines[index - 1] ?? '').trim();
    const delimiter = (lines[index] ?? '').trim();
    if (!header.startsWith('|') || !DELIMITER_ROW.test(delimiter)) continue;
    const count = cellsOf(header).length;
    const cells = cellsOf(delimiter);
    if (cells.length === count) continue;
    const matched = Array.from(
      { length: count },
      (_, cell) => cells[cell]?.trim() ?? DEFAULT_DELIMITER_CELL
    );
    lines[index] = `| ${matched.join(' | ')} |`;
  }
  return lines.join('\n');
}

/**
 * The one text a source is stored and chunked as. Chunk offsets and the reader highlight point into
 * it, so every parser feeds its output through this before anything else happens. Idempotent.
 */
export function toCanonicalText(raw: string): string {
  const text = raw
    .replace(/\r\n?/g, '\n')
    .replace(UNWANTED, '')
    .normalize('NFC')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return matchDelimiterToHeader(text);
}
