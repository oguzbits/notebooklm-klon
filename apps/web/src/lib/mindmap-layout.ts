import type { Mindmap } from '@nlm/shared';

/** The sizes of the map in pixels. A node is as high as a 14/24 line with 8px above and below. */
export const NODE_HEIGHT = 40;
export const ROW_GAP = 12;
export const COLUMN_GAP = 64;
/** The round toggle after a node that has children: 6px of air and a 20px button. */
export const TOGGLE_SPACE = 26;
const PADDING_X = 32;
const CHIP_WIDTH = 26;
const MIN_LABEL_WIDTH = 24;

export interface MapNode {
  /** The path of the node in the map ("0.1.2"): the root is "0". */
  id: string;
  label: string;
  chunkIds: string[];
  children: MapNode[];
}

/** The mind map as one tree: its title is the root, each branch, twig and leaf a node with a path as ID. */
export function toTree(mindmap: Mindmap): MapNode {
  return {
    id: '0',
    label: mindmap.title,
    chunkIds: [],
    children: mindmap.branches.map((branch, i) => ({
      id: `0.${i}`,
      label: branch.label,
      chunkIds: branch.chunkIds,
      children: branch.children.map((twig, j) => ({
        id: `0.${i}.${j}`,
        label: twig.label,
        chunkIds: twig.chunkIds,
        children: twig.children.map((leaf, k) => ({
          id: `0.${i}.${j}.${k}`,
          label: leaf.label,
          chunkIds: leaf.chunkIds,
          children: [],
        })),
      })),
    })),
  };
}

const NARROW = /[iljtfI.,:;'!|()]/;
const WIDE = /[mwMW]/;
const CAPITAL = /\p{Lu}/u;

/**
 * How wide a node is for its label and the chips of its passages. The browser would measure it, but
 * the layout must be known before anything is drawn, so the width is estimated from the letters (a
 * little generous, so text never runs out of its box).
 */
export function nodeWidth(label: string, chips: number): number {
  let text = 0;
  for (const letter of label) {
    if (NARROW.test(letter)) text += 4;
    else if (WIDE.test(letter)) text += 12;
    else if (CAPITAL.test(letter)) text += 9.5;
    else text += 7.6;
  }
  return Math.ceil(Math.max(text, MIN_LABEL_WIDTH) + PADDING_X + chips * CHIP_WIDTH);
}

export interface PlacedNode {
  node: MapNode;
  x: number;
  y: number;
  width: number;
  depth: number;
  /** Has children that could be shown. */
  expandable: boolean;
  /** Its children are shown. */
  open: boolean;
}

export interface Layout {
  nodes: PlacedNode[];
  links: { from: PlacedNode; to: PlacedNode }[];
  width: number;
  height: number;
}

const shown = (node: MapNode, expanded: ReadonlySet<string>) =>
  expanded.has(node.id) ? node.children : [];

/**
 * Places the visible part of the tree: one column per level, each as wide as its widest node plus
 * the toggle, siblings stacked with a gap, and every parent centered between its first and last
 * child. Positions are relative to the top left corner of the map.
 */
export function layoutMindmap(root: MapNode, expanded: ReadonlySet<string>): Layout {
  const columnWidth: number[] = [];
  const measure = (node: MapNode, depth: number) => {
    const slot =
      nodeWidth(node.label, new Set(node.chunkIds).size) +
      (node.children.length > 0 ? TOGGLE_SPACE : 0);
    columnWidth[depth] = Math.max(columnWidth[depth] ?? 0, slot);
    for (const child of shown(node, expanded)) measure(child, depth + 1);
  };
  measure(root, 0);
  const columnX = columnWidth.map((_, depth) =>
    columnWidth.slice(0, depth).reduce((sum, width) => sum + width + COLUMN_GAP, 0)
  );

  const nodes: PlacedNode[] = [];
  const links: Layout['links'] = [];
  let nextRow = 0;

  /** Places a node and its shown subtree; returns the placed node. */
  const place = (node: MapNode, depth: number): PlacedNode => {
    const children = shown(node, expanded).map((child) => place(child, depth + 1));
    const first = children[0];
    const last = children.at(-1);
    let y: number;
    if (first && last) {
      y = (first.y + last.y) / 2;
    } else {
      y = nextRow;
      nextRow += NODE_HEIGHT + ROW_GAP;
    }
    const placed: PlacedNode = {
      node,
      x: columnX[depth] ?? 0,
      y,
      width: nodeWidth(node.label, new Set(node.chunkIds).size),
      depth,
      expandable: node.children.length > 0,
      open: expanded.has(node.id) && node.children.length > 0,
    };
    // Parents come before their children in the list, the way they are read.
    nodes.push(placed);
    for (const child of children) links.push({ from: placed, to: child });
    return placed;
  };
  place(root, 0);

  nodes.sort((a, b) => a.node.id.localeCompare(b.node.id, undefined, { numeric: true }));
  links.sort((a, b) =>
    a.from.node.id === b.from.node.id
      ? a.to.node.id.localeCompare(b.to.node.id, undefined, { numeric: true })
      : a.from.node.id.localeCompare(b.from.node.id, undefined, { numeric: true })
  );
  const width = Math.max(
    ...nodes.map((placed) => placed.x + placed.width + (placed.expandable ? TOGGLE_SPACE : 0))
  );
  const height = Math.max(...nodes.map((placed) => placed.y + NODE_HEIGHT));
  return { nodes, links, width, height };
}

/** The curve of a link: from the toggle of the parent, sideways first, to the left edge of the child. */
export function linkPath({ from, to }: Layout['links'][number]): string {
  const startX = from.x + from.width + TOGGLE_SPACE - 4;
  const startY = from.y + NODE_HEIGHT / 2;
  const endX = to.x;
  const endY = to.y + NODE_HEIGHT / 2;
  const bend = (endX - startX) / 2;
  return `M${startX},${startY} C${startX + bend},${startY} ${endX - bend},${endY} ${endX},${endY}`;
}
