import { type AnswerStatement, AnswerStatementSchema, ChatReplySchema } from '@nlm/shared';

// {  "statements" [  { statement }  ]  }   -> a statement object opens at depth 3
// The questions that follow, {"followUps": ["..."]}, hold no object, so they are never mistaken for one.
const STATEMENT_DEPTH = 3;
const QUOTE = '"';
const BACKSLASH = '\\';

/**
 * Turns the streamed JSON of an answer, `{"statements":[{...},{...}],"followUps":[...]}`, into finished statements as
 * soon as each object is complete, so the UI can show an answer while the model still writes. Any
 * malformed statement, and an answer that is cut off or breaks the contract, is an error: partial
 * text must never be shown as a complete answer.
 */
export class StatementStream {
  private text = '';
  private scanned = 0;
  private depth = 0;
  private inString = false;
  private escaped = false;
  private statementStart = -1;
  private emitted = 0;

  /** Feeds the next piece of text and returns the statements that just became complete. */
  push(piece: string): AnswerStatement[] {
    this.text += piece;
    const done: AnswerStatement[] = [];

    for (; this.scanned < this.text.length; this.scanned += 1) {
      const char = this.text.charAt(this.scanned);
      if (this.inString) {
        if (this.escaped) this.escaped = false;
        else if (char === BACKSLASH) this.escaped = true;
        else if (char === QUOTE) this.inString = false;
        continue;
      }
      if (char === QUOTE) {
        this.inString = true;
      } else if (char === '{' || char === '[') {
        this.depth += 1;
        if (char === '{' && this.depth === STATEMENT_DEPTH) this.statementStart = this.scanned;
      } else if (char === '}' || char === ']') {
        if (char === '}' && this.depth === STATEMENT_DEPTH && this.statementStart >= 0) {
          const raw = this.text.slice(this.statementStart, this.scanned + 1);
          done.push(AnswerStatementSchema.parse(JSON.parse(raw)));
          this.emitted += 1;
          this.statementStart = -1;
        }
        this.depth -= 1;
      }
    }
    return done;
  }

  /**
   * Call when the model is done. Checks the whole text against the reply contract and returns any
   * statement that was not emitted yet (none, when the stream was well formed) and the questions
   * the reader could ask next.
   */
  finish(): { statements: AnswerStatement[]; followUps: string[] } {
    const reply = ChatReplySchema.parse(JSON.parse(this.text));
    return { statements: reply.statements.slice(this.emitted), followUps: reply.followUps };
  }
}
