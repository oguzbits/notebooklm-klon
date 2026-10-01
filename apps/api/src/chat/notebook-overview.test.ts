import type { NotebookOverview } from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import type { ChatInput } from '../ai/gemini-chat';
import {
  NOTEBOOK_OVERVIEW_JSON_SCHEMA,
  NOTEBOOK_OVERVIEW_SYSTEM_PROMPT,
  notebookOverviewKey,
} from '../core/notebook-overview-prompt';
import type {
  NotebookOverviewSource,
  StoredNotebookOverview,
} from '../db/notebook-overview-repository';
import { getOrCreateNotebookOverview, type NotebookOverviewPorts } from './notebook-overview';

const INPUT = { userId: 'u', notebookId: 'n' };
const OVERVIEW: NotebookOverview = { emoji: '🔬', summary: 'Es geht um **Nordlicht**.' };
const REPLY = JSON.stringify(OVERVIEW);
const projekt: NotebookOverviewSource = {
  id: '3f0f4a4e-6c1e-4a52-9a53-0d6d1c6f2a10',
  title: 'projekt.pdf',
  text: 'Dr. Brandt leitet Nordlicht.',
};
const budget: NotebookOverviewSource = {
  id: '9b2c7d6e-1f43-4c8a-8a3b-5e7a8f0c1d22',
  title: 'budget.txt',
  text: 'Das Budget beträgt 1,25 Mio. Euro.',
};

function setup(
  options: {
    sources?: NotebookOverviewSource[];
    stored?: StoredNotebookOverview | null;
    reply?: string;
    customSummary?: string | null;
    found?: boolean;
  } = {}
) {
  const {
    sources = [projekt],
    stored = null,
    reply = REPLY,
    customSummary = null,
    found = true,
  } = options;
  const saved: { overview: NotebookOverview; key: string }[] = [];
  const modelInputs: ChatInput[] = [];
  const asked: { userId: string; notebookId: string }[] = [];
  const ports: NotebookOverviewPorts = {
    find: async (userId, notebookId) => {
      asked.push({ userId, notebookId });
      return found ? { sources, stored, customSummary } : null;
    },
    save: async (_userId, _notebookId, overview, key) => {
      saved.push({ overview, key });
    },
    stream: async function* (input) {
      modelInputs.push(input);
      yield reply.slice(0, 12);
      yield reply.slice(12);
    },
  };
  return { ports, saved, modelInputs, asked };
}

