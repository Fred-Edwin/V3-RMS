import { Prisma } from '@prisma/client';
import { fmtKes, countWord } from '../_shared/count-format';
import type { CountLineRecord, CountRecord } from '../_shared/count-record-repository';
import { COUNT_SETTING_DEFAULTS } from '../_shared/count-settings';
import { ACCEPTED_REASON, adjustmentReason } from '../_shared/count-reason';
import { CAUSE_TEXT, type ApprovePreview } from '../_shared/counting-contract';

const ZERO = new Prisma.Decimal(0);

/** counted − expected, frozen at the counter's sign. Null for a line that was not counted. */
export const frozenDifference = (line: Pick<CountLineRecord, 'countedQty' | 'expectedQty'>): Prisma.Decimal | null =>
  line.countedQty !== null && line.expectedQty !== null ? line.countedQty.minus(line.expectedQty) : null;

/** difference × the frozen unit cost, KES to 2 dp. */
export const frozenValue = (line: Pick<CountLineRecord, 'countedQty' | 'expectedQty' | 'unitCost'>): Prisma.Decimal | null => {
  const difference = frozenDifference(line);
  return difference && line.unitCost ? difference.times(line.unitCost).toDecimalPlaces(2) : null;
};

/** An adjustment this line will post when the count is approved: a non-zero WRITE_OFF or ACCEPTED line (never a movement logged or a recount asked). */
export type PostingLine = { line: CountLineRecord; difference: Prisma.Decimal; value: Prisma.Decimal; reason: string };

export const postingLines = (count: Pick<CountRecord, 'lines'>): PostingLine[] =>
  count.lines.flatMap((line): PostingLine[] => {
    if (line.decision !== 'WRITE_OFF' && line.decision !== 'ACCEPTED') return [];
    const difference = frozenDifference(line);
    const value = frozenValue(line);
    if (!difference || !value || difference.isZero()) return [];
    return [{ line, difference, value, reason: line.decision === 'WRITE_OFF' && line.cause ? adjustmentReason(line.cause, line.causeNote) : ACCEPTED_REASON }];
  });

/** Lines worth at least the alert amount (frozen on the count): the Director is alerted about them whatever was decided. */
export const alertingLines = (count: Pick<CountRecord, 'lines' | 'directorAlertKes'>): { line: CountLineRecord; value: Prisma.Decimal }[] => {
  const alertKes = count.directorAlertKes ?? COUNT_SETTING_DEFAULTS.directorAlertKes;
  return count.lines.flatMap((line) => {
    const difference = frozenDifference(line);
    const value = frozenValue(line);
    return difference && value && !difference.isZero() && value.abs().greaterThanOrEqualTo(alertKes) ? [{ line, value }] : [];
  });
};

const list = (names: readonly string[]): string => (names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/** "Brown sugar was not counted, so nothing is written for it." */
const notCountedNote = (names: readonly string[]): string | null => {
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} was not counted, so nothing is written for it.`;
  if (names.length <= 3) return `${list(names)} were not counted, so nothing is written for them.`;
  return `${names.length} items were not counted, so nothing is written for them.`;
};

/** C28 (Paper step 11): every adjustment that will post, the within-range group, the net, and what the Director will hear. */
export const buildApprovePreview = (count: CountRecord): ApprovePreview => {
  const posting = postingLines(count);
  const written = posting.filter((p) => p.line.decision === 'WRITE_OFF');
  const accepted = posting.filter((p) => p.line.decision === 'ACCEPTED');
  const net = posting.reduce((total, p) => total.plus(p.value), ZERO).toDecimalPlaces(2);
  const acceptedNet = accepted.reduce((total, p) => total.plus(p.value), ZERO).toDecimalPlaces(2);
  const alerting = alertingLines(count);
  const alertKes = count.directorAlertKes ?? COUNT_SETTING_DEFAULTS.directorAlertKes;

  return {
    rows: written.map((p) => ({ lineId: p.line.id, label: `${p.line.inventoryItem.name} · ${p.line.cause ? CAUSE_TEXT[p.line.cause] : 'Written off'}`, valueKes: p.value.toFixed(2) })),
    withinRange: accepted.length > 0 ? { count: accepted.length, netKes: acceptedNet.toFixed(2) } : null,
    adjustments: posting.length,
    netKes: net.toFixed(2),
    directorNote:
      alerting.length === 0
        ? `Director is not alerted. No single difference reaches ${fmtKes(alertKes)}.`
        : `Director is alerted. ${countWord(alerting.length, 'line')} ${alerting.length === 1 ? 'reaches' : 'reach'} ${fmtKes(alertKes)}.`,
    notCountedNote: notCountedNote(count.lines.filter((l) => l.countedQty === null).map((l) => l.inventoryItem.name)),
  };
};
