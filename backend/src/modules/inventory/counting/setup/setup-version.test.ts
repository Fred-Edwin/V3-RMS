import { describe, expect, it } from 'vitest';
import { layoutVersion, type LayoutShape } from './setup-version';

const base: LayoutShape = {
  sections: [
    { id: 's1', name: 'Samrat', position: 0 },
    { id: 's2', name: 'Others', position: 1 },
  ],
  placements: [
    { itemId: 'i1', sectionId: 's1', position: 0 },
    { itemId: 'i2', sectionId: 's1', position: 1 },
    { itemId: 'i3', sectionId: 's2', position: 0 },
  ],
  unsectionedItemIds: ['i4'],
};

describe('layoutVersion', () => {
  it('is a stable 16-character stamp', () => {
    expect(layoutVersion(base)).toMatch(/^[0-9a-f]{16}$/);
    expect(layoutVersion(base)).toBe(layoutVersion(structuredClone(base)));
  });

  it('does not depend on the order the rows were read in', () => {
    const shuffled: LayoutShape = { sections: [...base.sections].reverse(), placements: [...base.placements].reverse(), unsectionedItemIds: [...base.unsectionedItemIds] };
    expect(layoutVersion(shuffled)).toBe(layoutVersion(base));
  });

  it('changes when anything about the layout changes', () => {
    const v = layoutVersion(base);
    const changes: LayoutShape[] = [
      { ...base, sections: [...base.sections, { id: 's3', name: 'Packaging', position: 2 }] }, // a section added
      { ...base, sections: [{ id: 's1', name: 'Samrat', position: 1 }, { id: 's2', name: 'Others', position: 0 }] }, // sections reordered
      { ...base, sections: [{ id: 's1', name: 'Samrat Ltd', position: 0 }, base.sections[1]!] }, // renamed
      { ...base, placements: [{ itemId: 'i1', sectionId: 's2', position: 1 }, ...base.placements.slice(1)] }, // an item moved
      { ...base, placements: [{ itemId: 'i1', sectionId: 's1', position: 1 }, { itemId: 'i2', sectionId: 's1', position: 0 }, base.placements[2]!] }, // items reordered
      { ...base, unsectionedItemIds: ['i4', 'i5'] }, // a new catalog item appeared
      { ...base, placements: base.placements.slice(0, 2), unsectionedItemIds: ['i3', 'i4'] }, // an item left its section
    ];
    for (const changed of changes) expect(layoutVersion(changed)).not.toBe(v);
  });
});
