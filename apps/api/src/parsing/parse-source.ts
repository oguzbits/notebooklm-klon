import { SOURCE_KIND, type SourceKind } from '@nlm/shared';

import type { IngestPorts, ParsedDocument } from '../ingestion/ingest';
import { parseDocx } from './parse-docx';
import { parseText } from './parse-text';
import { parseWebPage } from './parse-web';

/** Picks the parser for a source kind. Only PDFs need a provider call, so that parser is passed in. */
export function createParseSource(pdf: {
  parse: (bytes: Uint8Array) => Promise<ParsedDocument>;
}): IngestPorts['parse'] {
  return (kind: SourceKind, bytes: Uint8Array) => {
    switch (kind) {
      case SOURCE_KIND.PDF:
        return pdf.parse(bytes);
      case SOURCE_KIND.DOCX:
        return parseDocx(bytes);
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

function assertNever(value: never): never {
  throw new Error(`No parser for source kind ${String(value)}`);
}
