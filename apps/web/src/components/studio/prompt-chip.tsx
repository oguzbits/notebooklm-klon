import { type StudioRequest } from '@nlm/shared';
import { FileText, FolderOpen, Sparkles } from 'lucide-react';

import { SourceKindIcon } from '@/components/sources/kind-icon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useSources } from '@/hooks/use-sources';

interface PromptChipProps {
  notebookId: string;
  request: StudioRequest;
  withPrompt: boolean;
}

/**
 * "Prompt und 2 Quellen ansehen": a chip under the title that opens how the output was asked for
 * (the instruction in words) and the sources it was made from. Where the original shows no prompt
 * (cards, quiz, mind map), the chip names the sources only.
 */
export function PromptChip({ notebookId, request, withPrompt }: PromptChipProps) {
  const sources = useSources(notebookId);
  const count = request.sources.length;
  const sourcesText = `${count} ${count === 1 ? 'Quelle' : 'Quellen'}`;
  const label = withPrompt ? `Prompt und ${sourcesText} ansehen` : `${sourcesText} ansehen`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="veil h-8 rounded-full border border-border px-6 text-small font-label whitespace-nowrap"
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent role="dialog" aria-label={label} className="flex w-[420px] flex-col gap-4">
        {withPrompt && (
          <section className="flex flex-col gap-2">
            <h4 className="flex items-center gap-2 text-ui font-title">
              <Sparkles className="size-5" aria-hidden />
              Prompt
            </h4>
            <p className="text-[0.875rem] leading-6 whitespace-pre-line">{request.prompt}</p>
          </section>
        )}
        <section className="flex flex-col gap-2">
          <h4 className="flex items-center gap-2 text-ui font-title">
            <FolderOpen className="size-5" aria-hidden />
            Quellen
          </h4>
          <ul className="flex flex-wrap gap-2">
            {request.sources.map((entry) => {
              const kind = sources.data?.find((source) => source.id === entry.id)?.kind;
              return (
                <li
                  key={entry.id}
                  className="flex h-9 max-w-full items-center gap-2 rounded-full border border-border px-3 text-[0.875rem]"
                >
                  {kind ? (
                    <SourceKindIcon kind={kind} />
                  ) : (
                    <FileText className="size-6 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className="truncate">{entry.title}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </PopoverContent>
    </Popover>
  );
}
