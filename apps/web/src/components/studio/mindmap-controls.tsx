import { ChevronsDownUp, ChevronsUpDown, Download, Minus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { MAX_ZOOM, MIN_ZOOM } from '@/lib/mindmap-view';

const ROUND = 'size-10 rounded-full border border-border bg-card text-foreground shadow-glow';

/** Larger and smaller, in one round pill; each is off at its end of the range. */
function ZoomButtons({
  zoom,
  onZoomIn,
  onZoomOut,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <div className="flex flex-col rounded-full border border-border bg-card shadow-glow">
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        aria-label="Vergrößern"
        tooltip="Vergrößern"
        disabled={zoom >= MAX_ZOOM}
        onClick={onZoomIn}
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
        onClick={onZoomOut}
      >
        <Minus />
      </Button>
    </div>
  );
}

/** The buttons on the left of the map: open everything, zoom, and download as an image. */
export function MindmapControls({
  everything,
  zoom,
  onToggleEverything,
  onZoomIn,
  onZoomOut,
  onDownload,
}: {
  everything: boolean;
  zoom: number;
  onToggleEverything: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onDownload: () => void;
}) {
  const everythingLabel = everything ? 'Alle Knoten zuklappen' : 'Alle Knoten aufklappen';
  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-3">
      <Button
        variant="ghost"
        size="icon"
        className={ROUND}
        aria-label={everythingLabel}
        tooltip={everythingLabel}
        onClick={onToggleEverything}
      >
        {everything ? <ChevronsDownUp /> : <ChevronsUpDown />}
      </Button>
      <ZoomButtons zoom={zoom} onZoomIn={onZoomIn} onZoomOut={onZoomOut} />
      <Button
        variant="ghost"
        size="icon"
        className={ROUND}
        aria-label="Mindmap als Bild herunterladen"
        tooltip="Als Bild herunterladen"
        onClick={onDownload}
      >
        <Download />
      </Button>
    </div>
  );
}
