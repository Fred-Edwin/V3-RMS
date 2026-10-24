/**
 * The branch a company-wide role looked at last on Shifts, kept on this device so the screen opens where they left it. A convenience
 * only: private windows and blocked storage answer null, and the screen opens on the first branch instead.
 */
const KEY = 'wf-shifts-last-site';

export function rememberedSite(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function rememberSite(id: string): void {
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // storage is unavailable: the choice simply is not remembered
  }
}

/** The branch to open on: the remembered one if it is still listed, otherwise the first branch in the list's order, otherwise the first site. */
export function firstSite<T extends { id: string; type: string }>(sites: readonly T[], remembered: string | null): string | undefined {
  const branches = sites.filter((s) => s.type === 'BRANCH');
  return branches.find((s) => s.id === remembered)?.id ?? branches[0]?.id ?? sites[0]?.id;
}
