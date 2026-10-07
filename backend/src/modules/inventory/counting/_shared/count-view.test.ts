import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  buildBlankSheet,
  buildCheckResult,
  buildCountDetail,
  buildRecordPrint,
  buildSaveLinesResult,
  buildSignPreview,
  decisionTextOf,
  tallyOf,
  type LiveFigures,
} from './count-view';
import {
  COUNT_STOCK_FIGURE_KEYS,
  blankSheetSchema,
  checkResultSchema,
  countDetailSchema,
  countRecordPrintSchema,
  saveLinesResultSchema,
  signPreviewSchema,
} from './counting-contract';
import { COUNT_SETTING_DEFAULTS, settingsInForce } from './count-settings';
import {
  D,
  accountant,
  attendant,
  count,
  director,
  frozen,
  itemIdOf,
  line,
  lineIdOf,
  otherAttendant,
  person,
  signedLine,
  storeManager,
} from './count-fixtures';

const now = new Date('2026-10-13T06:00:00Z');
const settings = settingsInForce(null);
const live = (expected: Record<number, number>): LiveFigures => ({
  expected: new Map(Object.entries(expected).map(([n, v]) => [itemIdOf(Number(n)), D(v)])),
  settings,
});

const detail = (c: ReturnType<typeof count>, actor: Parameters<typeof buildCountDetail>[0]['actor'], extra: Partial<Parameters<typeof buildCountDetail>[0]> = {}) =>
  buildCountDetail({ count: c, actor: actor as never, now, lastCounted: new Map(), stories: new Map(), live: null, ...extra });

const keysDeep = (value: unknown, found = new Set<string>()): Set<string> => {
  if (Array.isArray(value)) value.forEach((v) => keysDeep(v, found));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      found.add(k);
      keysDeep(v, found);
    }
  }
  return found;
};

/** A SUBMITTED count: Sugar exceeds (short 16 of 180 = 8.9 %, KES 2,928), Rice within (1 of 100 = 1 %, KES 100), Oil matches, Tea skipped. */
const submitted = (overrides: Parameters<typeof count>[1] = {}) =>
  count(
    [
      signedLine(1, 164, 180, 'EXCEEDS', { name: 'Sugar, white', currentCost: 183, shortStreak: 3, recheck: 'RECOUNTED', firstCountedQty: D(162) }),
      signedLine(2, 99, 100, 'WITHIN_RANGE', { name: 'Rice', currentCost: 100 }),
      signedLine(3, 40, 40, 'MATCHES', { name: 'Oil' }),
      signedLine(4, null, 100, 'NOT_COUNTED', { name: 'Tea' }),
    ],
    {
      status: 'SUBMITTED',
      signedAt: new Date('2026-10-13T04:42:00Z'),
      expectedAsOf: new Date('2026-10-13T04:42:00Z'),
      updatedAt: new Date('2026-10-13T04:41:00Z'),
      ...frozen,
      ...overrides,
    },
  );

describe('Attendant: own count', () => {
  const open = count([line(1, { countedQty: D(3) }), line(2, { skipped: true }), line(3, { countedQty: D(0) }), line(4)]);

  it('is a valid CountDetail with no figure key anywhere', () => {
    const view = detail(open, attendant);
    expect(countDetailSchema.parse(view)).toBeTruthy();
    const found = keysDeep(view);
    for (const key of COUNT_STOCK_FIGURE_KEYS) expect(found.has(key), key).toBe(false);
    expect(view.figures).toBeUndefined();
  });

  it('shows what they typed, skipped and zero, the item cost, and last counted as a date', () => {
    const view = detail(open, attendant, { lastCounted: new Map([[itemIdOf(1), new Date('2026-10-12T05:30:00Z')]]) });
    expect(view.lines[0]).toMatchObject({ countedQty: '3', skipped: false, unitCost: '100.00', lastCountedText: 'Yesterday', lastCountedAt: '2026-10-12T05:30:00.000Z' });
    expect(view.lines[1]).toMatchObject({ countedQty: null, skipped: true, lastCountedText: 'Never counted' });
    expect(view.lines[2]!.countedQty).toBe('0');
    expect(view.progress).toEqual({ total: 4, counted: 2, skipped: 1, zero: 1, rechecked: 0, text: '2 of 4 counted · 1 skipped' });
  });

  it('may count and sign their own open count, nothing else', () => {
    expect(detail(open, attendant).can).toEqual({ count: true, sign: true, decide: false, approve: false, print: false });
    expect(detail(open, attendant).statusText).toBe('In progress');
  });

  it('still sees no figure after their count is signed and decided', () => {
    const signed = submitted({ counterId: attendant.id });
    const view = detail(signed, attendant, { stories: new Map([[lineIdOf(1), { story: 'No movement since the last count.', suggestedCause: null }]]) });
    expect(countDetailSchema.parse(view)).toBeTruthy();
    const found = keysDeep(view);
    for (const key of COUNT_STOCK_FIGURE_KEYS) expect(found.has(key), key).toBe(false);
    expect(view.statusText).toBe('Submitted');
    expect(view.lines.every((l) => l.can.countAgain === false && l.can.decide === false)).toBe(true);
    expect(view.tracker.steps.map((s) => s.state)).toEqual(['DONE', 'DONE', 'CURRENT', 'TODO']);
  });

  it('is never given live figures even if a caller passes them', () => {
    const view = detail(open, attendant, { live: live({ 1: 5, 2: 5, 3: 5, 4: 5 }) });
    const found = keysDeep(view);
    for (const key of COUNT_STOCK_FIGURE_KEYS) expect(found.has(key), key).toBe(false);
  });
});

