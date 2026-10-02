import { posix } from 'node:path';

import { strFromU8, unzipSync } from 'fflate';
import { DOMParser } from 'linkedom';

import type { ParsedDocument } from '../ingestion/ingest';
import { type DomNode, escapeMarkdownText } from './html-text';

/** No slide, list of slides or notes page is larger than this once unpacked. A larger part is an attack. */
const MAX_PART_BYTES = 5_000_000;

const PRESENTATION = 'ppt/presentation.xml';
const PRESENTATION_RELS = 'ppt/_rels/presentation.xml.rels';
/** The parts that are read; every other file of the ZIP (media, themes, layouts) is never unpacked. */
const READ_PARTS =
  /^ppt\/(presentation\.xml|_rels\/presentation\.xml\.rels|slides\/(_rels\/)?slide\d+\.xml(\.rels)?|notesSlides\/notesSlide\d+\.xml)$/;
const NOTES_RELATION = /\/notesSlide$/;
const TITLE_TYPES = new Set(['title', 'ctrTitle']);
/** Numbers, footers and dates repeat on every slide and say nothing about the content. */
const DECORATION_TYPES = new Set(['sldNum', 'ftr', 'dt']);
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

type Parts = Record<string, Uint8Array>;

interface Shape {
  placeholder: string | null;
  text: string;
}

const parseXml = (xml: string): DomNode => new DOMParser().parseFromString(xml, 'text/xml');

const elements = (node: DomNode) =>
  Array.from(node.childNodes).filter((child) => child.nodeType === ELEMENT_NODE);

function descendants(node: DomNode, name: string): DomNode[] {
  return elements(node).flatMap((child) => [
    ...(child.nodeName === name ? [child] : []),
    ...descendants(child, name),
  ]);
}

function plainText(node: DomNode): string {
  if (node.nodeType === TEXT_NODE) return node.data ?? '';
  if (node.nodeName === 'a:br') return '\n';
  return Array.from(node.childNodes).map(plainText).join('');
}

function unpack(bytes: Uint8Array): Parts {
  return unzipSync(bytes, {
    filter: ({ name, originalSize }) => {
      if (!READ_PARTS.test(name)) return false;
      if (originalSize > MAX_PART_BYTES)
        throw new Error(`A part of the presentation is too large.`);
      return true;
    },
  });
}

function part(parts: Parts, name: string): DomNode {
  const bytes = parts[name];
  if (!bytes) throw new Error(`The file is not a presentation: ${name} is missing.`);
  return parseXml(strFromU8(bytes));
}

/** The address of a part that a relationship points to, from the folder of the file that holds it. */
const target = (folder: string, address: string) =>
  address.startsWith('/') ? address.slice(1) : posix.join(folder, address);

function relations(rels: DomNode, folder: string) {
  return descendants(rels, 'Relationship').map((relation) => ({
    id: relation.getAttribute?.('Id') ?? '',
    type: relation.getAttribute?.('Type') ?? '',
    part: target(folder, relation.getAttribute?.('Target') ?? ''),
  }));
}

/** The text of a paragraph as a line, a nested point with its indent. Null for an empty paragraph. */
function line(paragraph: DomNode): string | null {
  const text = escapeMarkdownText(plainText(paragraph)).trim();
  if (text === '') return null;
  const level = Number(descendants(paragraph, 'a:pPr')[0]?.getAttribute?.('lvl') ?? 0);
  return level > 0 ? `${'  '.repeat(level)}- ${text}` : text;
}

function shape(node: DomNode): Shape {
  const placeholder = descendants(node, 'p:ph')[0]?.getAttribute?.('type') ?? null;
  const lines = descendants(node, 'a:p').map(line);
  return { placeholder, text: lines.filter((entry) => entry !== null).join('\n') };
}

/** A cell as one line: a line break or a bar would break the row of the Markdown table. */
const cellText = (cell: DomNode) =>
  escapeMarkdownText(plainText(cell).replace(/\s+/g, ' ').trim()).replace(/\|/g, '\\|');

function table(node: DomNode): string {
  const rows = descendants(node, 'a:tr').map(
    (row) => `| ${descendants(row, 'a:tc').map(cellText).join(' | ')} |`
  );
  const columns = descendants(node, 'a:tc').length / Math.max(rows.length, 1);
  const rule = `|${' --- |'.repeat(Math.round(columns))}`;
  return [rows[0], rule, ...rows.slice(1)].join('\n');
}

/** Shapes and tables of a page in the order they stand in the file, groups opened. */
function blocks(node: DomNode): (Shape | string)[] {
  return elements(node).flatMap((child) => {
    if (child.nodeName === 'p:sp') return [shape(child)];
    if (child.nodeName === 'a:tbl') return [table(child)];
    return blocks(child);
  });
}

function slideText(number: number, slide: DomNode, notes: DomNode | null): string | null {
  const content = blocks(slide).filter(
    (block) => typeof block === 'string' || !DECORATION_TYPES.has(block.placeholder ?? '')
  );
  const title = content.find(
    (block): block is Shape => typeof block !== 'string' && TITLE_TYPES.has(block.placeholder ?? '')
  );
  const body = content
    .filter((block) => block !== title)
    .map((block) => (typeof block === 'string' ? block : block.text))
    .filter((text) => text !== '');
  const spoken = notes
    ? blocks(notes)
        .filter(
          (block): block is Shape => typeof block !== 'string' && block.placeholder === 'body'
        )
        .map((block) => block.text)
        .filter((text) => text !== '')
    : [];
  if (!title?.text && body.length === 0 && spoken.length === 0) return null;
  const heading = `## Folie ${number}${title?.text ? `: ${title.text.replace(/\n/g, ' ')}` : ''}`;
  return [heading, ...body, ...(spoken.length ? [`Notizen: ${spoken.join('\n')}`] : [])].join(
    '\n\n'
  );
}

/** The notes page of a slide, from the relationship file that sits next to it. */
function notesOf(parts: Parts, slidePart: string): DomNode | null {
  const folder = posix.dirname(slidePart);
  const relsName = posix.join(folder, '_rels', `${posix.basename(slidePart)}.rels`);
  if (!parts[relsName]) return null;
  const notes = relations(part(parts, relsName), folder).find((relation) =>
    NOTES_RELATION.test(relation.type)
  );
  return notes && parts[notes.part] ? part(parts, notes.part) : null;
}

/**
 * PPTX is a ZIP of XML files. The text of every slide is read in the order of the presentation (not of
 * the file names, which stay when a slide is moved), with tables as Markdown tables and the speaker
 * notes below their slide. Pictures, charts and animations carry no text and are left out.
 */
export async function parsePptx(bytes: Uint8Array): Promise<ParsedDocument> {
  const parts = unpack(bytes);
  const rels = relations(part(parts, PRESENTATION_RELS), 'ppt');
  const order = descendants(part(parts, PRESENTATION), 'p:sldId').map(
    (slide) => slide.getAttribute?.('r:id') ?? ''
  );
  const texts = order.map((id, index) => {
    const slidePart = rels.find((relation) => relation.id === id)?.part;
    if (!slidePart) throw new Error('A slide of the presentation has no file.');
    return slideText(index + 1, part(parts, slidePart), notesOf(parts, slidePart));
  });
  return { text: texts.filter((text) => text !== null).join('\n\n'), pageCount: null };
}
