/**
 * In-memory stand-in for the head's phone endpoints while back end B is unbuilt (flag `NEXT_PUBLIC_REQUISITIONS_MOCK=1`). It
 * follows the contract's shapes and rules (one open requisition per cycle, a sent section cannot be edited, additions only after
 * approval, wrong PIN, 409 on a second start) so the screens are built against real behaviour. In the browser,
 * `window.__requisitionsMock` lets a reviewer play the Branch Manager: `approve()`, `managerChange()`, `cancel()`, `reset()`.
 * Never imported by a screen; only `requisitions-phone-api.ts` selects it.
 */
import { ApiError } from '@/types/api';
import type { Person } from '../../_shared/types/wire';
import type {
  Addition,
  AddableItem,
  HistoryMine,
  Home,
  RecallSectionResult,
  RequisitionCycle,
  RequisitionFile,
  RequisitionLine,
  RequisitionStatus,
  SectionDetail,
  SectionEdit,
  SectionStatus,
  SectionSummary,
  SendSectionResult,
  SetUrgentResult,
  TrackerStep,
} from '../_shared/types/requisitions-contract';
import type { RequisitionsPhoneApi } from './requisitions-phone-api';

const DEPARTMENT = { id: 'd0000000-0000-4000-8000-000000000001', name: 'Kitchen' };
const BRANCH = { id: 'b0000000-0000-4000-8000-000000000001', name: 'Nyeri Town', code: 'NYR' };
const HEAD: Person = { id: 'u-grace', name: 'Grace Wanjiru', initials: 'GW', roleLabel: 'Kitchen Head' };
const MANAGER: Person = { id: 'u-peter', name: 'Peter Mwangi', initials: 'PM', roleLabel: 'Branch Manager' };
const PIN = '1234';
/** Test hooks (browser console): `fail(code, times)` makes the next calls throw; `slow(ms)` holds every call so a loading state can be seen. */
let delayMs = 180;
let injected: { code: string; remaining: number } | null = null;
const latency = async (): Promise<void> => {
  await new Promise((r) => setTimeout(r, delayMs));
  if (injected && injected.remaining > 0) {
    injected.remaining -= 1;
    if (injected.code === 'NETWORK') throw new TypeError('Failed to fetch');
    throw new ApiError('Injected failure', injected.code === 'SERVER' ? 500 : 409, injected.code);
  }
};

interface Item {
  id: string;
  name: string;
  unit: string;
  path: string[];
  onHand: number;
  level: number;
}
const PREP = ['Prep kitchen', 'chicken and beef'];
const ITEMS: Item[] = [
  { id: 'i-01', name: 'Grilled chicken portion', unit: 'portion', path: PREP, onHand: 18, level: 40 },
  { id: 'i-02', name: 'Beef patty 120g', unit: 'pcs', path: PREP, onHand: 24, level: 60 },
  { id: 'i-03', name: 'Flour 25kg', unit: 'bags', path: ['Dry items'], onHand: 1, level: 3 },
  { id: 'i-04', name: 'Cooking oil 10L', unit: 'jerrican', path: ['Dry items'], onHand: 0, level: 2 },
  { id: 'i-05', name: 'Cling film 300m', unit: 'rolls', path: ['Dry items'], onHand: 1, level: 4 },
  { id: 'i-06', name: 'Pishori rice 25kg', unit: 'bags', path: ['Dry items'], onHand: 2, level: 4 },
  { id: 'i-07', name: 'Tomatoes', unit: 'kg', path: ['Market items'], onHand: 4, level: 15 },
  { id: 'i-08', name: 'Red onions', unit: 'kg', path: ['Market items'], onHand: 3, level: 10 },
  { id: 'i-09', name: 'Sukuma wiki', unit: 'bunches', path: ['Market items'], onHand: 2, level: 8 },
  { id: 'i-10', name: 'Avocados', unit: 'pcs', path: ['Market items'], onHand: 5, level: 20 },
  { id: 'i-11', name: 'Milk', unit: 'L', path: ['Dairy and eggs'], onHand: 9, level: 36 },
  { id: 'i-12', name: 'Eggs', unit: 'trays', path: ['Dairy and eggs'], onHand: 1, level: 5 },
  { id: 'i-13', name: 'Chicken breast', unit: 'trays', path: PREP, onHand: 2, level: 6 },
  { id: 'i-14', name: 'Chicken wings', unit: 'trays', path: PREP, onHand: 1, level: 5 },
  { id: 'i-15', name: 'Chicken seasoning 500g', unit: 'pcs', path: ['Dry items'], onHand: 4, level: 6 },
  { id: 'i-16', name: 'Butter', unit: 'kg', path: ['Dairy and eggs'], onHand: 5, level: 4 },
];
const suggestion = (i: Item): number => Math.max(0, i.level - i.onHand);
const itemOf = (id: string): Item => {
  const found = ITEMS.find((i) => i.id === id);
  if (!found) throw new ApiError('That item is not in your department.', 400, 'ITEM_NOT_IN_DEPARTMENT');
  return found;
};

