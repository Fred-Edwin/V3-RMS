/**
 * Fixture mode only: the small Central Store the Counting, Stock and Waste fixture handlers share. Items, sections, people.
 * Mutable (Count setup moves things); resets on reload.
 */
import type { Person } from '../types/wire';
import { isoAgo } from './fixture-clock';

export const PEOPLE = {
  linnet: { id: 'u-linnet', name: 'Linnet Wanjiru', initials: 'LW', roleLabel: 'Store Attendant' } satisfies Person,
  peter: { id: 'u-peter', name: 'Peter Kariuki', initials: 'PK', roleLabel: 'Store Attendant' } satisfies Person,
  isabel: { id: 'u-isabel', name: 'Isabel Njoki', initials: 'IN', roleLabel: 'Store Manager' } satisfies Person,
  grace: { id: 'u-grace', name: 'Grace Wambui', initials: 'GW', roleLabel: 'Director' } satisfies Person,
  admin: { id: 'u-admin', name: 'Wendo Admin', initials: 'WA', roleLabel: 'System Admin' } satisfies Person,
  accountant: { id: 'u-accountant', name: 'Joyce Mwangi', initials: 'JM', roleLabel: 'Accountant' } satisfies Person,
  branch: { id: 'u-branch', name: 'Samuel Maina', initials: 'SM', roleLabel: 'Branch Manager' } satisfies Person,
};

export interface WorldItem {
  id: string;
  name: string;
  unit: string;
  /** KES per unit. */
  cost: number;
  /** The ledger on-hand figure. */
  onHand: number;
  restockLevel: number | null;
  sectionId: string | null;
  position: number;
  category: string;
  type: 'Stocked' | 'Raw ingredient' | 'Prepped';
  department: 'KITCHEN' | 'BARISTA' | 'BOTH';
  lastCountedAt: string | null;
  /** Consecutive short counts, newest first. */
  shortStreak: number;
}

export interface WorldSection {
  id: string;
  name: string;
  kind: 'SUPPLIER' | 'MANUAL';
  supplierName: string | null;
  position: number;
}

export const SECTION_ID = { samrat: 's-samrat', summer: 's-summer', others: 's-others', packaging: 's-packaging' } as const;

export const sections: WorldSection[] = [
  { id: SECTION_ID.samrat, name: 'Samrat', kind: 'SUPPLIER', supplierName: 'Samrat Supermarket Ltd', position: 0 },
  { id: SECTION_ID.summer, name: 'Summer', kind: 'SUPPLIER', supplierName: 'Summer Foods Ltd', position: 1 },
  { id: SECTION_ID.others, name: 'Others', kind: 'MANUAL', supplierName: null, position: 2 },
  { id: SECTION_ID.packaging, name: 'Packaging', kind: 'MANUAL', supplierName: null, position: 3 },
];

type Seed = [name: string, unit: string, cost: number, onHand: number, restock: number | null, category: string, lastHoursAgo: number | null];

function seed(sectionId: string | null, rows: Seed[], type: WorldItem['type'] = 'Stocked'): WorldItem[] {
  return rows.map(([name, unit, cost, onHand, restock, category, ago], position) => ({
    id: `i-${sectionId ?? 'new'}-${position}`,
    name,
    unit,
    cost,
    onHand,
    restockLevel: restock,
    sectionId,
    position,
    category,
    type,
    department: category === 'Beverages' || category === 'Coffee' ? 'BARISTA' : 'KITCHEN',
    lastCountedAt: ago === null ? null : isoAgo(ago),
    shortStreak: 0,
  }));
}

