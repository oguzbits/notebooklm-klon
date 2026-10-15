/** The user has as many notebooks as allowed. */
export class NotebookLimitReachedError extends Error {
  constructor() {
    super('The limit of notebooks per user is reached.');
    this.name = 'NotebookLimitReachedError';
  }
}

/** The notebook has as many sources as allowed. */
export class SourceLimitReachedError extends Error {
  constructor() {
    super('The limit of sources per notebook is reached.');
    this.name = 'SourceLimitReachedError';
  }
}
