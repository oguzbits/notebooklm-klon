import { type Editor, useEditorState } from '@tiptap/react';
import {
  Bold,
  ChevronDown,
  Code,
  Ellipsis,
  Italic,
  Link,
  List,
  ListOrdered,
  type LucideIcon,
  Minus,
  Quote,
  Redo2,
  RemoveFormatting,
  SquareCode,
  Undo2,
} from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;
const NORMAL = 0;
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** A web address without a scheme ("tiptap.dev") is meant as https, not as a path on this site. */
const withScheme = (address: string) => (URL_SCHEME.test(address) ? address : `https://${address}`);

interface ToolButtonProps {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  /** Set for a tool that is on or off (bold); left out for one that only acts (undo). */
  active?: boolean;
  disabled?: boolean;
}

function ToolButton({ label, icon: Icon, onClick, active, disabled = false }: ToolButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      tooltip={label}
      aria-pressed={active}
      disabled={disabled}
      // The editor keeps its selection while a button is pressed, so the tool acts on it.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(active && 'bg-accent')}
    >
      <Icon />
    </Button>
  );
}

// On a narrow screen the bar wraps, and a line left at the end of a row would dangle: there the
// groups are told apart by a little space instead.
const Divider = () => (
  <span aria-hidden className="mx-2 hidden h-5 w-px bg-border min-[480px]:block" />
);

interface StyleMenuProps {
  editor: Editor;
  level: number;
}

/** "Normal ▾": the paragraph style, as a menu of the six heading levels and plain text. */
function StyleMenu({ editor, level }: StyleMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Textformat"
          tooltip="Textformat"
          className="px-3"
        >
          {level === NORMAL ? 'Normal' : `Überschrift ${level}`}
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
            Überschrift {heading}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem
          disabled={level === NORMAL}
          onSelect={() => editor.chain().focus().setParagraph().run()}
        >
          Normal
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface LinkToolProps {
  editor: Editor;
  active: boolean;
  enabled: boolean;
}

/** "Verknüpfen": gives the selected text an address, changes it, or takes it away. */
function LinkTool({ editor, active, enabled }: LinkToolProps) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState('');

  const close = () => {
    setOpen(false);
    editor.commands.focus();
  };
  const apply = (event: FormEvent) => {
    event.preventDefault();
    const typed = address.trim();
    if (typed === '') editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: withScheme(typed) })
        .run();
    close();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setAddress(editor.getAttributes('link').href ?? '');
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Verknüpfen"
          tooltip="Verknüpfen"
          aria-pressed={active}
          disabled={!enabled}
          onMouseDown={(event) => event.preventDefault()}
          className={cn(active && 'bg-accent')}
        >
          <Link />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" onCloseAutoFocus={(event) => event.preventDefault()}>
        <form onSubmit={apply} className="flex flex-col gap-2">
          <Input
            aria-label="Adresse des Links"
            placeholder="https://"
            inputMode="url"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            {active && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  editor.chain().focus().extendMarkRange('link').unsetLink().run();
                  close();
                }}
              >
                Link entfernen
              </Button>
            )}
            <Button type="submit">Übernehmen</Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

interface MoreToolsProps {
  editor: Editor;
  bullets: boolean;
  numbers: boolean;
  quote: boolean;
}

/** "⋯": the tools that do not fit in the bar, as a short row of symbols, like in the original. */
function MoreTools({ editor, bullets, numbers, quote }: MoreToolsProps) {
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
        <ToolButton
          label="Aufzählungsliste"
          icon={List}
          active={bullets}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolButton
          label="Nummerierte Liste"
          icon={ListOrdered}
          active={numbers}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolButton
          label="Zitat"
          icon={Quote}
          active={quote}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolButton
          label="Trennlinie"
          icon={Minus}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />
        <ToolButton
          label="Formatierung entfernen"
          icon={RemoveFormatting}
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        />
      </PopoverContent>
    </Popover>
  );
}

interface NoteToolbarProps {
  editor: Editor;
}

/**
 * The bar above the text of a note, in the order of the original: undo and redo, the text style,
 * bold and italic, link, code and code block, and a menu with the rest.
 */
export function NoteToolbar({ editor }: NoteToolbarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
      level:
        HEADING_LEVELS.find((heading) => current.isActive('heading', { level: heading })) ?? NORMAL,
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      link: current.isActive('link'),
      // A link needs text to put it on, unless the cursor is in one already.
      canLink: !current.state.selection.empty || current.isActive('link'),
      code: current.isActive('code'),
      codeBlock: current.isActive('codeBlock'),
      bullets: current.isActive('bulletList'),
      numbers: current.isActive('orderedList'),
      quote: current.isActive('blockquote'),
    }),
  });

  return (
    <div
      role="toolbar"
      aria-label="Textformatierung"
      className="flex shrink-0 flex-wrap items-center gap-y-1 border-y border-border px-4 py-4 max-[479px]:gap-x-1"
    >
      <ToolButton
        label="Rückgängig machen"
        icon={Undo2}
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolButton
        label="Wiederholen"
        icon={Redo2}
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      />
      <Divider />
      <StyleMenu editor={editor} level={state.level} />
      <Divider />
      <ToolButton
        label="Fett"
        icon={Bold}
        active={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolButton
        label="Kursiv"
        icon={Italic}
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <Divider />
      <LinkTool editor={editor} active={state.link} enabled={state.canLink} />
      <ToolButton
        label="Als Code markieren"
        icon={Code}
        active={state.code}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
      <ToolButton
        label="Codeblock"
        icon={SquareCode}
        active={state.codeBlock}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />
      <Divider />
      <MoreTools
        editor={editor}
        bullets={state.bullets}
        numbers={state.numbers}
        quote={state.quote}
      />
    </div>
  );
}
