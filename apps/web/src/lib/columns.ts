/** The three columns of a notebook; below the wide layout one of them shows at a time. */
export const COLUMN = { SOURCES: 'SOURCES', CHAT: 'CHAT', STUDIO: 'STUDIO' } as const;
export type Column = (typeof COLUMN)[keyof typeof COLUMN];
