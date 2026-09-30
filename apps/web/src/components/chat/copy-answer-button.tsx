import type { AnswerStatement } from '@nlm/shared';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

const CONFIRMATION_MS = 2000;

/** Copies the text of an answer, without the numbers of the citations. */
export function CopyAnswerButton({ statements }: { statements: AnswerStatement[] }) {
  const [copied, setCopied] = useState(false);
  // The name of the error the browser raised, so the failure stays visible and traceable.
  const [failure, setFailure] = useState<string | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(statements.map((statement) => statement.text).join(' '));
      setFailure(null);
      setCopied(true);
      setTimeout(() => setCopied(false), CONFIRMATION_MS);
    } catch (error) {
      // The browser refused (no permission, no secure page): say so instead of pretending.
      setFailure(error instanceof Error ? error.name : 'unknown');
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => void copy()}>
        {copied ? <Check /> : <Copy />}
        {copied ? 'Kopiert' : 'Kopieren'}
      </Button>
      {failure !== null && (
        <span className="text-small text-destructive" role="alert">
          Kopieren hat nicht geklappt.
        </span>
      )}
    </>
  );
}
