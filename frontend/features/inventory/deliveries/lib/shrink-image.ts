import { PHOTO_MAX_BYTES } from '../../dispatch/_shared/types/dispatch-contract';

const LONG_SIDE = 1600;
const SHRINK_ABOVE_BYTES = 1_000_000;

/**
 * A phone photo is often 4 to 8 MB. Above 1 MB it is redrawn with its long side at 1600 px as a JPEG, which keeps it readable and
 * well under the 5 MB limit. A file the browser cannot decode, or one that is still too big, is returned untouched and the caller
 * shows "That photo is over 5 MB." when it is.
 */
export async function shrinkImage(file: File): Promise<File> {
  if (file.size <= SHRINK_ABOVE_BYTES || !file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, LONG_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export const isTooLarge = (file: File): boolean => file.size > PHOTO_MAX_BYTES;
