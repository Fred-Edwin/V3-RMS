/**
 * Hand-written in-memory stand-in for back end D's deliveries (V1 to V6) and the member's delivery file, for the phone lane.
 * Deleted at integration. It follows the blind rule: the sent figure never leaves this file before `confirmPreview`, a check
 * flags a differing line COUNT_AGAIN once and then SHORT or EXTRA (final), and a PIN of 0000 is refused so the error path can be driven.
 */
import { ApiError } from '@/types/api';
import type { Person } from '../../_shared/types/wire';
import type { CountReason, DispatchFile, DispatchStage, PhotoRef } from '../../dispatch/_shared/types/dispatch-contract';
import type {
  CheckCountResult,
  ConfirmDeliveryInput,
  ConfirmDeliveryResult,
  ConfirmPreview,
  CountLine,
  CountView,
  DeletePhotoResult,
  DeliveryRow,
  ListDeliveries,
  ListDeliveriesQuery,
  SaveCountInput,
  SetReasonInput,
  UploadPhotoResult,
} from '../_shared/types/deliveries-contract';
import type { DeliveriesPhoneApi } from './deliveries-phone-api';

interface MockLine {
  lineId: string;
  itemName: string;
  unit: string;
  sentQty: number;
  countedQty: string | null;
  attempt: 0 | 1 | 2;
  direction: 'SHORT' | 'EXTRA' | null;
  reason: CountReason | null;
  photos: PhotoRef[];
}

interface MockDelivery {
  id: string;
  reference: string;
  departmentId: string;
  department: string;
  cycle: 'MORNING' | 'AFTERNOON' | 'EXTRA';
  signedAt: string;
  arrivedAt: string | null;
  confirmedAt: string | null;
  stage: DispatchStage;
  lines: MockLine[];
  discrepancyRefs: { id: string; reference: string; itemName: string; gapQty: string }[];
  open: boolean;
}

const person = (id: string, name: string, roleLabel: string): Person => ({ id, name, initials: name.split(' ').map((p) => p[0] ?? '').join(''), roleLabel });
const PETER = person('p1', 'Peter K.', 'Store Attendant');
const GRACE = person('p2', 'Grace W.', 'Kitchen Department Head');
const JOSEPH = person('p3', 'Joseph M.', 'Store Manager');
const BRANCH = { id: 'b1', name: 'Nyeri Town', code: 'NYR' };
const CARRIER = { id: 'c1', name: 'Wendo van KCB 214K', kind: 'VEHICLE' as const };

const iso = (hoursAgo: number, minutes = 0): string => new Date(Date.now() - hoursAgo * 3_600_000 - minutes * 60_000).toISOString();

const lines = (rows: [string, string, number][]): MockLine[] =>
  rows.map(([itemName, unit, sentQty], i) => ({ lineId: `l${i + 1}`, itemName, unit, sentQty, countedQty: null, attempt: 0, direction: null, reason: null, photos: [] }));

const counted = (rows: MockLine[], counts: (number | null)[]): MockLine[] =>
  rows.map((l, i) => {
    const c = counts[i] ?? l.sentQty;
    const direction = c < l.sentQty ? 'SHORT' : c > l.sentQty ? 'EXTRA' : null;
    return { ...l, countedQty: String(c), attempt: direction ? 2 : 1, direction, reason: direction ? 'DAMAGED' : null, photos: direction ? [{ id: `ph-${l.lineId}`, url: '' }] : [] };
  });

