/**
 * A hand-written mock of the Requisitions API, answering from the frozen contract fixtures. Used only when
 * `NEXT_PUBLIC_REQUISITIONS_MOCK=1`, until back end B lands. It is stateless: a write returns the fixture's result.
 *
 * To exercise the states, set `sessionStorage.reqMockScenario` in the browser to one of:
 * `slow` (3 s delay: the loading skeleton), `empty` (lists hold no rows), `error` (every read fails with a 500),
 * or `write:<CODE>` (every write is refused with that error code, e.g. `write:INVALID_PIN`).
 */
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import fixtures from '../types/requisitions-contract.fixtures.json';
import type {
  Activity,
  ApproveAdditionResult,
  ApproveResult,
  ApproveSummary,
  Badges,
  CancelResult,
  ChangeQuantityResult,
  Documents,
  ListRequisitions,
  ListRequisitionsQuery,
  NudgeResult,
  Print,
  RequisitionFile,
  SaveLinesInput,
  SectionDetail,
  SectionEdit,
  SendSectionResult,
  SetUrgentInput,
  SetUrgentResult,
  SkipSectionResult,
  StartRequisitionResult,
} from '../types/requisitions-contract';

const scenario = (): string => {
  try {
    return window.sessionStorage.getItem('reqMockScenario') ?? '';
  } catch {
    return '';
  }
};

const MESSAGES: Record<string, string> = {
  INVALID_PIN: 'That PIN did not work. Check it and try again.',
  SECTION_NOT_SENT: 'Section not sent.',
  DEPARTMENT_PACKED: 'Packed.',
  REASON_REQUIRED: 'A reason is required.',
};

const read = <T>(value: T): Promise<T> =>
  new Promise((resolve, reject) => {
    const s = scenario();
    window.setTimeout(() => (s === 'error' ? reject(new ApiError('Server error', 500, 'SERVER_ERROR')) : resolve(structuredClone(value))), s === 'slow' ? 3000 : 120);
  });

const write = <T>(value: T): Promise<T> =>
  new Promise((resolve, reject) => {
    const s = scenario();
    window.setTimeout(() => {
      if (s.startsWith('write:')) {
        const code = s.slice('write:'.length);
        reject(new ApiError(MESSAGES[code] ?? 'Refused.', 409, code));
      } else resolve(structuredClone(value));
    }, s === 'slow' ? 3000 : 120);
  });

/** `…0113` is a Collecting file with Housekeeping missing; `…0114` is an Approved file with a Kitchen addition waiting; any other id is the fixture. */
function fileVariant(id: string): RequisitionFile {
  const base = structuredClone(fixtures.fileManager as RequisitionFile);
  const [kitchen, housekeeping] = base.sections;
  if (!kitchen || !housekeeping) return base;
  if (id.endsWith('0113')) {
    housekeeping.status = 'NOT_STARTED';
    housekeeping.statusText = 'Not started';
    housekeeping.skippedAt = null;
    housekeeping.skippedBy = null;
    housekeeping.can = { ...housekeeping.can, fillMyself: true, nudge: true, skip: true };
    base.status = 'OPEN';
    base.statusText = 'Collecting';
    base.nextStep = { action: 'NUDGE', departmentId: housekeeping.departmentId, facts: { sectionsIn: 1, sectionsTotal: 2, additionsWaiting: 0 } };
    base.can = { ...base.can, nudge: true, skip: true, approve: false };
    base.tracker = base.tracker.map((s) => (s.key === 'ALL_IN' ? { ...s, state: 'CURRENT', at: null, count: { done: 1, total: 2 } } : s));
  }
  if (id.endsWith('0114')) {
    const line = { ...kitchen.lines[0]!, id: 'c0000000-0000-4000-8000-0000000000aa', itemId: '10000000-0000-4000-8000-0000000000aa', itemName: 'Chicken breast', unit: 'tray', requestedQty: '4', approvedQty: null, additionId: 'e0000000-0000-4000-8000-000000000001', changedByManager: false, changeReason: null };
    base.status = 'APPROVED';
    base.statusText = 'Approved';
    base.approvedAt = '2026-10-07T11:11:00.000Z';
    base.approvedBy = { id: 'u-peter', name: 'Peter Njoroge', initials: 'PN', roleLabel: 'Branch Manager' };
    base.additions = [
      { id: 'e0000000-0000-4000-8000-000000000001', departmentId: kitchen.departmentId, departmentName: 'Kitchen', status: 'PENDING', statusText: 'Waiting', addedBy: kitchen.head ?? base.openedBy, addedAt: '2026-10-07T12:14:00.000Z', approvedBy: null, approvedAt: null, lines: [line], valueKes: '880.00', can: { approve: true } },
    ];
    base.nextStep = { action: 'APPROVE_ADDITION', departmentId: null, facts: { sectionsIn: 2, sectionsTotal: 2, additionsWaiting: 1 } };
    base.can = { ...base.can, approve: true, cancel: false, changeQuantity: true };
    base.tracker = base.tracker.map((s) => (s.key === 'APPROVED' ? { ...s, state: 'DONE', at: base.approvedAt, by: base.approvedBy } : s.key === 'PACKED' ? { ...s, state: 'CURRENT' } : s));
  }
  // The server decides what each role may do; the mock mimics it so the screens can be checked per role.
  const role = useAuthStore.getState().user?.role;
  if (role !== 'MANAGER') {
    const approveOnly = role === 'DIRECTOR';
    base.can = { nudge: false, skip: false, changeQuantity: false, approve: approveOnly && base.can.approve, cancel: false, setUrgent: false, addToIt: false, print: base.can.print, startNew: false };
    for (const s of base.sections) s.can = { ...s.can, edit: false, send: false, recall: false, nudge: false, skip: false, fillMyself: false, changeQuantity: false };
    for (const a of base.additions) a.can = { approve: approveOnly };
    if (!approveOnly && base.nextStep.action !== 'PRINT') base.nextStep = { ...base.nextStep, action: null };
  }
  return base;
}

