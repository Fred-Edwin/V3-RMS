/**
 * Suggested sign-in addresses for a new hire, built from the name and the company's own email domain (taken from the signed-in
 * person's address, so it is never a guess). Pure. Up to three, in the order a company usually picks: first.last, first initial and
 * last, first.last2 (when the first is taken). The server stays the authority on whether an address is free.
 */
const clean = (part: string): string =>
  part
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export function domainOf(email: string | null | undefined): string | null {
  const at = email?.lastIndexOf('@') ?? -1;
  return email && at > 0 && at < email.length - 1 ? email.slice(at + 1).toLowerCase() : null;
}

export function suggestEmails(name: string, domain: string | null, taken: readonly string[] = []): string[] {
  if (!domain) return [];
  const parts = name.trim().split(/\s+/).map(clean).filter(Boolean);
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  if (!first) return [];
  const locals = last ? [`${first}.${last}`, `${first[0] ?? ''}${last}`, `${first}.${last}2`, `${first}${last}`] : [first, `${first}2`];
  const used = new Set(taken.map((t) => t.toLowerCase()));
  const out: string[] = [];
  for (const local of locals) {
    const address = `${local}@${domain}`;
    if (!used.has(address) && !out.includes(address)) out.push(address);
    if (out.length === 3) break;
  }
  return out;
}