interface MockLine {
  id: string;
  itemId: string;
  requested: number;
  approved: number | null;
  suggested: number | null;
  changedByManager: boolean;
  reason: string | null;
  additionId: string | null;
}
interface MockRequisition {
  id: string;
  reference: string;
  cycle: RequisitionCycle;
  status: RequisitionStatus;
  urgent: boolean;
  urgentNote: string | null;
  urgentAt: string | null;
  openedAt: string;
  sectionStatus: SectionStatus;
  lines: MockLine[];
  note: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  additionStatus: 'PENDING' | 'APPROVED' | null;
  additionAt: string | null;
  replays: Map<string, unknown>;
}

const CYCLE_TEXT: Record<RequisitionCycle, string> = { MORNING: 'Morning', AFTERNOON: 'Afternoon', EXTRA: 'Extra' };
const STATUS_TEXT: Record<RequisitionStatus, string> = { OPEN: 'Collecting', PENDING_APPROVAL: 'Ready to approve', APPROVED: 'Approved', CANCELLED: 'Cancelled', CLOSED: 'Closed' };
const SECTION_TEXT: Record<SectionStatus, string> = { NOT_STARTED: 'Not started', DRAFT: 'Draft', SUBMITTED: 'Sent', SKIPPED: 'Sent without this section' };
const DAY = 'Wed 7 Oct';
const iso = (offsetMinutes = 0): string => new Date(Date.now() + offsetMinutes * 60_000).toISOString();

let seq = 112;
let history: MockRequisition[] = [];
let current: MockRequisition | null = null;
const lineSeq = { n: 100 };

const oldOnes = (): MockRequisition[] => {
  const past = (n: number, cycle: RequisitionCycle, status: RequisitionStatus, lines: number, daysAgo: number, cancelReason: string | null = null): MockRequisition => ({
    id: `a0000000-0000-4000-8000-0000000000${n}`,
    reference: `REQ-NYR-0${n}`,
    cycle,
    status,
    urgent: false,
    urgentNote: null,
    urgentAt: null,
    openedAt: iso(-daysAgo * 1440 - 60),
    sectionStatus: status === 'CANCELLED' ? 'DRAFT' : 'SUBMITTED',
    lines: Array.from({ length: lines }, (_, i) => ({ id: `l-${n}-${i}`, itemId: ITEMS[i % ITEMS.length]?.id ?? 'i-01', requested: 2, approved: 2, suggested: 2, changedByManager: false, reason: null, additionId: null })),
    note: null,
    sentAt: status === 'CANCELLED' ? null : iso(-daysAgo * 1440),
    approvedAt: null,
    cancelledAt: status === 'CANCELLED' ? iso(-daysAgo * 1440) : null,
    cancelReason,
    additionStatus: null,
    additionAt: null,
    replays: new Map(),
  });
  return [
    past(108, 'MORNING', 'CLOSED', 12, 1),
    past(107, 'EXTRA', 'CANCELLED', 4, 2, 'Asked twice by mistake'),
    past(104, 'AFTERNOON', 'CLOSED', 9, 3),
    past(101, 'MORNING', 'CLOSED', 14, 4),
    past(98, 'AFTERNOON', 'CLOSED', 8, 5),
    ...Array.from({ length: 29 }, (_, i) => past(90 - i * 3, i % 2 ? 'AFTERNOON' : 'MORNING', 'CLOSED', 6 + (i % 7), 6 + i)),
  ];
};
history = oldOnes();