describe('Manager: reviewing a SUBMITTED count', () => {
  it('is a valid CountDetail with figures, frozen at the counter’s sign', () => {
    const view = detail(submitted(), storeManager, { stories: new Map([[lineIdOf(1), { story: 'No prep use logged for sugar this week. Last counted 6 days ago.', suggestedCause: 'PREP_NOT_LOGGED' }]]) });
    expect(countDetailSchema.parse(view)).toBeTruthy();
    expect(view.lines[0]).toMatchObject({
      itemName: 'Sugar, white',
      countedQty: '164',
      firstCountedQty: '162',
      recheck: 'RECOUNTED',
      expectedQty: '180',
      difference: '-16',
      differencePercent: '-8.9',
      differenceValueKes: '-2928.00',
      unitCost: '183.00',
      result: 'EXCEEDS',
      story: 'No prep use logged for sugar this week. Last counted 6 days ago.',
      suggestedCause: 'PREP_NOT_LOGGED',
      shortStreak: 3,
      adjustmentRef: null,
      can: { decide: true, countAgain: true },
    });
    expect(view.lines[0]!.decision).toMatchObject({ kind: 'PENDING', text: '' });
    expect(view.lines[0]!.director).toEqual({ flagged: false, alert: false, seenAt: null, seenBy: null });
  });

  it('the line results and the figures strip', () => {
    const view = detail(submitted(), storeManager);
    expect(view.lines.map((l) => l.result)).toEqual(['EXCEEDS', 'WITHIN_RANGE', 'MATCHES', 'NOT_COUNTED']);
    expect(view.lines[1]).toMatchObject({ difference: '-1', differenceValueKes: '-100.00', differencePercent: '-1' });
    expect(view.lines[2]).toMatchObject({ difference: '0', differenceValueKes: '0.00' });
    expect(view.lines[3]!.difference).toBeUndefined(); // not counted: no difference, but the expected figure shows
    expect(view.lines[3]!.expectedQty).toBe('100');
    expect(view.figures).toEqual({
      counted: 3,
      withinRange: 1,
      exceeds: 1,
      notCounted: 1,
      toDecide: 1,
      decided: 0,
      netDifferenceKes: '-3028.00',
      withinRangeNetKes: '-100.00',
    });
    expect(view.range).toEqual({ kes: 500, percent: '5' });
    expect(view.expectedAsOf).toBe('2026-10-13T04:42:00.000Z');
  });

  it('the Manager may decide, but not approve until the outside-range line is decided', () => {
    expect(detail(submitted(), storeManager)).toMatchObject({ statusText: 'Waiting for you', can: { decide: true, approve: false, count: false, sign: false } });
    const decided = submitted();
    decided.lines[0] = { ...decided.lines[0]!, decision: 'WRITE_OFF', cause: 'MISCOUNT' };
    const view = detail(decided, storeManager);
    expect(view.can.approve).toBe(true);
    expect(view.figures).toMatchObject({ toDecide: 0, decided: 1 });
    expect(view.lines[0]!.decision).toMatchObject({ kind: 'WRITE_OFF', cause: 'MISCOUNT', text: 'Miscount' });
    expect(view.tracker.steps.map((s) => s.state)).toEqual(['DONE', 'DONE', 'DONE', 'CURRENT']);
  });

  it('the counter time and the sign time come from the count, and nothing a later cost change does touches a signed line', () => {
    const c = submitted();
    c.lines[0] = { ...c.lines[0]!, inventoryItem: { ...c.lines[0]!.inventoryItem, currentCost: D(999) } };
    const view = detail(c, storeManager);
    expect(view.lines[0]!.unitCost).toBe('183.00');
    expect(view.lines[0]!.differenceValueKes).toBe('-2928.00');
    expect(view.savedAt).toBe('2026-10-13T04:41:00.000Z');
    expect(view.timeline).toEqual([
      { label: 'Counted', at: '2026-10-13T04:41:00.000Z', detail: '07:05 to 07:41' },
      { label: 'Signed with PIN', at: '2026-10-13T04:42:00.000Z', detail: null },
    ]);
  });
});

