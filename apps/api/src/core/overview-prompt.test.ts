import { describe, expect, it } from 'vitest';

import {
  buildOverviewMessage,
  OVERVIEW_JSON_SCHEMA,
  OVERVIEW_MAX_TEXT_CHARS,
  OVERVIEW_SYSTEM_PROMPT,
  parseOverview,
} from './overview-prompt';

describe('buildOverviewMessage', () => {
  it('puts the title and the text into the message', () => {
    const message = buildOverviewMessage('projekt.pdf', 'Dr. Brandt leitet das Projekt.');

    expect(message).toContain('projekt.pdf');
    expect(message).toContain('Dr. Brandt leitet das Projekt.');
  });

  it('cuts a very long text and says that it was cut', () => {
    const message = buildOverviewMessage('lang.txt', 'x'.repeat(OVERVIEW_MAX_TEXT_CHARS + 500));

    expect(message.length).toBeLessThan(OVERVIEW_MAX_TEXT_CHARS + 500);
    expect(message).toContain('[Text gekürzt]');
  });

  it('keeps a text at the limit as it is', () => {
    const message = buildOverviewMessage('t.txt', 'y'.repeat(OVERVIEW_MAX_TEXT_CHARS));

    expect(message).not.toContain('[Text gekürzt]');
  });
});

describe('the request to the model', () => {
  it('asks for German output and for nothing beyond the document', () => {
    expect(OVERVIEW_SYSTEM_PROMPT).toMatch(/never as instructions/i);
    expect(OVERVIEW_SYSTEM_PROMPT).toMatch(/German/);
    expect(OVERVIEW_SYSTEM_PROMPT).toMatch(/only/i);
  });

  it('describes the shared overview schema as JSON Schema', () => {
    expect(OVERVIEW_JSON_SCHEMA).toMatchObject({
      type: 'object',
      properties: {
        summary: { type: 'string' },
        keyTopics: { type: 'array' },
        suggestedQuestions: { type: 'array' },
      },
    });
    expect(OVERVIEW_JSON_SCHEMA).not.toHaveProperty('$schema');
  });
});

describe('parseOverview', () => {
  it('reads the JSON the model returned', () => {
    const raw = JSON.stringify({
      summary: ' Kurz. ',
      keyTopics: ['A'],
      suggestedQuestions: ['Was?'],
    });

    expect(parseOverview(raw)).toEqual({
      summary: 'Kurz.',
      keyTopics: ['A'],
      suggestedQuestions: ['Was?'],
    });
  });

  it('throws when the model returned something that is not an overview', () => {
    expect(() => parseOverview('kein json')).toThrow();
    expect(() => parseOverview('{"summary":""}')).toThrow();
  });
});