export const items: WorldItem[] = [
  ...seed(SECTION_ID.samrat, [
    ['Sugar, white', 'kg', 183, 180, 60, 'Dry goods', 144],
    ['Gram flour', 'kg', 180, 3, 8, 'Dry goods', 24],
    ['Wheat flour', 'kg', 96, 52, 20, 'Dry goods', 24],
    ['Brown sugar', 'kg', 178, 100, 30, 'Dry goods', 144],
    ['Vanilla essence', 'bottles', 640, 9, 4, 'Flavourings', 24],
    ['Baking powder', 'tins', 210, 11, 5, 'Dry goods', 24],
    ['Cocoa powder', 'kg', 1450, 14, 6, 'Dry goods', 24],
    ['Cornflour 2 kg', 'packs', 320, 18, 6, 'Dry goods', 144],
    ['Rolled oats 1 kg', 'bags', 260, 22, 8, 'Dry goods', 24],
    ['Honey 1 kg', 'jars', 850, 7, 3, 'Dry goods', 24],
    ['Cooking oil', 'L', 205, 99, 40, 'Dry goods', 24],
    ['Table salt', 'kg', 45, 26, 10, 'Dry goods', 24],
    ['Black pepper, ground', 'kg', 1180, 5, 2, 'Spices', 24],
    ['Cinnamon sticks', 'kg', 1320, 3, 1, 'Spices', 144],
  ]),
  ...seed(SECTION_ID.summer, [
    ['Whole milk', 'L', 118, 96, 60, 'Dairy', 24],
    ['Butter 500 g', 'blocks', 520, 24, 10, 'Dairy', 24],
    ['Cheddar cheese', 'kg', 980, 6, 4, 'Dairy', 24],
    ['Cream, fresh', 'L', 640, 14, 6, 'Dairy', 24],
    ['Yoghurt, plain', 'L', 240, 20, 8, 'Dairy', 24],
    ['Chicken breast', 'kg', 620, 18, 10, 'Meat', 24],
    ['Beef mince', 'kg', 780, 12, 8, 'Meat', 24],
    ['Smoked bacon', 'kg', 1450, 4, 3, 'Meat', 144],
    ['Tomatoes', 'kg', 120, 30, 15, 'Produce', 24],
    ['Avocados', 'kg', 220, 16, 8, 'Produce', 24],
  ]),
  ...seed(SECTION_ID.others, [
    ['Eggs', 'trays', 520, 24, 10, 'Dairy', 3],
    ['Coffee beans, house blend', 'kg', 1850, 48, 20, 'Coffee', 24],
    ['Oat milk 1 L', 'cartons', 310, 28, 12, 'Beverages', 24],
    ['Vanilla beans, grade A (Madagascar, 500 g pack)', 'packs', 12500, 5, 2, 'Flavourings', 144],
    ['Matcha powder', 'tins', 3400, 6, 3, 'Beverages', 24],
    ['Chocolate chips', 'kg', 1180, 9, 4, 'Dry goods', 24],
    ['Lemons', 'kg', 260, 11, 5, 'Produce', 24],
    ['Rice, 25 kg bag', 'bags', 3100, 6, 3, 'Dry goods', 24],
    ['Maple syrup', 'bottles', 1250, 8, 3, 'Beverages', 24],
    ['Tea bags, English breakfast', 'boxes', 480, 30, 12, 'Beverages', 24],
    ['Almond flour', 'kg', 1650, 4, 2, 'Dry goods', 144],
    ['Peanut butter', 'jars', 590, 15, 6, 'Dry goods', 24],
  ]),
  ...seed(SECTION_ID.packaging, [
    ['Takeaway cups 12 oz', 'sleeves', 380, 40, 15, 'Packaging', 24],
    ['Cup lids 12 oz', 'sleeves', 260, 38, 15, 'Packaging', 24],
    ['Paper bags, small', 'packs', 420, 22, 8, 'Packaging', 144],
    ['Napkins', 'packs', 150, 60, 20, 'Packaging', 24],
  ]),
  ...seed(null, [
    ['Coconut milk 1 L', 'cartons', 290, 10, null, 'Beverages', null],
    ['Chia seeds', 'kg', 1380, 2, null, 'Dry goods', null],
    ['Pesto, basil jar', 'jars', 760, 8, null, 'Dry goods', null],
  ]),
];

// Make a few items short or negative so the Stock screens have every status.
const set = (name: string, patch: Partial<WorldItem>) => Object.assign(items.find((i) => i.name === name) ?? {}, patch);
set('Gram flour', { onHand: 3 });
set('Cooking oil', { shortStreak: 1 });
set('Sugar, white', { shortStreak: 2 });
set('Smoked bacon', { onHand: -2 });
set('Black pepper, ground', { onHand: 0 });

export const itemById = (id: string): WorldItem | undefined => items.find((i) => i.id === id);
export const sectionById = (id: string): WorldSection | undefined => sections.find((s) => s.id === id);
export const itemsOf = (sectionId: string | null): WorldItem[] => items.filter((i) => i.sectionId === sectionId).sort((a, b) => a.position - b.position);
