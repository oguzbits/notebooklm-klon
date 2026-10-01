import { type Editor, useEditorState } from '@tiptap/react';

export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;
/** The text style that is no heading. */
export const NORMAL = 0;

/** What the bar over a note needs to know about the editor: which tools are on, which can act. */
export interface ToolbarState {
  canUndo: boolean;
  canRedo: boolean;
  /** The heading level at the cursor, or {@link NORMAL}. */
  level: number;
  bold: boolean;
  italic: boolean;
  link: boolean;
  /** A link needs text to put it on, unless the cursor is in one already. */
  canLink: boolean;
  code: boolean;
  codeBlock: boolean;
  bullets: boolean;
  numbers: boolean;
  quote: boolean;
}

export function useToolbarState(editor: Editor): ToolbarState {
  return useEditorState({
    editor,
    selector: ({ editor: current }): ToolbarState => ({
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
      level:
        HEADING_LEVELS.find((heading) => current.isActive('heading', { level: heading })) ?? NORMAL,
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      link: current.isActive('link'),
      canLink: !current.state.selection.empty || current.isActive('link'),
      code: current.isActive('code'),
      codeBlock: current.isActive('codeBlock'),
      bullets: current.isActive('bulletList'),
      numbers: current.isActive('orderedList'),
      quote: current.isActive('blockquote'),
    }),
  });
}
