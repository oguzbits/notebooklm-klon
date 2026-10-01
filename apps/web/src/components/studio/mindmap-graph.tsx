import { MindmapNode } from '@/components/studio/mindmap-node';
import { type Layout, linkPath } from '@/lib/mindmap-layout';
import { MARGIN } from '@/lib/mindmap-view';

/** The links of the map as lines. */
function MindmapLinks({ layout }: { layout: Layout }) {
  return (
    <svg
      aria-hidden
      width={layout.width}
      height={layout.height}
      className="pointer-events-none absolute inset-0 overflow-visible"
    >
      {layout.links.map((link) => (
        <path
          key={`${link.from.node.id}>${link.to.node.id}`}
          d={linkPath(link)}
          fill="none"
          stroke="var(--node-link)"
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}

/** The map at its zoom: the links as lines and above them the nodes, with the margin around. */
export function MindmapGraph({
  layout,
  zoom,
  notebookId,
  onToggle,
  onOpenCitation,
}: {
  layout: Layout;
  zoom: number;
  notebookId: string;
  onToggle: (id: string) => void;
  onOpenCitation: (chunkId: string) => void;
}) {
  return (
    <div
      className="relative m-auto shrink-0"
      style={{
        width: (layout.width + MARGIN * 2) * zoom,
        height: (layout.height + MARGIN * 2) * zoom,
      }}
    >
      <div
        className="absolute"
        style={{
          left: MARGIN * zoom,
          top: MARGIN * zoom,
          width: layout.width,
          height: layout.height,
          transform: `scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <MindmapLinks layout={layout} />
        {layout.nodes.map((placed) => (
          <MindmapNode
            key={placed.node.id}
            placed={placed}
            notebookId={notebookId}
            onToggle={onToggle}
            onOpenCitation={onOpenCitation}
          />
        ))}
      </div>
    </div>
  );
}
