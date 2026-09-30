// Throwaway spike code (excluded from lint and check). Shared by embed-eval.mjs and chat-eval.mjs
// so both work on exactly the same chunks.
import { readFileSync } from 'node:fs';

export const CHUNK_CHARS = 1500;
export const OVERLAP_CHARS = 200;

const PARSED_PDFS = new Set([
  '01-dpr-paper-en.pdf',
  '02-destatis-arbeitsmarkt-de.pdf',
  '04-grundgesetz-auszug-de.pdf',
  '05-nist-ai-rmf-scan-en.pdf',
]);
const SOURCES = [
  ...PARSED_PDFS,
  '03-projekt-nordlicht-de.docx',
  '06-bdsg-auszug-de.txt',
  '07-wikipedia-rag-en.html',
].sort();

export const here = (path) => new URL(path, import.meta.url);
export const normalize = (text) => text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

function sourceText(file, parseDir) {
  return PARSED_PDFS.has(file)
    ? readFileSync(here(`./results/parse/${parseDir}/${file}.md`), 'utf8')
    : readFileSync(here(`./corpus/_text/${file}.txt`), 'utf8');
}

function chunk(text) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + CHUNK_CHARS, text.length);
    if (end < text.length) {
      const boundary = text.lastIndexOf('\n', end);
      if (boundary > start + CHUNK_CHARS / 2) end = boundary;
    }
    const piece = text.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= text.length) break;
    start = Math.max(end - OVERLAP_CHARS, start + 1);
  }
  return chunks;
}

/** PDFs come from the winning parsing output, all other files from the extracted reference text. */
export function buildChunks(parseDir) {
  return SOURCES.flatMap((file) =>
    chunk(sourceText(file, parseDir)).map((text, index) => ({ file, index, text }))
  );
}

export function loadGolden() {
  return JSON.parse(readFileSync(here('../apps/api/src/eval/golden-questions.json'), 'utf8'));
}