function seed(): MockDelivery[] {
  const barista = lines([
    ['Coffee beans 1kg', 'bags', 12],
    ['Milk 1L', 'packets', 24],
    ['Sugar 2kg', 'packs', 6],
    ['Cocoa powder 1kg', 'tins', 3],
    ['Vanilla syrup 750ml', 'bottles', 4],
    ['Paper cups 12oz', 'sleeves', 10],
    ['Coffee filters', 'boxes', 2],
    ['Napkins', 'packs', 8],
  ]);
  const kitchenRows = lines([
    ['Grilled chicken portion', 'portions', 22],
    ['Flour 25kg', 'bags', 4],
    ['Eggs (tray)', 'trays', 6],
    ['Red onions (10kg bag)', 'bags', 2],
    ['Tomatoes (crate)', 'crates', 3],
  ]);
  const gapKitchen = counted(kitchenRows, [null, null, 5, null, null]);
  const past = (n: number, ref: string, daysAgo: number, result: 'ok' | 'open' | 'resolved'): MockDelivery => {
    const base = counted(lines([['Flour 25kg', 'bags', 4], ['Eggs (tray)', 'trays', 6], ['Milk 1L', 'packets', 12]]), result === 'ok' ? [null, null, null] : [null, 5, null]);
    return {
      id: `d-past-${n}`,
      reference: ref,
      departmentId: 'dep-kitchen',
      department: 'Kitchen',
      cycle: 'AFTERNOON',
      signedAt: iso(daysAgo * 24 + 1),
      arrivedAt: iso(daysAgo * 24),
      confirmedAt: iso(daysAgo * 24 - 0.2),
      stage: result === 'open' ? 'GAP_HELD' : result === 'resolved' ? 'CLOSED' : 'CONFIRMED',
      lines: base,
      discrepancyRefs: result === 'ok' ? [] : [{ id: `dsc-${n}`, reference: `DSC-NYR-00${n}`, itemName: 'Eggs (tray)', gapQty: '-1' }],
      open: result === 'open',
    };
  };
  return [
    { id: 'd-wait', reference: 'DSP-NYR-0232', departmentId: 'dep-barista', department: 'Barista', cycle: 'AFTERNOON', signedAt: iso(0, 25), arrivedAt: null, confirmedAt: null, stage: 'ON_THE_WAY', lines: barista, discrepancyRefs: [], open: false },
    { id: 'd-gap', reference: 'DSP-NYR-0231', departmentId: 'dep-kitchen', department: 'Kitchen', cycle: 'MORNING', signedAt: iso(26), arrivedAt: iso(25), confirmedAt: iso(24.9), stage: 'GAP_HELD', lines: gapKitchen, discrepancyRefs: [{ id: 'dsc-6', reference: 'DSC-NYR-0006', itemName: 'Eggs (tray)', gapQty: '-1' }], open: true },
    past(1, 'DSP-NYR-0224', 3, 'ok'),
    past(2, 'DSP-NYR-0219', 5, 'resolved'),
    past(3, 'DSP-NYR-0212', 6, 'ok'),
    past(4, 'DSP-NYR-0207', 7, 'ok'),
  ];
}

let db: MockDelivery[] = seed();
let photoCounter = 0;

const wait = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 120));
};
const fail = (status: number, code: string, message: string): never => {
  throw new ApiError(message, status, code);
};
const find = (id: string): MockDelivery => db.find((d) => d.id === id) ?? fail(404, 'NOT_FOUND', 'Not found');
const num = (s: string): number => Number(s);
const isConfirmed = (d: MockDelivery): boolean => d.confirmedAt !== null;

const lineView = (l: MockLine): CountLine => ({
  lineId: l.lineId,
  itemName: l.itemName,
  unit: l.unit,
  categoryPath: [],
  countedQty: l.countedQty,
  state: l.countedQty === null ? 'NOT_COUNTED' : l.attempt === 1 && l.direction ? 'COUNT_AGAIN' : l.attempt === 2 && l.direction ? l.direction : 'COUNTED',
  attempt: l.attempt,
  recountUsed: l.attempt === 2,
  direction: l.direction,
  reason: l.reason,
  reasonNote: null,
  photos: l.photos,
});

const countView = (d: MockDelivery): CountView => {
  const views = d.lines.map(lineView);
  const countedCount = views.filter((v) => v.countedQty !== null).length;
  return {
    id: d.id,
    reference: d.reference,
    branch: BRANCH,
    department: { id: d.departmentId, name: d.department },
    signedAt: d.signedAt,
    arrivedAt: d.arrivedAt,
    lineCount: d.lines.length,
    countedCount,
    countAgainCount: views.filter((v) => v.state === 'COUNT_AGAIN').length,
    lines: views,
    canCheck: countedCount === d.lines.length && views.every((v) => v.state !== 'COUNT_AGAIN'),
    onBehalfOfDepartment: null,
  };
};

