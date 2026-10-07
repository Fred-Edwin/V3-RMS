import type { Request } from 'express';
import { Prisma, type CountCause, type CountDecisionKind, type CountMovementKind } from '@prisma/client';
import { withoutCountFigures } from '../../_shared/blind-rule';
import { judgeLine } from '../../_shared/variance-calc';
import { fmtKes, fmtQty } from './count-format';
import { capsOf, countCan, lineCan, statusTextFor, trackerFor, type CountCaps } from './count-state';
import type { CountLineRecord, CountRecord } from './count-record-repository';
import { frozenSettingsOf, type CountSettingsInForce } from './count-settings';
import type { Story } from './count-story';
import { clockText, dateClockText, fullDateClockText, lastCountedText } from './count-time';
import { toPerson } from './count-people';
import {
  CAUSE_TEXT,
  type BlankSheet,
  type CheckResult,
  type CountDetail,
  type CountLine,
  type CountRecordPrint,
  type LineResult,
  type SaveLinesResult,
  type SignPreview,
} from './counting-contract';

type Actor = NonNullable<Request['user']>;
const ZERO = new Prisma.Decimal(0);
const iso = (d: Date): string => d.toISOString();

export const MOVEMENT_TEXT: Record<CountMovementKind, string> = { DISPATCH: 'Dispatch', PREP_USE: 'Prep use', DELIVERY: 'Delivery', WASTE: 'Waste' };

/** The words in a line's Decision cell: "Prep use not logged", "Movement logged · Dispatch", "Within range · accepted", "Recount asked". */
export const decisionTextOf = (line: { decision: CountDecisionKind; cause: CountCause | null; causeNote: string | null; movementKind: CountMovementKind | null }): string => {
  switch (line.decision) {
    case 'PENDING':
      return '';
    case 'ACCEPTED':
      return 'Within range · accepted';
    case 'RECOUNT_ASKED':
      return 'Recount asked';
    case 'MOVEMENT_LOGGED':
      return `Movement logged · ${line.movementKind ? MOVEMENT_TEXT[line.movementKind] : 'Other'}`;
    case 'WRITE_OFF':
      return line.cause ? (line.causeNote ? `${CAUSE_TEXT[line.cause]} · ${line.causeNote}` : CAUSE_TEXT[line.cause]) : 'Written off';
  }
};

// --- One line, judged ----------------------------------------------------------

/** The live figures behind an OPEN count (only the counter who sees stock figures ever gets them). */
export type LiveFigures = { expected: ReadonlyMap<string, Prisma.Decimal>; settings: CountSettingsInForce };

export type JudgedLine = {
  result: LineResult;
  expected: Prisma.Decimal | null;
  unitCost: Prisma.Decimal;
  difference: Prisma.Decimal | null;
  /** Signed KES, 2 dp. */
  value: Prisma.Decimal | null;
  /** Signed percent of expected, 1 dp; null when expected ≤ 0. */
  percent: Prisma.Decimal | null;
};

/**
 * Judges a line two ways: a SIGNED count reads the figures frozen at the counter's sign (never recomputed against anything later);
 * an OPEN count is judged live, against the live expected figure and the live settings (Paper step 13).
 */
export const judgeRecordLine = (line: CountLineRecord, live: LiveFigures | null): JudgedLine => {
  const counted = line.countedQty;
  if (line.expectedQty === null && !live) {
    // Nothing to judge against (OPEN and blind, or a row from before the freeze).
    return { result: counted === null ? (line.skipped ? 'NOT_COUNTED' : 'NOT_YET') : 'NOT_YET', expected: null, unitCost: line.unitCost ?? line.inventoryItem.currentCost, difference: null, value: null, percent: null };
  }
  const frozen = line.expectedQty !== null && line.result !== null;
  const expected = frozen ? line.expectedQty! : (live?.expected.get(line.inventoryItemId) ?? ZERO);
  const unitCost = frozen ? (line.unitCost ?? line.inventoryItem.currentCost) : line.inventoryItem.currentCost;
  if (counted === null) {
    return { result: frozen ? (line.result as LineResult) : line.skipped ? 'NOT_COUNTED' : 'NOT_YET', expected, unitCost, difference: null, value: null, percent: null };
  }
  const difference = counted.minus(expected);
  const value = difference.times(unitCost).toDecimalPlaces(2);
  const percent = expected.greaterThan(0) ? difference.dividedBy(expected).times(100).toDecimalPlaces(1) : null;
  const result: LineResult = frozen
    ? (line.result as LineResult)
    : judgeLine({ counted, expected, unitCost, rangeKes: live!.settings.rangeKes, rangePercent: live!.settings.rangePercent }).result;
  return { result, expected, unitCost, difference, value, percent };
};

