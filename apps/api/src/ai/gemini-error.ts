/** A failed provider call. The message has the status and the provider's reason, never our input. */
export class GeminiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}
