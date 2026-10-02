import { SOURCE_KIND, type SourceKind } from '@nlm/shared';

import { detectImageType } from '../core/image-type';
import type { IngestPorts, ParsedDocument } from '../ingestion/ingest';
import { parseDocx } from './parse-docx';
import { parsePptx } from './parse-pptx';
import { parseText } from './parse-text';
import { parseWebPage } from './parse-web';

/** Picks the parser for a source kind. Only PDFs and images need a provider call, so those readers are passed in. */
export function createParseSource(provider: {
  parse: (bytes: Uint8Array) => Promise<ParsedDocument>;
  parseImage: (bytes: Uint8Array, mimeType: string) => Promise<ParsedDocument>;
}): IngestPorts['parse'] {
  return (kind: SourceKind, bytes: Uint8Array) => {
    switch (kind) {
      case SOURCE_KIND.PDF:
        return provider.parse(bytes);
      case SOURCE_KIND.IMAGE:
        return readImage(provider, bytes);
      case SOURCE_KIND.DOCX:
        return parseDocx(bytes);
      case SOURCE_KIND.PPTX:
        return parsePptx(bytes);
      case SOURCE_KIND.TXT:
      case SOURCE_KIND.MD:
        return parseText(bytes);
      case SOURCE_KIND.URL:
        return parseWebPage(bytes);
      default:
        return assertNever(kind);
    }
  };
}

async function readImage(
  provider: { parseImage: (bytes: Uint8Array, mimeType: string) => Promise<ParsedDocument> },
  bytes: Uint8Array
) {
  const mimeType = detectImageType(bytes);
  if (mimeType === null) throw new Error('The bytes of an image source are not an image.');
  return provider.parseImage(bytes, mimeType);
}

function assertNever(value: never): never {
  throw new Error(`No parser for source kind ${String(value)}`);
}
