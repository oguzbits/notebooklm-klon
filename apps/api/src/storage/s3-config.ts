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
  const {
    S3_ENDPOINT: endpoint,
    S3_BUCKET: bucket,
    S3_ACCESS_KEY_ID: accessKeyId,
    S3_SECRET_ACCESS_KEY: secretAccessKey,
  } = raw;
  if (isSet(endpoint) && isSet(bucket) && isSet(accessKeyId) && isSet(secretAccessKey)) {
    return {
      endpoint,
      region: raw.S3_REGION?.trim() || DEFAULT_REGION,
      bucket,
      accessKeyId,
      secretAccessKey,
    };
  }
  const missing = REQUIRED.filter((name) => !isSet(raw[name]));
  if (missing.length === REQUIRED.length) return null;
  throw new Error(`Incomplete object store configuration, missing: ${missing.join(', ')}.`);
}

function isSet(value: string | undefined): value is string {
  return (value ?? '').trim() !== '';
}
