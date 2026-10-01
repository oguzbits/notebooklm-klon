import type { Mindmap } from '@nlm/shared';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Download,
  Minus,
  Plus,
} from 'lucide-react';
import { type PointerEvent, useCallback, useMemo, useRef, useState } from 'react';

import { CitedBy } from '@/components/studio/cited-by';
import { mindmapPictureSvg } from '@/components/studio/mindmap-picture';
import { Button } from '@/components/ui/button';
import {
  type Layout,
  layoutMindmap,
  linkPath,
  type MapNode,
  NODE_HEIGHT,
  TOGGLE_SPACE,
  toTree,
} from '@/lib/mindmap-layout';
import { downloadMindmapPng } from '@/lib/mindmap-png';
import { cn } from '@/lib/utils';

const MARGIN = 24;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.2;
const FILL = ['bg-node-root', 'bg-node-branch', 'bg-node-leaf'] as const;

const clamp = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

/** The zoom at which the whole map fits into the view, never larger than the real size. */
function fitScale(box: HTMLElement | null, layout: Layout): number {
  // jsdom and a hidden dialog have no size to fit into.
  if (!box || box.clientWidth === 0 || box.clientHeight === 0) return 1;
  return clamp(
    Math.min(
      1,
      box.clientWidth / (layout.width + MARGIN * 2),
      box.clientHeight / (layout.height + MARGIN * 2)
    )
  );
}

/** Every node that has children: what "alle aufklappen" opens. */
function expandable(node: MapNode): string[] {
  return node.children.length === 0 ? [] : [node.id, ...node.children.flatMap(expandable)];
}

/** The colors of the map as the page has them now, for the picture that is downloaded. */
function pageColors() {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string) => style.getPropertyValue(name).trim();
  return {
    root: read('--node-root'),
    branch: read('--node-branch'),
    leaf: read('--node-leaf'),
    text: read('--foreground'),
    link: read('--node-link'),
    background: read('--card'),
  };
}

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
  const tree = useMemo(() => toTree(mindmap), [mindmap]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set([tree.id]));
  const [everything, setEverything] = useState(false);
  const [zoom, setZoom] = useState(1);
  const scroller = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const layout = useMemo(() => layoutMindmap(tree, expanded), [tree, expanded]);
  // The map the view opens with, which is fitted into it as soon as the view is there.
  const first = useRef(layout);
  const attach = useCallback((box: HTMLDivElement | null) => {
    scroller.current = box;
    if (box) setZoom(fitScale(box, first.current));
  }, []);

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleEverything = () => {
    const next = everything ? new Set([tree.id]) : new Set(expandable(tree));
    setExpanded(next);
    setEverything(!everything);
    // Everything that is shown now fits into the view.
    setZoom(fitScale(scroller.current, layoutMindmap(tree, next)));
  };

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    const box = scroller.current;
    // Only the empty ground drags; a node or a button is for clicking.
    if (!box || (event.target as HTMLElement).closest('[data-node], button')) return;
    drag.current = { x: event.clientX, y: event.clientY, left: box.scrollLeft, top: box.scrollTop };
    box.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const box = scroller.current;
    const start = drag.current;
    if (!box || !start) return;
    box.scrollLeft = start.left - (event.clientX - start.x);
    box.scrollTop = start.top - (event.clientY - start.y);
  };
  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    scroller.current?.releasePointerCapture(event.pointerId);
  };

  const round = 'size-10 rounded-full border border-border bg-card text-foreground shadow-glow';

  return (
    <div className="relative h-full min-h-[360px] overflow-hidden rounded-2xl bg-secondary">
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-3">
        <Button
          variant="ghost"
          size="icon"
          className={round}
          aria-label={everything ? 'Alle Knoten zuklappen' : 'Alle Knoten aufklappen'}
          tooltip={everything ? 'Alle Knoten zuklappen' : 'Alle Knoten aufklappen'}
          onClick={toggleEverything}
        >
          {everything ? <ChevronsDownUp /> : <ChevronsUpDown />}
        </Button>
        <div className="flex flex-col rounded-full border border-border bg-card shadow-glow">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Vergrößern"
            tooltip="Vergrößern"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => setZoom((value) => clamp(value + ZOOM_STEP))}
          >
            <Plus />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Verkleinern"
            tooltip="Verkleinern"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => setZoom((value) => clamp(value - ZOOM_STEP))}
          >
            <Minus />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={round}
          aria-label="Mindmap als Bild herunterladen"
          tooltip="Als Bild herunterladen"
          onClick={() =>
            void mindmapPictureSvg(layout, pageColors()).then((svg) =>
              downloadMindmapPng(svg, title)
            )
          }
        >
          <Download />
        </Button>
      </div>
      <div
        ref={attach}
        data-testid="mindmap-canvas"
        data-zoom={zoom}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="flex h-full cursor-grab overflow-auto active:cursor-grabbing"
      >
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
            {layout.nodes.map((placed) => (
              <div
                key={placed.node.id}
                data-node
                className={cn(
                  'absolute flex items-center gap-1 rounded-[10px] px-4 text-ui whitespace-nowrap',
                  FILL[Math.min(placed.depth, FILL.length - 1)]
                )}
                style={{ left: placed.x, top: placed.y, width: placed.width, height: NODE_HEIGHT }}
              >
                <span className="truncate">{placed.node.label}</span>
                {placed.node.chunkIds.length > 0 && (
                  <CitedBy
                    notebookId={notebookId}
                    chunkIds={placed.node.chunkIds}
                    onOpen={onOpenCitation}
                  />
                )}
                {placed.expandable && (
                  <button
                    type="button"
                    aria-label={`„${placed.node.label}“ ${placed.open ? 'zuklappen' : 'aufklappen'}`}
                    aria-expanded={placed.open}
                    onClick={() => toggle(placed.node.id)}
                    className="veil absolute top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full bg-card text-foreground shadow-glow"
                    style={{ left: placed.width + (TOGGLE_SPACE - 20) }}
                  >
                    {placed.open ? (
                      <ChevronLeft className="size-3.5" aria-hidden />
                    ) : (
                      <ChevronRight className="size-3.5" aria-hidden />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