const rowOf = (d: MockDelivery, tab: 'waiting' | 'past'): DeliveryRow => {
  const gaps = d.lines.filter((l) => l.direction).length;
  return {
    id: d.id,
    reference: d.reference,
    department: { id: d.departmentId, name: d.department },
    cycle: d.cycle,
    carrier: CARRIER,
    lineCount: d.lines.length,
    signedAt: d.signedAt,
    arrivedAt: d.arrivedAt,
    stage: d.stage,
    countStarted: d.lines.some((l) => l.countedQty !== null),
    confirmedAt: d.confirmedAt,
    confirmedBy: isConfirmed(d) ? GRACE : null,
    confirmedByTitle: isConfirmed(d) ? 'Kitchen Department Head' : null,
    result: tab === 'past' ? (gaps === 0 ? 'MATCHED' : d.open ? 'GAP_OPEN' : 'GAP_RESOLVED') : null,
    gapCount: tab === 'past' ? gaps : null,
    can: { count: !isConfirmed(d), confirmOnBehalf: false },
  };
};

const fileOf = (d: MockDelivery): DispatchFile => {
  const visible = isConfirmed(d);
  const gap = d.lines.some((l) => l.direction);
  const reversed = d.id === 'd-past-2';
  const activity: DispatchFile['activity'] = [];
  if (gap && reversed) {
    activity.push(
      { id: 'a5', type: 'FINDING_RECORDED', at: iso(120), actor: JOSEPH, sentence: 'Joseph M. recorded a finding on DSC-NYR-0002: packed short at the store', link: null, reason: null },
      { id: 'a4', type: 'FINDING_REVERSED', at: iso(121), actor: JOSEPH, sentence: 'Joseph M. reversed the finding: recorded in error', link: null, reason: 'Recorded in error' },
      { id: 'a3', type: 'FINDING_RECORDED', at: iso(125), actor: JOSEPH, sentence: 'Joseph M. recorded a finding on DSC-NYR-0002: lost or damaged on the way', link: null, reason: null },
    );
  }
  activity.push({ id: 'a2', type: 'DELIVERY_CONFIRMED', at: d.confirmedAt ?? d.signedAt, actor: GRACE, sentence: 'Grace W. counted and signed', link: null, reason: null });
  const items = d.lines.map((l) => ({
    lineId: l.lineId,
    itemId: `i-${l.lineId}`,
    itemName: l.itemName,
    unit: l.unit,
    categoryPath: [],
    requestedQty: String(l.sentQty),
    ...(visible ? { sentQty: String(l.sentQty) } : {}),
    countedQty: l.countedQty,
    ...(visible ? { gapQty: l.countedQty === null ? null : String(num(l.countedQty) - l.sentQty) } : {}),
    countedTwice: l.attempt === 2,
    countReason: l.reason,
    countReasonNote: null,
    photos: l.photos,
    discrepancy: l.direction ? { id: d.discrepancyRefs[0]?.id ?? 'x', reference: d.discrepancyRefs[0]?.reference ?? 'DSC', status: d.open ? ('OPEN' as const) : ('RECORDED' as const) } : null,
  }));
  return {
    id: d.id,
    reference: d.reference,
    requisition: { id: 'r1', reference: 'REQ-NYR-0108' },
    branch: BRANCH,
    department: { id: d.departmentId, name: d.department },
    status: d.stage === 'CLOSED' ? 'CLOSED' : isConfirmed(d) ? 'CONFIRMED' : 'ON_THE_WAY',
    stage: d.stage,
    lineCount: d.lines.length,
    shortCount: d.lines.filter((l) => l.direction).length,
    carrier: CARRIER,
    packed: { by: PETER, at: d.signedAt },
    signed: { by: PETER, at: d.signedAt },
    sendBatchId: 'sb1',
    packedAt: d.signedAt,
    arrivedAt: d.arrivedAt,
    countedById: isConfirmed(d) ? GRACE.id : null,
    countedAt: d.confirmedAt,
    onBehalf: false,
    counted: isConfirmed(d) ? { by: GRACE, at: d.confirmedAt ?? d.signedAt } : null,
    onBehalfOfDepartment: null,
    cancelled: null,
    closedAt: d.stage === 'CLOSED' ? d.confirmedAt : null,
    siblings: [],
    tracker: [],
    nextStep: { action: null, facts: { gapLineCount: d.lines.filter((l) => l.direction).length, discrepancyId: d.discrepancyRefs[0]?.id ?? null, waitingSince: null } },
    sentVisible: visible,
    items,
    documents: [],
    activity,
    can: { print: false, cancel: false, recordFinding: false, confirmForDepartment: false },
  };
};

