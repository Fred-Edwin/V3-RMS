import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { ForbiddenError } from '../../../utils/errors';
import { actorCan } from '../_shared/central-store-access';
import { initialsOf, toPerson } from '../counting/_shared/count-people';
import { nairobiDayEnd, nairobiDayStart } from '../counting/_shared/count-time';
import {
  REQUISITION_STATUS_TEXT,
  eventTypeSchema,
  type Activity,
  type Badges,
  type Documents,
  type Home,
  type HistoryMine,
  type HistoryMineQuery,
  type ListRequisitions,
  type ListRequisitionsQuery,
  type RequisitionCycle,
  type RequisitionRow,
  type RequisitionStatus,
  type RequisitionTab,
  type SectionStatus,
  type TabCounts,
} from './_shared/requisitions-contract';
import { NAMES_REQUISITION, sentenceOf } from './_shared/requisitions-sentences';
import { requisitionsListRepository as listRepo, type FactsRecord, type ListFilters } from './requisitions-list-repository';
import { requisitionsRepository as repo, type RequisitionRecord, type Scope } from './requisitions-repository';
import { loadCaller, loadFile, readScope, restrictedHead, viewerFor, type Caller } from './requisitions-service';
import { defaultTab, headIsWaited, tabOf, waitingTab, type DispatchState, type WaitingFamily } from './requisitions-tabs';
import { urgentOverHour } from './requisitions-state';
import { additionStatusMap, cycleLabelOf, cycleOf, fileWire, sectionDetailWire, sectionLines, sectionSummaryWire, sectionValue } from './requisitions-view';

type Actor = NonNullable<Request['user']>;

const LIVE: RequisitionStatus[] = ['OPEN', 'PENDING_APPROVAL', 'APPROVED'];
const kes = (n: number): string => n.toFixed(2);

/** Whose waiting is the dark badge: approvers wait on To approve, the store on To pack, a head on their own unsent list. */
const familyOf = (c: Caller): WaitingFamily => {
  if (actorCan(c.actor, 'requisitions.approve')) return 'APPROVER';
  if (c.actor.role === 'STORE_MANAGER' || c.actor.role === 'STORE_ATTENDANT') return 'STORE';
  return c.headDepartmentId ? 'HEAD' : 'NONE';
};

/** A Nairobi `YYYY-MM-DD` as an instant (00:00 Nairobi), and the next day's start for an inclusive `to`. */
const dayStartOf = (day: string): Date => new Date(`${day}T00:00:00+03:00`);
const dayAfter = (day: string): Date => new Date(dayStartOf(day).getTime() + 24 * 60 * 60 * 1000);

const tabFromFacts = (f: FactsRecord): RequisitionTab => {
  const state = (key: string | null): DispatchState | null => {
    const hit = f.dispatches.find((d) => d.departmentTag === key);
    return hit ? hit.status : null;
  };
  return tabOf({
    status: f.status as RequisitionStatus,
    additionWaiting: f.additions.length > 0,
    sentDepartments: f.sections.filter((s) => s.status === 'SUBMITTED' && s.department?.key).map((s) => ({ dispatch: state(s.department?.key ?? null) })),
  });
};

const emptyCounts = (): TabCounts => ({ collecting: 0, 'to-approve': 0, 'to-pack': 0, 'on-the-way': 0, 'to-confirm': 0, discrepancies: 0, closed: 0 });

/** The moment the last section went in (the requisition stopped Collecting), from the sections' own times. */
const allInAtOf = (rec: RequisitionRecord): Date | null => {
  if (rec.status === 'OPEN') return null;
  const times = rec.sections.flatMap((s) => [s.submittedAt, s.skippedAt]).filter((t): t is Date => t !== null);
  return times.length === 0 ? null : new Date(Math.max(...times.map((t) => t.getTime())));
};

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

/** The seven moments every row carries (Amendment 2). `sentAt` is the head's section time on R9 rows and null on R1 rows. */
const momentsOf = (rec: RequisitionRecord, sentAt: Date | null) => ({
  allInAt: iso(allInAtOf(rec)),
  urgentAt: iso(rec.urgentAt),
  sentAt: iso(sentAt),
  closedAt: iso(rec.closedAt),
  cancelledAt: iso(rec.cancelledAt),
  cancelReason: rec.cancelReason,
  urgentNote: rec.urgentNote,
});

