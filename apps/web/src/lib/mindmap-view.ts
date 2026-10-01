import { type Layout, type MapNode } from './mindmap-layout';

/** The air around the map, in pixels, before zoom. */
export const MARGIN = 24;
export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 2;
export const ZOOM_STEP = 0.2;

export const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

/** The zoom at which the whole map fits into the view, never larger than the real size. */
export function fitScale(box: HTMLElement | null, layout: Layout): number {
  // jsdom and a hidden dialog have no size to fit into.
  if (!box || box.clientWidth === 0 || box.clientHeight === 0) return 1;
  return clampZoom(
    Math.min(
      1,
      box.clientWidth / (layout.width + MARGIN * 2),
      box.clientHeight / (layout.height + MARGIN * 2)
    )
  );
}

/** Every node that has children: what "alle aufklappen" opens. */
export function expandable(node: MapNode): string[] {
  return node.children.length === 0 ? [] : [node.id, ...node.children.flatMap(expandable)];
}

/** The colors of the map as the page has them now, for the picture that is downloaded. */
export function pageColors() {
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
