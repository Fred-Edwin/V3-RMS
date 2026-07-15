import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';
import { logger } from './logger';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export function uploadImageBuffer(buffer: Buffer, folder: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: [{ fetch_format: 'auto', quality: 'auto' }],
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error('Cloudinary upload returned no result'));
          return;
        }
        resolve(result.secure_url);
      },
    );
    stream.end(buffer);
  });
}

/**
 * We only persist the Cloudinary `secure_url`, not the `public_id`, so
 * deletion has to recover it from the URL path: everything after the last
 * `/upload/v<version>/` segment, minus the file extension.
 */
function extractPublicId(fileUrl: string): string | null {
  const match = fileUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
  return match?.[1] ?? null;
}

/**
 * Best-effort delete: failures are logged, never thrown, so a Cloudinary
 * outage or an unparseable legacy URL never blocks the DB delete.
 */
export async function destroyUploadedFile(fileUrl: string): Promise<void> {
  const publicId = extractPublicId(fileUrl);
  if (!publicId) {
    logger.warn(`Cloudinary destroy skipped: could not parse public_id from ${fileUrl}`);
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (error) {
    logger.warn(`Cloudinary destroy failed for public_id ${publicId}: ${error}`);
  }
}
