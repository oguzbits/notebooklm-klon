import { describe, expect, it } from 'vitest';

import { reportToHtml, reportToText } from './report-export';

const report = {
  title: 'Überblick <Projekt>',
  sections: [
    {
      heading: 'Lage',
      statements: [
        { text: 'Dr. Brandt leitet **das Projekt**.', chunkIds: ['a'] },
        { text: 'Es läuft seit 2024.', chunkIds: ['a', 'b'] },
      ],
    },
    { heading: 'Ausblick', statements: [{ text: 'Es endet 2027.', chunkIds: ['b'] }] },
  ],
};

describe('reportToText', () => {
  it('writes the title, each heading and its statements as plain paragraphs, without markers', () => {
    expect(reportToText(report)).toBe(
      [
        'Überblick <Projekt>',
        '',
        'Lage',
        'Dr. Brandt leitet das Projekt. Es läuft seit 2024.',
        '',
        'Ausblick',
        'Es endet 2027.',
      ].join('\n')
    );
  });
});

describe('reportToHtml', () => {
  it('writes headings and paragraphs, keeps bold words and escapes what is not markup', () => {
    const html = reportToHtml(report);

    expect(html).toContain('<h1>Überblick &lt;Projekt&gt;</h1>');
    expect(html).toContain('<h2>Lage</h2>');
    expect(html).toContain(
      '<p>Dr. Brandt leitet <strong>das Projekt</strong>. Es läuft seit 2024.</p>'
    );
    expect(html).toContain('<h2>Ausblick</h2>');
  });
});
