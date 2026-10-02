import { WEB_SEARCH_QUERY, type WebSearchResult } from '@nlm/shared';
import { ArrowRight, Check, LoaderCircle, Plus, X } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useState } from 'react';

import { ErrorNotice } from '@/components/query-boundary';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAddUrl } from '@/hooks/use-sources';
import { useCapabilities, useWebSearch } from '@/hooks/use-web-search';
import { describeError } from '@/lib/messages';

/** The domain of an address, for the line under the title. */
const domainOf = (address: string) => new URL(address).hostname.replace(/^www\./, '');

interface ResultRowProps {
  notebookId: string;
  result: WebSearchResult;
}

function ResultRow({ notebookId, result }: ResultRowProps) {
  const add = useAddUrl(notebookId);

  return (
    <li className="flex items-start gap-2 rounded-xl px-2 py-2">
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[0.875rem] leading-5 font-title">{result.title}</p>
        <p className="truncate text-small text-muted-foreground">{domainOf(result.url)}</p>
        {result.snippet !== '' && (
          <p className="mt-1 line-clamp-2 text-small text-muted-foreground">{result.snippet}</p>
        )}
        {add.isError && (
          <p className="mt-1 text-small text-destructive" role="alert">
            {describeError(add.error)}
          </p>
        )}
      </div>
      {add.isSuccess ? (
        <span className="flex h-8 shrink-0 items-center gap-1 px-2 text-small text-muted-foreground">
          <Check className="size-4" aria-hidden />
          Hinzugefügt
        </span>
      ) : (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`${result.title} als Quelle hinzufügen`}
          tooltip="Als Quelle hinzufügen"
          disabled={add.isPending}
          onClick={() => add.mutate(result.url)}
        >
          {add.isPending ? <LoaderCircle className="animate-spin" /> : <Plus />}
        </Button>
      )}
    </li>
  );
}

interface SearchFieldProps {
  query: string;
  pending: boolean;
  canSearch: boolean;
  onChange: (query: string) => void;
  onRun: () => void;
}

/** The field for the search, which sends with Enter or with the arrow. */
function SearchField({ query, pending, canSearch, onChange, onRun }: SearchFieldProps) {
  const submitOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onRun();
    }
  };

  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onRun();
      }}
      className="flex items-end gap-2 rounded-2xl bg-secondary py-2 pr-2 pl-4"
    >
      <Textarea
        aria-label="Im Web nach neuen Quellen suchen"
        placeholder="Im Web nach neuen Quellen suchen"
        rows={1}
        maxLength={WEB_SEARCH_QUERY.MAX_CHARS}
        value={query}
        disabled={pending}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={submitOnEnter}
        className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-0 py-1.5 text-ui shadow-none focus-visible:border-0 focus-visible:outline-0"
      />
      <Button
        type="submit"
        size="icon"
        variant={canSearch ? 'default' : 'ghost'}
        aria-label="Suchen"
        disabled={!canSearch}
      >
        <ArrowRight />
      </Button>
    </form>
  );
}

interface SearchResultsProps {
  notebookId: string;
  search: ReturnType<typeof useWebSearch>;
  onRetry: () => void;
  onClose: () => void;
}

/** What the search brought: the wait, the failure with a way to try again, or the pages found. */
function SearchResults({ notebookId, search, onRetry, onClose }: SearchResultsProps) {
  return (
    <section aria-label="Suchergebnisse" className="flex flex-col gap-1">
      {search.isPending && (
        <p
          role="status"
          aria-label="Suche läuft"
          className="flex items-center gap-2 px-2 py-3 text-ui text-muted-foreground"
        >
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Suche läuft …
        </p>
      )}
      {search.isError && (
        <ErrorNotice error={search.error} onRetry={onRetry} retrying={search.isPending} />
      )}
      {search.isSuccess && (
        <>
          <div className="flex items-center justify-between pl-2">
            <h3 className="text-small text-muted-foreground">Gefundene Seiten</h3>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Ergebnisse schließen"
              tooltip="Schließen"
              onClick={onClose}
            >
              <X />
            </Button>
          </div>
          {search.data.results.length === 0 ? (
            <p className="px-2 py-3 text-ui text-muted-foreground">Dazu wurde nichts gefunden.</p>
          ) : (
            <ul aria-label="Gefundene Seiten" className="flex flex-col">
              {search.data.results.map((result) => (
                <ResultRow key={result.url} notebookId={notebookId} result={result} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

interface WebSearchBoxProps {
  notebookId: string;
}

/**
 * "Im Web nach neuen Quellen suchen" of the original, under "Quellen hinzufügen": a field, and the
 * pages that were found with a button to add each as a source. It is shown only where the server has
 * a search service. Adding a page is the normal import of a web address, with all its checks.
 */
export function WebSearchBox({ notebookId }: WebSearchBoxProps) {
  const capabilities = useCapabilities();
  const search = useWebSearch();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  if (!capabilities.data?.webSearch) return null;
  const text = query.trim();
  const canSearch = text.length >= WEB_SEARCH_QUERY.MIN_CHARS && !search.isPending;
  const run = () => {
    if (!canSearch) return;
    setOpen(true);
    search.mutate(text);
  };

  return (
    <div className="flex flex-col gap-2">
      <SearchField
        query={query}
        pending={search.isPending}
        canSearch={canSearch}
        onChange={setQuery}
        onRun={run}
      />
      {open && (
        <SearchResults
          notebookId={notebookId}
          search={search}
          onRetry={run}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
