import type { SourceSummary } from '@nlm/shared';
import { Check, ChevronDown } from 'lucide-react';
import { type ReactNode, useId } from 'react';

import { SourceKindIcon } from '@/components/sources/kind-icon';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/** A heading above a field of a Studio dialog: 16/20 at weight 500, like the original. */
export const FIELD_LABEL = 'text-[1rem] leading-5 font-[500]';

/**
 * One of a few choices in a row of pills ("Weniger | Standardeinstellung | Mehr"). The chosen one
 * carries a check mark and a veil.
 */
export function SegmentedField<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-3">
      <p id={labelId} className={FIELD_LABEL}>
        {label}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex w-fit max-w-full overflow-hidden rounded-full border border-border"
      >
        {options.map((option, index) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                'veil flex h-10 items-center gap-2 px-4 text-ui font-label whitespace-nowrap',
                index > 0 && 'border-l border-border',
                selected && 'bg-accent'
              )}
            >
              {selected && <Check className="size-5" aria-hidden />}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Which of the usable sources the output is made from, as a chip that opens a list ("2 Quellen").
 * All of them are chosen to begin with.
 */
export function SourcesField({
  sources,
  chosen,
  onChange,
}: {
  sources: readonly SourceSummary[];
  chosen: ReadonlySet<string>;
  onChange: (chosen: ReadonlySet<string>) => void;
}) {
  const all = sources.length > 0 && sources.every((source) => chosen.has(source.id));
  const toggle = (id: string, on: boolean) => {
    const next = new Set(chosen);
    if (on) next.add(id);
    else next.delete(id);
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-3">
      <p className={FIELD_LABEL}>Quellen</p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="lg" className="w-fit gap-2 px-6 pr-4">
            {chosen.size} {chosen.size === 1 ? 'Quelle' : 'Quellen'}
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 min-w-64 overflow-y-auto">
          <DropdownMenuCheckboxItem
            checked={all}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(on) =>
              onChange(on === true ? new Set(sources.map((source) => source.id)) : new Set())
            }
          >
            Alle Quellen
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {sources.map((source) => (
            <DropdownMenuCheckboxItem
              key={source.id}
              checked={chosen.has(source.id)}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(on) => toggle(source.id, on === true)}
            >
              <SourceKindIcon kind={source.kind} />
              <span className="truncate">{source.title}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * The free text of a dialog: the topic, or the instruction of a report. While it is empty it shows
 * ideas, like the original ("Vorschläge" and a list); the ideas are no value and no label.
 */
export function FocusField({
  label,
  hint,
  ideas,
  value,
  maxLength,
  onChange,
  children,
}: {
  label: string;
  /** What the field is for, read by screen readers. */
  hint: string;
  ideas: readonly string[];
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
  children?: ReactNode;
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-3">
      <label id={labelId} htmlFor={`${labelId}-field`} className={FIELD_LABEL}>
        {label}
      </label>
      <div className="relative">
        <Textarea
          id={`${labelId}-field`}
          aria-label={hint}
          value={value}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-[120px] resize-none rounded-sm px-4 py-4 text-[1.0625rem] leading-6"
        />
        {value === '' && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 px-4 py-4 text-[1.0625rem] leading-6 text-muted-foreground"
          >
            <p>Vorschläge</p>
            <ul className="pl-9">
              {ideas.map((idea) => (
                <li key={idea} className="list-disc">
                  {idea}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