const sectionSummary = (r: MockRequisition): SectionSummary => {
  const changed = r.lines.filter((l) => l.suggested === null || l.suggested !== l.requested).length;
  return {
    departmentId: DEPARTMENT.id,
    departmentName: DEPARTMENT.name,
    status: r.sectionStatus,
    statusText: SECTION_TEXT[r.sectionStatus],
    head: HEAD,
    sentAt: r.sentAt,
    sentBy: r.sentAt ? HEAD : null,
    skippedAt: null,
    skippedBy: null,
    lineCount: r.lines.length,
    changedCount: changed,
  };
};

const lineWire = (l: MockLine): RequisitionLine => {
  const item = itemOf(l.itemId);
  return {
    id: l.id,
    itemId: l.itemId,
    itemName: item.name,
    unit: item.unit,
    categoryPath: item.path,
    requestedQty: String(l.requested),
    approvedQty: l.approved === null ? null : String(l.approved),
    suggestedQty: l.suggested === null ? null : String(l.suggested),
    onHand: String(item.onHand),
    level: String(item.level),
    changedFromSuggested: l.suggested === null || l.suggested !== l.requested,
    changedByManager: l.changedByManager,
    changeReason: l.reason,
    additionId: l.additionId,
  };
};

const detail = (r: MockRequisition): SectionDetail => {
  const editable = r.status === 'OPEN' || r.status === 'PENDING_APPROVAL';
  const sent = r.sectionStatus === 'SUBMITTED';
  return {
    ...sectionSummary(r),
    noteForManager: r.note,
    lines: r.lines.filter((l) => l.additionId === null).map(lineWire),
    can: { edit: editable, send: editable && !sent, recall: editable && sent, nudge: false, skip: false, fillMyself: false, changeQuantity: false },
  };
};

const notFound = (): ApiError => new ApiError('Requisition not found.', 404, 'NOT_FOUND');
const find = (id: string): MockRequisition => {
  if (current?.id === id) return current;
  const old = history.find((h) => h.id === id);
  if (!old) throw notFound();
  return old;
};

const addableFor = (r: MockRequisition): AddableItem[] =>
  ITEMS.map((i) => ({
    itemId: i.id,
    itemName: i.name,
    unit: i.unit,
    categoryPath: i.path,
    suggestedQty: String(suggestion(i)),
    onHand: String(i.onHand),
    level: String(i.level),
    inSection: r.lines.some((l) => l.itemId === i.id && l.additionId === null),
  }));

const tracker = (r: MockRequisition): TrackerStep[] => {
  const sent = r.sectionStatus === 'SUBMITTED';
  const approved = r.status === 'APPROVED' || r.status === 'CLOSED';
  const step = (key: TrackerStep['key'], state: TrackerStep['state'], at: string | null, by: Person | null, count: TrackerStep['count'] = null): TrackerStep => ({ key, state, at, by, count });
  return [
    step('STARTED', 'DONE', r.openedAt, HEAD),
    step('ALL_IN', sent ? 'DONE' : 'CURRENT', sent ? r.sentAt : null, null, { done: sent ? 1 : 0, total: 1 }),
    step('APPROVED', approved ? 'DONE' : sent ? 'CURRENT' : 'TODO', r.approvedAt, approved ? MANAGER : null),
    step('PACKED', approved ? 'CURRENT' : 'TODO', null, null),
    step('DELIVERED', 'TODO', null, null),
    step('CLOSED', 'TODO', null, null),
  ];
};

