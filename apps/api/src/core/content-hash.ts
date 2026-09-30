import { createHash } from 'node:crypto';

/**
 * Identifies a source by its content: SHA-256 of the raw bytes as lower-case hex. Together with the
 * user ID it is the key that keeps the same content from being parsed or embedded twice.
 */
export function hashContent(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex');
}
