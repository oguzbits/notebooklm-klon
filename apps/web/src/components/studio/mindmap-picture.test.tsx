import type { Mindmap } from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import { layoutMindmap, toTree } from '@/lib/mindmap-layout';

import { mindmapPictureSvg } from './mindmap-picture';

const MAP: Mindmap = {
  title: 'A & B <Thema>',
  branches: [{ label: 'Ast', chunkIds: ['a'], children: [] }],
};
const COLORS = {
  root: '#111111',
  branch: '#222222',
  leaf: '#333333',
  text: '#eeeeee',
  link: '#8888ff',
  background: '#000000',
};

describe('mindmapPictureSvg', async () => {
  const layout = layoutMindmap(toTree(MAP), new Set(['0']));
  const svg = await mindmapPictureSvg(layout, COLORS);

  it('is one picture as large as the map plus a margin, on the color of the page', () => {
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain(`width="${layout.width + 48}"`);
    expect(svg).toContain(`height="${layout.height + 48}"`);
    expect(svg).toContain('fill="#000000"');
  });

  it('draws every node with its label, escaped, and every link', () => {
    expect(svg).toContain('A &amp; B &lt;Thema&gt;');
    expect(svg).toContain('>Ast<');
    expect(svg.match(/<path /g)).toHaveLength(layout.links.length);
    expect(svg.match(/<rect /g)?.length).toBeGreaterThanOrEqual(layout.nodes.length);
  });

  it('colors the root, the branches and the rest with their own tones', () => {
    expect(svg).toContain('#111111');
    expect(svg).toContain('#222222');
  });

  it('writes the attributes the way SVG spells them', () => {
    expect(svg).toContain('dominant-baseline="central"');
    expect(svg).toContain('stroke-width="1.5"');
  });
});
