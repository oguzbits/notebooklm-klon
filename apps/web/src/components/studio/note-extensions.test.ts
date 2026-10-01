import { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it } from 'vitest';

import { noteExtensions } from '@/components/studio/note-extensions';

const editors: Editor[] = [];

/** Puts Markdown into the editor the way a saved note is opened, and reads it back the way it is saved. */
function roundTrip(markdown: string): string {
  const editor = new Editor({
    extensions: noteExtensions,
    content: markdown,
    contentType: 'markdown',
  });
  editors.push(editor);
  return editor.getMarkdown();
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

describe('note editor Markdown', () => {
  it.each([
    ['a paragraph', 'Ein Satz.\n\nNoch ein Absatz.'],
    ['bold and italic', 'Ein **fetter** und ein *kursiver* Satz.'],
    ['inline code', 'Der Befehl `pnpm check` läuft.'],
    ['a link', 'Siehe [die Doku](https://tiptap.dev/docs).'],
    ['a bullet list', '- Eins\n- Zwei\n- Drei'],
    ['a numbered list', '1. Eins\n2. Zwei\n3. Drei'],
    ['a quote', '> Ein Zitat\n> über zwei Zeilen'],
    ['a rule', 'Davor\n\n---\n\nDanach'],
    ['a code block', '```\nconst a = 1;\n```'],
    ['nothing', ''],
  ])('keeps %s as it is', (_name, markdown) => {
    expect(roundTrip(markdown)).toBe(markdown);
  });

  it.each([1, 2, 3, 4, 5, 6])('keeps a heading of level %i', (level) => {
    const markdown = `${'#'.repeat(level)} Titel\n\nText`;

    expect(roundTrip(markdown)).toBe(markdown);
  });

  it('keeps nested lists', () => {
    const markdown = '- Eins\n  - Innen\n- Zwei';

    expect(roundTrip(markdown)).toBe(markdown);
  });

  it('has no underline, which Markdown cannot say', () => {
    expect(roundTrip('Text mit <u>Unterstrich</u>')).not.toContain('<u>');
  });
});
