import { describe, expect, it } from 'vitest';

import { StatementStream } from './statement-stream';

const ANSWER = {
  statements: [
    { text: 'Erste Aussage.', chunkIds: ['c1'] },
    { text: 'Zweite mit } und { und ] und [ und \\" und \n Umbruch.', chunkIds: ['c2', 'c3'] },
    { text: 'Dritte Aussage mit Ümlauten und 😀.', chunkIds: ['c1'] },
  ],
  followUps: ['Und wie geht es weiter?', 'Wer ist noch dabei, [und } warum]?'],
};
const TEXT = JSON.stringify(ANSWER);

function collect(pieces: string[]) {
  const stream = new StatementStream();
  const emitted = pieces.flatMap((piece) => stream.push(piece));
  const { statements: rest, followUps } = stream.finish();
  return { emitted, rest, followUps };
}

describe('StatementStream', () => {
  it('emits every statement once, whatever the chunks look like', () => {
    for (let cut = 0; cut <= TEXT.length; cut += 1) {
      const { emitted, rest } = collect([TEXT.slice(0, cut), TEXT.slice(cut)]);

      expect([...emitted, ...rest]).toEqual(ANSWER.statements);
      expect(rest).toEqual([]);
    }
  });

  it('works when the text arrives one character at a time', () => {
    const { emitted, rest } = collect([...TEXT]);

    expect(emitted).toEqual(ANSWER.statements);
    expect(rest).toEqual([]);
  });

  it('holds a statement back until its closing brace has arrived', () => {
    const stream = new StatementStream();
    const firstEnd = TEXT.indexOf('"c1"]}') + '"c1"]'.length;

    expect(stream.push(TEXT.slice(0, firstEnd))).toEqual([]);
    expect(stream.push('}')).toEqual([ANSWER.statements[0]]);
  });

  it('reads pretty-printed JSON', () => {
    const { emitted } = collect([JSON.stringify(ANSWER, null, 2)]);

    expect(emitted).toEqual(ANSWER.statements);
  });

  it('accepts an answer without statements', () => {
    const { emitted, rest, followUps } = collect(['{"statements": [], "followUps": []}']);

    expect([...emitted, ...rest]).toEqual([]);
    expect(followUps).toEqual([]);
  });

  it('hands out the questions that follow once the answer is complete', () => {
    for (let cut = 0; cut <= TEXT.length; cut += 7) {
      const { followUps } = collect([TEXT.slice(0, cut), TEXT.slice(cut)]);

      expect(followUps).toEqual(ANSWER.followUps);
    }
  });

  it('does not take a question for a statement, wherever the questions stand in the answer', () => {
    const first = JSON.stringify({ followUps: ANSWER.followUps, statements: ANSWER.statements });
    const { emitted, rest, followUps } = collect([first]);

    expect([...emitted, ...rest]).toEqual(ANSWER.statements);
    expect(followUps).toEqual(ANSWER.followUps);
  });

  it('does not take an object inside a statement for the end of the statement', () => {
    const text =
      '{"statements":[{"text":"a","chunkIds":["c1"],"meta":{"k":{"x":1}}}],"followUps":[]}';
    const stream = new StatementStream();
    const innerEnd = text.indexOf('}}') + 1;

    expect(stream.push(text.slice(0, innerEnd))).toEqual([]);
    expect(stream.push(text.slice(innerEnd))).toEqual([{ text: 'a', chunkIds: ['c1'] }]);
  });

  it('does not take an array of arrays for a statement, and the contract check rejects it', () => {
    const stream = new StatementStream();

    expect(stream.push('{"statements":[[{"text":"a","chunkIds":[]}]],"followUps":[]}')).toEqual([]);
    expect(() => stream.finish()).toThrow();
  });

  it('ends a string at its closing quote, also when it is empty, the very first one, or ends in a backslash', () => {
    const text = JSON.stringify({
      '': '',
      statements: [{ text: 'Ende mit Backslash \\', chunkIds: [] }],
      followUps: [],
    });
    const { emitted, rest } = collect([...text]);

    expect(emitted).toEqual([{ text: 'Ende mit Backslash \\', chunkIds: [] }]);
    expect(rest).toEqual([]);
  });

  it('throws at the end when the model left out the questions', () => {
    const stream = new StatementStream();
    stream.push('{"statements": []}');

    expect(() => stream.finish()).toThrow();
  });

  it('throws at the end when the JSON was cut off', () => {
    const stream = new StatementStream();
    stream.push(TEXT.slice(0, TEXT.length - 5));

    expect(() => stream.finish()).toThrow();
  });

  it('throws at the end when the answer does not match the contract', () => {
    const stream = new StatementStream();
    stream.push('{"antwort": "kein Vertrag"}');

    expect(() => stream.finish()).toThrow();
  });

  it('throws as soon as a completed statement is not valid', () => {
    const stream = new StatementStream();

    expect(() => stream.push('{"statements":[{"text":"","chunkIds":["c1"]}]}')).toThrow();
    expect(() => new StatementStream().push('{"statements":[{"text":"x"}]}')).toThrow();
  });
});
