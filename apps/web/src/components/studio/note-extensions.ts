import { Markdown } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';

/**
 * What the note editor knows. The text goes in and out as Markdown, so a note is plain text in the
 * database and becomes a source as it is. No underline, because Markdown has no word for it; a link
 * is followed with a click on it only outside the editor.
 */
export const noteExtensions = [
  StarterKit.configure({
    underline: false,
    link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
  }),
  Markdown,
];
