import type { Mindmap } from '@nlm/shared';

import { MindmapControls } from '@/components/studio/mindmap-controls';
import { MindmapGraph } from '@/components/studio/mindmap-graph';
import { mindmapPictureSvg } from '@/components/studio/mindmap-picture';
import { useDragScroll } from '@/hooks/use-drag-scroll';
import { useMindmapState } from '@/hooks/use-mindmap-state';
import { downloadMindmapPng } from '@/lib/mindmap-png';
import { pageColors } from '@/lib/mindmap-view';

/**
 * A mind map from left to right, like the original: the topic and its branches to begin with,
 * a round toggle after every node opens or closes what is below it, "alle aufklappen" opens
 * everything and fits it into the view, zoom and a download as image sit on the left. The map
 * moves with the scroll bars or by dragging. Every node keeps the chips of the passages behind it.
 */
export function MindmapView({
  notebookId,
  title,
  mindmap,
  onOpenCitation,
}: {
  notebookId: string;
  /** Names the downloaded picture. */
  title: string;
  mindmap: Mindmap;
  onOpenCitation: (chunkId: string) => void;
}) {
  const { layout, zoom, everything, attach, toggle, toggleEverything, zoomIn, zoomOut } =
    useMindmapState(mindmap);
  // Only the empty ground drags; a node or a button is for clicking.
  const drag = useDragScroll('[data-node], button');
  const download = () =>
    void mindmapPictureSvg(layout, pageColors()).then((svg) => downloadMindmapPng(svg, title));

  return (
    <div className="relative h-full min-h-[360px] overflow-hidden rounded-2xl bg-secondary">
      <MindmapControls
        everything={everything}
        zoom={zoom}
        onToggleEverything={toggleEverything}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onDownload={download}
      />
      <div
        ref={attach}
        data-testid="mindmap-canvas"
        data-zoom={zoom}
        {...drag}
        className="flex h-full cursor-grab overflow-auto active:cursor-grabbing"
      >
        <MindmapGraph
          layout={layout}
          zoom={zoom}
          notebookId={notebookId}
          onToggle={toggle}
          onOpenCitation={onOpenCitation}
        />
      </div>
    </div>
  );
}
