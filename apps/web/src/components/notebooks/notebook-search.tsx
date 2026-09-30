import { Search } from 'lucide-react';

/** The search field in the header of the start page: a pill, 256px wide, that narrows the list. */
export function NotebookSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex h-9 w-64 items-center gap-2 rounded-full border border-border px-3 text-ui focus-within:outline-3 focus-within:outline-ring max-sm:hidden">
      <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Notizbücher durchsuchen"
        aria-label="Notizbücher durchsuchen"
        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
      />
    </label>
  );
}
