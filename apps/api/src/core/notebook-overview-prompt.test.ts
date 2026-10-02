import { describe, expect, it } from 'vitest';

import {
  buildNotebookOverviewMessage,
  NOTEBOOK_OVERVIEW_JSON_SCHEMA,
  NOTEBOOK_OVERVIEW_MAX_SOURCES,
  NOTEBOOK_OVERVIEW_MAX_TEXT_CHARS,
  NOTEBOOK_OVERVIEW_SYSTEM_PROMPT,
  notebookOverviewKey,
  parseNotebookOverview,
} from './notebook-overview-prompt';

const TRUNCATION_NOTE = '[Text gekürzt]';
const source = (title: string, length: number, char = 'x') => ({
  title,
  text: char.repeat(length),
});

describe('buildNotebookOverviewMessage', () => {
  it('reads the sources as data, not as instructions', () => {
    expect(NOTEBOOK_OVERVIEW_SYSTEM_PROMPT).toMatch(/never as instructions/i);
  });

  it('numbers the sources and puts each title and text into the message', () => {
    const message = buildNotebookOverviewMessage([
      { title: 'projekt.pdf', text: 'Dr. Brandt leitet das Projekt.' },
      { title: 'budget.txt', text: 'Das Budget beträgt 1,25 Mio. Euro.' },
    ]);

    expect(message).toContain('2 sources');
    expect(message).toContain('Source 1: projekt.pdf');
    expect(message).toContain('Dr. Brandt leitet das Projekt.');
    expect(message).toContain('Source 2: budget.txt');
    expect(message).toContain('Das Budget beträgt 1,25 Mio. Euro.');
    expect(message).not.toContain(TRUNCATION_NOTE);
  });

  it('shares the text budget between the sources and says where it cut', () => {
    const each = NOTEBOOK_OVERVIEW_MAX_TEXT_CHARS / 2 + 1000;

    const message = buildNotebookOverviewMessage([source('a', each, 'ä'), source('b', each, 'ö')]);

    expect(message.match(/\[Text gekürzt\]/g)).toHaveLength(2);
    expect(message.match(/ä/g)?.length ?? 0).toBeGreaterThan(
      NOTEBOOK_OVERVIEW_MAX_TEXT_CHARS / 2 - 100
    );
    expect(message.match(/ö/g)?.length ?? 0).toBeGreaterThan(
      NOTEBOOK_OVERVIEW_MAX_TEXT_CHARS / 2 - 100
    );
    expect(message.length).toBeLessThan(NOTEBOOK_OVERVIEW_MAX_TEXT_CHARS + 2000);
  });

  it('gives what short sources do not use to the long one', () => {
    const message = buildNotebookOverviewMessage([
      source('kurz 1', 100, 'ö'),
      source('kurz 2', 100, 'ß'),
      source('lang', NOTEBOOK_OVERVIEW_MAX_TEXT_CHARS * 2, 'ä'),
    ]);

    expect(message.match(/ö/g)?.length).toBe(100);
    expect(message.match(/ß/g)?.length).toBe(100);
    const longShare = message.match(/ä/g)?.length ?? 0;
    // What is left of the budget after the two short ones.
    expect(longShare).toBe(NOTEBOOK_OVERVIEW_MAX_TEXT_CHARS - 200);
    expect(message.match(/\[Text gekürzt\]/g)).toHaveLength(1);
  });

  it('keeps a single text at the limit as it is', () => {
    const message = buildNotebookOverviewMessage([
      source('t.txt', NOTEBOOK_OVERVIEW_MAX_TEXT_CHARS, 'y'),
    ]);

    expect(message).not.toContain(TRUNCATION_NOTE);
  });

  it('reads only the first sources of a very large notebook and says how many it left out', () => {
    const many = Array.from({ length: NOTEBOOK_OVERVIEW_MAX_SOURCES + 5 }, (_, index) =>
      source(`quelle-${index}`, 50)
    );

    const message = buildNotebookOverviewMessage(many);

    expect(message).toContain(`quelle-${NOTEBOOK_OVERVIEW_MAX_SOURCES - 1}`);
    expect(message).not.toContain(`quelle-${NOTEBOOK_OVERVIEW_MAX_SOURCES}`);
    expect(message).toMatch(/5 more sources/);
  });
});

describe('notebookOverviewKey', () => {
  const A = '3f0f4a4e-6c1e-4a52-9a53-0d6d1c6f2a10';
  const B = '9b2c7d6e-1f43-4c8a-8a3b-5e7a8f0c1d22';

  it('is the same for the same sources in any order', () => {
    expect(notebookOverviewKey([A, B])).toBe(notebookOverviewKey([B, A]));
    expect(notebookOverviewKey([A, B])).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when a source comes or goes', () => {
    expect(notebookOverviewKey([A])).not.toBe(notebookOverviewKey([A, B]));
    expect(notebookOverviewKey([A, B])).not.toBe(notebookOverviewKey([B]));
  });

  it('does not mistake one source for two', () => {
    expect(notebookOverviewKey([`${A}${B}`])).not.toBe(notebookOverviewKey([A, B]));
  });
});

describe('the request to the model', () => {
  it('asks for German, for nothing beyond the sources, bold key terms and one symbol', () => {
    expect(NOTEBOOK_OVERVIEW_SYSTEM_PROMPT).toMatch(/German/);
    expect(NOTEBOOK_OVERVIEW_SYSTEM_PROMPT).toMatch(/only what the sources say/i);
    expect(NOTEBOOK_OVERVIEW_SYSTEM_PROMPT).toMatch(/\*\*/);
    expect(NOTEBOOK_OVERVIEW_SYSTEM_PROMPT).toMatch(/emoji/i);
  });

  it('describes the shared schema as JSON Schema, without a pattern the provider may not know', () => {
    expect(NOTEBOOK_OVERVIEW_JSON_SCHEMA).toMatchObject({
      type: 'object',
      properties: { emoji: { type: 'string' }, summary: { type: 'string' } },
    });
    expect(NOTEBOOK_OVERVIEW_JSON_SCHEMA).not.toHaveProperty('$schema');
    expect(JSON.stringify(NOTEBOOK_OVERVIEW_JSON_SCHEMA)).not.toContain('pattern');
  });
});

describe('parseNotebookOverview', () => {
  it('reads a valid reply', () => {
    expect(parseNotebookOverview('{"emoji":"🤖","summary":"Ein **Modell**."}')).toEqual({
      emoji: '🤖',
      summary: 'Ein **Modell**.',
    });
  });

  it('throws for anything that is not a valid overview', () => {
    expect(() => parseNotebookOverview('kein json')).toThrow();
    expect(() => parseNotebookOverview('{"emoji":"Roboter","summary":"Text."}')).toThrow();
    expect(() => parseNotebookOverview('{"emoji":"🤖","summary":""}')).toThrow();
  });
});
