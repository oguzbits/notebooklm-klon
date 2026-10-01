import { ArrowDown } from 'lucide-react';

import { Button } from '@/components/ui/button';

/** The round button over the lower edge of the chat that takes the reader to the newest message. */
export function JumpToEndButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      size="icon"
      variant="secondary"
      tooltip="Nach unten springen"
      aria-label="Nach unten springen"
      onClick={onClick}
      className="absolute bottom-3 left-1/2 size-9 -translate-x-1/2 rounded-full bg-card shadow-glow"
    >
      <ArrowDown />
    </Button>
  );
}
