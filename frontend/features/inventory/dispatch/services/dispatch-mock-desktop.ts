/**
 * The desktop lane's hand-written mock for back end D's endpoints (discrepancies Q1 to Q5 and the deliveries V2 to V6 the Branch
 * Manager's "Confirm for a department" drawer walks). In memory, seeded from the contract fixtures. It follows the contract's rules:
 * the sent figure is never in a count response, a check flags a differing line once and then marks it final, the PIN is `1234`, a
 * repeated idempotency key returns the first result, a reversal returns the gap to OPEN and a new finding may follow.
 * Deleted at integration (see `mock-mode.ts`).
 */
import { ApiError } from '@/types/api';
import discrepancyFixtures from '../../discrepancies/_shared/types/discrepancies-contract.fixtures.json';
import type {
  DiscrepancyFile,
  DiscrepancyRow,
  Finding,
  FindingPreview,
  ListDiscrepancies,
  ListDiscrepanciesQuery,
  RecordFindingInput,
  RecordFindingResult,
  RecordedFinding,
  ReverseFindingInput,
  ReverseFindingResult,
} from '../../discrepancies/_shared/types/discrepancies-contract';
import { FINDINGS_FOR, FINDING_PROFILE } from '../../discrepancies/_shared/types/discrepancies-contract';
import type {
  CheckCountResult,
  ConfirmDeliveryInput,
  ConfirmDeliveryResult,
  ConfirmPreview,
  CountLine,
  CountView,
  DeletePhotoResult,
  SaveCountInput,
  SetReasonInput,
  UploadPhotoResult,
} from '../../deliveries/_shared/types/deliveries-contract';
import type { Person } from '../../_shared/types/wire';
import type { CountReason, DispatchActivityEvent } from '../_shared/types/dispatch-contract';

const PIN = '1234';
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const delay = <T,>(value: T): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(clone(value)), 180));
const fail = (status: number, code: string, message: string): never => {
  throw new ApiError(message, status, code);
};

const MANAGER: Person = { id: 'u-store-manager', name: 'Joseph Mwangi', initials: 'JM', roleLabel: 'Store Manager' };

// ── Discrepancies ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const base = (discrepancyFixtures.fileOpen as unknown) as DiscrepancyFile;
const reversedBase = (discrepancyFixtures.fileReversedBackToOpen as unknown) as DiscrepancyFile;

const files = new Map<string, DiscrepancyFile>();
const seeded = new Map<string, unknown>();
const keyed = new Map<string, unknown>();

function seed(): void {
  if (files.size > 0) return;
  const open = clone(base);
  open.openedAt = new Date(Date.now() - 62 * 60000).toISOString();
  files.set(open.id, open);

  const second = clone(base);
  second.id = '80000000-0000-4000-8000-000000000002';
  second.reference = 'DSC-KRT-0003';
  second.branch = { id: '20000000-0000-4000-8000-000000000002', name: 'Karatina', code: 'KRT' };
  second.department = { id: '30000000-0000-4000-8000-000000000011', name: 'Kitchen' };
  second.dispatch = { id: '50000000-0000-4000-8000-000000000020', reference: 'DSP-KRT-0118' };
  second.item = { id: '10000000-0000-4000-8000-000000000020', name: 'Cooking oil 10L', unit: 'can' };
  second.sentQty = '5';
  second.countedQty = '4';
  second.gapQty = '-1';
  second.branchReason = null;
  second.countedTwice = false;
  second.openedAt = new Date(Date.now() - 26 * 3600000).toISOString();
  second.reminderSentAt = new Date(Date.now() - 2 * 3600000).toISOString();
  files.set(second.id, second);

  const extra = clone(base);
  extra.id = '80000000-0000-4000-8000-000000000003';
  extra.reference = 'DSC-NYR-0008';
  extra.item = { id: '10000000-0000-4000-8000-000000000013', name: 'Vanilla syrup 750ml', unit: 'bottle' };
  extra.sentQty = '4';
  extra.countedQty = '6';
  extra.gapQty = '2';
  extra.direction = 'EXTRA';
  extra.branchReason = null;
  extra.allowedFindings = [...FINDINGS_FOR.EXTRA];
  extra.openedAt = new Date(Date.now() - 3 * 3600000).toISOString();
  files.set(extra.id, extra);

  const again = clone(reversedBase);
  again.id = '80000000-0000-4000-8000-000000000005';
  again.reference = 'DSC-NYR-0005';
  files.set(again.id, again);

  for (let i = 0; i < 3; i += 1) {
    const settled = clone(base);
    settled.id = `80000000-0000-4000-8000-00000000010${i}`;
    settled.reference = `DSC-NYR-000${i + 1}`;
    settled.status = 'RECORDED';
    settled.allowedFindings = [];
    const finding: Finding = (['PACKED_SHORT', 'LOST_OR_DAMAGED', 'BRANCH_COUNTED_WRONG'] as const)[i] ?? 'PACKED_SHORT';
    settled.finding = { finding, note: i === 0 ? 'Counted the crate with Peter: 22 in the box, 24 on the sheet.' : null, recorded: { by: MANAGER, at: new Date(Date.now() - (i + 2) * 86400000).toISOString() }, ...FINDING_PROFILE[finding], lossValueKes: finding === 'LOST_OR_DAMAGED' ? '240.0000' : undefined };
    settled.can = { recordFinding: false, reverse: true };
    settled.openedAt = new Date(Date.now() - (i + 3) * 86400000).toISOString();
    files.set(settled.id, settled);
  }
  seeded.set('ready', true);
}

