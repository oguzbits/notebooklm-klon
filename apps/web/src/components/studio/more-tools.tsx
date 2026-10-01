import type { Editor } from '@tiptap/react';
import { Ellipsis } from 'lucide-react';

import { ToolGroup } from '@/components/studio/tool-button';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ToolbarState } from '@/hooks/use-toolbar-state';
import { MORE_TOOLS } from '@/lib/note-tools';

/** "⋯": the tools that do not fit in the bar, as a short row of symbols, like in the original. */
export function MoreTools({ editor, state }: { editor: Editor; state: ToolbarState }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Weitere Editor-Tools anzeigen"
          tooltip="Mehr"
          onMouseDown={(event) => event.preventDefault()}
        >
          <Ellipsis />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="flex gap-1 rounded-full p-1"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          editor.commands.focus();
        }}
      >
        <ToolGroup tools={MORE_TOOLS} editor={editor} state={state} />
      </PopoverContent>
    </Popover>
  );
}