describe('every other desktop role reads the same signed count', () => {
  for (const [name, actor] of [['Director', director], ['Accountant', accountant]] as const) {
    it(`${name}: figures, no write buttons`, () => {
      const view = detail(submitted(), actor);
      expect(countDetailSchema.parse(view)).toBeTruthy();
      expect(view.lines[0]!.expectedQty).toBe('180');
      expect(view.lines[0]!.can).toEqual({ decide: false, countAgain: false });
      expect(view.can).toMatchObject({ count: false, sign: false, decide: false, approve: false, print: true });
      expect(view.statusText).toBe('Submitted');
    });
  }
});

describe('an OPEN count', () => {
  const own = count([line(1, { countedQty: D(164), name: 'Sugar, white', currentCost: 183 }), line(2, { skipped: true }), line(3), line(4, { countedQty: D(95), currentCost: 1 })], {
    counterId: storeManager.id,
    counter: person(storeManager),
  });

  it('the counting Manager sees live figures and a live result per line (Paper step 13)', () => {
    const view = detail(own, storeManager, { live: live({ 1: 180, 2: 10, 3: 10, 4: 100 }) });
    expect(countDetailSchema.parse(view)).toBeTruthy();
    expect(view.lines.map((l) => l.result)).toEqual(['EXCEEDS', 'NOT_COUNTED', 'NOT_YET', 'WITHIN_RANGE']); // 95 of 100 = exactly 5 %, KES 5: a tie is within
    expect(view.lines[0]).toMatchObject({ expectedQty: '180', difference: '-16', differenceValueKes: '-2928.00' });
    expect(view.lines[2]!.difference).toBeUndefined();
    expect(view.range).toEqual({ kes: 500, percent: '5' });
    expect(view.expectedAsOf).toBeNull();
    expect(view.can).toMatchObject({ count: true, sign: true });
    expect(view.lines.every((l) => l.story === undefined && l.decision === undefined)).toBe(true);
  });

  it('over the percent but inside the KES range still exceeds ("Over 5%, so it will exceed")', () => {
    const c = count([line(1, { countedQty: D(94), currentCost: 1 })], { counterId: storeManager.id, counter: person(storeManager) });
    expect(detail(c, storeManager, { live: live({ 1: 100 }) }).lines[0]!.result).toBe('EXCEEDS');
  });

  it('the Manager looking at someone else’s OPEN count sees no figures at all (no live figures are passed)', () => {
    const view = detail(count([line(1, { countedQty: D(3) })]), storeManager);
    const found = keysDeep(view);
    for (const key of COUNT_STOCK_FIGURE_KEYS) expect(found.has(key), key).toBe(false);
    expect(view.lines[0]!.countedQty).toBe('3');
    expect(view.can).toMatchObject({ count: false, sign: false });
  });

  it('a Director or Accountant sees an OPEN count without figures too', () => {
    for (const actor of [director, accountant]) {
      const found = keysDeep(detail(count([line(1, { countedQty: D(3) })]), actor));
      for (const key of COUNT_STOCK_FIGURE_KEYS) expect(found.has(key), key).toBe(false);
    }
  });

  it('a second Attendant gets the same blind payload (the service refuses them with 404; the builder never leaks)', () => {
    const found = keysDeep(detail(count([line(1)]), otherAttendant));
    for (const key of COUNT_STOCK_FIGURE_KEYS) expect(found.has(key), key).toBe(false);
  });
});

