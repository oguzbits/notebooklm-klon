import type { Editor } from '@tiptap/react';

import { LinkTool } from '@/components/studio/link-tool';
import { MoreTools } from '@/components/studio/more-tools';
import { StyleMenu } from '@/components/studio/style-menu';
import { Divider, ToolGroup } from '@/components/studio/tool-button';
import { useToolbarState } from '@/hooks/use-toolbar-state';
import { CODE_TOOLS, HISTORY_TOOLS, MARK_TOOLS } from '@/lib/note-tools';

interface NoteToolbarProps {
  editor: Editor;
}

/**
 * The bar above the text of a note, in the order of the original: undo and redo, the text style,
 * bold and italic, link, code and code block, and a menu with the rest.
 */
export function NoteToolbar({ editor }: NoteToolbarProps) {
  const state = useToolbarState(editor);

  return (
    <div
      role="toolbar"
      aria-label="Textformatierung"
      className="flex shrink-0 flex-wrap items-center gap-y-1 border-y border-border px-4 py-4 max-[479px]:gap-x-1"
    >
      <ToolGroup tools={HISTORY_TOOLS} editor={editor} state={state} />
      <Divider />
      <StyleMenu editor={editor} level={state.level} />
      <Divider />
      <ToolGroup tools={MARK_TOOLS} editor={editor} state={state} />
      <Divider />
      <LinkTool editor={editor} active={state.link} enabled={state.canLink} />
      <ToolGroup tools={CODE_TOOLS} editor={editor} state={state} />
      <Divider />
      <MoreTools editor={editor} state={state} />
    </div>
  );
}
