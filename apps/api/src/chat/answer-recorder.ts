import { type AnswerStatement, type AnswerTrace, CHAT_EVENT, type ChatEvent } from '@nlm/shared';

type Save = (
  statements: AnswerStatement[],
  followUps: string[],
  trace: AnswerTrace | null
) => Promise<void>;

/**
 * Keeps what an answer said while it streams, so it can be saved once: the statements, the questions
 * to ask next and how the answer came about. An answer is saved before its last event goes out, so
 * the client can read it back at once; one with no statements is saved only if the model finished
 * (it found nothing to say).
 */
export class AnswerRecorder {
  private readonly statements: AnswerStatement[] = [];
  private followUps: string[] = [];
  private trace: AnswerTrace | null = null;
  private saved = false;

  constructor(private readonly save: Save) {}

  /** Takes note of what an event carries. */
  note(event: ChatEvent): void {
    if (event.type === CHAT_EVENT.STATEMENT) {
      this.statements.push({ text: event.text, chunkIds: event.chunkIds });
    } else if (event.type === CHAT_EVENT.DONE) {
      this.followUps = event.followUps;
      this.trace = {
        sourcesSearched: event.sourcesSearched,
        passagesFound: event.passagesFound,
        droppedStatements: event.droppedStatements,
        strippedCitations: event.strippedCitations,
      };
    }
  }

  /** Saves the answer, once. `finished` is true when the model ended normally. */
  async saveOnce(finished: boolean): Promise<void> {
    if (this.saved || (!finished && this.statements.length === 0)) return;
    this.saved = true;
    await this.save(this.statements, this.followUps, this.trace);
  }
}
