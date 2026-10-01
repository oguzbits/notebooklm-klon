import {
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  NoSuchKey,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import type { ObjectStore } from './object-store';

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** The ports of the object store on any S3-compatible service (path-style addresses, as they all accept). */
export function createS3ObjectStore(
  config: S3Config
): ObjectStore & { ensureBucket: () => Promise<void> } {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  const Bucket = config.bucket;

  return {
    /** Makes the bucket if it is not there yet. Called once when the server starts. */
    async ensureBucket() {
      try {
        await client.send(new HeadBucketCommand({ Bucket }));
      } catch (error) {
        if (!(error instanceof NotFound)) throw error;
        await client.send(new CreateBucketCommand({ Bucket }));
      }
    },

    async put(key, object) {
      await client.send(
        new PutObjectCommand({
          Bucket,
          Key: key,
          Body: object.bytes,
          ContentType: object.contentType,
        })
      );
    },

    async get(key) {
      try {
        const response = await client.send(new GetObjectCommand({ Bucket, Key: key }));
        if (!response.Body) throw new Error('The object store returned no body.');
        return {
          bytes: await response.Body.transformToByteArray(),
          contentType: response.ContentType ?? 'application/octet-stream',
        };
      } catch (error) {
        if (error instanceof NoSuchKey) return null;
        throw error;
      }
    },

    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },

    async removePrefix(prefix) {
      let token: string | undefined;
      do {
        const page = await client.send(
          new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken: token })
        );
        const keys = (page.Contents ?? []).flatMap((entry) =>
          entry.Key ? [{ Key: entry.Key }] : []
        );
        if (keys.length > 0) {
          await client.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys } }));
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
    },
  };
}
