import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSaveQueue, SAVE_STATE, type SaveEvent } from '@/lib/save-queue';

const DELAY = 800;

/** A write the test finishes by hand, so it can stay open while the reader keeps typing. */
function openWrite() {
  const calls: { text: string; done: () => void; fail: (error: Error) => void }[] = [];
  const write = vi.fn(
    (text: string) =>
      new Promise<void>((resolve, reject) => {
        calls.push({ text, done: resolve, fail: reject });
      })
  );
  return { write, calls };
}

function setup() {
  const events: SaveEvent[] = [];
  const { write, calls } = openWrite();
  const queue = createSaveQueue({ delayMs: DELAY, write, onChange: (event) => events.push(event) });
  const states = () => events.map((event) => event.state);
  return { queue, write, calls, events, states };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('save queue', () => {
  it('waits for a pause and then saves only the latest text, once', async () => {
    const { queue, write, calls, states } = setup();

    queue.push('a');
    await vi.advanceTimersByTimeAsync(DELAY - 1);
    queue.push('ab');
    await vi.advanceTimersByTimeAsync(DELAY - 1);
    expect(write).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('ab');
    calls[0]?.done();
    await vi.advanceTimersByTimeAsync(0);

    expect(states()).toEqual([SAVE_STATE.SAVING, SAVE_STATE.SAVED]);
  });

  it('keeps one save open at a time and saves what was typed meanwhile afterwards', async () => {
    const { queue, write, calls } = setup();
    queue.push('eins');
    await vi.advanceTimersByTimeAsync(DELAY);

    queue.push('eins zwei');
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(write).toHaveBeenCalledTimes(1);

    calls[0]?.done();
    await vi.advanceTimersByTimeAsync(0);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenLastCalledWith('eins zwei');
  });

  it('says so when a save fails, and sends the same text again on a retry', async () => {
    const { queue, write, calls, events, states } = setup();
    queue.push('wichtig');
    await vi.advanceTimersByTimeAsync(DELAY);

    const failure = new Error('offline');
    calls[0]?.fail(failure);
    await vi.advanceTimersByTimeAsync(0);
    expect(events.at(-1)).toEqual({ state: SAVE_STATE.FAILED, error: failure });

    void queue.flush();
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenLastCalledWith('wichtig');
    calls[1]?.done();
    await vi.advanceTimersByTimeAsync(0);
    expect(states().at(-1)).toBe(SAVE_STATE.SAVED);
  });

  it('prefers what was typed after a failed save to the text that failed', async () => {
    const { queue, write, calls } = setup();
    queue.push('alt');
    await vi.advanceTimersByTimeAsync(DELAY);
    queue.push('neu');

    calls[0]?.fail(new Error('offline'));
    await vi.advanceTimersByTimeAsync(0);
    void queue.flush();

    expect(write).toHaveBeenLastCalledWith('neu');
  });

  it('saves at once on flush, for when the note is closed', async () => {
    const { queue, write } = setup();
    queue.push('halb fertig');

    void queue.flush();

    expect(write).toHaveBeenCalledWith('halb fertig');
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('does nothing on flush when nothing was typed', async () => {
    const { queue, write, events } = setup();

    await queue.flush();

    expect(write).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('saves an emptied note too, an empty text is a text', async () => {
    const { queue, write } = setup();

    queue.push('');
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(write).toHaveBeenCalledWith('');
  });
});
