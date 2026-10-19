import { describe, expect, it } from 'vitest';
import { FIRST_PAGE_PEOPLE, LATER_PAGE_PEOPLE, continuation, joinNames, planPages } from './export-plan';

const people = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }));
const group = (department: string, n: number) => ({ department, people: people(department[0]!, n) });
const peopleOn = (page: { bands: { people: unknown[] }[] }) => page.bands.reduce((total, band) => total + band.people.length, 0);

describe('the PDF page plan (D16)', () => {
  it('Paper\'s month: Barista 9 and Kitchen 8 on page 1, Pastry 5 would make 22 so it moves to page 2 with Service 9', () => {
    const pages = planPages([group('Barista', 9), group('Kitchen', 8), group('Pastry', 5), group('Service', 9)]);
    expect(pages).toHaveLength(2);
    expect(pages[0]!.bands.map((b) => b.department)).toEqual(['Barista', 'Kitchen']);
    expect(pages[1]!.bands.map((b) => b.department)).toEqual(['Pastry', 'Service']);
    expect(pages[1]!.rulesAndSignature).toBe(true);
    expect(pages[0]!.rulesAndSignature).toBe(false);
    expect(continuation(pages)).toEqual({ departments: ['Pastry', 'Service'], people: 14 });
    expect(joinNames(['Pastry', 'Service'])).toBe('Pastry and Service');
  });
  it('holds exactly 20 people on page 1', () => {
    const pages = planPages([group('Barista', FIRST_PAGE_PEOPLE)]);
    expect(peopleOn(pages[0]!)).toBe(20);
    expect(pages[0]!.rulesAndSignature).toBe(false); // no room left for the rules on a full first page
    expect(pages).toHaveLength(2);
    expect(pages[1]!.bands).toHaveLength(0); // the rules and the signature take a last page of their own
    expect(pages[1]!.rulesAndSignature).toBe(true);
    expect(continuation(pages)).toEqual({ departments: [], people: 0 });
  });
  it('21 people in one department: not split (it fits a later page), so it starts page 2', () => {
    const pages = planPages([group('Kitchen', 21)]);
    expect(pages[0]!.bands).toHaveLength(0);
    expect(pages[1]!.bands[0]!.people).toHaveLength(21);
    expect(pages[1]!.bands[0]!.continued).toBe(false);
  });
  it('never splits a department of up to 26, whatever page it lands on', () => {
    const pages = planPages([group('A', 15), group('B', 26), group('C', 10)]);
    for (const page of pages) for (const band of page.bands) expect(band.continued).toBe(false);
    expect(pages.flatMap((p) => p.bands).map((b) => b.people.length)).toEqual([15, 26, 10]);
  });
  it('splits a department over 26 into pieces marked continued, on fresh pages', () => {
    const pages = planPages([group('Barista', 5), group('Service', 60)]);
    const pieces = pages.flatMap((p) => p.bands).filter((b) => b.department === 'Service');
    expect(pieces.map((b) => b.continued)).toEqual([false, true, true]);
    expect(pieces.reduce((total, b) => total + b.people.length, 0)).toBe(60);
    expect(pieces.every((b) => b.departmentTotal === 60)).toBe(true);
    expect(pieces.every((b) => b.people.length <= LATER_PAGE_PEOPLE)).toBe(true);
    expect(pages[0]!.bands.map((b) => b.department)).toEqual(['Barista']);
  });
  it('keeps every person exactly once, in order, whatever the shape', () => {
    const groups = [group('Alpha', 7), group('Bravo', 19), group('Charlie', 30), group('Delta', 1), group('Echo', 26), group('Foxtrot', 12)];
    const pages = planPages(groups);
    const seen = pages.flatMap((p) => p.bands).flatMap((b) => b.people.map((x) => x.id));
    expect(seen).toEqual(groups.flatMap((g) => g.people.map((x) => x.id)));
    pages.forEach((page, i) => expect(page.number).toBe(i + 1));
  });
  it('the rules box and the signature are on exactly one page, the last, and never share a page they do not fit', () => {
    for (const sizes of [[3], [11], [12], [20], [26], [30, 20], [100], [200]]) {
      const pages = planPages(sizes.map((n, i) => group(`D${i}`, n)));
      expect(pages.filter((p) => p.rulesAndSignature)).toHaveLength(1);
      expect(pages[pages.length - 1]!.rulesAndSignature).toBe(true);
    }
    expect(planPages([group('A', 16)])[0]!.rulesAndSignature).toBe(true); // 16 on page 1 still leaves room for the rules
    expect(planPages([group('A', 17)])).toHaveLength(2); // 17 does not
  });
  it('a month of 200 people takes a handful of pages, and an empty month still has its rules page', () => {
    const many = planPages(Array.from({ length: 10 }, (_, i) => group(`D${String(i).padStart(2, '0')}`, 20)));
    expect(many.length).toBeGreaterThanOrEqual(8);
    expect(many.length).toBeLessThanOrEqual(12);
    const none = planPages([]);
    expect(none).toHaveLength(1);
    expect(none[0]!.rulesAndSignature).toBe(true);
  });
  it('many tiny departments never overflow a page (lines count too)', () => {
    const pages = planPages(Array.from({ length: 40 }, (_, i) => group(`T${String(i).padStart(2, '0')}`, 1)));
    for (const page of pages) expect(peopleOn(page) + page.bands.length).toBeLessThanOrEqual(page.number === 1 ? 24 : 32);
  });
});
