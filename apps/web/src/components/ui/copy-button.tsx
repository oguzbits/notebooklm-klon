import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

const CONFIRMATION_MS = 2000;

/**
 * An icon button that copies something and says so with a check mark. If the browser refuses
 * (no permission, no secure page) it says that instead of pretending.
 */
export function CopyButton({
  label,
  tooltip = label,
  size = 'icon',
  write,
}: {
  /** Names the button for screen readers. */
  label: string;
  /** The text of the tooltip before it was copied; "Kopiert" follows. */
  tooltip?: string;
  size?: 'icon' | 'icon-sm';
  /** Puts the content on the clipboard. */
  write: () => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  // The name of the error the browser raised, so the failure stays visible and traceable.
  const [failure, setFailure] = useState<string | null>(null);

  const copy = async () => {
    try {
      await write();
      setFailure(null);
      setCopied(true);
      setTimeout(() => setCopied(false), CONFIRMATION_MS);
    } catch (error) {
      setFailure(error instanceof Error ? error.name : 'unknown');
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size={size}
        aria-label={label}
        tooltip={copied ? 'Kopiert' : tooltip}
        onClick={() => void copy()}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
      {failure !== null && (
        <span className="text-small text-destructive" role="alert">
          Kopieren hat nicht geklappt.
        </span>
      )}
    </>
  );
}
