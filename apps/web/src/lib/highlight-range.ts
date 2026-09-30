import type { Element, ElementContent, Root, Text } from 'hast';

/** The cited passage as character offsets into the text of the source; both null for none. */
export interface HighlightRange {
  start: number | null;
  end: number | null;
}

function mark(value: string): Element {
  return {
    type: 'element',
    tagName: 'mark',
    properties: {},
    children: [{ type: 'text', value }],
  };
}

/** Splits one text node at the edges of the range; parts inside it become `<mark>`. */
function splitText(node: Text, start: number, end: number): ElementContent[] {
  const from = node.position?.start.offset;
  const to = node.position?.end.offset;
  if (from === undefined || to === undefined || from >= end || to <= start) return [node];

  // The characters of a node are the characters of the source at its place, unless markdown changed
  // them (an escape, an entity, trimmed line ends). Then the place cannot be cut exactly, and the
  // whole piece is marked instead of a wrong part of it.
  if (node.value.length !== to - from) return [mark(node.value)];

  const cutStart = Math.max(start, from) - from;
  const cutEnd = Math.min(end, to) - from;
  const parts: ElementContent[] = [];
  if (cutStart > 0) parts.push({ type: 'text', value: node.value.slice(0, cutStart) });
  parts.push(mark(node.value.slice(cutStart, cutEnd)));
  if (cutEnd < node.value.length) parts.push({ type: 'text', value: node.value.slice(cutEnd) });
  return parts;
}

function walk(parent: Root | Element, start: number, end: number): void {
  parent.children = parent.children.flatMap((child): ElementContent[] => {
    if (child.type === 'text') return splitText(child, start, end);
    if (child.type === 'element') walk(child, start, end);
    return child.type === 'element' || child.type === 'comment' ? [child] : [];
  }) as typeof parent.children;
}

/**
 * A rehype plugin that wraps the cited passage in `<mark>`, inside the formatted text. The positions
 * that markdown keeps for every piece of text say where it came from in the source, so the passage
 * is found even in bold text, links and lists.
 */
export function rehypeHighlightRange({ start, end }: HighlightRange) {
  return (tree: Root): void => {
    if (start === null || end === null || end <= start) return;
    walk(tree, start, end);
  };
}
