import { ErrorNotice, ListSkeleton } from '@/components/query-boundary';
import { Badge } from '@/components/ui/badge';
import { useOverview } from '@/hooks/use-overview';

/** Summary and key topics of one source, made on first view. */
export function SourceOverview({ notebookId, sourceId }: { notebookId: string; sourceId: string }) {
  const overview = useOverview(notebookId, sourceId, true);

  if (overview.isPending) return <ListSkeleton rows={2} />;
  if (overview.isError) {
    return (
      <ErrorNotice
        error={overview.error}
        onRetry={() => void overview.refetch()}
        retrying={overview.isFetching}
      />
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs leading-relaxed text-muted-foreground">{overview.data.summary}</p>
      {overview.data.keyTopics.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label="Schlüsselthemen">
          {overview.data.keyTopics.map((topic) => (
            <li key={topic}>
              <Badge variant="secondary">{topic}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
