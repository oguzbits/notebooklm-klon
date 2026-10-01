import type { S3Config } from './s3-object-store';

const DEFAULT_REGION = 'us-east-1';
export interface S3Env {
  S3_ENDPOINT?: string | undefined;
  S3_REGION?: string | undefined;
  S3_BUCKET?: string | undefined;
  S3_ACCESS_KEY_ID?: string | undefined;
  S3_SECRET_ACCESS_KEY?: string | undefined;
}

const REQUIRED = ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const;

/**
 * The object store from the environment: null when none of its variables is set (cover images are
 * then not offered), the configuration when all are, and an error naming the missing ones when
 * only some are. The values come from `config/env.ts`, the only place that reads the environment.
 */
export function s3ConfigFromEnv(raw: S3Env): S3Config | null {
  const given = REQUIRED.filter((name) => (raw[name] ?? '').trim() !== '');
  if (given.length === 0) return null;
  const missing = REQUIRED.filter((name) => !given.includes(name));
  if (missing.length > 0) {
    throw new Error(`Incomplete object store configuration, missing: ${missing.join(', ')}.`);
  }
  return {
    endpoint: raw.S3_ENDPOINT as string,
    region: raw.S3_REGION?.trim() || DEFAULT_REGION,
    bucket: raw.S3_BUCKET as string,
    accessKeyId: raw.S3_ACCESS_KEY_ID as string,
    secretAccessKey: raw.S3_SECRET_ACCESS_KEY as string,
  };
}
