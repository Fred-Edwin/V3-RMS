import { createHash } from 'node:crypto';

/**
 * The layout "version" C15 hands out and C18 must send back (a stale one is 409 `LAYOUT_CHANGED`). It is a stamp of what the
 * layout IS, not of when it changed: any section added or reordered, any item placed, moved, reordered or left unplaced gives a
 * different version, whoever did it. Opaque to the screen.
 */
export type LayoutShape = {
  sections: readonly { id: string; name: string; position: number }[];
  /** Live items in a section, in any order. */
  placements: readonly { itemId: string; sectionId: string; position: number }[];
  /** Live items in no section. */
  unsectionedItemIds: readonly string[];
};

export const layoutVersion = (layout: LayoutShape): string => {
  const sections = [...layout.sections].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const placements = [...layout.placements].sort((a, b) => a.sectionId.localeCompare(b.sectionId) || a.position - b.position || a.itemId.localeCompare(b.itemId));
  const unsectioned = [...layout.unsectionedItemIds].sort();
  const canonical = JSON.stringify([
    sections.map((s) => [s.id, s.name, s.position]),
    placements.map((p) => [p.itemId, p.sectionId, p.position]),
    unsectioned,
  ]);
  return createHash('sha1').update(canonical).digest('hex').slice(0, 16);
};
