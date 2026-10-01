import { describe, expect, it } from 'vitest';

import { reportHtml } from './report-html';

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

describe('reportHtml', () => {
  it('writes headings and paragraphs, keeps bold words and escapes what is not markup', async () => {
    const html = await reportHtml(report);

    expect(html).toContain('<h1>Überblick &lt;Projekt&gt;</h1>');
    expect(html).toContain('<h2>Lage</h2>');
    expect(html).toContain(
      '<p>Dr. Brandt leitet <strong>das Projekt</strong>. Es läuft seit 2024.</p>'
    );
    expect(html).toContain('<h2>Ausblick</h2>');
  });

  it('never lets text become markup', async () => {
    const html = await reportHtml({
      title: '<img src=x onerror=alert(1)>',
      sections: [
        {
          heading: '"</h2><script>',
          statements: [{ text: '**<b>fett</b>**', chunkIds: ['a'] }],
        },
      ],
    });

    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).toContain('<strong>&lt;b&gt;fett&lt;/b&gt;</strong>');
  });
});