describe('getOrCreateNotebookOverview', () => {
  it('asks the model once for a notebook without an overview, and saves it with the key of its sources', async () => {
    const { ports, saved, modelInputs } = setup();

    expect(await getOrCreateNotebookOverview(INPUT, ports)).toEqual({ overview: OVERVIEW });

    expect(saved).toEqual([{ overview: OVERVIEW, key: notebookOverviewKey([projekt.id]) }]);
    expect(modelInputs).toHaveLength(1);
    expect(modelInputs[0]?.system).toBe(NOTEBOOK_OVERVIEW_SYSTEM_PROMPT);
    expect(modelInputs[0]?.schema).toBe(NOTEBOOK_OVERVIEW_JSON_SCHEMA);
    expect(modelInputs[0]?.user).toContain('projekt.pdf');
    expect(modelInputs[0]?.user).toContain('Dr. Brandt leitet Nordlicht.');
  });

  describe('with a summary the user wrote', () => {
    const MINE = 'Meine eigene **Zusammenfassung**.';
    const key = notebookOverviewKey([projekt.id]);

    it('shows it instead of the summary of the model, with the symbol that was chosen, and asks no model', async () => {
      const stored = { overview: OVERVIEW, key };
      const { ports, saved, modelInputs } = setup({ stored, customSummary: MINE });

      expect(await getOrCreateNotebookOverview(INPUT, ports)).toEqual({
        overview: { emoji: '🔬', summary: MINE },
      });
      expect(modelInputs).toHaveLength(0);
      expect(saved).toHaveLength(0);
    });

    it('does not make a new summary when the sources changed', async () => {
      const stored = { overview: OVERVIEW, key: 'older-key' };
      const { ports, modelInputs } = setup({ stored, customSummary: MINE });

      await getOrCreateNotebookOverview(INPUT, ports);

      expect(modelInputs).toHaveLength(0);
    });

    it('makes the overview once when there is none yet, for the symbol, and shows the own summary', async () => {
      const { ports, saved, modelInputs } = setup({ customSummary: MINE });

      expect(await getOrCreateNotebookOverview(INPUT, ports)).toEqual({
        overview: { emoji: '🔬', summary: MINE },
      });
      expect(modelInputs).toHaveLength(1);
      // The summary of the model is kept: it is shown again when the own one is taken back.
      expect(saved).toEqual([{ overview: OVERVIEW, key }]);
    });
  });

  it('reads the notebook of the user from the session, never from the request', async () => {
    const { ports, asked } = setup();

    await getOrCreateNotebookOverview({ userId: 'alice', notebookId: 'nb-1' }, ports);

    expect(asked).toEqual([{ userId: 'alice', notebookId: 'nb-1' }]);
  });

  it('returns the stored overview without the model while the sources are the same', async () => {
    const stored = { overview: OVERVIEW, key: notebookOverviewKey([projekt.id]) };
    const { ports, saved, modelInputs } = setup({ stored });

    expect(await getOrCreateNotebookOverview(INPUT, ports)).toEqual({ overview: OVERVIEW });

    expect(modelInputs).toEqual([]);
    expect(saved).toEqual([]);
  });

  it('makes the overview again when a source was added, and keeps the symbol it had', async () => {
    const stored = { overview: OVERVIEW, key: notebookOverviewKey([projekt.id]) };
    const newer = { emoji: '🧠', summary: 'Jetzt mit **Budget**.' };
    const { ports, saved, modelInputs } = setup({
      sources: [projekt, budget],
      stored,
      reply: JSON.stringify(newer),
    });

    const result = await getOrCreateNotebookOverview(INPUT, ports);

    expect(modelInputs).toHaveLength(1);
    expect(modelInputs[0]?.user).toContain('budget.txt');
    expect(result).toEqual({ overview: { emoji: '🔬', summary: 'Jetzt mit **Budget**.' } });
    expect(saved).toEqual([
      { overview: result?.overview, key: notebookOverviewKey([projekt.id, budget.id]) },
    ]);
  });

  it('makes the overview again when a source was removed', async () => {
    const stored = { overview: OVERVIEW, key: notebookOverviewKey([projekt.id, budget.id]) };
    const { ports, modelInputs } = setup({ sources: [budget], stored });

    await getOrCreateNotebookOverview(INPUT, ports);

    expect(modelInputs).toHaveLength(1);
    expect(modelInputs[0]?.user).not.toContain('projekt.pdf');
  });

  it('says there is nothing to describe while no source is ready, and does not call the model', async () => {
    const stored = { overview: OVERVIEW, key: notebookOverviewKey([projekt.id]) };
    const { ports, saved, modelInputs } = setup({ sources: [], stored });

    expect(await getOrCreateNotebookOverview(INPUT, ports)).toEqual({ overview: null });

    expect(modelInputs).toEqual([]);
    expect(saved).toEqual([]);
  });

  it('returns null when the notebook is not the user’s', async () => {
    const { ports, modelInputs } = setup({ found: false });

    expect(await getOrCreateNotebookOverview(INPUT, ports)).toBeNull();
    expect(modelInputs).toEqual([]);
  });

  it('saves nothing when the model returns something that is not an overview', async () => {
    for (const reply of [
      '{"emoji":"Roboter","summary":"Text."}',
      '{"emoji":"🤖","summary":""}',
      'kein json',
    ]) {
      const { ports, saved } = setup({ reply });

      await expect(getOrCreateNotebookOverview(INPUT, ports)).rejects.toThrow();
      expect(saved).toEqual([]);
    }
  });
});
