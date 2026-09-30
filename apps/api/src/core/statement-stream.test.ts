import { describe, expect, it } from 'vitest';

import { StatementStream } from './statement-stream';

const ANSWER = {
  statements: [
    { text: 'Erste Aussage.', chunkIds: ['c1'] },
    { text: 'Zweite mit } und { und ] und [ und \\" und \n Umbruch.', chunkIds: ['c2', 'c3'] },
    { text: 'Dritte Aussage mit Ümlauten und 😀.', chunkIds: ['c1'] },
  ],
};
const TEXT = JSON.stringify(ANSWER);

function collect(pieces: string[]) {
  const stream = new StatementStream();
  const emitted = pieces.flatMap((piece) => stream.push(piece));
  return { emitted, rest: stream.finish() };
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
    const { emitted, rest } = collect(['{"statements": []}']);

    expect([...emitted, ...rest]).toEqual([]);
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
