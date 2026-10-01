import { SOURCE_STATUS } from '@nlm/shared';

import { AddSourceDialog } from '@/components/sources/add-source-dialog';
import { SourceKindIcon } from '@/components/sources/kind-icon';
import { Button } from '@/components/ui/button';
import { useSources } from '@/hooks/use-sources';

/**
 * What the folded Sources column shows, like the original: the button that adds a source and one
 * symbol per source. A symbol opens the text of its source (the column opens with it).
 */
export function SourcesRail({
  notebookId,
  onOpenSource,
}: {
  notebookId: string;
  onOpenSource: (sourceId: string) => void;
}) {
  const sources = useSources(notebookId);

  return (
    <>
      <AddSourceDialog notebookId={notebookId} compact />
      {(sources.data ?? []).map((source) => (
        <Button
          key={source.id}
          variant="ghost"
          size="icon-sm"
          aria-label={`Quelle anzeigen: ${source.title}`}
          tooltip={source.title}
          disabled={source.status !== SOURCE_STATUS.READY}
          onClick={() => onOpenSource(source.id)}
        >
          <SourceKindIcon kind={source.kind} />
        </Button>
      ))}
    </>
  );
}
