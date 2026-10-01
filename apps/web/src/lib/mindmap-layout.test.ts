import type { Mindmap } from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import {
  COLUMN_GAP,
  layoutMindmap,
  linkPath,
  NODE_HEIGHT,
  nodeWidth,
  ROW_GAP,
  TOGGLE_SPACE,
  toTree,
} from './mindmap-layout';

const MAP: Mindmap = {
  title: 'Nordlicht',
  branches: [
    {
      label: 'Leitung',
      chunkIds: ['a'],
      children: [
        {
          label: 'Dr. Brandt',
          chunkIds: ['a'],
          children: [{ label: 'Seit 2024', chunkIds: ['a'] }],
        },
        { label: 'Team', chunkIds: ['b'], children: [] },
      ],
    },
    { label: 'Budget', chunkIds: ['b'], children: [] },
  ],
};

const tree = toTree(MAP);
const byLabel = (layout: ReturnType<typeof layoutMindmap>, label: string) => {
  const found = layout.nodes.find((placed) => placed.node.label === label);
  if (!found) throw new Error(`no node ${label}`);
  return found;
};

describe('toTree', () => {
  it('makes the title the root and gives every node a path as its ID', () => {
    expect(tree.label).toBe('Nordlicht');
    expect(tree.id).toBe('0');
    expect(tree.children.map((node) => node.id)).toEqual(['0.0', '0.1']);
    expect(tree.children[0]?.children[0]?.children[0]?.id).toBe('0.0.0.0');
    expect(tree.chunkIds).toEqual([]);
  });
});

describe('nodeWidth', () => {
  it('grows with the text and with the chips behind it, and is never narrower than a short label', () => {
    expect(nodeWidth('Ein sehr langer Name eines Astes', 0)).toBeGreaterThan(nodeWidth('Ast', 0));
    expect(nodeWidth('Ast', 2)).toBeGreaterThan(nodeWidth('Ast', 0));
    expect(nodeWidth('', 0)).toBeGreaterThan(0);
  });

  it('counts wide letters wider than narrow ones', () => {
    expect(nodeWidth('MMMM', 0)).toBeGreaterThan(nodeWidth('iiii', 0));
  });
});

describe('layoutMindmap', () => {
  it('shows only the root while nothing is open', () => {
    const layout = layoutMindmap(tree, new Set());

    expect(layout.nodes.map((placed) => placed.node.label)).toEqual(['Nordlicht']);
    expect(layout.links).toEqual([]);
  });

  it('shows the children of an open node in the next column, to the right of it', () => {
    const layout = layoutMindmap(tree, new Set(['0']));
    const root = byLabel(layout, 'Nordlicht');
    const leitung = byLabel(layout, 'Leitung');
    const budget = byLabel(layout, 'Budget');

    expect(layout.nodes).toHaveLength(3);
    expect(leitung.x).toBe(root.x + root.width + TOGGLE_SPACE + COLUMN_GAP);
    expect(budget.x).toBe(leitung.x);
    expect(leitung.depth).toBe(1);
  });

  it('stacks siblings with a gap and centers the parent between its first and last child', () => {
    const layout = layoutMindmap(tree, new Set(['0']));
    const root = byLabel(layout, 'Nordlicht');
    const leitung = byLabel(layout, 'Leitung');
    const budget = byLabel(layout, 'Budget');

    expect(budget.y - leitung.y).toBe(NODE_HEIGHT + ROW_GAP);
    expect(root.y + NODE_HEIGHT / 2).toBe((leitung.y + budget.y + NODE_HEIGHT) / 2);
  });

  it('gives a subtree that is open the room of all its rows, so nothing overlaps', () => {
    const layout = layoutMindmap(tree, new Set(['0', '0.0', '0.0.0']));
    const rows = layout.nodes
      .filter((placed) => placed.depth === 2 || placed.depth === 1)
      .map((placed) => [placed.y, placed.y + NODE_HEIGHT]);

    expect(byLabel(layout, 'Seit 2024').depth).toBe(3);
    const budget = byLabel(layout, 'Budget');
    const leitung = byLabel(layout, 'Leitung');
    // Budget comes after the whole open subtree of Leitung (two rows below it, at least).
    expect(budget.y).toBeGreaterThanOrEqual(leitung.y + NODE_HEIGHT + ROW_GAP);
    for (const [index, [top, bottom]] of rows.entries()) {
      for (const [otherIndex, [otherTop, otherBottom]] of rows.entries()) {
        if (index === otherIndex) continue;
        // Nodes of one column never overlap; nodes of different columns may share a row.
        const sameColumn = layout.nodes[index]?.depth === layout.nodes[otherIndex]?.depth;
        if (sameColumn) expect(top! < otherBottom! && otherTop! < bottom!).toBe(false);
      }
    }
  });

  it('draws one link from each shown parent to each of its shown children', () => {
    const layout = layoutMindmap(tree, new Set(['0', '0.0']));

    expect(layout.links.map((link) => `${link.from.node.label}>${link.to.node.label}`)).toEqual([
      'Nordlicht>Leitung',
      'Nordlicht>Budget',
      'Leitung>Dr. Brandt',
      'Leitung>Team',
    ]);
  });

  it('marks which nodes have children to open, and which of them are open', () => {
    const layout = layoutMindmap(tree, new Set(['0']));

    expect(byLabel(layout, 'Nordlicht')).toMatchObject({ expandable: true, open: true });
    expect(byLabel(layout, 'Leitung')).toMatchObject({ expandable: true, open: false });
    expect(byLabel(layout, 'Budget')).toMatchObject({ expandable: false, open: false });
  });

  it('measures the whole picture, with the toggle after the last column counted', () => {
    const layout = layoutMindmap(tree, new Set(['0']));
    const leitung = byLabel(layout, 'Leitung');
    const budget = byLabel(layout, 'Budget');

    expect(layout.width).toBe(
      Math.max(leitung.x + leitung.width + TOGGLE_SPACE, budget.x + budget.width)
    );
    expect(layout.height).toBe(budget.y + NODE_HEIGHT);
  });

  it('lines the nodes of one column up by the widest of them', () => {
    const layout = layoutMindmap(tree, new Set(['0', '0.0']));
    const brandt = byLabel(layout, 'Dr. Brandt');
    const team = byLabel(layout, 'Team');

    expect(brandt.x).toBe(team.x);
  });
});

describe('linkPath', () => {
  it('runs as a smooth curve from the toggle of the parent to the left edge of the child', () => {
    const layout = layoutMindmap(tree, new Set(['0']));
    const link = layout.links[0];
    if (!link) throw new Error('no link');
    const startX = link.from.x + link.from.width + TOGGLE_SPACE - 4;
    const startY = link.from.y + NODE_HEIGHT / 2;

    const path = linkPath(link);

    expect(path.startsWith(`M${startX},${startY} C`)).toBe(true);
    expect(path.endsWith(`${link.to.x},${link.to.y + NODE_HEIGHT / 2}`)).toBe(true);
  });
});