describe('APPROVED counts and adjustments', () => {
  it('a Manager’s own count is "Signed", lists the adjustment numbers and who was told', () => {
    const c = submitted({ status: 'APPROVED', selfSigned: true, counterId: storeManager.id, counter: person(storeManager), approverId: storeManager.id, approver: person(storeManager), approvedAt: new Date('2026-10-13T04:42:00Z') });
    c.lines[0] = { ...c.lines[0]!, directorFlagged: true, decision: 'WRITE_OFF', cause: 'PREP_NOT_LOGGED', transactions: [{ reference: 'ADJ-0012' }] };
    c.lines[1] = { ...c.lines[1]!, decision: 'ACCEPTED', transactions: [{ reference: 'ADJ-0013' }] };
    const view = detail(c, storeManager);
    expect(countDetailSchema.parse(view)).toBeTruthy();
    expect(view.statusText).toBe('Signed');
    expect(view.lines[0]).toMatchObject({ adjustmentRef: 'ADJ-0012', decision: { text: 'Prep use not logged' }, director: { flagged: true } });
    expect(view.lines[1]!.decision).toMatchObject({ kind: 'ACCEPTED', text: 'Within range · accepted' });
    expect(view.timeline!.map((t) => t.label)).toEqual(['Counted', 'Signed with PIN', 'Applied to stock', 'Director told about 1 line']);
    expect(view.timeline![2]!.detail).toBe('2 lines applied · ADJ-0012 to ADJ-0013');
    expect(view.tracker.steps.every((s) => s.state === 'DONE')).toBe(true);
    expect(view.can).toMatchObject({ decide: false, approve: false, print: true });
  });

  it('count again is offered on an outside-range line of an approved count', () => {
    const c = submitted({ status: 'APPROVED', approvedAt: new Date('2026-10-13T09:00:00Z'), approver: person(storeManager), approverId: storeManager.id });
    const view = detail(c, storeManager);
    expect(view.statusText).toBe('Approved');
    expect(view.lines.map((l) => l.can.countAgain)).toEqual([true, false, false, false]);
  });

  it('a recount links back to the line it came from', () => {
    const oldCount = 'c0000000-0000-4000-8000-000000000009';
    const c = count([line(1)], { recountOfLineId: lineIdOf(9), recountOfLine: { id: lineIdOf(9), inventoryItem: { name: 'Eggs' }, count: { id: oldCount, reference: 'CNT-2026-0006' } } });
    expect(detail(c, attendant).recountOf).toEqual({ countId: oldCount, reference: 'CNT-2026-0006', lineId: lineIdOf(9), itemName: 'Eggs' });
  });

  it('an item-scoped (recount) count has scope ITEMS and no sections', () => {
    const c = count([line(1)], { scopeSections: [] });
    expect(detail(c, attendant)).toMatchObject({ scope: 'ITEMS', sections: [] });
  });
});

describe('decisionTextOf', () => {
  const base = { cause: null, causeNote: null, movementKind: null } as const;
  it('words for every kind', () => {
    expect(decisionTextOf({ ...base, decision: 'PENDING' })).toBe('');
    expect(decisionTextOf({ ...base, decision: 'ACCEPTED' })).toBe('Within range · accepted');
    expect(decisionTextOf({ ...base, decision: 'RECOUNT_ASKED' })).toBe('Recount asked');
    expect(decisionTextOf({ ...base, decision: 'MOVEMENT_LOGGED', movementKind: 'DISPATCH' })).toBe('Movement logged · Dispatch');
    expect(decisionTextOf({ ...base, decision: 'MOVEMENT_LOGGED', movementKind: 'PREP_USE' })).toBe('Movement logged · Prep use');
    expect(decisionTextOf({ ...base, decision: 'WRITE_OFF', cause: 'SPOILAGE' })).toBe('Spoilage or spill');
    expect(decisionTextOf({ ...base, decision: 'WRITE_OFF', cause: 'OTHER', causeNote: 'Dropped crate' })).toBe('Other · Dropped crate');
  });
});

describe('tallyOf', () => {
  it('counts only judged lines and nets the values', () => {
    const t = tallyOf(submitted(), null);
    expect(t).toMatchObject({ counted: 3, withinRange: 1, exceeds: 1, notCounted: 1, toDecide: 1, decided: 0 });
    expect(t.netDifferenceKes.toFixed(2)).toBe('-3028.00');
  });
});

