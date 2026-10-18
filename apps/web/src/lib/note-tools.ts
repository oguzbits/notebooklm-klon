import type { Editor } from '@tiptap/react';
import {
  Bold,
  Code,
  Italic,
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

import { tr } from './i18n';

/** The booleans of the editor state that say a tool is on, or that it can act. */
type Flag =
  | 'canUndo'
  | 'canRedo'
  | 'bold'
  | 'italic'
  | 'code'
  | 'codeBlock'
  | 'bullets'
  | 'numbers'
  | 'quote';

/** One button of the bar over a note: its words, its symbol, what it does and what it shows of the state. */
export interface NoteTool {
  label: string;
  icon: LucideIcon;
  run: (editor: Editor) => void;
  /** The flag that says the tool is on (bold); left out for one that only acts (undo). */
  active?: Flag;
  /** The flag that says the tool can act now (undo). */
  enabled?: Flag;
}

export const HISTORY_TOOLS: readonly NoteTool[] = [
  {
    label: tr('Rückgängig machen', 'Undo'),
    icon: Undo2,
    enabled: 'canUndo',
    run: (e) => e.chain().focus().undo().run(),
  },
  {
    label: tr('Wiederholen', 'Redo'),
    icon: Redo2,
    enabled: 'canRedo',
    run: (e) => e.chain().focus().redo().run(),
  },
];

export const MARK_TOOLS: readonly NoteTool[] = [
  {
    label: tr('Fett', 'Bold'),
    icon: Bold,
    active: 'bold',
    run: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    label: tr('Kursiv', 'Italic'),
    icon: Italic,
    active: 'italic',
    run: (e) => e.chain().focus().toggleItalic().run(),
  },
];

export const CODE_TOOLS: readonly NoteTool[] = [
  {
    label: tr('Als Code markieren', 'Mark as code'),
    icon: Code,
    active: 'code',
    run: (e) => e.chain().focus().toggleCode().run(),
  },
  {
    label: tr('Codeblock', 'Code block'),
    icon: SquareCode,
    active: 'codeBlock',
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
];

/** The tools behind "⋯", for what does not fit in the bar. */
export const MORE_TOOLS: readonly NoteTool[] = [
  {
    label: tr('Aufzählungsliste', 'Bulleted list'),
    icon: List,
    active: 'bullets',
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    label: tr('Nummerierte Liste', 'Numbered list'),
    icon: ListOrdered,
    active: 'numbers',
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    label: tr('Zitat', 'Quote'),
    icon: Quote,
    active: 'quote',
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    label: tr('Trennlinie', 'Divider'),
    icon: Minus,
    run: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    label: tr('Formatierung entfernen', 'Clear formatting'),
    icon: RemoveFormatting,
    run: (e) => e.chain().focus().clearNodes().unsetAllMarks().run(),
  },
];
