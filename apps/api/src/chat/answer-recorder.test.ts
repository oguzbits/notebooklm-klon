import { CHAT_EVENT, type ChatEvent } from '@nlm/shared';
import { describe, expect, it, vi } from 'vitest';

import { AnswerRecorder } from './answer-recorder';

const statement: ChatEvent = { type: CHAT_EVENT.STATEMENT, text: 'Aussage.', chunkIds: ['c1'] };
const done: ChatEvent = {
  type: CHAT_EVENT.DONE,
  statements: 1,
  sourcesSearched: 2,
  passagesFound: 5,
  droppedStatements: 0,
  strippedCitations: 1,
  followUps: ['Und dann?'],
};

describe('AnswerRecorder', () => {
  it('saves the statements, the follow-ups and the trace once', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const recorder = new AnswerRecorder(save);

    recorder.note(statement);
    recorder.note(done);
    await recorder.saveOnce(true);
    await recorder.saveOnce(false);

    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith([{ text: 'Aussage.', chunkIds: ['c1'] }], ['Und dann?'], {
      sourcesSearched: 2,
      passagesFound: 5,
      droppedStatements: 0,
      strippedCitations: 1,
    });
  });

  it('keeps what a client saw when it left midway, but nothing when there was nothing', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const empty = new AnswerRecorder(save);
    await empty.saveOnce(false);
    expect(save).not.toHaveBeenCalled();

    const partial = new AnswerRecorder(save);
    partial.note(statement);
    await partial.saveOnce(false);
    expect(save).toHaveBeenCalledWith([{ text: 'Aussage.', chunkIds: ['c1'] }], [], null);
  });

  it('saves an answer with no statements when the model finished, because it found nothing', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const recorder = new AnswerRecorder(save);

    await recorder.saveOnce(true);

    expect(save).toHaveBeenCalledWith([], [], null);
  });
});
