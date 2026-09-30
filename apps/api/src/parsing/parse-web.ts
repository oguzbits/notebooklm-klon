import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

import type { ParsedDocument } from '../ingestion/ingest';
import { htmlToText } from './html-text';

/**
 * Main content of a web page: Readability picks the article and drops navigation and footers. A
 * page without a recognizable article (a plain table, a tiny page) is read as a whole instead.
 */
export async function parseWebPage(bytes: Uint8Array): Promise<ParsedDocument> {
  const html = new TextDecoder('utf-8').decode(bytes);
  const { document } = parseHTML(html);
  const article = new Readability(document).parse();

  if (article?.content) {
    const body = htmlToText(article.content);
    const title = article.title?.trim();
    const hasTitle = title && !body.startsWith(`# ${title}`);
    return { text: hasTitle ? `# ${title}\n\n${body}` : body, pageCount: null };
  }
  return { text: htmlToText(html), pageCount: null };
}
