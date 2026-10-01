import { describe, expect, it } from 'vitest';

import { s3ConfigFromEnv } from './s3-config';

const ALL = {
  S3_ENDPOINT: 'http://localhost:8333',
  S3_BUCKET: 'nlm',
  S3_ACCESS_KEY_ID: 'id',
  S3_SECRET_ACCESS_KEY: 'secret',
};

describe('s3ConfigFromEnv', () => {
  it('is null when nothing is set, so cover images are not offered', () => {
    expect(s3ConfigFromEnv({})).toBeNull();
  });

  it('reads all five values, with a default region', () => {
    expect(s3ConfigFromEnv(ALL)).toEqual({
      endpoint: 'http://localhost:8333',
      region: 'us-east-1',
      bucket: 'nlm',
      accessKeyId: 'id',
      secretAccessKey: 'secret',
    });
    expect(s3ConfigFromEnv({ ...ALL, S3_REGION: 'eu-central-1' })?.region).toBe('eu-central-1');
  });

  it('refuses a half set configuration and names what is missing, never a value', () => {
    expect(() => s3ConfigFromEnv({ S3_ENDPOINT: ALL.S3_ENDPOINT })).toThrow(
      /S3_BUCKET.*S3_ACCESS_KEY_ID.*S3_SECRET_ACCESS_KEY/s
    );
    expect(() => s3ConfigFromEnv({ ...ALL, S3_SECRET_ACCESS_KEY: undefined })).toThrow(
      /S3_SECRET_ACCESS_KEY/
    );
    try {
      s3ConfigFromEnv({ S3_ENDPOINT: 'http://geheim-host:1' });
    } catch (error) {
      expect(String(error)).not.toContain('geheim-host');
    }
  });
});
