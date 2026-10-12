/**
 * Supplier documents — object storage behind a small interface.
 *
 * Production uses Cloudflare R2 (S3-compatible). Without the four R2 env vars,
 * non-production uses an in-memory fake (tests, local dev); production refuses
 * with 503 rather than silently keeping files in memory.
 */
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../../config/env';
import { ServiceUnavailableError } from '../../../utils/errors';

export interface SignedDownload {
  url: string;
  expiresAt: Date;
}

export interface DocumentStorage {
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  getSignedUrl(key: string, options: { expiresInSeconds: number; fileName: string }): Promise<SignedDownload>;
  deleteObject(key: string): Promise<void>;
  /** The stored bytes, or null when the object is gone (delivery photos are served through the API, not by a public link). */
  getObject(key: string): Promise<{ body: Buffer; contentType: string } | null>;
}

export class InMemoryDocumentStorage implements DocumentStorage {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();

  async getObject(key: string): Promise<{ body: Buffer; contentType: string } | null> {
    return this.objects.get(key) ?? null;
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    this.objects.set(key, { body, contentType });
  }

  async getSignedUrl(key: string, options: { expiresInSeconds: number; fileName: string }): Promise<SignedDownload> {
    const expiresAt = new Date(Date.now() + options.expiresInSeconds * 1000);
    return { url: `memory://${key}?expires=${expiresAt.getTime()}`, expiresAt };
  }

  async deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
  }
}

export class R2DocumentStorage implements DocumentStorage {
  private readonly client: S3Client;

  constructor(
    accountId: string,
    accessKeyId: string,
    secretAccessKey: string,
    private readonly bucket: string,
  ) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async getSignedUrl(key: string, options: { expiresInSeconds: number; fileName: string }): Promise<SignedDownload> {
    const safeName = options.fileName.replace(/["\\\r\n]/g, '_');
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${safeName}"`,
      }),
      { expiresIn: options.expiresInSeconds },
    );
    return { url, expiresAt: new Date(Date.now() + options.expiresInSeconds * 1000) };
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async getObject(key: string): Promise<{ body: Buffer; contentType: string } | null> {
    try {
      const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!out.Body) return null;
      return { body: Buffer.from(await out.Body.transformToByteArray()), contentType: out.ContentType ?? 'application/octet-stream' };
    } catch (error) {
      if (error instanceof Error && (error.name === 'NoSuchKey' || error.name === 'NotFound')) return null;
      throw error;
    }
  }
}

let cached: DocumentStorage | null = null;

/** Resolved lazily so tests can inject a fake via `setDocumentStorage`. */
export const getDocumentStorage = (): DocumentStorage => {
  if (cached) return cached;
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = env;
  if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET) {
    cached = new R2DocumentStorage(R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET);
  } else if (env.NODE_ENV === 'production') {
    throw new ServiceUnavailableError('Document storage is not configured', 'STORAGE_NOT_CONFIGURED');
  } else {
    cached = new InMemoryDocumentStorage();
  }
  return cached;
};

export const setDocumentStorage = (storage: DocumentStorage | null): void => {
  cached = storage;
};
