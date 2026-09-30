import { SOURCE_KIND } from '@nlm/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SourceText } from './source-text';

const marks = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('mark')).map((mark) => mark.textContent);

describe('SourceText', () => {
  it('shows headings, lists and links as what they are', () => {
    render(
      <SourceText
        text={
          '# Titel\n\nEin Absatz mit [Link](https://example.org/a).\n\n- eins\n- zwei\n\n1. erst\n2. dann'
        }
      />
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Titel' })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    const link = screen.getByRole('link', { name: 'Link' });
    expect(link.getAttribute('href')).toBe('https://example.org/a');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('shows bold, italic and tables', () => {
    const { container } = render(
      <SourceText
        text={'Das **wichtige** Wort, *betont*.\n\n| Name | Wert |\n| --- | --- |\n| a | 1 |'}
      />
    );

    expect(container.querySelector('strong')?.textContent).toBe('wichtige');
    expect(container.querySelector('em')?.textContent).toBe('betont');
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: '1' })).toBeTruthy();
  });

  it('does not run HTML or scripts from a source', () => {
    const { container } = render(
      <SourceText
        text={
          'Text <script>alert(1)</script> [x](javascript:alert(1)) ![bild](https://example.org/b.png)'
        }
      />
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByRole('link', { name: 'x' })?.getAttribute('href') ?? '').not.toContain(
      'javascript'
    );
  });

  describe('the cited passage', () => {
    it('marks the passage in plain text', () => {
      const text = 'Vorwort. Dr. Brandt leitet das Projekt. Ende.';
      const start = text.indexOf('Dr.');
      const { container } = render(
        <SourceText text={text} highlight={{ start, end: text.indexOf(' Ende') }} />
      );

      expect(marks(container)).toEqual(['Dr. Brandt leitet das Projekt.']);
      expect(container.textContent).toBe(text);
    });

    it('marks through bold text and keeps it bold', () => {
      const text = 'Das **wichtige** Wort und mehr.';
      const start = text.indexOf('wichtige');
      const end = text.indexOf(' und');
      const { container } = render(<SourceText text={text} highlight={{ start, end }} />);

      expect(marks(container)).toEqual(['wichtige', ' Wort']);
      expect(container.querySelector('strong mark')?.textContent).toBe('wichtige');
    });

    it('marks a passage that runs over two paragraphs', () => {
      const text = 'Erster Absatz endet hier.\n\nZweiter beginnt und endet dort.';
      const { container } = render(
        <SourceText
          text={text}
          highlight={{ start: text.indexOf('hier'), end: text.indexOf(' und') }}
        />
      );

      expect(marks(container)).toEqual(['hier.', 'Zweiter beginnt']);
    });

    it('marks the whole piece of text when the characters were changed on the way', () => {
      const text = 'Preis 5 \\* 3 ergibt 15.';
      const { container } = render(
        <SourceText text={text} highlight={{ start: text.indexOf('ergibt'), end: text.length }} />
      );

      expect(marks(container).join('')).toContain('ergibt 15.');
    });

    it('marks nothing without a passage or outside the text', () => {
      const { container, rerender } = render(<SourceText text="Kurz." highlight={null} />);
      expect(marks(container)).toEqual([]);

      rerender(<SourceText text="Kurz." highlight={{ start: 50, end: 60 }} />);
      expect(marks(container)).toEqual([]);
    });
  });

  describe('a plain text source', () => {
    it('keeps its line breaks and does not read Markdown into it', () => {
      const text = '# kein Titel\n* kein Punkt\nzweite Zeile';
      const { container } = render(<SourceText text={text} kind={SOURCE_KIND.TXT} />);

      expect(container.querySelector('h1, li, em')).toBeNull();
      expect(container.textContent).toBe(text);
    });

    it('marks the cited passage', () => {
      const text = 'Vorwort.\nDr. Brandt leitet das Projekt.\nEnde.';
      const { container } = render(
        <SourceText
          text={text}
          kind={SOURCE_KIND.TXT}
          highlight={{ start: text.indexOf('Dr.'), end: text.indexOf('\nEnde') }}
        />
      );

      expect(marks(container)).toEqual(['Dr. Brandt leitet das Projekt.']);
      expect(container.textContent).toBe(text);
    });
  });
});
