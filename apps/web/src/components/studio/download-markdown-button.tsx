import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { downloadMarkdown } from '@/lib/markdown-export';

/** Saves the text as a Markdown file named after the title. The text is read when it is clicked, so a note being written is saved as it is now. */
export function DownloadMarkdownButton({
  title,
  getMarkdown,
  size = 'icon',
}: {
  title: string;
  getMarkdown: () => string;
  size?: 'icon' | 'icon-lg';
}) {
  return (
    <Button
      variant="ghost"
      size={size}
      aria-label="Als Markdown herunterladen"
      tooltip="Als Markdown herunterladen"
      onClick={() => downloadMarkdown(title, getMarkdown())}
    >
      <Download />
    </Button>
  );
}
