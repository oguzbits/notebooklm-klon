import { parseHTML } from 'linkedom';

/** The few DOM properties needed here, so the server build needs no browser typings. */
export interface DomNode {
  nodeType: number;
  nodeName: string;
  data?: string;
  childNodes: ArrayLike<DomNode>;
}

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const LINE_BREAK_MARK = '\u0001';

const SKIPPED = new Set([
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'img',
  'iframe',
  'canvas',
  'video',
  'audio',
  'head',
  'hr',
]);
const BLOCKS = new Set([
  'p',
  'div',
  'section',
  'article',
  'main',
  'header',
  'footer',
  'aside',
  'nav',
  'blockquote',
  'figure',
  'figcaption',
  'form',
  'fieldset',
  'address',
  'details',
  'summary',
  'dl',
  'dt',
  'dd',
  'body',
  'html',
]);
const HEADING = /^h([1-6])$/;
const LIST = new Set(['ul', 'ol']);

/** Lower-case tag name, so the sets below do not depend on how the parser spells it. */
function tag(node: DomNode): string {
  return node.nodeName.toLowerCase();
}

function children(node: DomNode): DomNode[] {
  return Array.from(node.childNodes);
}

/** Text of a node as one line: whitespace collapsed, `<br>` kept as a line break. */
function inlineText(node: DomNode): string {
  if (node.nodeType === TEXT_NODE) return node.data ?? '';
  if (node.nodeType !== ELEMENT_NODE || SKIPPED.has(tag(node))) return '';
  if (tag(node) === 'br') return LINE_BREAK_MARK;
  const inner = children(node).map(inlineText).join('');
  return BLOCKS.has(tag(node)) ? ` ${inner} ` : inner;
}

function tidy(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(new RegExp(` ?${LINE_BREAK_MARK} ?`, 'g'), '\n')
    .trim();
}

function tableBlock(table: DomNode): string {
  const rows: string[] = [];
  const visit = (node: DomNode): void => {
    for (const child of children(node)) {
      if (tag(child) === 'tr') {
        const cells = children(child)
          .filter((cell) => tag(cell) === 'td' || tag(cell) === 'th')
          .map((cell) => tidy(inlineText(cell)).replace(/\n/g, ' '));
        if (cells.some((cell) => cell !== '')) rows.push(cells.join(' | '));
      } else if (child.nodeType === ELEMENT_NODE) {
        visit(child);
      }
    }
  };
  visit(table);
  return rows.join('\n');
}

function listBlock(list: DomNode, depth = 0): string {
  const lines: string[] = [];
  for (const item of children(list).filter((child) => tag(child) === 'li')) {
    const nested = children(item).filter((child) => LIST.has(tag(child)));
    const own = children(item)
      .filter((child) => !LIST.has(tag(child)))
      .map(inlineText)
      .join('');
    const text = tidy(own).replace(/\n/g, ' ');
    if (text !== '') lines.push(`${'  '.repeat(depth)}- ${text}`);
    for (const inner of nested) lines.push(listBlock(inner, depth + 1));
  }
  return lines.filter((line) => line !== '').join('\n');
}

function collectBlocks(node: DomNode, out: string[]): void {
  let run = '';
  const flush = (): void => {
    const text = tidy(run);
    if (text !== '') out.push(text);
    run = '';
  };

  for (const child of children(node)) {
    if (child.nodeType === TEXT_NODE) {
      run += child.data ?? '';
    } else if (child.nodeType !== ELEMENT_NODE || SKIPPED.has(tag(child))) {
      continue;
    } else if (tag(child) === 'table') {
      flush();
      const table = tableBlock(child);
      if (table !== '') out.push(table);
    } else if (LIST.has(tag(child))) {
      flush();
      const list = listBlock(child);
      if (list !== '') out.push(list);
    } else if (tag(child) === 'pre') {
      flush();
      const text = children(child)
        .map((part) => (part.nodeType === TEXT_NODE ? (part.data ?? '') : inlineText(part)))
        .join('')
        .replace(/\r\n?/g, '\n')
        .trim();
      if (text !== '') out.push(text);
    } else if (HEADING.test(tag(child))) {
      flush();
      const level = Number(HEADING.exec(tag(child))?.[1]);
      const text = tidy(inlineText(child)).replace(/\n/g, ' ');
      if (text !== '') out.push(`${'#'.repeat(level)} ${text}`);
    } else if (BLOCKS.has(tag(child))) {
      flush();
      collectBlocks(child, out);
    } else {
      run += inlineText(child);
    }
  }
  flush();
}

/**
 * Plain text of an HTML document with its structure kept: Markdown headings, one line per table
 * row, bullet lists. Scripts, styles and images are dropped. This is what gets chunked and searched.
 */
export function htmlToText(html: string): string {
  const source = /<html[\s>]/i.test(html) ? html : `<html><body>${html}</body></html>`;
  const { document } = parseHTML(source);
  const root: DomNode = document.body ?? document.documentElement;
  const blocks: string[] = [];
  collectBlocks(root, blocks);
  return blocks.join('\n\n');
}
