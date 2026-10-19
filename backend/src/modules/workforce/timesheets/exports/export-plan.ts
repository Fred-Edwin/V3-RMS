/** People on page 1 (D16): whole departments up to this many; Paper shows Barista 9 and Kitchen 8 because Pastry 5 would make 22. */
export const FIRST_PAGE_PEOPLE = 20;
/** People on every later page. */
export const LATER_PAGE_PEOPLE = 26;
/**
 * A page also has a height: each person row and each department band takes a line, so a page never holds more than this many
 * lines (people plus bands). It only matters for a page of many tiny departments; the people limits above decide everything else.
 */
export const FIRST_PAGE_LINES = 24;
export const LATER_PAGE_LINES = 32;
/**
 * The rules box and the signature block are never split across pages. In points (A4 landscape): they are this tall, a line is
 * this tall, the table starts this far down on page 1 and on later pages, and nothing may pass the usable bottom.
 */
export const RULES_AND_SIGNATURE_PT = 158;
export const LINE_PT = 15;
export const FIRST_TABLE_Y = 150;
export const LATER_TABLE_Y = 78;
export const USABLE_BOTTOM_PT = 565;

export interface PlanPerson {
  id: string;
}

export interface Band<P> {
  department: string;
  people: P[];
  /** The department carries on from the page before ("BARISTA, continued"): the column header repeats. */
  continued: boolean;
  /** The department's whole head count, for the band's "9 people". */
  departmentTotal: number;
}

export interface PlannedPage<P> {
  number: number;
  bands: Band<P>[];
  /** This page carries the rules box and the signature block (always the last page). */
  rulesAndSignature: boolean;
}

const peopleCap = (pageNumber: number): number => (pageNumber === 1 ? FIRST_PAGE_PEOPLE : LATER_PAGE_PEOPLE);
const linesCap = (pageNumber: number): number => (pageNumber === 1 ? FIRST_PAGE_LINES : LATER_PAGE_LINES);
const peopleOn = <P>(page: PlannedPage<P>): number => page.bands.reduce((total, band) => total + band.people.length, 0);
const linesOn = <P>(page: PlannedPage<P>): number => peopleOn(page) + page.bands.length;

/**
 * Rule (spec section 10, D16): departments A to Z, people in the order given. A department goes whole onto a page; if it does not
 * fit the room left it starts the next page. A department that alone exceeds a later page (more than 26) is split, the pieces
 * marked continued. The rules box and signature never split: they sit on the last page when its lines leave room for them,
 * otherwise they take a last page of their own. The server never scales type to squeeze; it adds a page.
 */
export function planPages<P extends PlanPerson>(groups: readonly { department: string; people: readonly P[] }[]): PlannedPage<P>[] {
  const pages: PlannedPage<P>[] = [{ number: 1, bands: [], rulesAndSignature: false }];
  const current = (): PlannedPage<P> => pages[pages.length - 1]!;
  const openPage = (): PlannedPage<P> => {
    pages.push({ number: pages.length + 1, bands: [], rulesAndSignature: false });
    return current();
  };
  const fits = (page: PlannedPage<P>, people: number): boolean => peopleOn(page) + people <= peopleCap(page.number) && linesOn(page) + people + 1 <= linesCap(page.number);

  for (const group of groups) {
    if (group.people.length === 0) continue;
    const total = group.people.length;
    if (total > LATER_PAGE_PEOPLE) {
      // Too big for any page: start on a fresh page when this one has rows, then fill page after page.
      let page = peopleOn(current()) > 0 ? openPage() : current();
      let rest = [...group.people];
      let first = true;
      while (rest.length > 0) {
        const room = Math.min(peopleCap(page.number) - peopleOn(page), linesCap(page.number) - linesOn(page) - 1);
        const take = rest.slice(0, Math.max(1, room));
        page.bands.push({ department: group.department, people: take, continued: !first, departmentTotal: total });
        rest = rest.slice(take.length);
        first = false;
        if (rest.length > 0) page = openPage();
      }
      continue;
    }
    let page = current();
    if (!fits(page, total)) page = openPage();
    page.bands.push({ department: group.department, people: [...group.people], continued: false, departmentTotal: total });
  }

  const last = current();
  const startY = last.number === 1 ? FIRST_TABLE_Y : LATER_TABLE_Y;
  if (startY + linesOn(last) * LINE_PT + RULES_AND_SIGNATURE_PT > USABLE_BOTTOM_PT) {
    openPage().rulesAndSignature = true;
  } else {
    last.rulesAndSignature = true;
  }
  return pages;
}

/** The people left for the later pages after page 1, for the italic "Continued on page 2: Pastry and Service (14 people)" line. */
export function continuation<P>(pages: readonly PlannedPage<P>[]): { departments: string[]; people: number } | null {
  if (pages.length < 2) return null;
  const rest = pages.slice(1).flatMap((page) => page.bands);
  return { departments: [...new Set(rest.map((band) => band.department))], people: rest.reduce((total, band) => total + band.people.length, 0) };
}

/** "Pastry and Service", "A, B and C". */
export const joinNames = (names: readonly string[]): string => (names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);
