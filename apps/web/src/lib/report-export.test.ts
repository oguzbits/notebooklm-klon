import { describe, expect, it } from 'vitest';

import { reportToText } from './report-export';

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