export const mockRequisitions = {
  list: (query: ListRequisitionsQuery): Promise<ListRequisitions> => {
    const base = (query.tab === 'collecting' ? fixtures.listHubCollecting : fixtures.listManager) as ListRequisitions;
    const empty = scenario() === 'empty';
    if (query.tab === 'closed' || query.tab === 'discrepancies') {
      const first = base.rows[0];
      const closedRows: ListRequisitions['rows'] = first && query.tab === 'closed'
        ? [
            { ...first, id: 'a0000000-0000-4000-8000-000000000108', reference: 'REQ-NYR-0108', cycleLabel: 'Morning · Wed 7 Oct', status: 'CLOSED', statusText: 'Closed', tab: 'closed', rowAction: null, closedAt: '2026-10-07T06:12:00.000Z', lineCount: 38, urgent: false },
            { ...first, id: 'a0000000-0000-4000-8000-000000000107', reference: 'REQ-NYR-0107', cycleLabel: 'Extra · Tue 6 Oct', status: 'CANCELLED', statusText: 'Cancelled', tab: 'closed', rowAction: null, cancelledAt: '2026-10-06T13:05:00.000Z', cancelReason: 'Asked twice by mistake', lineCount: 4, urgent: false, sections: first.sections.slice(0, 1) },
          ]
        : [];
      const closedBranches = useAuthStore.getState().user?.role !== 'MANAGER' ? ((fixtures.listHubCollecting as ListRequisitions).branches ?? []) : undefined;
      return read({ ...base, ...(closedBranches ? { branches: closedBranches } : {}), tab: query.tab, rows: empty ? [] : closedRows, page: { ...base.page, total: empty ? 0 : closedRows.length } });
    }
    // A hub role (anyone but the Branch Manager) gets the branch picker, as the real list will.
    const hub = useAuthStore.getState().user?.role !== 'MANAGER';
    const branches = hub ? ((fixtures.listHubCollecting as ListRequisitions).branches ?? []) : undefined;
    return read({ ...base, ...(branches ? { branches } : {}), tab: query.tab ?? base.tab, rows: empty ? [] : base.rows, page: empty ? { ...base.page, total: 0 } : base.page });
  },
  badges: (): Promise<Badges> => read(fixtures.badgesManager as Badges),
  file: (id: string): Promise<RequisitionFile> => read(fileVariant(id)),
  activity: (): Promise<Activity> => read(scenario() === 'empty' ? { events: [] } : (fixtures.activity as Activity)),
  documents: (): Promise<Documents> => read(scenario() === 'empty' ? { documents: [] } : (fixtures.documents as Documents)),
  print: (): Promise<Print> => read(fixtures.print as Print),
  section: (): Promise<SectionEdit> => read(fixtures.sectionEdit as SectionEdit),
  approveSummary: (): Promise<ApproveSummary> => read(fixtures.approveSummary as ApproveSummary),
  start: (): Promise<StartRequisitionResult> => write(fixtures.startResult as StartRequisitionResult),
  saveLines: (_input: SaveLinesInput): Promise<SectionDetail> => write((fixtures.sectionEdit as SectionEdit).section),
  send: (): Promise<SendSectionResult> => write(fixtures.sendSectionResult as SendSectionResult),
  setUrgent: (input: SetUrgentInput): Promise<SetUrgentResult> => write({ ...(fixtures.setUrgentResult as SetUrgentResult), urgent: input.urgent }),
  changeQuantity: (): Promise<ChangeQuantityResult> => write(fixtures.changeQuantityResult as ChangeQuantityResult),
  nudge: (): Promise<NudgeResult> => write(fixtures.nudgeResult as NudgeResult),
  skip: (): Promise<SkipSectionResult> => write(fixtures.skipSectionResult as SkipSectionResult),
  approve: (): Promise<ApproveResult> => write(fixtures.approveResult as ApproveResult),
  cancel: (): Promise<CancelResult> => write(fixtures.cancelResult as CancelResult),
  approveAddition: (): Promise<ApproveAdditionResult> => write(fixtures.approveAdditionResult as ApproveAdditionResult),
};
