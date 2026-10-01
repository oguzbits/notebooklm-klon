import type { CreateStudioBody, SourceSummary, StudioKind } from '@nlm/shared';

import { CreateDialog } from '@/components/studio/create-dialog';
import { Tile } from '@/components/studio/studio-tiles';

/** A tile of the Studio; it opens the dialog that asks what to make before anything is made. */
export function CreateTile({
  kind,
  compact,
  sources,
  disabled,
  onCreate,
}: {
  kind: StudioKind;
  compact: boolean;
  sources: SourceSummary[];
  disabled: boolean;
  onCreate: (body: CreateStudioBody) => void;
}) {
  return (
    <CreateDialog kind={kind} sources={sources} onCreate={onCreate}>
      <Tile kind={kind} compact={compact} disabled={disabled} />
    </CreateDialog>
  );
}
