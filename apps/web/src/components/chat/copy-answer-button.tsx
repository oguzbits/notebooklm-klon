import type { AnswerStatement } from '@nlm/shared';

import { CopyButton } from '@/components/ui/copy-button';
import { withoutMarkers } from '@/lib/plain-text';

/** Copies the text of an answer, without the numbers of the citations. */
export function CopyAnswerButton({ statements }: { statements: AnswerStatement[] }) {
  return (
    <CopyButton
      label="Kopieren"
      write={() =>
        navigator.clipboard.writeText(
          statements.map((statement) => withoutMarkers(statement.text)).join(' ')
        )
      }
    />
  );
}
