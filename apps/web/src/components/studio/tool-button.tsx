import type { Editor } from '@tiptap/react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ToolbarState } from '@/hooks/use-toolbar-state';
import type { NoteTool } from '@/lib/note-tools';
import { cn } from '@/lib/utils';

interface ToolButtonProps {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  /** Set for a tool that is on or off (bold); left out for one that only acts (undo). */
  active?: boolean;
  disabled?: boolean;
}

export function ToolButton({
  label,
  icon: Icon,
  onClick,
  active,
  disabled = false,
}: ToolButtonProps) {
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

/** A row of tools, each read against the state of the editor. */
export function ToolGroup({
  tools,
  editor,
  state,
}: {
  tools: readonly NoteTool[];
  editor: Editor;
  state: ToolbarState;
}) {
  return tools.map((tool) => (
    <ToolButton
      key={tool.label}
      label={tool.label}
      icon={tool.icon}
      active={tool.active && state[tool.active]}
      disabled={tool.enabled ? !state[tool.enabled] : false}
      onClick={() => tool.run(editor)}
    />
  ));
}

// On a narrow screen the bar wraps, and a line left at the end of a row would dangle: there the
// groups are told apart by a little space instead.
export const Divider = () => (
  <span aria-hidden className="mx-2 hidden h-5 w-px bg-border min-[480px]:block" />
);
