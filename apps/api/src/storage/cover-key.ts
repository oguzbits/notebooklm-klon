/** Where the cover image of a notebook lives in the object store. The user comes first, so all files of a user share a prefix. */
export const coverKey = (userId: string, notebookId: string, version: string) =>
  `covers/${userId}/${notebookId}/${version}`;

/** The prefix of every file of one user. */
export const userCoverPrefix = (userId: string) => `covers/${userId}/`;
