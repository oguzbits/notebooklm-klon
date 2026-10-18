import type { Editor } from '@tiptap/react';
import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HEADING_LEVELS, NORMAL } from '@/hooks/use-toolbar-state';
import { tr } from '@/lib/i18n';

interface StyleMenuProps {
  editor: Editor;
  level: number;
}

/** "Normal ▾": the paragraph style, as a menu of the six heading levels and plain text. */
export function StyleMenu({ editor, level }: StyleMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={tr('Textformat', 'Text style')}
          tooltip={tr('Textformat', 'Text style')}
          className="px-3"
        >
          {level === NORMAL
            ? tr('Normal', 'Normal')
            : tr(`Überschrift ${level}`, `Heading ${level}`)}
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          editor.commands.focus();
        }}
      >
        {HEADING_LEVELS.map((heading) => (
          <DropdownMenuItem
            key={heading}
            onSelect={() => editor.chain().focus().setHeading({ level: heading }).run()}
          >
            {tr(`Überschrift ${heading}`, `Heading ${heading}`)}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem
          disabled={level === NORMAL}
          onSelect={() => editor.chain().focus().setParagraph().run()}
        >
          {tr('Normal', 'Normal')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
