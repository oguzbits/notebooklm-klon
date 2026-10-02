import { PgBoss } from 'pg-boss';

export const QUEUE = {
  INGEST: 'ingest-source',
} as const;

// A failed job is not retried by the queue: the ingestion job deletes the upload bytes when it
// finishes, so a retry could not run. The user retries a failed source from the UI instead.
const NO_RETRIES = 0;
const POLL_SECONDS = 1;

export interface JobQueueOptions {
  /** Called for queue-internal errors (lost connection and similar). */
  onError: (error: Error) => void;
}

export interface JobQueue {
  enqueue: (sourceId: string) => Promise<void>;
  /** Registers the worker for ingestion jobs. A handler that throws marks the job as failed. */
  work: (handler: (payload: unknown) => Promise<void>) => Promise<void>;
  /** Lets the running job finish for up to `waitMs`, then closes the queue. */
  stop: (waitMs: number) => Promise<void>;
}

/** The ingestion job queue, stored in the same PostgreSQL database. */
export async function createJobQueue(
  connectionString: string,
  options: JobQueueOptions
): Promise<JobQueue> {
  const boss = new PgBoss(connectionString);
  boss.on('error', options.onError);
  await boss.start();
  await boss.createQueue(QUEUE.INGEST);

  return {
    async enqueue(sourceId) {
      const id = await boss.send(QUEUE.INGEST, { sourceId }, { retryLimit: NO_RETRIES });
      if (id === null) throw new Error('The job queue did not accept the job.');
    },
    async work(handler) {
      await boss.work(QUEUE.INGEST, { pollingIntervalSeconds: POLL_SECONDS }, async (jobs) => {
        for (const job of jobs) await handler(job.data);
      });
    },
    async stop(waitMs) {
      await boss.stop({ graceful: true, timeout: waitMs });
    },
  };
}
