/** Just what Search reads of a menu: both the table's groups and the sidebar's fit it. */
interface MenuGroup {
  key: string;
  label: string;
  items: ReadonlyArray<{ key: string; label: string; href: string; subItems?: ReadonlyArray<{ key: string; label: string; href: string }> }>;
}

/** The logic of the shell's Search (Ctrl K): which links match what was typed, and which letters to draw bold. Pure, so it is tested. */

export interface Segment {
  text: string;
  bold: boolean;
}

/**
 * Splits a label into runs, bold where the typed letters match: first as one stretch ("Pay" in "Payroll"), else letter by letter in order
 * ("pr" in "Payroll" bolds P and r). No match returns the label whole.
 */
export function highlight(label: string, query: string): Segment[] {
  const q = query.trim().toLowerCase();
  if (!q) return [{ text: label, bold: false }];
  const lower = label.toLowerCase();
  const at = lower.indexOf(q);
  if (at >= 0) return [at > 0 ? { text: label.slice(0, at), bold: false } : null, { text: label.slice(at, at + q.length), bold: true }, at + q.length < label.length ? { text: label.slice(at + q.length), bold: false } : null].filter((s): s is Segment => s !== null);
  const marks = new Set<number>();
  let from = 0;
  for (const ch of q.replace(/\s+/g, '').split('')) {
    const i = lower.indexOf(ch, from);
    if (i < 0) return [{ text: label, bold: false }];
    marks.add(i);
    from = i + 1;
  }
  const out: Segment[] = [];
  label.split('').forEach((ch, i) => {
    const bold = marks.has(i);
    const last = out[out.length - 1];
    if (last && last.bold === bold) last.text += ch;
    else out.push({ text: ch, bold });
  });
  return out;
}

/** True when the typed letters appear in the label in order (a stretch or spread out). */
export const matches = (label: string, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const lower = label.toLowerCase();
  if (lower.includes(q)) return true;
  let from = 0;
  for (const ch of q.replace(/\s+/g, '').split('')) {
    const i = lower.indexOf(ch, from);
    if (i < 0) return false;
    from = i + 1;
  }
  return true;
};

export interface SearchLink {
  key: string;
  label: string;
  href: string;
  /** The group it sits in ("WORKFORCE"), shown small beside it. */
  group: string;
}

/** Every link the person has (a link with sub-links yields the sub-links), flat, in menu order. */
export function flatLinks(groups: readonly MenuGroup[]): SearchLink[] {
  return groups.flatMap((group) =>
    group.items.flatMap((item) =>
      item.subItems ? item.subItems.map((s) => ({ key: `${item.key}/${s.key}`, label: s.label, href: s.href, group: item.label })) : [{ key: item.key, label: item.label, href: item.href, group: group.label }]
    )
  );
}

/** The links that match, whole-stretch matches first, then in-order ones. At most `limit`. */
export function searchLinks(links: readonly SearchLink[], query: string, limit = 8): SearchLink[] {
  const q = query.trim().toLowerCase();
  const hits = links.filter((l) => matches(l.label, q));
  if (!q) return hits.slice(0, limit);
  const stretch = (l: SearchLink): number => (l.label.toLowerCase().startsWith(q) ? 0 : l.label.toLowerCase().includes(q) ? 1 : 2);
  return [...hits].sort((a, b) => stretch(a) - stretch(b)).slice(0, limit);
}

/** The person label for a list or a search row (Paper 7.5): "Name · position · site"; the site is cut first when space runs out, never the name. */
export const personLine = (p: { name: string; positionName: string | null; organizationName: string }): string => [p.name, p.positionName, p.organizationName].filter(Boolean).join(' · ');