const toRow = (f: DiscrepancyFile): DiscrepancyRow => ({
  id: f.id,
  reference: f.reference,
  status: f.status,
  branch: f.branch,
  department: f.department,
  itemName: f.item.name,
  unit: f.item.unit,
  gapQty: f.gapQty,
  direction: f.direction,
  branchReason: f.branchReason,
  dispatch: f.dispatch,
  openedAt: f.openedAt,
  reminderSentAt: f.reminderSentAt,
  finding: f.finding,
  can: { recordFinding: f.can.recordFinding },
});

export const mockDiscrepancies = {
  async list(query: ListDiscrepanciesQuery = {}): Promise<ListDiscrepancies> {
    seed();
    const tab = query.tab ?? 'open';
    const all = Array.from(files.values());
    const counts = { open: all.filter((f) => f.status !== 'RECORDED').length, settled: all.filter((f) => f.status === 'RECORDED').length };
    const q = (query.q ?? '').trim().toLowerCase();
    const matching = all
      .filter((f) => (tab === 'open' ? f.status !== 'RECORDED' : f.status === 'RECORDED'))
      .filter((f) => !query.branchId || f.branch.id === query.branchId)
      .filter((f) => !query.departmentId || f.department.id === query.departmentId)
      .filter((f) => !q || f.reference.toLowerCase().includes(q) || f.item.name.toLowerCase().includes(q) || f.dispatch.reference.toLowerCase().includes(q))
      .sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime());
    const pageSize = query.pageSize ?? 25;
    const page = query.page ?? 1;
    const branches = all.filter((f, i) => all.findIndex((g) => g.branch.id === f.branch.id) === i).map((f) => f.branch);
    return delay({ tab, rows: matching.slice((page - 1) * pageSize, page * pageSize).map(toRow), counts, branches, page: { page, pageSize, total: matching.length } });
  },

  async file(id: string): Promise<DiscrepancyFile> {
    seed();
    const f = files.get(id);
    if (!f) return fail(404, 'NOT_FOUND', 'Discrepancy not found');
    return delay(f);
  },

  async preview(id: string, finding: Finding): Promise<FindingPreview> {
    seed();
    const f = files.get(id);
    if (!f) return fail(404, 'NOT_FOUND', 'Discrepancy not found');
    if (!FINDINGS_FOR[f.direction].includes(finding)) return fail(422, 'FINDING_NOT_ALLOWED', 'That finding does not fit this gap.');
    const n = Math.abs(Number(f.gapQty));
    const profile = FINDING_PROFILE[finding];
    const short = f.direction === 'SHORT';
    const effects: FindingPreview['effects'] = [];
    if (finding === 'PACKED_SHORT') effects.push({ place: 'CENTRAL_STORE', placeName: 'Central Store stock', quantity: String(n) });
    if (finding === 'PACKED_MORE') effects.push({ place: 'CENTRAL_STORE', placeName: 'Central Store stock', quantity: String(-n) });
    if (finding === 'LOST_OR_DAMAGED') effects.push({ place: 'WRITTEN_OFF', placeName: 'Written off at cost', quantity: String(n) });
    if (finding === 'BRANCH_COUNTED_WRONG') effects.push({ place: 'DEPARTMENT', placeName: `${f.department.name} stock`, quantity: short ? String(n) : String(-n) });
    if (finding === 'CANT_TELL') effects.push(short ? { place: 'WRITTEN_OFF', placeName: 'Written off at cost', quantity: String(n) } : { place: 'DEPARTMENT', placeName: `${f.department.name} stock`, quantity: '0' });
    const againstParty = profile.against === 'STORE' ? `Packer: ${f.packed.by.roleLabel}` : profile.against === 'CARRIER' ? f.carrier.name : profile.against === 'RECEIVER' ? f.counted.by.roleLabel : null;
    const cost = f.valueKes !== undefined ? (Number(f.valueKes) / n) * n : undefined;
    return delay({ id: f.id, reference: f.reference, finding, itemName: f.item.name, unit: f.item.unit, effects, against: profile.against, againstParty, lossKind: profile.lossKind, ...(profile.lossKind === 'LOSS' && cost !== undefined ? { lossValueKes: String(cost) } : {}) });
  },

  async record(id: string, input: RecordFindingInput): Promise<RecordFindingResult> {
    seed();
    const replay = keyed.get(`rec:${input.idempotencyKey}`);
    if (replay) return delay({ ...(replay as RecordFindingResult), replayed: true });
    if (input.pin !== PIN) return fail(401, 'INVALID_PIN', 'That PIN is not right.');
    const f = files.get(id);
    if (!f) return fail(404, 'NOT_FOUND', 'Discrepancy not found');
    if (f.status === 'RECORDED') return fail(409, 'FINDING_ALREADY_RECORDED', 'A finding is already recorded.');
    if (!FINDINGS_FOR[f.direction].includes(input.finding)) return fail(422, 'FINDING_NOT_ALLOWED', 'That finding does not fit this gap.');
    const profile = FINDING_PROFILE[input.finding];
    const finding: RecordedFinding = { finding: input.finding, note: input.note?.trim() || null, recorded: { by: MANAGER, at: new Date().toISOString() }, ...profile, ...(f.valueKes !== undefined && profile.lossKind === 'LOSS' ? { lossValueKes: f.valueKes } : {}) };
    f.status = 'RECORDED';
    f.finding = finding;
    f.allowedFindings = [];
    f.can = { recordFinding: false, reverse: true };
    f.events = [event(`${MANAGER.name} recorded a finding: ${input.finding.toLowerCase().replace(/_/g, ' ')}`, 'FINDING_RECORDED', f), ...f.events];
    const result: RecordFindingResult = { id: f.id, reference: f.reference, status: 'RECORDED', finding, ledgerEntries: 1, replayed: false };
    keyed.set(`rec:${input.idempotencyKey}`, result);
    return delay(result);
  },

  async reverse(id: string, input: ReverseFindingInput): Promise<ReverseFindingResult> {
    seed();
    const replay = keyed.get(`rev:${input.idempotencyKey}`);
    if (replay) return delay({ ...(replay as ReverseFindingResult), replayed: true });
    if (input.pin !== PIN) return fail(401, 'INVALID_PIN', 'That PIN is not right.');
    const f = files.get(id);
    if (!f) return fail(404, 'NOT_FOUND', 'Discrepancy not found');
    if (f.status !== 'RECORDED' || !f.finding) return fail(409, 'FINDING_NOT_REVERSIBLE', 'This finding cannot be reversed.');
    const reversal = { reason: input.reason, reversed: { by: MANAGER, at: new Date().toISOString() } };
    f.status = 'OPEN';
    f.finding = null;
    f.reversal = reversal;
    f.allowedFindings = [...FINDINGS_FOR[f.direction]];
    f.can = { recordFinding: true, reverse: false };
    f.events = [event(`${MANAGER.name} reversed the finding: ${input.reason}`, 'FINDING_REVERSED', f), ...f.events];
    const result: ReverseFindingResult = { id: f.id, reference: f.reference, status: 'OPEN', reversal, ledgerEntries: 1, replayed: false };
    keyed.set(`rev:${input.idempotencyKey}`, result);
    return delay(result);
  },
};