export const requisitionsListService = {
  // ======================================================================================================================
  // R1 GET / the list
  // ======================================================================================================================
  list: async (actor: Actor, query: ListRequisitionsQuery, now: Date = new Date()): Promise<ListRequisitions> => {
    const c = await loadCaller(actor);
    const scope = readScope(c);
    const head = restrictedHead(c);
    const family = familyOf(c);
    const hubReader = 'anyBranch' in scope;
    const filters: ListFilters = {
      // A branch-bound caller (the Branch Manager, a head) is already narrowed to their branch; the picker is for hub roles.
      ...(hubReader && query.branchId ? { branchId: query.branchId } : {}),
      ...(query.q ? { q: query.q } : {}),
      ...(query.from ? { fromAt: dayStartOf(query.from) } : {}),
      ...(query.to ? { toAt: dayAfter(query.to) } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.cycle ? { cycle: query.cycle } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.urgent !== undefined ? { urgent: query.urgent } : {}),
      ...(head ? { headDepartmentId: head } : {}),
    };

    const [facts, waitingForYou, branches] = await Promise.all([
      listRepo.listFacts(scope, filters),
      requisitionsListService.waiting(c, scope),
      hubReader ? listRepo.listBranches() : Promise.resolve(undefined),
    ]);

    const tabById = new Map(facts.map((f) => [f.id, tabFromFacts(f)]));
    const tabCounts = emptyCounts();
    for (const tab of tabById.values()) tabCounts[tab] += 1;

    const tab = query.tab ?? defaultTab(family);
    const matching = facts.filter((f) => tabById.get(f.id) === tab);
    const start = (query.page - 1) * query.pageSize;
    const pageIds = matching.slice(start, start + query.pageSize).map((f) => f.id);
    const records = await listRepo.findFiles(scope, pageIds);

    const seeValue = actorCan(actor, 'requisitions.see_value');
    const rows = records.map((rec) => rowWire(rec, tabById.get(rec.id) ?? 'collecting', { c, seeValue, head, now }));
    return { tab, rows, tabCounts, waitingForYou, ...(branches ? { branches } : {}), page: { page: query.page, pageSize: query.pageSize, total: matching.length } };
  },

  // ======================================================================================================================
  // The caller's waiting count, and R2 GET /badges
  // ======================================================================================================================
  /** What waits for this caller (the dark badge): independent of any filter on the list. */
  waiting: async (c: Caller, scope: Scope = readScope(c)): Promise<number> => {
    const family = familyOf(c);
    if (family === 'NONE') return 0;
    const head = restrictedHead(c);
    const facts = await listRepo.listFacts(scope, { statuses: LIVE, ...(head ? { headDepartmentId: head } : {}) });
    if (family === 'HEAD') {
      return facts.filter((f) => headIsWaited(f.status as RequisitionStatus, (f.sections.find((s) => s.departmentId === c.headDepartmentId)?.status ?? 'SUBMITTED') as SectionStatus)).length;
    }
    const wanted = waitingTab(family);
    return facts.filter((f) => tabFromFacts(f) === wanted).length;
  },

  badges: async (actor: Actor): Promise<Badges> => {
    const c = await loadCaller(actor);
    const family = familyOf(c);
    if (family === 'NONE' && !actorCan(actor, 'requisitions.read')) throw new ForbiddenError('You do not have permission to view requisitions');
    const scope = readScope(c);
    const head = restrictedHead(c);
    const facts = await listRepo.listFacts(scope, { statuses: LIVE, ...(head ? { headDepartmentId: head } : {}) });
    const count = (tab: RequisitionTab): number => facts.filter((f) => tabFromFacts(f) === tab).length;
    if (family === 'APPROVER') return { requisitions: count('to-approve'), toApprove: count('to-approve') };
    if (family === 'STORE') return { requisitions: count('to-pack'), toPack: count('to-pack') };
    if (family === 'HEAD') {
      const mine = facts.filter((f) => headIsWaited(f.status as RequisitionStatus, (f.sections.find((s) => s.departmentId === c.headDepartmentId)?.status ?? 'SUBMITTED') as SectionStatus)).length;
      return { requisitions: mine };
    }
    return { requisitions: 0 };
  },

  // ======================================================================================================================
  // R4 GET /:id/activity
  // ======================================================================================================================
  activity: async (actor: Actor, id: string): Promise<Activity> => {
    const c = await loadCaller(actor);
    const rec = await loadFile(c, id);
    const head = restrictedHead(c);
    const sectionDepartment = new Map(rec.sections.map((s) => [s.id, { id: s.departmentId, name: s.department?.name ?? null }]));
    const events = await listRepo.listEvents(rec.id, rec.siteId);
    const lineLabels = await listRepo.findLineLabels(rec.siteId, events.flatMap((e) => (e.lineId ? [e.lineId] : [])));
    return {
      events: events.flatMap((e) => {
        const type = eventTypeSchema.safeParse(e.type);
        if (!type.success) return [];
        const section = e.sectionId ? sectionDepartment.get(e.sectionId) : undefined;
        // A head reads the events of the requisition as a whole and of their own department, not another department's.
        if (head && section && section.id !== head) return [];
        const sentence = sentenceOf(
          { type: type.data, fromValue: e.fromValue, toValue: e.toValue, reason: e.reason },
          { reference: rec.reference, departmentName: section?.name ?? null, line: e.lineId ? (lineLabels.get(e.lineId) ?? null) : null },
        );
        return [
          {
            id: e.id,
            type: type.data,
            at: e.at.toISOString(),
            actor: { id: e.actor.id, name: e.actor.name, initials: initialsOf(e.actor.name), roleLabel: e.actorRoleLabel },
            sentence,
            departmentId: section?.id ?? null,
            lineId: e.lineId,
            fromValue: e.fromValue,
            toValue: e.toValue,
            reason: e.reason,
            link: NAMES_REQUISITION.includes(type.data) ? { kind: 'REQUISITION' as const, id: rec.id, reference: rec.reference } : null,
          },
        ];
      }),
    };
  },

  // ======================================================================================================================
  // R5 GET /:id/documents
  // ======================================================================================================================
  /** The printed versions: one when the requisition was approved, one after each approved addition. Derived, never stored. */
  documents: async (actor: Actor, id: string): Promise<Documents> => {
    const c = await loadCaller(actor);
    const rec = await loadFile(c, id);
    const head = restrictedHead(c);
    if (!rec.approvedAt || !rec.approvedBy) return { documents: [] };
    const documents: Documents['documents'] = [{ id: rec.id, version: 1, label: 'Requisition · approved', at: rec.approvedAt.toISOString(), by: toPerson(rec.approvedBy) }];
    const approved = rec.additions
      .filter((a) => a.status === 'APPROVED' && a.approvedAt && a.approvedBy && (!head || a.departmentId === head))
      .sort((a, b) => (a.approvedAt as Date).getTime() - (b.approvedAt as Date).getTime());
    for (const a of approved) {
      const n = rec.sections.flatMap((s) => s.lines).filter((l) => l.additionId === a.id).length;
      documents.push({
        id: a.id,
        version: documents.length + 1,
        label: `Requisition · with ${n} added ${n === 1 ? 'line' : 'lines'}`,
        at: (a.approvedAt as Date).toISOString(),
        by: toPerson(a.approvedBy as NonNullable<typeof a.approvedBy>),
      });
    }
    return { documents };
  },

  // ======================================================================================================================
  // R7 GET /home (a head)
  // ======================================================================================================================
  home: async (actor: Actor, now: Date = new Date()): Promise<Home> => {
    const c = await loadCaller(actor);
    const departmentId = c.headDepartmentId;
    const siteId = c.staff.siteId;
    if (!departmentId || !siteId) throw new ForbiddenError('Only a department head has a Requisitions home');
    const department = await repo.findDepartment(siteId, departmentId);
    if (!department) throw new ForbiddenError('Only a department head has a Requisitions home');

    const today = await listRepo.listTodayForDepartment(siteId, departmentId, nairobiDayStart(now), nairobiDayEnd(now));
    // A cancelled requisition does not hold the cycle: the head may start it again.
    const live = today.filter((r) => r.status !== 'CANCELLED');
    const latestFor = (cycle: RequisitionCycle): RequisitionRecord | null => live.find((r) => cycleOf(r.type) === cycle) ?? null;
    const entry = (rec: RequisitionRecord | null) => (rec ? { requisitionId: rec.id, status: rec.status as RequisitionStatus } : null);

    // Morning until noon (Nairobi), Afternoon after; Extra is chosen by the head.
    const suggestedCycle: RequisitionCycle = (now.getUTCHours() + 3) % 24 < 12 ? 'MORNING' : 'AFTERNOON';
    const openRec = latestFor(suggestedCycle);
    const viewer = openRec ? await viewerFor(c, openRec, now) : null;
    const section = openRec?.sections.find((s) => s.departmentId === departmentId);
    const detail = openRec && viewer && section ? sectionDetailWire(section, openRec, viewer) : null;
    const file = openRec && viewer ? fileWire(openRec, viewer, null) : null;

    return {
      department: { id: department.id, name: department.name },
      suggestedCycle,
      suggestedLineCount: await requisitionsListService.suggestedLineCount(siteId, departmentId),
      open:
        openRec && viewer && section && detail && file
          ? {
              requisitionId: openRec.id,
              reference: openRec.reference,
              cycle: cycleOf(openRec.type),
              cycleLabel: cycleLabelOf(openRec.type, openRec.openedAt),
              status: openRec.status as RequisitionStatus,
              statusText: REQUISITION_STATUS_TEXT[openRec.status as RequisitionStatus],
              urgent: openRec.urgent,
              openedAt: openRec.openedAt.toISOString(),
              section: sectionSummaryWire(section, openRec, viewer),
              can: { edit: detail.can.edit, recall: detail.can.recall, addToIt: file.can.addToIt },
            }
          : null,
      openByCycle: { MORNING: entry(latestFor('MORNING')), AFTERNOON: entry(latestFor('AFTERNOON')), EXTRA: entry(latestFor('EXTRA')) },
      earlierToday: live
        .filter((r) => r.id !== openRec?.id)
        .map((r) => {
          const own = r.sections.find((s) => s.departmentId === departmentId);
          return {
            requisitionId: r.id,
            reference: r.reference,
            cycleLabel: cycleLabelOf(r.type, r.openedAt),
            status: r.status as RequisitionStatus,
            statusText: REQUISITION_STATUS_TEXT[r.status as RequisitionStatus],
            sectionStatus: (own?.status ?? 'NOT_STARTED') as SectionStatus,
            lineCount: own ? sectionLines(own, additionStatusMap(r)).length : 0,
            sentAt: iso(own?.submittedAt ?? null),
          };
        }),
    };
  },

  /** How many lines starting a requisition would pre-fill for the department: items whose restock level is above what is on hand. */
  suggestedLineCount: async (siteId: string, departmentId: string): Promise<number> => {
    const location = await repo.findDepartmentLocation(siteId, departmentId);
    if (!location) return 0;
    const items = await repo.listTaggedItems(siteId, departmentId);
    const stock = await repo.readStock(siteId, location.id, items.map((i) => i.id));
    return items.filter((i) => {
      const level = stock.level.get(i.id);
      if (!level) return false;
      return level.minus(stock.onHand.get(i.id) ?? new Prisma.Decimal(0)).greaterThan(0);
    }).length;
  },

  // ======================================================================================================================
  // R9 GET /history/mine (a head)
  // ======================================================================================================================
  history: async (actor: Actor, query: HistoryMineQuery): Promise<HistoryMine> => {
    const c = await loadCaller(actor);
    const departmentId = c.headDepartmentId;
    const siteId = c.staff.siteId;
    if (!departmentId || !siteId) throw new ForbiddenError('Only a department head has a requisition history');
    const scope: Scope = { siteId };
    const facts = await listRepo.listFacts(scope, {
      headDepartmentId: departmentId,
      ...(query.from ? { fromAt: dayStartOf(query.from) } : {}),
      ...(query.to ? { toAt: dayAfter(query.to) } : {}),
      ...(query.status ? { status: query.status } : {}),
    });
    const start = (query.page - 1) * query.pageSize;
    const records = await listRepo.findFiles(scope, facts.slice(start, start + query.pageSize).map((f) => f.id));
    return {
      rows: records.map((rec) => {
        const own = rec.sections.find((s) => s.departmentId === departmentId);
        return {
          ...momentsOf(rec, own?.submittedAt ?? null),
          requisitionId: rec.id,
          reference: rec.reference,
          cycleLabel: cycleLabelOf(rec.type, rec.openedAt),
          status: rec.status as RequisitionStatus,
          statusText: REQUISITION_STATUS_TEXT[rec.status as RequisitionStatus],
          sectionStatus: (own?.status ?? 'NOT_STARTED') as SectionStatus,
          lineCount: own ? sectionLines(own, additionStatusMap(rec)).length : 0,
          openedAt: rec.openedAt.toISOString(),
        };
      }),
      page: { page: query.page, pageSize: query.pageSize, total: facts.length },
    };
  },
};

