import { describe, expect, it } from 'vitest';

import {
  parseTranslations,
  queryVariants,
  TRANSLATE_JSON_SCHEMA,
  TRANSLATE_SYSTEM_PROMPT,
} from './query-variants';

describe('parseTranslations', () => {
  it('reads the German and the English version out of the reply', () => {
    expect(
      parseTranslations('{"de":"Wer leitet das Projekt?","en":"Who leads the project?","parts":[]}')
    ).toEqual(['Wer leitet das Projekt?', 'Who leads the project?']);
  });

  it('adds one query for each part of a question that asks several things', () => {
    expect(
      parseTranslations(
        '{"de":"Wer leitet A und was kostet B?","en":"Who leads A and what does B cost?","parts":["Leitung A / lead of A","Kosten B / cost of B"]}'
      )
    ).toEqual([
      'Wer leitet A und was kostet B?',
      'Who leads A and what does B cost?',
      'Leitung A / lead of A',
      'Kosten B / cost of B',
    ]);
  });

  it('throws on more parts than the search can afford', () => {
    const parts = JSON.stringify(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(() => parseTranslations(`{"de":"x","en":"y","parts":${parts}}`)).toThrow();
  });

  it.each([
    ['kein json'],
    ['{"de":"nur deutsch"}'],
    ['{"de":"  ","en":"x","parts":[]}'],
    ['{"de":"a","en":"b"}'],
  ])('throws on a reply that is not the contract: %s', (reply) => {
    expect(() => parseTranslations(reply)).toThrow();
  });

  it('asks the provider for the two languages and the parts', () => {
    expect(TRANSLATE_JSON_SCHEMA).toMatchObject({ required: ['de', 'en', 'parts'] });
    expect(TRANSLATE_SYSTEM_PROMPT).toContain('German');
    expect(TRANSLATE_SYSTEM_PROMPT).toContain('English');
  });
});

describe('queryVariants', () => {
  it('puts the question first and adds each translation that says something else', () => {
    expect(
      queryVariants('Wer leitet das Projekt?', ['Wer leitet das Projekt?', 'Who leads it?'])
    ).toEqual(['Wer leitet das Projekt?', 'Who leads it?']);
  });

  it('treats case and punctuation as no difference', () => {
    expect(queryVariants('Who leads it?', ['who leads it', 'Who leads it!'])).toEqual([
      'Who leads it?',
    ]);
  });

  it('keeps the question when there is nothing to add', () => {
    expect(queryVariants('Budget 2018', [])).toEqual(['Budget 2018']);
  });
});
