import type { AnswerTrace } from '@nlm/shared';
import { ChevronDown, CircleDot, FileSearch, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { foundLine, leftOutLines, plural } from '@/lib/answer-trace';
import { sourcesLabel } from '@/lib/sources-label';
import { cn } from '@/lib/utils';

interface AnswerTraceViewProps {
  trace: AnswerTrace;
  statements: number;
}

/**
 * "Thoughts" of the original, honestly: a closed line under the question that opens to the steps
 * the server really took for this answer (searched the sources, wrote and checked the statements),
 * in German. There are no thoughts of the model in it, only what was done and what was left out.
 */
export function AnswerTraceView({ trace, statements }: AnswerTraceViewProps) {
  const [open, setOpen] = useState(false);
  const left = leftOutLines(trace);

  return (
    <div className="mb-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'veil inline-flex h-8 items-center gap-2 rounded-lg px-3 text-ui text-muted-foreground',
          open && 'bg-secondary'
        )}
      >
        <CircleDot className="size-3.5" aria-hidden />
        Vorgehen
        <ChevronDown
          className={cn('size-4 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open && (
        <ol className="mt-2 mb-3 flex flex-col gap-3 pl-3 text-ui">
          <li className="flex items-start gap-3">
            <FileSearch className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              Deine Quellen wurden durchsucht
              <span className="block text-small text-muted-foreground">
                {sourcesLabel(trace.sourcesSearched)} · {foundLine(trace.passagesFound)}
              </span>
            </span>
          </li>
          {statements > 0 && (
            <li className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                Antwort geschrieben und geprüft
                <span className="block text-small text-muted-foreground">
                  {plural(statements, 'Aussage', 'Aussagen')}, jede mit Quellenangabe
                </span>
                {left.map((line) => (
                  <span key={line} className="block text-small text-muted-foreground">
                    {line}
                  </span>
                ))}
              </span>
            </li>
          )}
        </ol>
      )}
    </div>
  );
}