describe('C10 save result', () => {
  const c = count([line(1, { countedQty: D(164), currentCost: 183 }), line(2, { skipped: true }), line(3)], { counterId: storeManager.id, counter: person(storeManager) });

  it('an Attendant gets progress only', () => {
    const result = buildSaveLinesResult(attendant as never, { savedAt: now, lines: c.lines, live: null });
    expect(saveLinesResultSchema.parse(result)).toEqual({ savedAt: '2026-10-13T06:00:00.000Z', progress: { total: 3, counted: 1, skipped: 1, zero: 0, rechecked: 0, text: '1 of 3 counted · 1 skipped' } });
  });

  it('the counting Manager also gets the live result of the lines this save touched', () => {
    const result = buildSaveLinesResult(storeManager as never, { savedAt: now, lines: c.lines, live: { lineIds: [lineIdOf(1)], figures: live({ 1: 180 }) } });
    expect(saveLinesResultSchema.parse(result).lines).toEqual([{ lineId: lineIdOf(1), result: 'EXCEEDS', difference: '-16', differenceValueKes: '-2928.00' }]);
  });

  it('a blind caller never gets lines, even when asked for them', () => {
    const result = buildSaveLinesResult(attendant as never, { savedAt: now, lines: c.lines, live: { lineIds: [lineIdOf(1)], figures: live({ 1: 180 }) } });
    expect(result.lines).toBeUndefined();
  });
});

describe('C11 check result', () => {
  const rows = [
    { id: lineIdOf(1), itemName: 'Sugar, white', unit: 'kg', sectionName: 'Samrat', counted: D(164) },
    { id: lineIdOf(2), itemName: 'Cooking oil', unit: 'L', sectionName: 'Samrat', counted: D(74) },
  ];
  it('names and typed numbers, in the voice of Paper step 3', () => {
    const result = buildCheckResult({ sectionName: 'Samrat', lines: rows });
    expect(checkResultSchema.parse(result)).toEqual({
      items: [
        { lineId: lineIdOf(1), itemName: 'Sugar, white', unit: 'kg', sectionName: 'Samrat', counted: '164' },
        { lineId: lineIdOf(2), itemName: 'Cooking oil', unit: 'L', sectionName: 'Samrat', counted: '74' },
      ],
      text: 'Samrat done. Check 2 items again?',
    });
  });
  it('one item, many sections, and nothing', () => {
    expect(buildCheckResult({ sectionName: 'Samrat', lines: [rows[0]!] }).text).toBe('Samrat done. Check 1 item again?');
    expect(buildCheckResult({ sectionName: null, lines: rows }).text).toBe('Check 2 items again?');
    expect(buildCheckResult({ sectionName: 'Samrat', lines: [] })).toEqual({ items: [], text: 'Nothing to check again. Carry on.' });
  });
});

describe('C12 sign preview', () => {
  it('an Attendant sees how many items, zeros and skips', () => {
    const c = count([line(1, { countedQty: D(0) }), line(2, { countedQty: D(3) }), line(3, { skipped: true })]);
    expect(signPreviewSchema.parse(buildSignPreview(attendant as never, { count: c, live: null, causes: new Map() }))).toEqual({ itemCount: 3, zero: 1, skipped: 1 });
  });

  it('a Manager sees what applies, what is outside the range and which causes are still needed', () => {
    const c = count(
      [
        line(1, { countedQty: D(164), name: 'Sugar, white', currentCost: 183 }),
        line(2, { countedQty: D(99), name: 'Rice' }),
        line(3, { countedQty: D(40), name: 'Oil' }),
        line(4, { skipped: true }),
      ],
      { counterId: storeManager.id, counter: person(storeManager) },
    );
    const preview = signPreviewSchema.parse(buildSignPreview(storeManager as never, { count: c, live: live({ 1: 180, 2: 100, 3: 40, 4: 5 }), causes: new Map() }));
    expect(preview).toMatchObject({ itemCount: 4, zero: 0, skipped: 1 });
    expect(preview.figures).toMatchObject({
      appliedLines: 1,
      appliedNetKes: '-100.00',
      netKes: '-3028.00',
      causesNeeded: [lineIdOf(1)],
      directorNote: 'The Director sees these lines with your causes.',
    });
    expect(preview.figures!.outside).toEqual([
      { lineId: lineIdOf(1), itemName: 'Sugar, white', unit: 'kg', difference: '-16', differenceValueKes: '-2928.00', cause: null },
    ]);
  });

  it('a chosen cause stops being "needed"; a line at the alert amount says the Director is alerted', () => {
    const c = count([line(1, { countedQty: D(100), currentCost: 100 })], { counterId: storeManager.id, counter: person(storeManager) });
    const figures = buildSignPreview(storeManager as never, { count: c, live: live({ 1: 160 }), causes: new Map([[lineIdOf(1), 'LOSS']]) }).figures!;
    expect(figures.causesNeeded).toEqual([]);
    expect(figures.outside[0]!.cause).toBe('LOSS');
    expect(figures.directorNote).toBe('The Director sees these lines with your causes and is alerted: one line reaches KES 5,000.');
  });

  it('nothing outside the range says the Director is not told', () => {
    const c = count([line(1, { countedQty: D(10) })], { counterId: storeManager.id, counter: person(storeManager) });
    expect(buildSignPreview(storeManager as never, { count: c, live: live({ 1: 10 }), causes: new Map() }).figures!.directorNote).toBe('No line is outside the range, so the Director is not told.');
  });
});

