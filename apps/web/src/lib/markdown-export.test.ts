import { describe, expect, it } from 'vitest';

import { captureDownloads } from '@/test/capture-downloads';
import { answer, question } from '@/test/fixtures';

import {
  answerToMarkdown,
  chatToMarkdown,
  downloadMarkdown,
  markdownFileName,
  reportToMarkdown,
} from './markdown-export';

const report = {
  title: 'Überblick',
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

describe('reportToMarkdown', () => {
  it('writes the title and the headings as Markdown headings, keeps bold, leaves out the citations', () => {
    expect(reportToMarkdown(report)).toBe(
      [
        '# Überblick',
        '',
        '## Lage',
        '',
        'Dr. Brandt leitet **das Projekt**. Es läuft seit 2024.',
        '',
        '## Ausblick',
        '',
        'Es endet 2027.',
        '',
      ].join('\n')
    );
  });
});

describe('answerToMarkdown', () => {
  it('puts the title above the statements as one paragraph', () => {
    const statements = [
      { text: 'Der **Gewinn** stieg.', chunkIds: ['a'] },
      { text: 'Die Rücklagen auch.', chunkIds: ['b'] },
    ];
    expect(answerToMarkdown('Bilanz', statements)).toBe(
      '# Bilanz\n\nDer **Gewinn** stieg. Die Rücklagen auch.\n'
    );
  });
});

describe('markdownFileName', () => {
  it('adds the ending and replaces the characters a file name cannot hold', () => {
    expect(markdownFileName('Plan 2026/27')).toBe('Plan 2026-27.md');
    expect(markdownFileName('a\\b')).toBe('a-b.md');
  });
});

describe('chatToMarkdown', () => {
  it('writes each question and each answer under its own heading, without citations or follow-ups', () => {
    const messages = [
      question('Wer leitet es?'),
      answer(
        [
          { text: 'Dr. Brandt leitet **es**.', chunkIds: ['a'] },
          { text: 'Seit 2024.', chunkIds: ['b'] },
        ],
        ['Und danach?']
      ),
    ];

    expect(chatToMarkdown('Steuerrecht', messages)).toBe(
      [
        '# Steuerrecht',
        '',
        '### Frage',
        '',
        'Wer leitet es?',
        '',
        '### Antwort',
        '',
        'Dr. Brandt leitet **es**. Seit 2024.',
        '',
      ].join('\n')
    );
  });
});

describe('downloadMarkdown', () => {
  it('hands the text over as a Markdown file', async () => {
    const downloads = captureDownloads();
    try {
      downloadMarkdown('Plan', '# Plan\n');

      expect(downloads.files).toHaveLength(1);
      expect(downloads.files[0]?.name).toBe('Plan.md');
      expect(downloads.files[0]?.blob.type).toBe('text/markdown;charset=utf-8');
      expect(await downloads.files[0]?.blob.text()).toBe('# Plan\n');
    } finally {
      downloads.restore();
    }
  });
});
