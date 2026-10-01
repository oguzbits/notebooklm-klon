import { type Layout, linkPath, NODE_HEIGHT } from '@/lib/mindmap-layout';
import { renderMarkup } from '@/lib/render-markup';

const MARGIN = 24;
const FONT_SIZE = 14;
const RADIUS = 10;
const LABEL_INSET = 16;
const LINK_WIDTH = 1.5;

export interface MapColors {
  root: string;
  branch: string;
  leaf: string;
  text: string;
  link: string;
  background: string;
}

/** The root, the branches and everything below them each have their own tone. */
const fillOf = (depth: number, colors: MapColors) =>
  [colors.root, colors.branch][depth] ?? colors.leaf;

/** The visible map as an SVG picture: the links, then the nodes with their labels. */
function MindmapPicture({ layout, colors }: { layout: Layout; colors: MapColors }) {
  const width = layout.width + MARGIN * 2;
  const height = layout.height + MARGIN * 2;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <rect width={width} height={height} fill={colors.background} />
      <g transform={`translate(${MARGIN} ${MARGIN})`}>
        {layout.links.map((link) => (
          <path
            key={`${link.from.node.id}>${link.to.node.id}`}
            d={linkPath(link)}
            fill="none"
            stroke={colors.link}
            strokeWidth={LINK_WIDTH}
          />
        ))}
        {layout.nodes.map((placed) => (
          <g key={placed.node.id}>
            <rect
              x={placed.x}
              y={placed.y}
              width={placed.width}
              height={NODE_HEIGHT}
              rx={RADIUS}
              fill={fillOf(placed.depth, colors)}
            />
            <text
              x={placed.x + LABEL_INSET}
              y={placed.y + NODE_HEIGHT / 2}
              dominantBaseline="central"
              fontFamily="sans-serif"
              fontSize={FONT_SIZE}
              fill={colors.text}
            >
              {placed.node.label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/** The picture as the text of an SVG file, for the download. */
export function mindmapPictureSvg(layout: Layout, colors: MapColors): Promise<string> {
  return renderMarkup(<MindmapPicture layout={layout} colors={colors} />);
}
