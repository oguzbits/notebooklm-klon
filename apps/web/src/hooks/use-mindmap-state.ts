import type { Mindmap } from '@nlm/shared';
import { useCallback, useMemo, useRef, useState } from 'react';

import { layoutMindmap, toTree } from '@/lib/mindmap-layout';
import { clampZoom, expandable, fitScale, ZOOM_STEP } from '@/lib/mindmap-view';

/**
 * The state of a mind map on screen: which nodes are open, the zoom, and the layout that follows. The
 * map opens with the topic and its branches; "alle aufklappen" opens everything and fits it into the
 * view. `attach` goes on the scrolling box and fits the map into it as soon as it is there.
 */
export function useMindmapState(mindmap: Mindmap) {
  const tree = useMemo(() => toTree(mindmap), [mindmap]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set([tree.id]));
  const [everything, setEverything] = useState(false);
  const [zoom, setZoom] = useState(1);
  const scroller = useRef<HTMLDivElement | null>(null);
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
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const toggleEverything = () => {
    const next = everything ? new Set([tree.id]) : new Set(expandable(tree));
    setExpanded(next);
    setEverything(!everything);
    // Everything that is shown now fits into the view.
    setZoom(fitScale(scroller.current, layoutMindmap(tree, next)));
  };
  const zoomBy = (step: number) => setZoom((value) => clampZoom(value + step));

  return {
    layout,
    everything,
    zoom,
    attach,
    toggle,
    toggleEverything,
    zoomIn: () => zoomBy(ZOOM_STEP),
    zoomOut: () => zoomBy(-ZOOM_STEP),
  };
}