// --- The count detail (C5, and the body of C9, C13, C27, C29) -------------------

export type DetailInput = {
  count: CountRecord;
  actor: Actor;
  now: Date;
  /** When each item was last counted BEFORE this count. */
  lastCounted: ReadonlyMap<string, Date>;
  /** "What the records show" per outside-range line of a signed count. */
  stories: ReadonlyMap<string, Story>;
  /** Present only for an OPEN count read by its counter, who sees stock figures. */
  live: LiveFigures | null;
};

const progressOf = (lines: readonly CountLineRecord[]) => {
  const counted = lines.filter((l) => l.countedQty !== null).length;
  const skipped = lines.filter((l) => l.skipped && l.countedQty === null).length;
  const zero = lines.filter((l) => l.countedQty !== null && l.countedQty.isZero()).length;
  const rechecked = lines.filter((l) => l.recheck !== 'NONE').length;
  return {
    total: lines.length,
    counted,
    skipped,
    zero,
    rechecked,
    text: `${counted} of ${lines.length} counted${skipped > 0 ? ` · ${skipped} skipped` : ''}`,
  };
};

export const progressView = progressOf;

const adjustmentRefOf = (line: CountLineRecord): string | null => line.transactions[0]?.reference ?? null;

/** The sections that were picked, in shelf order (an item-scoped recount picked none). */
const sectionsOf = (count: CountRecord): { id: string; name: string }[] => {
  const firstPosition = new Map<string, number>();
  for (const line of count.lines) if (line.sectionId && !firstPosition.has(line.sectionId)) firstPosition.set(line.sectionId, line.position);
  return count.scopeSections
    .flatMap((s) => (s.sectionId ? [{ id: s.sectionId, name: s.sectionName }] : []))
    .sort((a, b) => (firstPosition.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (firstPosition.get(b.id) ?? Number.MAX_SAFE_INTEGER));
};

/** "Samrat", "Others, Packaging", or the item names of a recount ("Eggs"). */
export const sectionsText = (count: CountRecord): string => {
  const names = count.scopeSections.map((s) => s.sectionName);
  if (names.length > 0) return names.join(', ');
  return [...new Set(count.lines.map((l) => l.inventoryItem.name))].slice(0, 3).join(', ');
};

const lineView = (line: CountLineRecord, ctx: { input: DetailInput; caps: CountCaps; showFigures: boolean }): CountLine => {
  const { input, caps, showFigures } = ctx;
  const { count } = input;
  const judged = judgeRecordLine(line, showFigures ? input.live : null);
  const last = input.lastCounted.get(line.inventoryItemId) ?? null;
  const signed = count.status !== 'OPEN';

  const view: CountLine = {
    id: line.id,
    itemId: line.inventoryItemId,
    itemName: line.inventoryItem.name,
    unit: line.inventoryItem.usageUnit,
    sectionId: line.sectionId,
    sectionName: line.sectionName,
    position: line.position,
    countedQty: line.countedQty ? fmtQty(line.countedQty) : null,
    skipped: line.skipped,
    recheck: line.recheck,
    firstCountedQty: line.firstCountedQty ? fmtQty(line.firstCountedQty) : null,
    lastCountedAt: last ? iso(last) : null,
    lastCountedText: lastCountedText(last, input.now),
    can: lineCan({ status: count.status, result: showFigures ? judged.result : null, caps }),
  };
  if (caps.costs) view.unitCost = judged.unitCost.toDecimalPlaces(2).toFixed(2);

  if (showFigures) {
    if (judged.expected) view.expectedQty = fmtQty(judged.expected);
    if (judged.difference) view.difference = fmtQty(judged.difference);
    if (judged.percent) view.differencePercent = judged.percent.toFixed();
    if (judged.value) view.differenceValueKes = judged.value.toFixed(2);
    view.result = judged.result;
    if (signed) {
      const story = input.stories.get(line.id);
      view.story = story?.story ?? null;
      view.suggestedCause = story?.suggestedCause ?? null;
      view.shortStreak = line.shortStreak;
      view.decision = {
        kind: line.decision,
        cause: line.cause,
        causeNote: line.causeNote,
        movementKind: line.movementKind,
        text: decisionTextOf(line),
        by: line.decidedBy ? toPerson(line.decidedBy) : null,
        at: line.decidedAt ? iso(line.decidedAt) : null,
      };
      view.director = {
        flagged: line.directorFlagged,
        alert: line.directorAlert,
        seenAt: line.directorSeenAt ? iso(line.directorSeenAt) : null,
        seenBy: line.directorSeenBy ? toPerson(line.directorSeenBy) : null,
      };
      view.adjustmentRef = adjustmentRefOf(line);
    }
  }
  return view;
};

/** Sum of signed values, 2 dp. */
const sumValues = (values: readonly (Prisma.Decimal | null)[]): Prisma.Decimal => values.reduce<Prisma.Decimal>((t, v) => (v ? t.plus(v) : t), ZERO).toDecimalPlaces(2);

export type CountTally = {
  counted: number;
  withinRange: number;
  exceeds: number;
  notCounted: number;
  toDecide: number;
  decided: number;
  netDifferenceKes: Prisma.Decimal;
  withinRangeNetKes: Prisma.Decimal;
};

/** The count's figures from its judged lines (the KPI strip of the review screen, and `approve.can`). */
export const tallyOf = (count: CountRecord, live: LiveFigures | null): CountTally => {
  const judged = count.lines.map((line) => ({ line, j: judgeRecordLine(line, live) }));
  const counted = judged.filter((x) => x.line.countedQty !== null);
  const exceeds = judged.filter((x) => x.j.result === 'EXCEEDS');
  // An exact match is within range too (the review tab "Within range" counts it, as Paper draws).
  const within = judged.filter((x) => x.j.result === 'WITHIN_RANGE' || x.j.result === 'MATCHES');
  return {
    counted: counted.length,
    withinRange: within.length,
    exceeds: exceeds.length,
    notCounted: judged.filter((x) => x.j.result === 'NOT_COUNTED').length,
    toDecide: exceeds.filter((x) => x.line.decision === 'PENDING').length,
    decided: exceeds.filter((x) => x.line.decision !== 'PENDING').length,
    netDifferenceKes: sumValues(counted.map((x) => x.j.value)),
    withinRangeNetKes: sumValues(within.map((x) => x.j.value)),
  };
};

const timelineOf = (count: CountRecord, countedAt: Date): NonNullable<CountDetail['timeline']> => {
  const entries: NonNullable<CountDetail['timeline']> = [
    { label: 'Counted', at: iso(countedAt), detail: `${clockText(count.startedAt)} to ${clockText(countedAt)}` },
  ];
  if (count.signedAt) entries.push({ label: 'Signed with PIN', at: iso(count.signedAt), detail: null });
  const refs = count.lines.map(adjustmentRefOf).filter((r): r is string => r !== null).sort();
  if (count.approvedAt) {
    const posted = refs.length > 0 ? `${refs.length} ${refs.length === 1 ? 'line' : 'lines'} applied · ${refs[0]}${refs.length > 1 ? ` to ${refs[refs.length - 1]}` : ''}` : 'Nothing needed applying';
    entries.push({ label: count.selfSigned ? 'Applied to stock' : 'Approved with PIN', at: iso(count.approvedAt), detail: posted });
  }
  const told = count.lines.filter((l) => l.directorFlagged).length;
  if (told > 0 && count.signedAt) {
    entries.push({ label: `Director told about ${told} ${told === 1 ? 'line' : 'lines'}`, at: iso(count.approvedAt ?? count.signedAt), detail: null });
  }
  return entries;
};

/** C5: one count, shaped for this caller. The only place that decides which keys a count detail has. */
export const buildCountDetail = (input: DetailInput): CountDetail => {
  const { count, actor, now } = input;
  const caps = capsOf(actor);
  const isCounter = count.counterId === actor.id;
  const showFigures = !caps.blind && (count.status !== 'OPEN' || input.live !== null);
  const tally = showFigures ? tallyOf(count, input.live) : null;
  const countedAt = count.updatedAt;

  const settings = frozenSettingsOf(count) ?? input.live?.settings ?? null;
  const detail: CountDetail = {
    id: count.id,
    reference: count.reference,
    status: count.status,
    statusText: statusTextFor(count, caps),
    sections: sectionsOf(count),
    scope: count.scopeSections.length > 0 ? 'SECTIONS' : 'ITEMS',
    counter: toPerson(count.counter),
    startedAt: iso(count.startedAt),
    signedAt: count.signedAt ? iso(count.signedAt) : null,
    approvedAt: count.approvedAt ? iso(count.approvedAt) : null,
    approver: count.approver ? toPerson(count.approver) : null,
    selfSigned: count.selfSigned,
    recountOf: count.recountOfLine
      ? {
          countId: count.recountOfLine.count.id,
          reference: count.recountOfLine.count.reference,
          lineId: count.recountOfLine.id,
          itemName: count.recountOfLine.inventoryItem.name,
        }
      : null,
    progress: progressOf(count.lines),
    savedAt: iso(countedAt),
    tracker: trackerFor({
      status: count.status,
      signedAt: count.signedAt,
      approvedAt: count.approvedAt,
      countedAt,
      checked: tally ? tally.toDecide === 0 : false,
    }),
    lines: count.lines.map((line) => lineView(line, { input, caps, showFigures })),
    can: countCan({ status: count.status, isCounter, caps, toDecide: tally?.toDecide ?? 0 }),
  };

  if (tally) {
    detail.figures = {
      counted: tally.counted,
      withinRange: tally.withinRange,
      exceeds: tally.exceeds,
      notCounted: tally.notCounted,
      toDecide: tally.toDecide,
      decided: tally.decided,
      netDifferenceKes: tally.netDifferenceKes.toFixed(2),
      withinRangeNetKes: tally.withinRangeNetKes.toFixed(2),
    };
    if (settings) detail.range = { kes: settings.rangeKes, percent: settings.rangePercent.toFixed() };
    detail.expectedAsOf = count.expectedAsOf ? iso(count.expectedAsOf) : null;
    if (count.status !== 'OPEN') detail.timeline = timelineOf(count, countedAt);
  }

  // The blind rule, applied once more to the whole payload so a key can never reach a caller who must not see it.
  return withoutCountFigures(actor, detail);
};

// --- C10 save, C11 check, C12 sign preview ------------------------------------

export type SaveLinesInput = {
  savedAt: Date;
  lines: readonly CountLineRecord[];
  /** Only for the counter who sees stock figures: the lines this save touched, judged live. */
  live: { lineIds: readonly string[]; figures: LiveFigures } | null;
};

export const buildSaveLinesResult = (actor: Actor, input: SaveLinesInput): SaveLinesResult => {
  const result: SaveLinesResult = { savedAt: iso(input.savedAt), progress: progressOf(input.lines) };
  if (input.live && !capsOf(actor).blind) {
    const touched = new Set(input.live.lineIds);
    result.lines = input.lines
      .filter((line) => touched.has(line.id))
      .map((line) => {
        const j = judgeRecordLine(line, input.live!.figures);
        return {
          lineId: line.id,
          result: j.result,
          ...(j.difference ? { difference: fmtQty(j.difference) } : {}),
          ...(j.value ? { differenceValueKes: j.value.toFixed(2) } : {}),
        };
      });
  }
  return withoutCountFigures(actor, result);
};

export type CheckInput = {
  sectionName: string | null;
  lines: readonly { id: string; itemName: string; unit: string; sectionName: string | null; counted: Prisma.Decimal }[];
};

/** The section-end check: names and the typed number only, never a figure or a direction. */
export const buildCheckResult = (input: CheckInput): CheckResult => {
  const n = input.lines.length;
  const done = input.sectionName ? `${input.sectionName} done. ` : '';
  return {
    items: input.lines.map((l) => ({ lineId: l.id, itemName: l.itemName, unit: l.unit, sectionName: l.sectionName, counted: fmtQty(l.counted) })),
    text: n === 0 ? 'Nothing to check again. Carry on.' : `${done}Check ${n} ${n === 1 ? 'item' : 'items'} again?`,
  };
};

export type SignPreviewInput = { count: CountRecord; live: LiveFigures | null; causes: ReadonlyMap<string, CountCause> };

export const buildSignPreview = (actor: Actor, input: SignPreviewInput): SignPreview => {
  const { count, live } = input;
  const progress = progressOf(count.lines);
  const preview: SignPreview = { itemCount: progress.total, zero: progress.zero, skipped: progress.skipped };
  if (!capsOf(actor).blind && live) {
    const judged = count.lines.map((line) => ({ line, j: judgeRecordLine(line, live) }));
    const applied = judged.filter((x) => x.j.result === 'WITHIN_RANGE');
    const outside = judged.filter((x) => x.j.result === 'EXCEEDS');
    const appliedNet = sumValues(applied.map((x) => x.j.value));
    const outsideNet = sumValues(outside.map((x) => x.j.value));
    const alerting = outside.filter((x) => x.j.value && x.j.value.abs().greaterThanOrEqualTo(live.settings.directorAlertKes) && live.settings.directorAlertKes >= 0);
    preview.figures = {
      appliedLines: applied.length,
      appliedNetKes: appliedNet.toFixed(2),
      outside: outside.map((x) => ({
        lineId: x.line.id,
        itemName: x.line.inventoryItem.name,
        unit: x.line.inventoryItem.usageUnit,
        difference: fmtQty(x.j.difference!),
        differenceValueKes: x.j.value!.toFixed(2),
        cause: input.causes.get(x.line.id) ?? null,
      })),
      netKes: appliedNet.plus(outsideNet).toFixed(2),
      causesNeeded: outside.filter((x) => !input.causes.has(x.line.id)).map((x) => x.line.id),
      directorNote:
        outside.length === 0
          ? 'No line is outside the range, so the Director is not told.'
          : alerting.length > 0
            ? `The Director sees these lines with your causes and is alerted: ${alerting.length === 1 ? 'one line reaches' : `${alerting.length} lines reach`} ${fmtKes(live.settings.directorAlertKes)}.`
            : 'The Director sees these lines with your causes.',
    };
  }
  return withoutCountFigures(actor, preview);
};

// --- C6 record print, C7 blank sheet ------------------------------------------

export type BlankSheetInput = {
  now: Date;
  sections: readonly { id: string; name: string; supplierName: string | null; items: readonly { name: string; unit: string }[] }[];
};

/** The blank count sheet: every section in shelf order, item and unit, no stock figure of any kind. */
export const buildBlankSheet = (input: BlankSheetInput): BlankSheet => ({
  printedAtText: fullDateClockText(input.now),
  dateText: dateClockText(input.now).split(' ').slice(0, 2).join(' '),
  sections: input.sections.map((s, i) => ({
    id: s.id,
    name: s.name,
    detail: `Section ${i + 1} of ${input.sections.length}${s.supplierName ? ` · ${s.supplierName}` : ''} · ${s.items.length} ${s.items.length === 1 ? 'item' : 'items'}`,
    items: s.items.map((item) => ({ name: item.name, unit: item.unit })),
  })),
});

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** The printed count record (Paper step 44): the differences and what was decided, both signatures. A signed count only. */
export const buildRecordPrint = (count: CountRecord, now: Date): CountRecordPrint => {
  const judged = count.lines.map((line) => ({ line, j: judgeRecordLine(line, null) }));
  const counted = judged.filter((x) => x.line.countedQty !== null);
  const different = counted.filter((x) => x.j.difference !== null && !x.j.difference.isZero());
  const skipped = judged.filter((x) => x.j.result === 'NOT_COUNTED').length;
  const matched = counted.length - different.length;
  const end = count.signedAt ?? count.updatedAt;

  const printDecision = (line: CountLineRecord): string => {
    if (line.decision === 'WRITE_OFF') return `Written off · ${line.cause ? CAUSE_TEXT[line.cause] : 'Other'}`;
    return decisionTextOf(line) || 'Not decided';
  };

  const signatures: CountRecordPrint['signatures'] = [
    { role: 'COUNTED_BY', name: count.counter.name, roleLabel: toPerson(count.counter).roleLabel, signedAtText: dateClockText(count.signedAt ?? end) },
  ];
  if (count.approver && count.approvedAt) {
    signatures.push({ role: 'APPROVED_BY', name: count.approver.name, roleLabel: toPerson(count.approver).roleLabel, signedAtText: dateClockText(count.approvedAt) });
  }

  return {
    reference: count.reference,
    generatedText: `Generated ${fullDateClockText(now)}`,
    sectionsText: sectionsText(count),
    counterName: count.counter.name,
    timeText: `${clockText(count.startedAt)} to ${clockText(end)}`,
    counted: counted.length,
    total: count.lines.length,
    differences: different.length,
    netValueKes: sumValues(counted.map((x) => x.j.value)).toFixed(2),
    rows: different.map(({ line, j }) => ({
      itemName: line.inventoryItem.name,
      unit: line.inventoryItem.usageUnit,
      expected: fmtQty(j.expected ?? ZERO),
      counted: fmtQty(line.countedQty!),
      difference: fmtQty(j.difference!),
      valueKes: j.value!.toFixed(2),
      decisionText: printDecision(line),
    })),
    footnote: `The other ${plural(matched, 'counted item', 'counted items')} matched. ${plural(skipped, 'item was', 'items were')} skipped and ${skipped === 1 ? 'keeps' : 'keep'} their last count. This copy is for the Manager and shows expected stock.`,
    signatures,
  };
};
