import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createS3ObjectStore } from './s3-object-store';

// Needs the S3 container of `pnpm db:up` (docker/s3.json holds its throwaway credentials).
const store = createS3ObjectStore({
  endpoint: 'http://localhost:8333',
  region: 'us-east-1',
  // One fixed bucket: every bucket takes a volume of the small store, so a new one per run would fill it.
  bucket: 'nlm-store-test',
  accessKeyId: 'nlm-dev-access',
  secretAccessKey: 'nlm-dev-secret-not-real',
});
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

beforeAll(async () => {
  await store.ensureBucket();
  // Asking again is fine: the bucket is there.
  await store.ensureBucket();
});

afterAll(async () => {
  await store.removePrefix('');
});

describe('createS3ObjectStore', () => {
  it('stores a file with its type and reads it back', async () => {
    await store.put('covers/a/b', { bytes: PNG, contentType: 'image/png' });

    const found = await store.get('covers/a/b');

    expect(found?.contentType).toBe('image/png');
    expect([...(found?.bytes ?? [])]).toEqual([...PNG]);
  });

  it('answers null for a key that is not there', async () => {
    expect(await store.get('covers/gibt-es-nicht')).toBeNull();
  });

  it('removes one file', async () => {
    await store.put('covers/x/1', { bytes: PNG, contentType: 'image/png' });

    await store.remove('covers/x/1');

    expect(await store.get('covers/x/1')).toBeNull();
  });

  it('removes everything under a prefix and nothing else', async () => {
    await store.put('covers/user-1/a', { bytes: PNG, contentType: 'image/png' });
    await store.put('covers/user-1/b', { bytes: PNG, contentType: 'image/png' });
    await store.put('covers/user-2/a', { bytes: PNG, contentType: 'image/png' });

    await store.removePrefix('covers/user-1/');

    expect(await store.get('covers/user-1/a')).toBeNull();
    expect(await store.get('covers/user-1/b')).toBeNull();
    expect(await store.get('covers/user-2/a')).not.toBeNull();
  });
});
