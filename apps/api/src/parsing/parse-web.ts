import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

import type { ParsedDocument } from '../ingestion/ingest';
import { documentBaseUrl, escapeMarkdownText, htmlToMarkdown } from './html-text';

/**
 * Main content of a web page as Markdown: Readability picks the article and drops navigation and
 * footers. A page without a recognizable article (a plain table, a tiny page) is read as a whole
 * instead. The address the page names for itself is read first, because Readability changes the
 * document, and it places the relative links.
 */
export async function parseWebPage(bytes: Uint8Array): Promise<ParsedDocument> {
  const html = new TextDecoder('utf-8').decode(bytes);
  const { document } = parseHTML(html);
  const base = documentBaseUrl(document);
  const article = new Readability(document).parse();

  if (article?.content) {
    const body = htmlToMarkdown(article.content, base);
    const title = article.title?.trim();
    const heading = title ? `# ${escapeMarkdownText(title)}` : null;
    const hasTitle = heading !== null && !body.startsWith(heading);
    return { text: hasTitle ? `${heading}\n\n${body}` : body, pageCount: null };
  }
  return { text: htmlToMarkdown(html, base), pageCount: null };
}

/** The <title> of a page, or null when it has none. Used to name a URL source. */
export function pageTitle(bytes: Uint8Array): string | null {
  const { document } = parseHTML(new TextDecoder('utf-8').decode(bytes));
  const title = document.title.trim();
  return title === '' ? null : title;
}
