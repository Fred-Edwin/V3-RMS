export const MAX_UPLOAD_MB = 10;

/** Why a chosen file cannot be sent, in a sentence; null when it can (or nothing is chosen yet). `accept` is the same list the box offers. */
export function fileProblem(file: Pick<File, 'size' | 'type' | 'name'> | null, accept: string): string | null {
  if (!file) return null;
  if (file.size > MAX_UPLOAD_MB * 1_000_000) return `That file is over ${MAX_UPLOAD_MB} MB. Choose a smaller one or a lower-quality photo.`;
  if (file.size === 0) return 'That file is empty.';
  const allowed = accept.split(',').map((a) => a.trim());
  if (!allowed.includes(file.type)) return 'Use a JPG, PNG or PDF file.';
  return null;
}
