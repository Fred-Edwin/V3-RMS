import { formatQty, toNumber } from '../../requisitions/lib/qty';
import { PACK_WAITING_CHIP_AFTER_MINUTES, type PackLine, type Review, type ReviewDepartment } from '../_shared/types/dispatch-contract';

/** What the packer sees for a line: the server's values with the packer's own changes laid over them. */
export interface PackLineEdit {
  sentQty: string;
  packedTick: boolean;
}

export interface EffectiveLine extends PackLine {
  /** Sent quantity and tick after the packer's changes. */
  sentQty: string;
  packedTick: boolean;
  /** Sent less than asked: normal, never an error. */
  short: boolean;
  /** True when the store holds less than was asked ("Not enough in store"). */
  notEnough: boolean;
}

export const withEdits = (lines: readonly PackLine[], edits: Readonly<Record<string, PackLineEdit>>): EffectiveLine[] =>
  lines.map((line) => {
    const edit = edits[line.lineId];
    const sentQty = edit?.sentQty ?? line.sentQty;
    return {
      ...line,
      sentQty,
      packedTick: edit?.packedTick ?? line.packedTick,
      short: toNumber(sentQty) < toNumber(line.requestedQty),
      notEnough: toNumber(line.onHand) < toNumber(line.requestedQty),
    };
  });

/** The most a line can send: never more than asked, never more than the store holds. */
export const maxSend = (line: Pick<PackLine, 'requestedQty' | 'onHand'>): number => Math.max(0, Math.min(toNumber(line.requestedQty), toNumber(line.onHand)));

/** The smallest step a quantity moves by: whole numbers, or tenths when the quantity is already fractional. */
export const stepFor = (qty: string): number => (Number.isInteger(toNumber(qty)) ? 1 : 0.1);

export const clampSend = (line: Pick<PackLine, 'requestedQty' | 'onHand'>, qty: number): string => {
  const clamped = Math.min(maxSend(line), Math.max(0, qty));
  return formatQty(Number(clamped.toFixed(3)));
};

export interface LineGroup<T> {
  heading: string;
  lines: T[];
}

/** One heading per category, the path joined with " · " (Block 1's two-level default), in the order the server sent. */
export function groupByCategory<T extends { categoryPath: string[] }>(lines: readonly T[]): LineGroup<T>[] {
  const groups: LineGroup<T>[] = [];
  for (const line of lines) {
    const heading = line.categoryPath.length > 0 ? line.categoryPath.join(' · ') : 'Other items';
    const last = groups[groups.length - 1];
    const existing = last?.heading === heading ? last : groups.find((g) => g.heading === heading);
    if (existing) existing.lines.push(line);
    else groups.push({ heading, lines: [line] });
  }
  return groups;
}

export const ticked = (lines: readonly { packedTick: boolean }[]): number => lines.filter((l) => l.packedTick).length;

/** "1 of 2" under an item: the sent quantity of a short line. */
export const sentOfAsked = (sentQty: string, requestedQty: string): string => `${formatQty(sentQty)} of ${formatQty(requestedQty)}`;

/** The quantity line of D2: "Asked 22 · In store 140", "Asked 2 · Not enough in store (1)". The unit is shown only when the name does not carry it. */
export function askedLine(line: Pick<PackLine, 'requestedQty' | 'onHand' | 'unit' | 'itemName'>, notEnough: boolean): string {
  const carried = /\(.+\)|\d\s?(kg|g|l|ml|oz)\b/i.test(line.itemName);
  const unit = !carried && line.unit ? ` ${line.unit}` : '';
  const asked = `Asked ${formatQty(line.requestedQty)}${unit}`;
  return notEnough ? `${asked} · Not enough in store (${formatQty(line.onHand)})` : `${asked} · In store ${formatQty(line.onHand)}`;
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
/** "Five delivery notes": numbers to ten are words, as Paper writes them. */
export const countWord = (n: number): string => WORDS[n] ?? String(n);
export const deliveryNotesText = (n: number): string => (n === 1 ? 'One delivery note' : `${countWord(n)} delivery notes`);

/** The count under a department row: "12 lines · Cooking oil 1 of 2", "8 lines · all in full", "3 short". */
export function shortSummary(department: Pick<ReviewDepartment, 'lineCount' | 'shortCount' | 'shortLines'>): { text: string; short: boolean } {
  const lines = `${department.lineCount} ${department.lineCount === 1 ? 'line' : 'lines'}`;
  if (department.shortCount === 0) return { text: lines, short: false };
  const only = department.shortLines[0];
  if (department.shortCount === 1 && only) return { text: `${lines} · ${only.itemName} ${sentOfAsked(only.sentQty, only.requestedQty)}`, short: true };
  return { text: `${lines} · ${department.shortCount} short`, short: true };
}

export interface ReviewTotals {
  /** Departments that ship now (fully ticked and not left out). */
  shipping: ReviewDepartment[];
  lineCount: number;
  shortCount: number;
  canSend: boolean;
}

export function reviewTotals(review: Pick<Review, 'departments'>, leftOut: ReadonlySet<string>): ReviewTotals {
  const shipping = review.departments.filter((d) => d.allTicked && !leftOut.has(d.departmentId));
  return {
    shipping,
    lineCount: shipping.reduce((n, d) => n + d.lineCount, 0),
    shortCount: shipping.reduce((n, d) => n + d.shortCount, 0),
    canSend: shipping.length > 0,
  };
}

/** The sign button: "Sign and send to Nyeri Town", or with the number of lines when something stays at the store. */
export const signLabel = (branchName: string, totals: ReviewTotals, allShipping: boolean): string =>
  allShipping ? `Sign and send to ${branchName}` : `Sign and send ${totals.lineCount} ${totals.lineCount === 1 ? 'line' : 'lines'} to ${branchName}`;

/** "Waiting 29 min": from approval, amber from 20 minutes (D22). Hours once past an hour. */
export function waitChip(approvedAt: string, now: number): { text: string; amber: boolean } {
  const minutes = Math.max(0, Math.floor((now - new Date(approvedAt).getTime()) / 60_000));
  const text = minutes >= 60 ? `Waiting ${Math.floor(minutes / 60)} h ${minutes % 60} min` : `Waiting ${minutes} min`;
  return { text, amber: minutes >= PACK_WAITING_CHIP_AFTER_MINUTES };
}

/** The sentence of D6: "30 lines in full and 1 short went out at 3:05 pm." */
export function wentOutText(lineCount: number, shortCount: number, time: string): string {
  const full = lineCount - shortCount;
  const body = shortCount > 0 ? `${full} ${full === 1 ? 'line' : 'lines'} in full and ${shortCount} short` : `${full} ${full === 1 ? 'line' : 'lines'} in full`;
  return `${body} went out at ${time}.`;
}

/** Names for "Pastry is still to pack" / "Pastry and Service are still to pack". */
export function stillToPackText(names: readonly string[]): { title: string; line: string } | null {
  if (names.length === 0) return null;
  const list = names.length === 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] ?? ''}`;
  return names.length === 1
    ? { title: '', line: `${list} is still to pack. It stays in To pack and ships later with its own review and signature.` }
    : { title: '', line: `${list} are still to pack. They stay in To pack and ship later with their own review and signature.` };
}