export const mockDeliveriesApi: DeliveriesPhoneApi = {
  async list(query: ListDeliveriesQuery): Promise<ListDeliveries> {
    await wait();
    const tab = query.tab ?? 'waiting';
    const waiting = db.filter((d) => !isConfirmed(d));
    const past = db.filter(isConfirmed);
    let rows = (tab === 'waiting' ? waiting : past).map((d) => rowOf(d, tab));
    if (tab === 'past' && query.result) rows = rows.filter((r) => r.result === query.result);
    const dayOf = (iso: string): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date(iso));
    if (tab === 'past') rows = rows.filter((r) => r.confirmedAt !== null && (!query.from || dayOf(r.confirmedAt) >= query.from) && (!query.to || dayOf(r.confirmedAt) <= query.to));
    const pageSize = query.pageSize ?? 25;
    const page = query.page ?? 1;
    return { tab, rows: rows.slice((page - 1) * pageSize, page * pageSize), tabCounts: { waiting: waiting.length, past: past.length }, page: { page, pageSize, total: rows.length } };
  },
  async countView(id) {
    await wait();
    const d = find(id);
    if (isConfirmed(d)) fail(409, 'ALREADY_CONFIRMED', 'Already confirmed');
    d.arrivedAt ??= new Date().toISOString();
    return countView(d);
  },
  async saveCount(id, input: SaveCountInput) {
    await wait();
    const d = find(id);
    if (isConfirmed(d)) fail(409, 'ALREADY_CONFIRMED', 'Already confirmed');
    for (const c of input.counts) {
      const l = d.lines.find((x) => x.lineId === c.lineId);
      if (!l) continue;
      if (l.attempt === 2 && l.countedQty !== c.countedQty) fail(409, 'RECOUNT_USED', 'Second count is final');
      l.countedQty = c.countedQty;
    }
    return countView(d);
  },
  async check(id): Promise<CheckCountResult> {
    await wait();
    const d = find(id);
    const view0 = countView(d);
    if (view0.countedCount < d.lines.length) fail(422, 'NOT_COUNTED', 'Count every line');
    const differing: CheckCountResult['differing'] = [];
    for (const l of d.lines) {
      const counted = num(l.countedQty ?? '0');
      const dir = counted < l.sentQty ? 'SHORT' : counted > l.sentQty ? 'EXTRA' : null;
      if (l.attempt === 2) {
        if (l.direction) differing.push({ lineId: l.lineId, itemName: l.itemName, countedQty: l.countedQty ?? '0', direction: l.direction, state: l.direction });
        continue;
      }
      if (!dir) {
        l.attempt = 1;
        l.direction = null;
        continue;
      }
      if (l.attempt === 0) {
        l.attempt = 1;
        l.direction = dir;
        differing.push({ lineId: l.lineId, itemName: l.itemName, countedQty: l.countedQty ?? '0', direction: dir, state: 'COUNT_AGAIN' });
      } else {
        l.attempt = 2;
        l.direction = dir;
        differing.push({ lineId: l.lineId, itemName: l.itemName, countedQty: l.countedQty ?? '0', direction: dir, state: dir });
      }
    }
    const view = countView(d);
    return { differing, final: differing.every((x) => x.state !== 'COUNT_AGAIN'), reasonsComplete: d.lines.filter((l) => l.attempt === 2 && l.direction).every((l) => l.reason), view };
  },
  async setReason(id, lineId, input: SetReasonInput) {
    await wait();
    const l = find(id).lines.find((x) => x.lineId === lineId) ?? fail(404, 'NOT_FOUND', 'Not found');
    if (!l.direction) fail(422, 'LINE_NOT_DIFFERENT', 'Line matches');
    l.reason = input.reason;
    return lineView(l);
  },
  async uploadPhoto(id, lineId, file): Promise<UploadPhotoResult> {
    await wait();
    const l = find(id).lines.find((x) => x.lineId === lineId) ?? fail(404, 'NOT_FOUND', 'Not found');
    if (l.photos.length >= 3) fail(422, 'TOO_MANY_PHOTOS', 'Too many');
    if (file.size > 5 * 1024 * 1024) fail(422, 'PHOTO_TOO_LARGE', 'Too large');
    const photo: PhotoRef = { id: `ph${++photoCounter}`, url: URL.createObjectURL(file) };
    l.photos = [...l.photos, photo];
    return { lineId, photo, photos: l.photos };
  },
  async deletePhoto(id, photoId): Promise<DeletePhotoResult> {
    await wait();
    const d = find(id);
    const l = d.lines.find((x) => x.photos.some((p) => p.id === photoId)) ?? fail(404, 'NOT_FOUND', 'Not found');
    l.photos = l.photos.filter((p) => p.id !== photoId);
    return { lineId: l.lineId, photos: l.photos };
  },
  async confirmPreview(id): Promise<ConfirmPreview> {
    await wait();
    const d = find(id);
    const diff = d.lines.filter((l) => l.direction && l.attempt === 2);
    return {
      id: d.id,
      reference: d.reference,
      department: { id: d.departmentId, name: d.department },
      lineCount: d.lines.length,
      matchingLines: d.lines.filter((l) => !l.direction).map((l) => ({ lineId: l.lineId, itemName: l.itemName })),
      differingLines: diff.map((l) => ({
        lineId: l.lineId,
        itemName: l.itemName,
        unit: l.unit,
        countedQty: l.countedQty ?? '0',
        sentQty: String(l.sentQty),
        gapQty: String(num(l.countedQty ?? '0') - l.sentQty),
        direction: l.direction ?? 'SHORT',
        reason: l.reason,
        reasonNote: null,
        photoCount: l.photos.length,
      })),
      signedBy: GRACE,
      onBehalfOfDepartment: null,
      canConfirm: diff.every((l) => l.reason),
    };
  },
  async confirm(id, input: ConfirmDeliveryInput): Promise<ConfirmDeliveryResult> {
    await wait();
    const d = find(id);
    if (isConfirmed(d)) fail(409, 'ALREADY_CONFIRMED', 'Already confirmed');
    if (input.pin === '0000') fail(401, 'INVALID_PIN', 'Wrong PIN');
    const diff = d.lines.filter((l) => l.direction);
    d.confirmedAt = new Date().toISOString();
    d.stage = diff.length ? 'GAP_HELD' : 'CONFIRMED';
    d.open = diff.length > 0;
    d.discrepancyRefs = diff.map((l, i) => ({ id: `dsc-new-${i}`, reference: `DSC-NYR-000${7 + i}`, itemName: l.itemName, gapQty: String(num(l.countedQty ?? '0') - l.sentQty) }));
    return {
      id: d.id,
      reference: d.reference,
      status: 'CONFIRMED',
      signedAt: d.signedAt,
      arrivedAt: d.arrivedAt,
      confirmedAt: d.confirmedAt,
      confirmedBy: GRACE,
      onBehalfOfDepartment: null,
      lineCount: d.lines.length,
      matchedCount: d.lines.length - diff.length,
      discrepancies: d.discrepancyRefs,
      replayed: false,
    };
  },
  async file(id) {
    await wait();
    return fileOf(find(id));
  },
};

/** Test hook: put the mock back to its first state. */
export const resetPhoneMock = (): void => {
  db = seed();
  photoCounter = 0;
};
