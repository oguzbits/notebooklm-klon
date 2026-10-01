import { STUDIO_KIND, type StudioKind } from '@nlm/shared';
import { FileText, Layers, ListChecks, type LucideIcon, Network } from 'lucide-react';

import { TILE_LABEL } from '@/components/studio/studio-labels';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export const KIND_ICON: Record<StudioKind, LucideIcon> = {
  [STUDIO_KIND.REPORT]: FileText,
  [STUDIO_KIND.FLASHCARDS]: Layers,
  [STUDIO_KIND.QUIZ]: ListChecks,
  [STUDIO_KIND.MINDMAP]: Network,
};

/** Each format has its own icon color, like in the original. */
export const KIND_COLOR: Record<StudioKind, string> = {
  [STUDIO_KIND.REPORT]: 'text-studio-pink',
  [STUDIO_KIND.FLASHCARDS]: 'text-studio-warm',
  [STUDIO_KIND.QUIZ]: 'text-studio-teal',
  [STUDIO_KIND.MINDMAP]: 'text-studio-purple',
};

/** The order of the tiles is the one of the original, minus the formats this clone does not make. */
export const TILE_ORDER: readonly StudioKind[] = [
  STUDIO_KIND.MINDMAP,
  STUDIO_KIND.REPORT,
  STUDIO_KIND.FLASHCARDS,
  STUDIO_KIND.QUIZ,
];

/** What a tile says when the pointer rests on it, worded like the original. */
const KIND_TIP: Record<StudioKind, string> = {
  [STUDIO_KIND.REPORT]: 'Berichte auf Grundlage deiner Quellen erstellen',
  [STUDIO_KIND.FLASHCARDS]: 'Karteikarten mithilfe von KI basierend auf deinen Quellen erstellen',
  [STUDIO_KIND.QUIZ]: 'Interaktives Quiz auf Grundlage deiner Quellen mit KI erstellen',
  [STUDIO_KIND.MINDMAP]: 'Mindmap mithilfe von KI erstellen, basierend auf deinen Quellen',
};

const TILE =
  'flex h-12 w-full items-center gap-1 rounded-xl bg-tile pr-3 pl-2 text-left text-small ring-1 ring-inset ring-[var(--tile-ring)] transition-transform duration-200 ease-[cubic-bezier(0.05,0.7,0.1,1)] hover:scale-[0.985] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50';

/** The same tile as a bare icon, the way the folded column shows it. */
const TILE_COMPACT =
  'veil flex size-9 items-center justify-center rounded-full disabled:pointer-events-none disabled:opacity-50';

/**
 * One tile of the Studio: the format to make. `compact` is its icon on the rail of the folded column.
 */
export function Tile({
  kind,
  compact = false,
  children,
  ...props
}: { kind: StudioKind; compact?: boolean } & React.ComponentProps<'button'>) {
  const Icon = KIND_ICON[kind];
  return (
    <Tooltip>
      {/* The span keeps the tooltip alive while the tile is disabled (a disabled button gets no pointer events). */}
      <TooltipTrigger asChild>
        <span className="flex">
          <button
            type="button"
            aria-label={compact ? TILE_LABEL[kind] : undefined}
            className={compact ? TILE_COMPACT : TILE}
            {...props}
          >
            <span
              className={cn('flex shrink-0 items-center justify-center', !compact && 'size-10')}
            >
              <Icon className={cn(compact ? 'size-5' : 'size-6', KIND_COLOR[kind])} aria-hidden />
            </span>
            {!compact && (children ?? TILE_LABEL[kind])}
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{KIND_TIP[kind]}</TooltipContent>
    </Tooltip>
  );
}
