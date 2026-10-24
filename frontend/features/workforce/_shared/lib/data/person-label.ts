/**
 * The person label's one text rule (Paper frame 7.5): letters that match what was typed are marked. Paper cannot draw this, so it is
 * written here once. Case does not matter; an empty search marks nothing; a search that matches in several places marks each.
 */
export interface LabelPart {
  text: string;
  match: boolean;
}

export function highlightParts(text: string, query: string | undefined): LabelPart[] {
  const q = (query ?? '').trim().toLowerCase();
  if (q === '' || text === '') return [{ text, match: false }];
  const lower = text.toLowerCase();
  const parts: LabelPart[] = [];
  let from = 0;
  for (let at = lower.indexOf(q, from); at !== -1; at = lower.indexOf(q, from)) {
    if (at > from) parts.push({ text: text.slice(from, at), match: false });
    parts.push({ text: text.slice(at, at + q.length), match: true });
    from = at + q.length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts;
}

/** "position · site" for the grey second line; a missing half is left out, both missing gives null. */
export function labelDetail(position: string | null | undefined, site: string | null | undefined): string | null {
  const bits = [position, site].filter((b): b is string => typeof b === 'string' && b.trim() !== '');
  return bits.length > 0 ? bits.join(' · ') : null;
}
