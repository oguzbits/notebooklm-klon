import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { parsePptx } from './parse-pptx';

const NS = 'xmlns:a="http://a" xmlns:p="http://p" xmlns:r="http://r"';

const run = (text: string) => `<a:r><a:t>${text}</a:t></a:r>`;
const paragraph = (text: string, level = 0) => `<a:p><a:pPr lvl="${level}"/>${run(text)}</a:p>`;
const shape = (paragraphs: string, placeholder = '') =>
  `<p:sp><p:nvSpPr><p:nvPr>${placeholder}</p:nvPr></p:nvSpPr><p:txBody>${paragraphs}</p:txBody></p:sp>`;
const ph = (type: string) => `<p:ph type="${type}"/>`;
const slide = (shapes: string) =>
  `<p:sld ${NS}><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld></p:sld>`;
const cell = (text: string) => `<a:tc><a:txBody>${paragraph(text)}</a:txBody></a:tc>`;
const table = (rows: string[][]) =>
  `<p:graphicFrame><a:graphic><a:graphicData><a:tbl>${rows
    .map((row) => `<a:tr>${row.map(cell).join('')}</a:tr>`)
    .join('')}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;

const rels = (items: { id: string; target: string; type?: string }[]) =>
  `<Relationships>${items
    .map(
      ({ id, target, type = 'slide' }) =>
        `<Relationship Id="${id}" Type="http://schemas/${type}" Target="${target}"/>`
    )
    .join('')}</Relationships>`;

/** A PPTX whose presentation lists the slides in the given order of their files. */
function pptx(
  slides: Record<string, string>,
  order: string[],
  extra: Record<string, string> = {}
): Uint8Array {
  const files: Record<string, string> = {
    'ppt/presentation.xml': `<p:presentation ${NS}><p:sldIdLst>${order
      .map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`)
      .join('')}</p:sldIdLst></p:presentation>`,
    'ppt/_rels/presentation.xml.rels': rels(
      order.map((file, index) => ({ id: `rId${index + 1}`, target: `slides/${file}.xml` }))
    ),
    ...extra,
  };
  for (const [file, xml] of Object.entries(slides)) files[`ppt/slides/${file}.xml`] = xml;
  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));
}

describe('parsePptx', () => {
  it('writes each slide under its number with the title in the heading', async () => {
    const bytes = pptx(
      {
        slide1: slide(
          shape(paragraph('Projekt Nordlicht'), ph('ctrTitle')) + shape(paragraph('Dr. Brandt'))
        ),
        slide2: slide(shape(paragraph('Ergebnisse'), ph('title')) + shape(paragraph('Umsatz 455'))),
      },
      ['slide1', 'slide2']
    );

    const { text, pageCount } = await parsePptx(bytes);

    expect(text).toBe(
      '## Folie 1: Projekt Nordlicht\n\nDr. Brandt\n\n## Folie 2: Ergebnisse\n\nUmsatz 455'
    );
    expect(pageCount).toBeNull();
  });

  it('follows the order of the presentation, not the number in the file name', async () => {
    const bytes = pptx(
      { slide1: slide(shape(paragraph('zweite'))), slide2: slide(shape(paragraph('erste'))) },
      ['slide2', 'slide1']
    );

    const { text } = await parsePptx(bytes);

    expect(text.indexOf('erste')).toBeLessThan(text.indexOf('zweite'));
  });

  it('indents nested points and keeps line breaks inside a paragraph', async () => {
    const bytes = pptx(
      {
        slide1: slide(
          shape(
            paragraph('Oberpunkt') +
              paragraph('Unterpunkt', 1) +
              `<a:p>${run('Zeile eins')}<a:br/>${run('Zeile zwei')}</a:p>`
          )
        ),
      },
      ['slide1']
    );

    const { text } = await parsePptx(bytes);

    expect(text).toContain('Oberpunkt\n  - Unterpunkt\nZeile eins\nZeile zwei');
  });

  it('writes a table as a Markdown table, a row on one line', async () => {
    const bytes = pptx(
      {
        slide1: slide(
          table([
            ['Quartal', 'Umsatz'],
            ['Q3', '455'],
          ])
        ),
      },
      ['slide1']
    );

    const { text } = await parsePptx(bytes);

    expect(text).toContain('| Quartal | Umsatz |\n| --- | --- |\n| Q3 | 455 |');
  });

  it('keeps a bar inside a cell from splitting the row', async () => {
    const bytes = pptx({ slide1: slide(table([['A', 'a | b']])) }, ['slide1']);

    const { text } = await parsePptx(bytes);

    expect(text).toContain('| A | a \\| b |');
  });

  it('leaves out slide numbers, footers and dates', async () => {
    const bytes = pptx(
      {
        slide1: slide(
          shape(paragraph('Inhalt')) +
            shape(paragraph('7'), ph('sldNum')) +
            shape(paragraph('Vertraulich'), ph('ftr')) +
            shape(paragraph('01.10.2026'), ph('dt'))
        ),
      },
      ['slide1']
    );

    const { text } = await parsePptx(bytes);

    expect(text).toContain('Inhalt');
    expect(text).not.toMatch(/Vertraulich|01\.10\.2026|\n7/);
  });

  it('adds the speaker notes of a slide below it', async () => {
    const notes = `<p:notes ${NS}><p:cSld><p:spTree>${shape(paragraph('1'), ph('sldNum'))}${shape(
      paragraph('Hier die Zahlen nennen'),
      ph('body')
    )}</p:spTree></p:cSld></p:notes>`;
    const bytes = pptx({ slide1: slide(shape(paragraph('Inhalt'))) }, ['slide1'], {
      'ppt/slides/_rels/slide1.xml.rels': rels([
        { id: 'rId1', target: '../notesSlides/notesSlide1.xml', type: 'notesSlide' },
      ]),
      'ppt/notesSlides/notesSlide1.xml': notes,
    });

    const { text } = await parsePptx(bytes);

    expect(text).toBe('## Folie 1\n\nInhalt\n\nNotizen: Hier die Zahlen nennen');
  });

  it('escapes what Markdown would read as formatting', async () => {
    const bytes = pptx({ slide1: slide(shape(paragraph('a_b_c *fett*'))) }, ['slide1']);

    const { text } = await parsePptx(bytes);

    expect(text).toContain('a\\_b\\_c \\*fett\\*');
  });

  it('rejects a ZIP that is not a presentation', async () => {
    const zip = zipSync({ 'word/document.xml': strToU8('<w:document/>') });

    await expect(parsePptx(zip)).rejects.toThrow();
  });

  it('rejects a part that is far larger than any slide can be', async () => {
    const bytes = pptx({ slide1: slide(shape(paragraph('x'.repeat(6_000_000)))) }, ['slide1']);

    await expect(parsePptx(bytes)).rejects.toThrow();
  });
});