// --- One R1 row ----------------------------------------------------------------------------------------------------------------

interface RowContext {
  c: Caller;
  seeValue: boolean;
  head: string | null;
  now: Date;
}

const rowWire = (rec: RequisitionRecord, tab: RequisitionTab, ctx: RowContext): RequisitionRow => {
  const { c, head, now } = ctx;
  const additions = additionStatusMap(rec);
  // A head sees their own department only; nobody else's list, count or money.
  const sections = head ? rec.sections.filter((s) => s.departmentId === head) : rec.sections;
  const lineCount = sections.reduce((sum, s) => sum + sectionLines(s, additions).length, 0);
  const value = sections.reduce((sum, s) => sum + sectionValue(s, additions), 0);
  const additionWaiting = (head ? rec.additions.filter((a) => a.departmentId === head) : rec.additions).some((a) => a.status === 'PENDING');
  const mayApproveHere = actorCan(c.actor, 'requisitions.approve') && (c.actor.role === 'DIRECTOR' || c.actor.role === 'SYSTEM_ADMIN' || c.staff.siteId === rec.siteId);
  const mayNudgeHere = actorCan(c.actor, 'requisitions.nudge') && (c.actor.role === 'SYSTEM_ADMIN' || c.staff.siteId === rec.siteId);
  const waiting = rec.status === 'OPEN' ? rec.sections.find((s) => s.department?.status === 'ACTIVE' && (s.status === 'NOT_STARTED' || s.status === 'DRAFT')) : undefined;

  let rowAction: RequisitionRow['rowAction'] = null;
  if (rec.status === 'PENDING_APPROVAL' && mayApproveHere) rowAction = { action: 'APPROVE_AND_SIGN', label: 'Open and approve', departmentId: null };
  else if (rec.status === 'APPROVED' && additionWaiting && mayApproveHere) rowAction = { action: 'APPROVE_ADDITION', label: 'Open and approve', departmentId: null };
  else if (waiting && mayNudgeHere) rowAction = { action: 'NUDGE', label: `Nudge ${waiting.department?.name ?? 'department'}`, departmentId: waiting.departmentId };

  return {
    ...momentsOf(rec, null),
    id: rec.id,
    reference: rec.reference,
    cycle: cycleOf(rec.type),
    cycleLabel: cycleLabelOf(rec.type, rec.openedAt),
    branch: { id: rec.site.id, name: rec.site.name, code: rec.site.code },
    status: rec.status as RequisitionStatus,
    statusText: REQUISITION_STATUS_TEXT[rec.status as RequisitionStatus],
    tab,
    sections: sections.map((s) => ({ departmentId: s.departmentId ?? '', departmentName: s.department?.name ?? '', status: s.status as SectionStatus })),
    lineCount,
    ...(ctx.seeValue ? { valueKes: kes(value) } : {}),
    openedAt: rec.openedAt.toISOString(),
    urgent: rec.urgent,
    urgentOverHour: urgentOverHour({ urgent: rec.urgent, urgentAt: rec.urgentAt, status: rec.status as RequisitionStatus }, now),
    additionWaiting,
    rowAction,
  };
};
