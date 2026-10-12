/**
 * The one source for a person's initials: first letter of the first and last name, with any bracketed note ("(Store Attendant)")
 * dropped, so the sidebar, the top bar and the greeting always agree. One name gives one letter; no name gives an empty string.
 */
export function initialsOf(name: string | undefined | null): string {
  const parts = (name ?? '').replace(/\s*\([^)]*\)/g, '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}
