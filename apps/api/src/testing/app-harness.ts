import { EMBEDDING_DIMENSIONS } from '@nlm/shared';

import type { ChatInput } from '../ai/gemini-chat';
import type { AppDeps } from '../app-deps';
import { createAuth } from '../auth/auth';
import { REWRITE_SYSTEM_PROMPT } from '../core/chat-history';
import { createSourceStorage, createUploadStorage } from '../db/source-storage';
import { axisVector, createTestDb } from '../db/testing/test-db';
import type { FetchDeps } from '../import/fetch-url';
import { runIngestJob } from '../ingestion/submit';
import type { WebSearch } from '../search/tavily-search';
import type { ObjectStore } from '../storage/object-store';

export const BASE_URL = 'http://localhost:3000';
export const DEMO_OWNER_EMAIL = 'demo@example.test';
export const SECRET = 'a-test-secret-with-at-least-32-characters';

const noNetwork: FetchDeps = {
  lookup: async () => {
    throw new Error('no network in tests');
  },
  request: async () => {
    throw new Error('no network in tests');
  },
};

interface HarnessOptions {
  fetch?: FetchDeps;
  /** The web search the app gets; none by default. */
  webSearch?: WebSearch;
  /** The object store for cover images; none by default. */
  objectStore?: ObjectStore;
  /** Replaces the model: gets what the app would send and streams text back. */
  model?: (input: ChatInput) => AsyncIterable<string>;
  embedQuery?: (text: string) => Promise<number[]>;
}

/**
 * The real app on the real test database, with everything that leaves the process replaced: the
 * network, the job queue (jobs are recorded and run on demand), the embedding and the model.
 */
export function createHarness(options: HarnessOptions = {}) {
  const { db, pool } = createTestDb();
  const auth = createAuth(db, {
    secret: SECRET,
    baseURL: BASE_URL,
    objectStore: options.objectStore,
  });
  const enqueued: string[] = [];
  const modelInputs: ChatInput[] = [];
  const errors: unknown[] = [];

  const deps: AppDeps = {
    auth,
    db,
    ingest: {
      sources: createSourceStorage(db, { enforceQuota: true }),
      uploads: createUploadStorage(db),
      queue: {
        enqueue: async (sourceId) => {
          enqueued.push(sourceId);
        },
      },
      // Text files only: the job decodes the bytes. Every chunk gets the same test vector.
      parse: async (_kind, bytes) => ({ text: new TextDecoder().decode(bytes), pageCount: null }),
      embed: async (texts) => texts.map(() => axisVector(0, EMBEDDING_DIMENSIONS)),
    },
    demoOwnerEmail: DEMO_OWNER_EMAIL,
    fetch: options.fetch ?? noNetwork,
    webSearch: options.webSearch ?? null,
    objectStore: options.objectStore ?? null,
    chat: {
      embedQuery: options.embedQuery ?? (async () => axisVector(0, EMBEDDING_DIMENSIONS)),
      stream:
        options.model ??
        async function* (input) {
          modelInputs.push(input);
          if (input.system === REWRITE_SYSTEM_PROMPT) {
            yield '{"query":"Umformulierte Frage"}';
            return;
          }
          yield '{"statements":[{"text":"Antwort.","chunkIds":["c1"]}],"followUps":["Und was noch?"]}';
        },
      onError: (error) => {
        errors.push(error);
      },
    },
  };

  /** Runs the jobs that were queued so far, like the worker would. */
  async function runJobs(): Promise<void> {
    const ids = enqueued.splice(0);
    for (const sourceId of ids) await runIngestJob({ sourceId }, deps.ingest);
  }

  return { deps, db, pool, auth, enqueued, modelInputs, errors, runJobs };
}
