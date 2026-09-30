import type { SourceOverview } from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import type { ChatInput } from '../ai/gemini-chat';
import { getOrCreateOverview, type OverviewPorts } from './overview';

const OVERVIEW: SourceOverview = {
  summary: 'Es geht um Nordlicht.',
  keyTopics: ['Polarlicht'],
  suggestedQuestions: ['Wer leitet es?'],
};
const INPUT = { userId: 'u', notebookId: 'n', sourceId: 's' };

function setup(stored: SourceOverview | null, reply = JSON.stringify(OVERVIEW)) {
  const saved: SourceOverview[] = [];
  const modelInputs: ChatInput[] = [];
  const ports: OverviewPorts = {
    find: async () => ({
      title: 'projekt.pdf',
      text: 'Dr. Brandt leitet Nordlicht.',
      overview: stored,
    }),
    save: async (_userId, _sourceId, overview) => {
      saved.push(overview);
    },
    stream: async function* (input) {
      modelInputs.push(input);
      yield reply.slice(0, 10);
      yield reply.slice(10);
    },
  };
  return { ports, saved, modelInputs };
}

describe('getOrCreateOverview', () => {
  it('returns the stored overview without calling the model', async () => {
    const { ports, modelInputs } = setup(OVERVIEW);

    expect(await getOrCreateOverview(INPUT, ports)).toEqual(OVERVIEW);
    expect(modelInputs).toEqual([]);
  });

  it('asks the model once for a source without an overview, and saves the result', async () => {
    const { ports, saved, modelInputs } = setup(null);

    expect(await getOrCreateOverview(INPUT, ports)).toEqual(OVERVIEW);

    expect(saved).toEqual([OVERVIEW]);
    expect(modelInputs).toHaveLength(1);
    expect(modelInputs[0]?.user).toContain('Dr. Brandt leitet Nordlicht.');
  });

  it('returns null when the source is not available to the user', async () => {
    const { ports, modelInputs } = setup(null);
    ports.find = async () => null;

    expect(await getOrCreateOverview(INPUT, ports)).toBeNull();
    expect(modelInputs).toEqual([]);
  });

  it('saves nothing when the model returns something that is not an overview', async () => {
    const { ports, saved } = setup(null, '{"summary":""}');

    await expect(getOrCreateOverview(INPUT, ports)).rejects.toThrow();
    expect(saved).toEqual([]);
  });
});
