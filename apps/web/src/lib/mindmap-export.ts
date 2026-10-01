import { escapeMarkup } from './escape-markup';
import { type Layout, linkPath, NODE_HEIGHT } from './mindmap-layout';

const MARGIN = 24;
const FONT_SIZE = 14;
const RADIUS = 10;

export interface MapColors {
  root: string;
  branch: string;
  leaf: string;
  text: string;
  link: string;
  background: string;
}

/** The visible map as an SVG picture: the links, then the nodes with their labels. */
export function mindmapSvg(layout: Layout, colors: MapColors): string {
  const width = layout.width + MARGIN * 2;
  const height = layout.height + MARGIN * 2;
  const links = layout.links
    .map(
      (link) =>
        `<path d="${linkPath(link)}" fill="none" stroke="${colors.link}" stroke-width="1.5"/>`
    )
    .join('');
  const nodes = layout.nodes
    .map((placed) => {
      const fill =
        placed.depth === 0 ? colors.root : placed.depth === 1 ? colors.branch : colors.leaf;
      return (
        `<rect x="${placed.x}" y="${placed.y}" width="${placed.width}" height="${NODE_HEIGHT}" rx="${RADIUS}" fill="${fill}"/>` +
        `<text x="${placed.x + 16}" y="${placed.y + NODE_HEIGHT / 2}" dominant-baseline="central" ` +
        `font-family="sans-serif" font-size="${FONT_SIZE}" fill="${colors.text}">${escapeMarkup(placed.node.label)}</text>`
      );
    })
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${colors.background}"/>` +
    `<g transform="translate(${MARGIN} ${MARGIN})">${links}${nodes}</g></svg>`
  );
}
