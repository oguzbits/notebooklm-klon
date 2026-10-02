export interface ShutdownSteps {
  /** Stops accepting connections and waits for the open ones. */
  closeServer: () => Promise<void>;
  /** Lets the running ingestion job finish, then closes the queue. */
  stopQueue: () => Promise<void>;
}

/**
 * The handler for SIGTERM (a deploy or a restart): no new requests, then the running job gets time to
 * finish. Without it a job in progress is cut off and its source stays PROCESSING.
 */
export function createShutdown({ closeServer, stopQueue }: ShutdownSteps): () => Promise<void> {
  let running: Promise<void> | null = null;
  return () => {
    running ??= (async () => {
      try {
        await closeServer();
      } finally {
        await stopQueue();
      }
    })();
    return running;
  };
}
