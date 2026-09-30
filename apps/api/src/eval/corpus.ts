import { SOURCE_KIND } from '@nlm/shared';

import { detectSourceKind } from '../core/file-kind';
import type { LocalFile } from '../ingestion/local-import';

const HTML_FILE = /\.html?$/i;
// A saved page has no address of its own; the source list shows this one.
const SAVED_PAGE_URL = 'https://example.invalid/saved-page';

/** A file of the eval corpus as a source. Saved web pages go in as URL sources, the rest by content. */
export function toLocalFile(name: string, bytes: Uint8Array): LocalFile {
  if (HTML_FILE.test(name)) {
    return { name, kind: SOURCE_KIND.URL, bytes, sourceUrl: SAVED_PAGE_URL };
  }
  const kind = detectSourceKind(name, bytes);
  if (kind === null) throw new Error(`The corpus file "${name}" is not a supported kind.`);
  return { name, kind, bytes, sourceUrl: null };
}
