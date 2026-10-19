/** Hands a downloaded file to the browser as a save. The object URL is released straight after. */
export function saveFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** The line under the choices: what the file will say about the month (spec S3, "Production adds"). */
export function exportFileHint(approved: { at: string; number: string | null } | null): string {
  if (!approved) return 'This month is not approved yet. The file will say "Draft, not approved".';
  return `Approved on ${approved.at}. The file carries the signature${approved.number ? ` and ${approved.number}` : ''}.`;
}
