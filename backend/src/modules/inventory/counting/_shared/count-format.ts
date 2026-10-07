import type { Prisma } from '@prisma/client';

/** A quantity on the wire: a plain decimal string without trailing zeros ("164", "2.5"). */
export const fmtQty = (value: Prisma.Decimal): string => value.toDecimalPlaces(4).toFixed();

const withCommas = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** "KES 5,000": whole shillings, thousands separated by commas. A decimal is rounded to the nearest shilling. */
export const fmtKes = (value: Prisma.Decimal | number): string => `KES ${withCommas(String(Math.round(Math.abs(Number(value.toString())))))}`;

/** "−KES 7,940" (a real minus sign) or "KES 482": the sign shown only when negative. */
export const fmtKesSigned = (value: Prisma.Decimal | number): string => {
  const n = Math.round(Number(value.toString()));
  return n < 0 ? `−${fmtKes(n)}` : fmtKes(n);
};

/** "7 lines", "1 line" */
export const countWord = (n: number, one: string, many: string = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
