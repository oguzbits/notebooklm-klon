/**
 * What the reader shows: a whole source, or the passage a citation points to. `opened` counts the
 * clicks that opened it, so opening the same passage again scrolls back to it.
 */
export type ReaderTarget = ({ sourceId: string } | { chunkId: string }) & { opened?: number };