const fileWire = (r: MockRequisition): RequisitionFile => {
  const approved = r.status === 'APPROVED';
  const additionLines = r.lines.filter((l) => l.additionId !== null);
  const additions: Addition[] =
    r.additionStatus && additionLines.length
      ? [
          {
            id: 'add-1',
            departmentId: DEPARTMENT.id,
            departmentName: DEPARTMENT.name,
            status: r.additionStatus,
            statusText: r.additionStatus === 'PENDING' ? 'Waiting for approval' : 'Approved',
            addedBy: HEAD,
            addedAt: r.additionAt ?? iso(),
            approvedBy: r.additionStatus === 'APPROVED' ? MANAGER : null,
            approvedAt: r.additionStatus === 'APPROVED' ? iso() : null,
            lines: additionLines.map(lineWire),
            can: { approve: false },
          },
        ]
      : [];
  return {
    id: r.id,
    reference: r.reference,
    cycle: r.cycle,
    cycleLabel: `${CYCLE_TEXT[r.cycle]} · ${DAY}`,
    branch: BRANCH,
    status: r.status,
    statusText: STATUS_TEXT[r.status],
    urgent: r.urgent,
    urgentAt: r.urgentAt,
    urgentOverHour: false,
    openedBy: HEAD,
    openedAt: r.openedAt,
    approvedBy: approved ? MANAGER : null,
    approvedAt: r.approvedAt,
    cancelled: r.status === 'CANCELLED' && r.cancelledAt ? { at: r.cancelledAt, by: MANAGER, reason: r.cancelReason ?? '' } : null,
    closedAt: null,
    tracker: tracker(r),
    nextStep: {
      action: approved ? 'ADD_TO_THIS_REQUISITION' : r.status === 'CANCELLED' ? 'START_A_NEW_ONE' : r.sectionStatus === 'SUBMITTED' ? null : 'SEND_SECTION',
      departmentId: DEPARTMENT.id,
      facts: { sectionsIn: r.sectionStatus === 'SUBMITTED' ? 1 : 0, sectionsTotal: 1, additionsWaiting: r.additionStatus === 'PENDING' ? 1 : 0 },
    },
    sections: [{ ...detail(r), can: { ...detail(r).can, edit: false } }],
    additions,
    dispatches: [],
    lineCount: r.lines.filter((l) => l.additionId === null).length,
    can: { nudge: false, skip: false, changeQuantity: false, approve: false, cancel: false, setUrgent: r.status === 'OPEN' || r.status === 'PENDING_APPROVAL', addToIt: approved && r.additionStatus !== 'PENDING', print: false, startNew: false },
  };
};

const rowMoments = (r: MockRequisition) => ({
  allInAt: r.sentAt,
  urgentAt: r.urgentAt,
  sentAt: r.sentAt,
  closedAt: r.status === 'CLOSED' ? r.sentAt : null,
  cancelledAt: r.cancelledAt,
  cancelReason: r.cancelReason,
  urgentNote: r.urgentNote,
});

const startDraft = (cycle: RequisitionCycle, urgent: boolean, urgentNote: string | null): MockRequisition => {
  seq += 1;
  const lines: MockLine[] = ITEMS.slice(0, 12)
    .filter((i) => suggestion(i) > 0)
    .map((i) => ({ id: `l-${(lineSeq.n += 1)}`, itemId: i.id, requested: suggestion(i), approved: null, suggested: suggestion(i), changedByManager: false, reason: null, additionId: null }));
  return {
    id: `a0000000-0000-4000-8000-0000000001${seq}`,
    reference: `REQ-NYR-0${seq}`,
    cycle,
    status: 'OPEN',
    urgent,
    urgentNote,
    urgentAt: urgent ? iso() : null,
    openedAt: iso(),
    sectionStatus: 'DRAFT',
    lines,
    note: null,
    sentAt: null,
    approvedAt: null,
    cancelledAt: null,
    cancelReason: null,
    additionStatus: null,
    additionAt: null,
    replays: new Map(),
  };
};

