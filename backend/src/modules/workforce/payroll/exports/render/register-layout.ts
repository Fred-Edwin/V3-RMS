import { formatWhole, parseCents, sumCents } from '../../engine/money';
import type { PayrollModel, RegisterPerson, TableColumn } from '../export-model';

export interface PdfColumn {
  key: string;
  label: string;
  w: number;
  align: 'left' | 'right';
  /** Statutory tables this column adds up (one table, or the tables folded into "Other statutory"). */
  tableKeys?: string[];
}

/**
 * The register PDF never shrinks type to fit (E8): more statutory tables than this fold into one "Other statutory" column. The Excel
 * keeps every table as its own column, so nothing is hidden, only grouped on paper.
 */
export const MAX_TABLE_COLUMNS = 7;

const FIXED = { person: 140, site: 78, basic: 58, overtime: 64, gross: 60, other: 54, net: 64 } as const;
const MIN_TABLE_WIDTH = 40;

/** Person, Site, Basic, Overtime, Gross, one column per statutory table in the Accountant's order, Other, Net pay. Widths add up to the page. */
export function registerColumns(tables: readonly TableColumn[], contentWidth: number): PdfColumn[] {
  const shown: { label: string; keys: string[] }[] = tables.length <= MAX_TABLE_COLUMNS
    ? tables.map((t) => ({ label: t.name, keys: [t.key] }))
    : [...tables.slice(0, MAX_TABLE_COLUMNS - 1).map((t) => ({ label: t.name, keys: [t.key] })), { label: 'Other statutory', keys: tables.slice(MAX_TABLE_COLUMNS - 1).map((t) => t.key) }];
  const fixed = Object.values(FIXED).reduce((a, b) => a + b, 0);
  let person: number = FIXED.person;
  let site: number = FIXED.site;
  let each = shown.length === 0 ? 0 : (contentWidth - fixed) / shown.length;
  if (shown.length > 0 && each < MIN_TABLE_WIDTH) {
    // Take the room from the name and the site before touching a figure column.
    const need = MIN_TABLE_WIDTH * shown.length - (contentWidth - fixed);
    const fromPerson = Math.min(need, FIXED.person - 110);
    person -= fromPerson;
    site -= Math.min(need - fromPerson, FIXED.site - 60);
    each = (contentWidth - (fixed - (FIXED.person - person) - (FIXED.site - site))) / shown.length;
  }
  const fixedTail = shown.length === 0 ? contentWidth - person - site - FIXED.basic - FIXED.overtime - FIXED.gross - FIXED.other - FIXED.net : 0;
  return [
    { key: 'person', label: 'PERSON', w: person + fixedTail, align: 'left' },
    { key: 'site', label: 'SITE', w: site, align: 'left' },
    { key: 'basic', label: 'BASIC', w: FIXED.basic, align: 'right' },
    { key: 'overtime', label: 'OVERTIME', w: FIXED.overtime, align: 'right' },
    { key: 'gross', label: 'GROSS', w: FIXED.gross, align: 'right' },
    ...shown.map((s, i): PdfColumn => ({ key: `table${i}`, label: s.label.toUpperCase(), w: each, align: 'right', tableKeys: s.keys })),
    { key: 'other', label: 'OTHER', w: FIXED.other, align: 'right' },
    { key: 'net', label: 'NET PAY', w: FIXED.net, align: 'right' },
  ];
}

const whole = (value: string): string => formatWhole(parseCents(value));

/** The text of one cell of the register, whole shillings as on screen. */
export function registerCell(column: PdfColumn, person: RegisterPerson): string {
  if (column.tableKeys) return formatWhole(sumCents(column.tableKeys.map((k) => parseCents(person.tables[k] ?? '0.00'))));
  switch (column.key) {
    case 'person':
      return person.name;
    case 'site':
      return person.siteName;
    case 'basic':
      return whole(person.basic);
    case 'overtime':
      return whole(person.overtime);
    case 'gross':
      return whole(person.gross);
    case 'other':
      return whole(person.other);
    default:
      return whole(person.net);
  }
}

/** The net of a department band: "9 people · net 214,300". */
export const bandNet = (people: readonly RegisterPerson[]): string => formatWhole(sumCents(people.map((p) => parseCents(p.net))));

/** The six cells of the figures band; the tax cell is the income-tax tables, the statutory cell the rest. */
export function figuresOf(model: PayrollModel): [string, string][] {
  const taxKeys = new Set(model.tables.filter((t) => t.isIncomeTax).map((t) => t.key));
  const sumTables = (wanted: (key: string) => boolean): string => formatWhole(sumCents(model.people.flatMap((p) => Object.entries(p.tables).filter(([k]) => wanted(k)).map(([, v]) => parseCents(v)))));
  return [
    ['PEOPLE', String(model.totals.headcount)],
    ['GROSS PAY', whole(model.totals.gross)],
    ['TAX', sumTables((k) => taxKeys.has(k))],
    ['STATUTORY', sumTables((k) => !taxKeys.has(k))],
    ['OTHER DEDUCTIONS', whole(model.totals.other)],
    ['NET PAY', whole(model.totals.net)],
  ];
}
