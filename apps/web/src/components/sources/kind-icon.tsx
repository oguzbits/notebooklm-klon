import { SOURCE_KIND, type SourceKind } from '@nlm/shared';
import { Globe, Image } from 'lucide-react';

import { cn } from '@/lib/utils';

/** The color of the symbol of a file. */
const FILE_COLOR: Record<
  Exclude<SourceKind, typeof SOURCE_KIND.URL | typeof SOURCE_KIND.IMAGE>,
  string
> = {
  [SOURCE_KIND.PDF]: 'text-destructive',
  [SOURCE_KIND.DOCX]: 'text-studio-blue',
  [SOURCE_KIND.TXT]: 'text-muted-foreground',
  [SOURCE_KIND.MD]: 'text-muted-foreground',
};

/** The symbol of a source in the list: a rounded file with its type, the globe for a web page, a picture for an image. */
export function SourceKindIcon({ kind }: { kind: SourceKind }) {
  if (kind === SOURCE_KIND.URL) {
    return <Globe className="size-6 shrink-0 text-muted-foreground" aria-hidden />;
  }
  if (kind === SOURCE_KIND.IMAGE) {
    return <Image className="size-6 shrink-0 text-muted-foreground" aria-hidden />;
  }
  // The mark inside the symbol is the kind itself, except that "DOCX" does not fit.
  const mark = kind === SOURCE_KIND.DOCX ? 'DOC' : kind;
  const color = FILE_COLOR[kind];
  return (
    <svg viewBox="0 0 24 24" className={cn('size-6 shrink-0', color)} aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" />
      <text
        x="12"
        y="14.6"
        textAnchor="middle"
        fontSize="6.4"
        fontWeight="700"
        fill="currentColor"
        style={{ fontStretch: '100%' }}
      >
        {mark}
      </text>
    </svg>
  );
}
