import { parseHTML } from 'linkedom';

/** The few DOM properties needed here, so the server build needs no browser typings. */
export interface DomNode {
  nodeType: number;
  nodeName: string;
  data?: string;
  childNodes: ArrayLike<DomNode>;
  getAttribute?: (name: string) => string | null;
}

/** What `documentBaseUrl` needs from a document. */
interface QueryRoot {
  querySelector: (selector: string) => { getAttribute: (name: string) => string | null } | null;
}

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const LINE_BREAK_MARK = '\u0001';
const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

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

/** How a piece of text is read: which page its relative links belong to, and whether it may carry marks. */
interface Context {
  base: URL | null;
  /** A heading is plain: no links and no emphasis inside it. */
  plain: boolean;
}

/** Lower-case tag name, so the sets below do not depend on how the parser spells it. */
function tag(node: DomNode): string {
  return node.nodeName.toLowerCase();
}

function children(node: DomNode): DomNode[] {
  return Array.from(node.childNodes);
}

/** Backslash-escapes what Markdown would read as formatting inside a line of text. */
export function escapeMarkdownText(text: string): string {
  return (
    text
      .replace(/\\/g, '\\\\')
      .replace(/[*_`<]/g, '\\$&')
      .replace(/&(?=#?\w+;)/g, '\\&')
      // A bracket only matters in front of a parenthesis, where it would start a link.
      .replace(/\](?=\()/g, '\\]')
  );
}

/** Escapes a line that would start a heading, a quote, a list or a rule once it stands alone. */
function escapeLineStart(line: string): string {
  return line
    .replace(/^(\s*)([#>+-])(?=[\s#-]|$)/, '$1\\$2')
    .replace(/^(\s*\d+)([.)])(?=\s|$)/, '$1\\$2');
}

/** Escapes each line of a block of text. */
function escapeBlock(text: string): string {
  return text.split('\n').map(escapeLineStart).join('\n');
}

function isUsableBase(value: string | null | undefined): URL | null {
  if (!value || !URL.canParse(value)) return null;
  const url = new URL(value);
  return HTTP_PROTOCOLS.has(url.protocol) ? url : null;
}

/**
 * The address a page says it has, to place its relative links: a `<base>`, else the canonical link,
 * else `og:url`. Null when the page names none, so a relative link is then left as plain text.
 */
export function documentBaseUrl(document: QueryRoot): string | null {
  const candidates: [string, string][] = [
    ['base[href]', 'href'],
    ['link[rel="canonical"]', 'href'],
    ['meta[property="og:url"]', 'content'],
  ];
  for (const [selector, attribute] of candidates) {
    const url = isUsableBase(document.querySelector(selector)?.getAttribute(attribute));
    if (url) return url.href;
  }
  return null;
}

/** The address a link points to, or null when it must not be kept (no http, no place, same page). */
function resolveLink(href: string | null, base: URL | null): string | null {
  if (!href || href.startsWith('#') || !URL.canParse(href, base?.href)) return null;
  const url = new URL(href, base?.href);
  return HTTP_PROTOCOLS.has(url.protocol) ? url.href : null;
}

/** Keeps brackets and spaces of an address from ending the link early. */
function encodeLinkTarget(url: string): string {
  return url.replace(/[()<>\s]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** Marks around text; the spaces at its edges stay outside, where Markdown wants them. */
function wrap(inner: string, mark: string): string {
  const parts = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner);
  if (!parts || parts[2] === '') return inner;
  return `${parts[1]}${mark}${parts[2]}${mark}${parts[3]}`;
}

function rawText(node: DomNode): string {
  if (node.nodeType === TEXT_NODE) return node.data ?? '';
  return children(node).map(rawText).join('');
}

function codeSpan(text: string): string {
  const runs = text.match(/`+/g) ?? [];
  const fence = '`'.repeat(Math.max(0, ...runs.map((run) => run.length)) + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

function link(node: DomNode, inner: string, context: Context): string {
  const target = resolveLink(node.getAttribute?.('href')?.trim() ?? null, context.base);
  const label = inner.trim();
  if (target === null || label === '') return inner;
  return `[${label.replace(/[[\]]/g, '\\$&')}](${encodeLinkTarget(target)})`;
}

/** The marks of an inline element around its text: links, bold, italic, code. */
function markInline(name: string, node: DomNode, inner: string, context: Context): string {
  switch (name) {
    case 'a':
      return link(node, inner, context);
    case 'b':
    case 'strong':
      return wrap(inner, '**');
    case 'i':
    case 'em':
      return wrap(inner, '*');
    case 'code':
      return codeSpan(rawText(node).replace(/\s+/g, ' ').trim());
    default:
      return inner;
  }
}

/** Text of a node as one line with its inline marks: bold, italic, code and links; `<br>` kept as a mark. */
function inlineText(node: DomNode, context: Context): string {
  if (node.nodeType === TEXT_NODE) return escapeMarkdownText(node.data ?? '');
  if (node.nodeType !== ELEMENT_NODE || SKIPPED.has(tag(node))) return '';
  const name = tag(node);
  if (name === 'br') return LINE_BREAK_MARK;
  const inner = children(node)
    .map((child) => inlineText(child, context))
    .join('');
  if (BLOCKS.has(name)) return ` ${inner} `;
  return context.plain ? inner : markInline(name, node, inner, context);
}

/**
 * One line of text: whitespace collapsed. A `<br>` becomes a hard break (a backslash before the
 * line end, which survives the trimming of line ends) in running text, and a space elsewhere.
 */
function tidy(text: string, hardBreaks: boolean): string {
  const breaks = new RegExp(` ?${LINE_BREAK_MARK} ?`, 'g');
  const edges = new RegExp(`^( ?${LINE_BREAK_MARK} ?)+|( ?${LINE_BREAK_MARK} ?)+$`, 'g');
  return text
    .replace(/\s+/g, ' ')
    .replace(edges, '')
    .replace(breaks, hardBreaks ? '\\\n' : ' ')
    .trim();
}

function tableBlock(table: DomNode, context: Context): string {
  const rows: string[][] = [];
  const visit = (node: DomNode): void => {
    for (const child of children(node)) {
      if (tag(child) === 'tr') {
        const cells = children(child)
          .filter((cell) => tag(cell) === 'td' || tag(cell) === 'th')
          .map((cell) => tidy(inlineText(cell, context), false).replace(/\|/g, '\\|'));
        if (cells.some((cell) => cell !== '')) rows.push(cells);
      } else if (child.nodeType === ELEMENT_NODE) {
        visit(child);
      }
    }
  };
  visit(table);
  if (rows.length === 0) return '';

  const width = Math.max(...rows.map((row) => row.length));
  const line = (row: string[]) =>
    `| ${Array.from({ length: width }, (_, index) => row[index] ?? '').join(' | ')} |`;
  const [head = [], ...body] = rows;
  return [line(head), line(Array.from({ length: width }, () => '---')), ...body.map(line)].join(
    '\n'
  );
}

function listBlock(list: DomNode, context: Context, indent = ''): string {
  const ordered = tag(list) === 'ol';
  const first = Number.parseInt(list.getAttribute?.('start') ?? '', 10);
  const lines: string[] = [];
  let number = Number.isNaN(first) ? 1 : first;
  for (const item of children(list).filter((child) => tag(child) === 'li')) {
    const nested = children(item).filter((child) => LIST.has(tag(child)));
    const own = children(item)
      .filter((child) => !LIST.has(tag(child)))
      .map((child) => inlineText(child, context))
      .join('');
    const text = escapeBlock(tidy(own, false));
    const marker = ordered ? `${number}. ` : '- ';
    if (text !== '') {
      lines.push(`${indent}${marker}${text}`);
      number += 1;
    }
    for (const inner of nested)
      lines.push(listBlock(inner, context, indent + ' '.repeat(marker.length)));
  }
  return lines.filter((line) => line !== '').join('\n');
}

function codeBlock(pre: DomNode): string {
  const code = rawText(pre).replace(/\r\n?/g, '\n').trim();
  if (code === '') return '';
  const runs = code.match(/`{3,}/g) ?? [];
  const fence = '`'.repeat(Math.max(2, ...runs.map((run) => run.length)) + 1);
  return `${fence}\n${code}\n${fence}`;
}

/** A quotation: its blocks with a mark in front of each line. */
function blockquoteBlock(node: DomNode, context: Context): string {
  const quoted: string[] = [];
  collectBlocks(node, quoted, context);
  if (quoted.length === 0) return '';
  const lines = quoted.join('\n\n').split('\n');
  return lines.map((line) => (line === '' ? '>' : `> ${line}`)).join('\n');
}

/** A heading without links or emphasis. */
function headingBlock(node: DomNode, name: string, context: Context): string {
  const level = Number(HEADING.exec(name)?.[1]);
  const text = tidy(inlineText(node, { ...context, plain: true }), false);
  return text === '' ? '' : `${'#'.repeat(level)} ${text}`;
}

/**
 * The element as a block of its own (table, list, code, quotation, heading), or null when it is
 * not one of those. An empty string is a block with nothing in it.
 */
function structuredBlock(node: DomNode, name: string, context: Context): string | null {
  if (name === 'table') return tableBlock(node, context);
  if (LIST.has(name)) return listBlock(node, context);
  if (name === 'pre') return codeBlock(node);
  if (name === 'blockquote') return blockquoteBlock(node, context);
  if (HEADING.test(name)) return headingBlock(node, name, context);
  return null;
}

function collectBlocks(node: DomNode, out: string[], context: Context): void {
  let run = '';
  const flush = (): void => {
    const text = escapeBlock(tidy(run, true));
    if (text !== '') out.push(text);
    run = '';
  };

  for (const child of children(node)) {
    if (child.nodeType === TEXT_NODE) {
      run += escapeMarkdownText(child.data ?? '');
      continue;
    }
    if (child.nodeType !== ELEMENT_NODE || SKIPPED.has(tag(child))) continue;
    const name = tag(child);
    const block = structuredBlock(child, name, context);
    if (block !== null) {
      flush();
      if (block !== '') out.push(block);
    } else if (BLOCKS.has(name)) {
      flush();
      collectBlocks(child, out, context);
    } else {
      run += inlineText(child, context);
    }
  }
  flush();
}

/**
 * An HTML document as Markdown with its structure kept: headings, paragraphs, bold and italic, links
 * with an address that works, lists, tables with their head row, code and quotations. Scripts,
 * styles and images are dropped. This is what gets chunked, searched and shown to the reader.
 * `baseUrl` is the address of the page; without it the page is asked (see `documentBaseUrl`).
 */
export function htmlToMarkdown(html: string, baseUrl: string | null = null): string {
  const source = /<html[\s>]/i.test(html) ? html : `<html><body>${html}</body></html>`;
  const { document } = parseHTML(source);
  const base = isUsableBase(baseUrl ?? documentBaseUrl(document));
  const root: DomNode = document.body ?? document.documentElement;
  const blocks: string[] = [];
  collectBlocks(root, blocks, { base, plain: false });
  return blocks.join('\n\n');
}