const guardOpen = (r: MockRequisition): void => {
  if (r.status === 'CANCELLED') throw new ApiError('Cancelled.', 409, 'CANCELLED');
  if (r.status === 'APPROVED' || r.status === 'CLOSED') throw new ApiError('Already approved.', 409, 'SECTION_NOT_OPEN');
};
const guardPin = (pin: string): void => {
  if (pin !== PIN) throw new ApiError('Wrong PIN.', 400, 'INVALID_PIN');
};

const mutation = (r: MockRequisition, replayed = false) => ({ requisitionId: r.id, reference: r.reference, status: r.status, statusText: STATUS_TEXT[r.status], replayed });

const remember = async <T>(r: MockRequisition, key: string, make: () => T): Promise<T> => {
  const prior = r.replays.get(key);
  if (prior) return { ...(prior as T & { replayed: boolean }), replayed: true } as T;
  const result = make();
  r.replays.set(key, result);
  return result;
};

export const mockRequisitionsApi: RequisitionsPhoneApi = {
  async home(): Promise<Home> {
    await latency();
    const open = current;
    const byCycle = (c: RequisitionCycle) => (open && open.cycle === c ? { requisitionId: open.id, status: open.status } : null);
    const earlier = history.filter((h) => h.status !== 'CANCELLED').slice(0, 1);
    return {
      department: DEPARTMENT,
      suggestedCycle: 'AFTERNOON',
      suggestedLineCount: ITEMS.slice(0, 12).filter((i) => suggestion(i) > 0).length,
      open: open
        ? {
            requisitionId: open.id,
            reference: open.reference,
            cycle: open.cycle,
            cycleLabel: `${CYCLE_TEXT[open.cycle]} · ${DAY}`,
            status: open.status,
            statusText: STATUS_TEXT[open.status],
            urgent: open.urgent,
            openedAt: open.openedAt,
            section: sectionSummary(open),
            can: { edit: open.status === 'OPEN', recall: open.status === 'OPEN' && open.sectionStatus === 'SUBMITTED', addToIt: open.status === 'APPROVED' && open.additionStatus !== 'PENDING' },
          }
        : null,
      openByCycle: { MORNING: byCycle('MORNING'), AFTERNOON: byCycle('AFTERNOON'), EXTRA: byCycle('EXTRA') },
      earlierToday: earlier.map((h) => ({
        requisitionId: h.id,
        reference: h.reference,
        cycleLabel: `${CYCLE_TEXT[h.cycle]} · ${DAY}`,
        status: h.status,
        statusText: STATUS_TEXT[h.status],
        sectionStatus: h.sectionStatus,
        lineCount: h.lines.length,
        sentAt: h.sentAt,
      })),
    };
  },

  async file(id) {
    await latency();
    return fileWire(find(id));
  },

  async sectionEdit(id, departmentId): Promise<SectionEdit> {
    await latency();
    if (departmentId !== DEPARTMENT.id) throw new ApiError('Not your department.', 403, 'NOT_YOUR_DEPARTMENT');
    const r = find(id);
    return {
      requisitionId: r.id,
      reference: r.reference,
      cycleLabel: `${CYCLE_TEXT[r.cycle]} · ${DAY}`,
      requisitionStatus: r.status,
      urgent: r.urgent,
      openedAt: r.openedAt,
      section: detail(r),
      addable: addableFor(r),
    };
  },

  async historyMine(query): Promise<HistoryMine> {
    await latency();
    const pageSize = query.pageSize ?? 25;
    const page = query.page ?? 1;
    const rows = history.filter((h) => !query.status || h.status === query.status);
    const slice = rows.slice((page - 1) * pageSize, page * pageSize);
    return {
      rows: slice.map((h) => ({
        requisitionId: h.id,
        reference: h.reference,
        cycleLabel: `${CYCLE_TEXT[h.cycle]} · ${DAY}`,
        status: h.status,
        statusText: STATUS_TEXT[h.status],
        sectionStatus: h.sectionStatus,
        lineCount: h.lines.length,
        openedAt: h.openedAt,
        ...rowMoments(h),
      })),
      page: { page, pageSize, total: rows.length },
    };
  },

  async start(input) {
    await latency();
    if (current && current.cycle === input.cycle && current.status !== 'CANCELLED') {
      throw new ApiError('One is already open for this cycle.', 409, 'REQUISITION_ALREADY_OPEN');
    }
    if (current) history = [current, ...history];
    current = startDraft(input.cycle, Boolean(input.urgent), input.urgentNote ?? null);
    return mutation(current);
  },

  async saveLines(id, departmentId, input): Promise<SectionDetail> {
    await latency();
    if (departmentId !== DEPARTMENT.id) throw new ApiError('Not your department.', 403, 'NOT_YOUR_DEPARTMENT');
    const r = find(id);
    guardOpen(r);
    if (r.sectionStatus === 'SUBMITTED') r.sectionStatus = 'DRAFT';
    const kept = r.lines.filter((l) => l.additionId !== null);
    r.lines = [
      ...input.lines.map((l) => {
        const prior = r.lines.find((p) => p.itemId === l.itemId && p.additionId === null);
        itemOf(l.itemId);
        return { id: prior?.id ?? `l-${(lineSeq.n += 1)}`, itemId: l.itemId, requested: Number(l.requestedQty), approved: null, suggested: prior ? prior.suggested : null, changedByManager: false, reason: null, additionId: null };
      }),
      ...kept,
    ];
    if (input.noteForManager !== undefined) r.note = input.noteForManager;
    return detail(r);
  },

  async send(id, departmentId, pin, key): Promise<SendSectionResult> {
    await latency();
    if (departmentId !== DEPARTMENT.id) throw new ApiError('Not your department.', 403, 'NOT_YOUR_DEPARTMENT');
    const r = find(id);
    return remember(r, key, () => {
      guardOpen(r);
      guardPin(pin);
      if (r.lines.length === 0) throw new ApiError('Empty.', 409, 'SECTION_EMPTY');
      if (r.sectionStatus === 'SUBMITTED') throw new ApiError('Sent.', 409, 'SECTION_ALREADY_SENT');
      r.sectionStatus = 'SUBMITTED';
      r.sentAt = iso();
      r.status = 'PENDING_APPROVAL';
      return { ...mutation(r), section: sectionSummary(r), readyToApprove: true };
    });
  },

  async recall(id, departmentId): Promise<RecallSectionResult> {
    await latency();
    if (departmentId !== DEPARTMENT.id) throw new ApiError('Not your department.', 403, 'NOT_YOUR_DEPARTMENT');
    const r = find(id);
    if (r.status === 'APPROVED' || r.status === 'CLOSED') throw new ApiError('Approved.', 409, 'ALREADY_APPROVED');
    if (r.sectionStatus !== 'SUBMITTED') throw new ApiError('Not sent.', 409, 'SECTION_NOT_SENT');
    r.sectionStatus = 'DRAFT';
    r.status = 'OPEN';
    // Recall and resend: the head's quantities replace the manager's changes (Amendment 2).
    r.lines = r.lines.map((l) => ({ ...l, approved: null, changedByManager: false, reason: null }));
    return { ...mutation(r), section: sectionSummary(r) };
  },

  async setUrgent(id, input): Promise<SetUrgentResult> {
    await latency();
    const r = find(id);
    guardOpen(r);
    r.urgent = input.urgent;
    r.urgentAt = input.urgent ? iso() : null;
    r.urgentNote = input.urgent ? (input.urgentNote ?? r.urgentNote) : null;
    return { ...mutation(r), urgent: r.urgent, urgentAt: r.urgentAt };
  },

  async addAddition(id, input, key) {
    await latency();
    const r = find(id);
    return remember(r, key, () => {
      if (r.status !== 'APPROVED') throw new ApiError('Not approved.', 409, 'NOT_APPROVED');
      guardPin(input.pin);
      r.additionStatus = 'PENDING';
      r.additionAt = iso();
      for (const l of input.lines) {
        itemOf(l.itemId);
        r.lines.push({ id: `l-${(lineSeq.n += 1)}`, itemId: l.itemId, requested: Number(l.requestedQty), approved: null, suggested: null, changedByManager: false, reason: null, additionId: 'add-1' });
      }
      const addition = fileWire(r).additions[0];
      if (!addition) throw new ApiError('Addition failed.', 500, 'UNKNOWN_ERROR');
      return { ...mutation(r), addition };
    });
  },
};

