import { SOURCE_KIND, type SourceKind } from '@nlm/shared';
import { useEffect, useMemo, useRef } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { rehypeHighlightRange } from '@/lib/highlight-range';

const COMPONENTS: Components = {
  // A link opens in a new tab and cannot reach back into the app.
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  // Wide tables scroll sideways instead of widening the column.
  table: ({ node: _node, ...props }) => (
    <div className="overflow-x-auto">
      <table {...props} />
    </div>
  ),
  // A source never pulls pictures from other sites into the page.
  img: () => null,
};

/** A plain text source: one block that keeps its line breaks, with the cited passage marked. */
function PlainText({
  text,
  start,
  end,
}: {
  text: string;
  start: number | null;
  end: number | null;
}) {
  if (start === null || end === null || start >= text.length || end <= start) {
    return <p className="whitespace-pre-wrap">{text}</p>;
  }
  return (
    <p className="whitespace-pre-wrap">
      {text.slice(0, start)}
      <mark>{text.slice(start, end)}</mark>
      {text.slice(end)}
    </p>
  );
}

/**
 * A source as formatted text, like the original: headings, paragraphs, lists, links, bold and
 * italic, tables. The text of a source is Markdown (the parsers write it that way), except a plain
 * text file, which is shown as it was written. HTML inside it is dropped, and only safe link targets
 * are kept. The cited passage, if there is one, is marked and scrolled to the middle.
 */
export function SourceText({
  text,
  kind,
  highlight = null,
  scrollKey,
}: {
  text: string;
  kind?: SourceKind;
  highlight?: { start: number; end: number } | null;
  /** Changes with each click on a citation, so the same passage is scrolled to again. */
  scrollKey?: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const start = highlight?.start ?? null;
  const end = highlight?.end ?? null;

  // A long source is parsed once, not again each time something around it re-renders.
  const content = useMemo(
    () =>
      kind === SOURCE_KIND.TXT ? (
        <PlainText text={text} start={start} end={end} />
      ) : (
        <Markdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeHighlightRange, { start, end }]]}
          components={COMPONENTS}
          skipHtml
        >
          {text}
        </Markdown>
      ),
    [kind, text, start, end]
  );

  useEffect(() => {
    root.current?.querySelector('mark')?.scrollIntoView?.({ block: 'center' });
  }, [text, start, end, scrollKey]);

  return (
    <div ref={root} className="source-text">
      {content}
    </div>
  );
}
