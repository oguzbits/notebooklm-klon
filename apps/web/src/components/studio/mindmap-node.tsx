import { ChevronLeft, ChevronRight } from 'lucide-react';

import { CitedBy } from '@/components/studio/cited-by';
import { NODE_HEIGHT, type PlacedNode, TOGGLE_SPACE } from '@/lib/mindmap-layout';
import { cn } from '@/lib/utils';

const FILL = ['bg-node-root', 'bg-node-branch', 'bg-node-leaf'] as const;
const TOGGLE_SIZE = 20;

/** One node of the map: its label, the chips of the passages behind it, the toggle for its children. */
export function MindmapNode({
  placed,
  notebookId,
  onToggle,
  onOpenCitation,
}: {
  placed: PlacedNode;
  notebookId: string;
  onToggle: (id: string) => void;
  onOpenCitation: (chunkId: string) => void;
}) {
  const { node } = placed;
  return (
    <div
      data-node
      className={cn(
        'absolute flex items-center gap-1 rounded-[10px] px-4 text-ui whitespace-nowrap',
        FILL[Math.min(placed.depth, FILL.length - 1)]
      )}
      style={{ left: placed.x, top: placed.y, width: placed.width, height: NODE_HEIGHT }}
    >
      <span className="truncate">{node.label}</span>
      {node.chunkIds.length > 0 && (
        <CitedBy notebookId={notebookId} chunkIds={node.chunkIds} onOpen={onOpenCitation} />
      )}
      {placed.expandable && (
        <button
          type="button"
          aria-label={`„${node.label}“ ${placed.open ? 'zuklappen' : 'aufklappen'}`}
          aria-expanded={placed.open}
          onClick={() => onToggle(node.id)}
          className="veil absolute top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full bg-card text-foreground shadow-glow"
          style={{ left: placed.width + (TOGGLE_SPACE - TOGGLE_SIZE) }}
        >
          {placed.open ? (
            <ChevronLeft className="size-3.5" aria-hidden />
          ) : (
            <ChevronRight className="size-3.5" aria-hidden />
          )}
        </button>
      )}
    </div>
  );
}