// --- Play the Branch Manager, from the browser console (mock only) ----------------------------------------------------------

interface MockControls {
  approve: () => string;
  managerChange: () => string;
  cancel: () => string;
  approveAddition: () => string;
  reset: () => string;
  fail: (code: string, times?: number) => string;
  slow: (ms: number) => string;
  emptyHistory: () => string;
}

const controls: MockControls = {
  approve: () => {
    if (!current || current.status !== 'PENDING_APPROVAL') return 'Send the list first.';
    current.status = 'APPROVED';
    current.approvedAt = iso();
    current.lines = current.lines.map((l) => ({ ...l, approved: l.approved ?? l.requested }));
    return 'Approved.';
  },
  managerChange: () => {
    if (!current || current.status !== 'PENDING_APPROVAL') return 'Send the list first.';
    const line = current.lines[0];
    if (!line) return 'No lines.';
    line.approved = Math.max(1, line.requested - 4);
    line.changedByManager = true;
    line.reason = 'too much for the week';
    return `Changed ${itemOf(line.itemId).name}.`;
  },
  cancel: () => {
    if (!current) return 'Nothing open.';
    current.status = 'CANCELLED';
    current.cancelledAt = iso();
    current.cancelReason = 'Asked for the wrong cycle';
    return 'Cancelled.';
  },
  approveAddition: () => {
    if (!current || current.additionStatus !== 'PENDING') return 'No addition waiting.';
    current.additionStatus = 'APPROVED';
    current.lines = current.lines.map((l) => (l.additionId ? { ...l, approved: l.requested } : l));
    return 'Addition approved.';
  },
  reset: () => {
    current = null;
    history = oldOnes();
    seq = 112;
    delayMs = 180;
    injected = null;
    return 'Reset.';
  },
  fail: (code, times = 1) => {
    injected = { code, remaining: times };
    return `The next ${times} call(s) fail with ${code}.`;
  },
  slow: (ms) => {
    delayMs = ms;
    return `Every call now takes ${ms} ms.`;
  },
  emptyHistory: () => {
    history = [];
    return 'History is empty.';
  },
};

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_REQUISITIONS_MOCK === '1') {
  // A start-up setting for states that must exist before the first call: sessionStorage `reqMockInit` = {"slow":3000,"fail":{"code":"SERVER","times":1},"emptyHistory":true}.
  try {
    const init = JSON.parse(window.sessionStorage.getItem('reqMockInit') ?? 'null') as { slow?: number; fail?: { code: string; times?: number }; emptyHistory?: boolean } | null;
    if (init?.slow) delayMs = init.slow;
    if (init?.fail) injected = { code: init.fail.code, remaining: init.fail.times ?? 1 };
    if (init?.emptyHistory) history = [];
  } catch {
    /* no start-up setting */
  }
  (window as unknown as { __requisitionsMock: MockControls }).__requisitionsMock = controls;
}