function event(sentence: string, type: DispatchActivityEvent['type'], f: DiscrepancyFile): DispatchActivityEvent {
  return { id: `ev-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, type, at: new Date().toISOString(), actor: MANAGER, sentence, link: { kind: 'DISCREPANCY', id: f.id, reference: f.reference }, reason: null };
}

// ── The Branch Manager's drawer: deliveries V2 to V6 (D19) ─────────────────────────────────────────────────────────────────

interface MockDelivery {
  id: string;
  signedAt: string;
  lines: { lineId: string; itemName: string; unit: string; sent: number; counted: string | null; attempt: 0 | 1 | 2; reason: CountReason | null; note: string | null }[];
  confirmed: ConfirmDeliveryResult | null;
}
const deliveries = new Map<string, MockDelivery>();
const photos = new Map<string, { id: string; url: string }[]>();
const PASTRY: { itemName: string; unit: string; sent: number }[] = [
  { itemName: 'Flour 25kg', unit: 'bag', sent: 4 },
  { itemName: 'Butter 500g', unit: 'block', sent: 12 },
  { itemName: 'Eggs (tray)', unit: 'tray', sent: 8 },
  { itemName: 'Baking powder 500g', unit: 'tin', sent: 6 },
  { itemName: 'Icing sugar 1kg', unit: 'pack', sent: 5 },
  { itemName: 'Vanilla essence 100ml', unit: 'bottle', sent: 3 },
  { itemName: 'Cocoa powder 1kg', unit: 'tin', sent: 2 },
  { itemName: 'Cream 1L', unit: 'packet', sent: 10 },
  { itemName: 'Yeast 500g', unit: 'pack', sent: 2 },
];

function delivery(id: string): MockDelivery {
  let d = deliveries.get(id);
  if (!d) {
    d = { id, signedAt: new Date(Date.now() - 135 * 60000).toISOString(), lines: PASTRY.map((l, i) => ({ lineId: `${id}-l${i}`, itemName: l.itemName, unit: l.unit, sent: l.sent, counted: null, attempt: 0, reason: null, note: null })), confirmed: null };
    deliveries.set(id, d);
  }
  return d;
}

const toCountLine = (l: MockDelivery['lines'][number]): CountLine => {
  const differs = l.counted !== null && Number(l.counted) !== l.sent;
  const state: CountLine['state'] = l.counted === null ? 'NOT_COUNTED' : !differs ? 'COUNTED' : l.attempt >= 2 ? (Number(l.counted) < l.sent ? 'SHORT' : 'EXTRA') : l.attempt === 1 ? 'COUNT_AGAIN' : 'COUNTED';
  return {
    lineId: l.lineId,
    itemName: l.itemName,
    unit: l.unit,
    categoryPath: [],
    countedQty: l.counted,
    state,
    attempt: l.attempt,
    recountUsed: l.attempt >= 2,
    direction: differs && l.attempt >= 1 ? (Number(l.counted) < l.sent ? 'SHORT' : 'EXTRA') : null,
    reason: l.reason,
    reasonNote: l.note,
    photos: photos.get(l.lineId) ?? [],
  };
};

function view(d: MockDelivery): CountView {
  const lines = d.lines.map(toCountLine);
  return {
    id: d.id,
    reference: 'DSP-NYR-0233',
    branch: { id: '20000000-0000-4000-8000-000000000001', name: 'Nyeri Town', code: 'NYR' },
    department: { id: '30000000-0000-4000-8000-000000000003', name: 'Pastry' },
    signedAt: d.signedAt,
    arrivedAt: null,
    lineCount: lines.length,
    countedCount: lines.filter((l) => l.countedQty !== null).length,
    countAgainCount: lines.filter((l) => l.state === 'COUNT_AGAIN').length,
    lines,
    canCheck: true,
    onBehalfOfDepartment: { id: '30000000-0000-4000-8000-000000000003', name: 'Pastry' },
  };
}

export const mockDeliveries = {
  async count(id: string): Promise<CountView> {
    return delay(view(delivery(id)));
  },
  async save(id: string, input: SaveCountInput): Promise<CountView> {
    const d = delivery(id);
    if (d.confirmed) return fail(409, 'ALREADY_CONFIRMED', 'Already confirmed.');
    for (const c of input.counts) {
      const line = d.lines.find((l) => l.lineId === c.lineId);
      if (line && line.attempt < 2) line.counted = c.countedQty;
    }
    return delay(view(d));
  },
  async check(id: string): Promise<CheckCountResult> {
    const d = delivery(id);
    if (d.lines.some((l) => l.counted === null)) return fail(422, 'NOT_COUNTED', 'Count every line before you sign.');
    for (const l of d.lines) {
      if (Number(l.counted) !== l.sent && l.attempt < 2) l.attempt = (l.attempt + 1) as 1 | 2;
      if (Number(l.counted) === l.sent) l.attempt = 0;
    }
    const v = view(d);
    const differing = v.lines.filter((l) => l.direction !== null).map((l) => ({ lineId: l.lineId, itemName: l.itemName, countedQty: l.countedQty ?? '0', direction: l.direction ?? ('SHORT' as const), state: l.state as 'COUNT_AGAIN' | 'SHORT' | 'EXTRA' }));
    return delay({ differing, final: v.countAgainCount === 0, reasonsComplete: v.lines.filter((l) => l.state === 'SHORT' || l.state === 'EXTRA').every((l) => l.reason !== null), view: v });
  },
  async reason(id: string, lineId: string, input: SetReasonInput): Promise<CountLine> {
    const d = delivery(id);
    const line = d.lines.find((l) => l.lineId === lineId);
    if (!line) return fail(404, 'NOT_FOUND', 'Line not found');
    line.reason = input.reason;
    line.note = input.note ?? null;
    return delay(toCountLine(line));
  },
  async uploadPhoto(id: string, lineId: string, file: File): Promise<UploadPhotoResult> {
    const d = delivery(id);
    if (!d.lines.some((l) => l.lineId === lineId)) return fail(404, 'NOT_FOUND', 'Line not found');
    if (file.size > 5 * 1024 * 1024) return fail(413, 'PHOTO_TOO_LARGE', 'That photo is over 5 MB.');
    const kept = photos.get(lineId) ?? [];
    if (kept.length >= 3) return fail(422, 'TOO_MANY_PHOTOS', 'You can add up to 3 photos.');
    const photo = { id: `mock-photo-${Date.now()}-${kept.length}`, url: URL.createObjectURL(file) };
    photos.set(lineId, [...kept, photo]);
    return delay({ lineId, photo, photos: photos.get(lineId) ?? [] });
  },
  async deletePhoto(id: string, photoId: string): Promise<DeletePhotoResult> {
    delivery(id);
    const found = Array.from(photos.entries()).find(([, list]) => list.some((p) => p.id === photoId));
    if (!found) return fail(404, 'NOT_FOUND', 'Photo not found');
    const [lineId, list] = found;
    photos.set(lineId, list.filter((p) => p.id !== photoId));
    return delay({ lineId, photos: photos.get(lineId) ?? [] });
  },
  async preview(id: string): Promise<ConfirmPreview> {
    const d = delivery(id);
    const v = view(d);
    const differing = d.lines.filter((l) => Number(l.counted) !== l.sent);
    return delay({
      id,
      reference: 'DSP-NYR-0233',
      department: { id: '30000000-0000-4000-8000-000000000003', name: 'Pastry' },
      lineCount: v.lineCount,
      matchingLines: d.lines.filter((l) => Number(l.counted) === l.sent).map((l) => ({ lineId: l.lineId, itemName: l.itemName })),
      differingLines: differing.map((l) => ({ lineId: l.lineId, itemName: l.itemName, unit: l.unit, countedQty: l.counted ?? '0', sentQty: String(l.sent), gapQty: String(Number(l.counted) - l.sent), direction: Number(l.counted) < l.sent ? ('SHORT' as const) : ('EXTRA' as const), reason: l.reason, reasonNote: l.note, photoCount: 0 })),
      signedBy: { id: 'u-bm', name: 'Peter Njoroge', initials: 'PN', roleLabel: 'Branch Manager' },
      onBehalfOfDepartment: { id: '30000000-0000-4000-8000-000000000003', name: 'Pastry' },
      canConfirm: true,
    });
  },
  async confirm(id: string, input: ConfirmDeliveryInput): Promise<ConfirmDeliveryResult> {
    const d = delivery(id);
    if (d.confirmed) return delay({ ...d.confirmed, replayed: true });
    if (input.pin !== PIN) return fail(401, 'INVALID_PIN', 'That PIN is not right.');
    const differing = d.lines.filter((l) => Number(l.counted) !== l.sent);
    const now = new Date().toISOString();
    const result: ConfirmDeliveryResult = {
      id,
      reference: 'DSP-NYR-0233',
      status: differing.length ? 'CONFIRMED' : 'CLOSED',
      signedAt: d.signedAt,
      arrivedAt: null,
      confirmedAt: now,
      confirmedBy: { id: 'u-bm', name: 'Peter Njoroge', initials: 'PN', roleLabel: 'Branch Manager' },
      onBehalfOfDepartment: { id: '30000000-0000-4000-8000-000000000003', name: 'Pastry' },
      lineCount: d.lines.length,
      matchedCount: d.lines.length - differing.length,
      discrepancies: differing.map((l, i) => ({ id: `mock-dsc-${i}`, reference: `DSC-NYR-009${i}`, itemName: l.itemName, gapQty: String(Number(l.counted) - l.sent) })),
      replayed: false,
    };
    d.confirmed = result;
    return delay(result);
  },
};