describe('C6 print and C7 blank sheet', () => {
  it('the record lists the differences and what was decided, with both signatures', () => {
    const c = submitted({ status: 'APPROVED', approvedAt: new Date('2026-10-13T06:10:00Z'), approver: person(storeManager), approverId: storeManager.id });
    c.lines[0] = { ...c.lines[0]!, decision: 'WRITE_OFF', cause: 'SPOILAGE' };
    c.lines[1] = { ...c.lines[1]!, decision: 'ACCEPTED' };
    const print = countRecordPrintSchema.parse(buildRecordPrint(c, now));
    expect(print).toMatchObject({
      reference: 'CNT-2026-0007',
      generatedText: 'Generated 13 Oct 2026, 09:00',
      sectionsText: 'Samrat',
      counterName: 'Linnet Wanjiru',
      timeText: '07:05 to 07:42',
      counted: 3,
      total: 4,
      differences: 2,
      netValueKes: '-3028.00',
    });
    expect(print.rows.map((r) => [r.itemName, r.expected, r.counted, r.difference, r.valueKes, r.decisionText])).toEqual([
      ['Sugar, white', '180', '164', '-16', '-2928.00', 'Written off · Spoilage or spill'],
      ['Rice', '100', '99', '-1', '-100.00', 'Within range · accepted'],
    ]);
    expect(print.footnote).toBe('The other 1 counted item matched. 1 item was skipped and keeps their last count. This copy is for the Manager and shows expected stock.');
    expect(print.signatures).toEqual([
      { role: 'COUNTED_BY', name: 'Linnet Wanjiru', roleLabel: 'Store Attendant', signedAtText: '13 Oct 07:42' },
      { role: 'APPROVED_BY', name: 'Isabel Njoki', roleLabel: 'Store Manager', signedAtText: '13 Oct 09:10' },
    ]);
  });

  it('a SUBMITTED count prints with its decisions still open and only the counter’s signature', () => {
    const print = buildRecordPrint(submitted(), now);
    expect(print.rows[0]!.decisionText).toBe('Not decided');
    expect(print.signatures).toHaveLength(1);
  });

  it('the blank sheet has every section in order, item and unit only, and no stock figure', () => {
    const sheet = blankSheetSchema.parse(
      buildBlankSheet({
        now,
        sections: [
          { id: lineIdOf(1).replace('a', 'c'), name: 'Samrat', supplierName: 'Samrat Supermarket Ltd', items: [{ name: 'Sugar, white', unit: 'kg' }, { name: 'Rice', unit: 'kg' }] },
          { id: lineIdOf(2).replace('a', 'c'), name: 'Others', supplierName: null, items: [{ name: 'Tea', unit: 'kg' }] },
        ],
      }),
    );
    expect(sheet.sections.map((s) => s.detail)).toEqual(['Section 1 of 2 · Samrat Supermarket Ltd · 2 items', 'Section 2 of 2 · 1 item']);
    expect(sheet.printedAtText).toBe('13 Oct 2026, 09:00');
    const found = keysDeep(sheet);
    for (const key of COUNT_STOCK_FIGURE_KEYS) expect(found.has(key), key).toBe(false);
  });
});

describe('settings defaults', () => {
  it('KES 500, 5 %, repeat on, Director alert KES 5,000 when the hub has no row', () => {
    expect(settings).toMatchObject({ rangeKes: 500, flagRepeat: true, directorAlertKes: 5000 });
    expect(settings.rangePercent).toEqual(new Prisma.Decimal(COUNT_SETTING_DEFAULTS.rangePercent));
  });
});
