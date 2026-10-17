import { Prisma } from '@prisma/client';
import type { ContractStatus, EmploymentStatus, MoveKind, MoveStatus } from '@prisma/client';
import { prisma } from '../../../../config/database';
import type { Db } from '../employees/employees-repository';

/** Contract, probation, moves, exit, undo and rehire. Every query names the company, directly or through the employee. */
const ACTIVE_HEAD = (today: Date): Prisma.DepartmentHeadWhereInput => ({
  startsOn: { lte: today },
  OR: [{ endsOn: null }, { endsOn: { gte: today } }],
});

const EMPLOYEE_FOR_LIFECYCLE = {
  id: true,
  companyId: true,
  siteId: true,
  userId: true,
  name: true,
  departmentId: true,
  positionId: true,
  reportsToId: true,
  status: true,
  payType: true,
  contractStatus: true,
  tracksTime: true,
  tracksTimeOverride: true,
  startDate: true,
  probationEndsOn: true,
  probationExtensions: true,
  probationDecidedOn: true,
  probationConfirmedOn: true,
  exitedOn: true,
  personalPhone: true,
  legacyProfileId: true,
  department: { select: { key: true, siteId: true } },
  position: { select: { id: true, defaultTracksTime: true } },
} as const satisfies Prisma.EmployeeSelect;

export type LifecycleEmployee = Prisma.EmployeeGetPayload<{ select: typeof EMPLOYEE_FOR_LIFECYCLE }>;

export interface NewMove {
  employeeId: string;
  kind: MoveKind;
  status: MoveStatus;
  fromSiteId: string;
  toSiteId: string;
  fromDepartmentId: string | null;
  toDepartmentId: string | null;
  toPositionId: string | null;
  toReportsToId: string | null;
  startsOn: Date;
  endsOn: Date | null;
  summary: Prisma.InputJsonValue | null;
  createdById: string;
}

const MOVE_INCLUDE = { employee: { select: EMPLOYEE_FOR_LIFECYCLE } } as const satisfies Prisma.EmployeeMoveInclude;
export type MoveWithEmployee = Prisma.EmployeeMoveGetPayload<{ include: typeof MOVE_INCLUDE }>;

export const lifecycleRepository = {
  // ---- reads -----------------------------------------------------------------------------------
  findEmployee: (db: Db, companyId: string, id: string): Promise<LifecycleEmployee | null> =>
    db.employee.findFirst({ where: { id, companyId }, select: EMPLOYEE_FOR_LIFECYCLE }),

  /** The same reads on the default client, for callers that are not inside a transaction. */
  findEmployeeTop: (companyId: string, id: string): Promise<LifecycleEmployee | null> => prisma.employee.findFirst({ where: { id, companyId }, select: EMPLOYEE_FOR_LIFECYCLE }),
  currentSpellTop: (employeeId: string) => prisma.employmentSpell.findFirst({ where: { employeeId }, orderBy: { startsOn: 'desc' } }),

  currentSpell: (db: Db, employeeId: string) => db.employmentSpell.findFirst({ where: { employeeId }, orderBy: { startsOn: 'desc' } }),

  activeContracts: (db: Db, employeeId: string) => db.contract.findMany({ where: { employeeId, status: 'ACTIVE' }, select: { id: true } }),

  activeHeadRows: (db: Db, employeeId: string, today: Date) =>
    db.departmentHead.findMany({ where: { employeeId, ...ACTIVE_HEAD(today) }, select: { id: true, departmentId: true, isActing: true, startsOn: true } }),

  userIsActive: async (userId: string): Promise<boolean> => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } });
    return user?.isActive === true;
  },

  departmentHasHead: async (db: Db, departmentId: string, today: Date): Promise<boolean> => {
    const found = await db.departmentHead.findFirst({ where: { departmentId, isActing: false, ...ACTIVE_HEAD(today) }, select: { id: true } });
    return found !== null;
  },

  findDepartment: (companyId: string, id: string) =>
    prisma.department.findFirst({
      where: { id, site: { companyId } },
      select: { id: true, siteId: true, name: true, status: true, key: true, positions: { select: { positionId: true } } },
    }),

  findPosition: (companyId: string, id: string) => prisma.position.findFirst({ where: { id, companyId }, select: { id: true, isActive: true, defaultTracksTime: true, casualsAllowed: true } }),

  findSite: (companyId: string, id: string) => prisma.site.findFirst({ where: { id, companyId, isActive: true }, select: { id: true, name: true, type: true } }),

  findActiveEmployee: (companyId: string, id: string) => prisma.employee.findFirst({ where: { id, companyId, status: { not: 'EXITED' } }, select: { id: true, name: true, userId: true } }),

  /** The person who heads a department today (substantive first), for the transfer preview. */
  async headOf(departmentId: string, today: Date) {
    return prisma.departmentHead.findFirst({
      where: { departmentId, ...ACTIVE_HEAD(today) },
      orderBy: { isActing: 'asc' },
      select: { employee: { select: { id: true, name: true, userId: true } } },
    });
  },

  // ---- contract --------------------------------------------------------------------------------
  createContract: (db: Db, data: { employeeId: string; contractTypeId: string | null; startsOn: Date; endsOn: Date | null; createdById: string }) =>
    db.contract.create({ data: { ...data, status: 'ACTIVE' }, select: { id: true } }),

  endContracts: (db: Db, ids: readonly string[]) => db.contract.updateMany({ where: { id: { in: [...ids] }, status: 'ACTIVE' }, data: { status: 'ENDED' } }),
  restoreContracts: (db: Db, ids: readonly string[]) => db.contract.updateMany({ where: { id: { in: [...ids] }, status: 'ENDED' }, data: { status: 'ACTIVE' } }),

  findContractType: (companyId: string, id: string) =>
    prisma.contractType.findFirst({ where: { id, isActive: true, OR: [{ siteId: null }, { site: { companyId } }] }, select: { id: true, name: true } }),

  // ---- employee row writes ---------------------------------------------------------------------
  updateEmployee: (db: Db, id: string, companyId: string, data: Prisma.EmployeeUncheckedUpdateManyInput) => db.employee.updateMany({ where: { id, companyId }, data }),

  setStatus: (db: Db, id: string, companyId: string, status: EmploymentStatus, extra: Prisma.EmployeeUncheckedUpdateManyInput = {}) =>
    db.employee.updateMany({ where: { id, companyId }, data: { status, ...extra } }),

  setContractStatus: (db: Db, id: string, companyId: string, contractStatus: ContractStatus) => db.employee.updateMany({ where: { id, companyId }, data: { contractStatus } }),

  // ---- probation notes -------------------------------------------------------------------------
  addNote: (db: Db, data: { employeeId: string; authorId: string; authorKind: string; verdict: string; note: string | null }) =>
    db.probationNote.create({ data, select: { id: true } }),

  // ---- heads (rows only; claims are slice 1b) --------------------------------------------------
  endHeads: (db: Db, ids: readonly string[], endsOn: Date, endedById: string | null, endReason: string) =>
    db.departmentHead.updateMany({ where: { id: { in: [...ids] }, endsOn: null }, data: { endsOn, endedById, endReason } }),

  restoreHead: (db: Db, data: { departmentId: string; employeeId: string; startsOn: Date }) =>
    db.departmentHead.create({ data: { ...data, isActing: false } }),

  // ---- spells ----------------------------------------------------------------------------------
  createSpell: (db: Db, data: { employeeId: string; startsOn: Date }) => db.employmentSpell.create({ data, select: { id: true } }),

  endSpell: (db: Db, id: string, data: { endedOn: Date; exitReason: string; exitNote: string | null; uniformReturned: boolean; endedById: string | null; endedAt: Date; exitSnapshot: Prisma.InputJsonValue }) =>
    db.employmentSpell.updateMany({ where: { id, endedOn: null }, data }),

  setSnapshot: (db: Db, id: string, finalizedAt: Date, exitSnapshot: Prisma.InputJsonValue) => db.employmentSpell.updateMany({ where: { id, finalizedAt: null }, data: { finalizedAt, exitSnapshot } }),

  reopenSpell: (db: Db, id: string) =>
    db.employmentSpell.updateMany({
      where: { id },
      data: { endedOn: null, exitReason: null, exitNote: null, uniformReturned: false, endedById: null, endedAt: null, finalizedAt: null, exitSnapshot: Prisma.DbNull },
    }),

  setUniform: (db: Db, id: string, uniformReturned: boolean) => db.employmentSpell.updateMany({ where: { id }, data: { uniformReturned } }),

  /** Scheduler: recorded exits whose last day has passed and that are not yet finalised. */
  dueExits: (today: Date) =>
    prisma.employmentSpell.findMany({
      where: { endedOn: { lt: today }, finalizedAt: null, employee: { status: { in: ['NOTICE', 'ACTIVE', 'ONBOARDING', 'ON_LEAVE', 'SUSPENDED'] } } },
      select: { id: true, employeeId: true, endedOn: true, employee: { select: { companyId: true } } },
      orderBy: { endedOn: 'asc' },
    }),

  // ---- moves -----------------------------------------------------------------------------------
  createMove: (db: Db, data: NewMove) => db.employeeMove.create({ data: { ...data, summary: data.summary ?? undefined }, select: { id: true } }),

  findMove: (db: Db, companyId: string, employeeId: string, moveId: string): Promise<MoveWithEmployee | null> =>
    db.employeeMove.findFirst({ where: { id: moveId, employeeId, employee: { companyId } }, include: MOVE_INCLUDE }),

  findMoveTop: (companyId: string, employeeId: string, moveId: string): Promise<MoveWithEmployee | null> =>
    prisma.employeeMove.findFirst({ where: { id: moveId, employeeId, employee: { companyId } }, include: MOVE_INCLUDE }),

  scheduledTransferTop: (employeeId: string) => prisma.employeeMove.findFirst({ where: { employeeId, kind: 'TRANSFER', status: 'SCHEDULED' }, select: { id: true } }),

  scheduledTransfer: (db: Db, employeeId: string) => db.employeeMove.findFirst({ where: { employeeId, kind: 'TRANSFER', status: 'SCHEDULED' }, select: { id: true } }),

  scheduledMoveIds: async (db: Db, employeeId: string): Promise<string[]> => {
    const rows = await db.employeeMove.findMany({ where: { employeeId, status: { in: ['SCHEDULED', 'ACTIVE'] } }, select: { id: true } });
    return rows.map((r) => r.id);
  },

  setMoveStatus: (db: Db, id: string, from: MoveStatus, data: { status: MoveStatus; appliedAt?: Date | null; cancelledAt?: Date | null; endsOn?: Date | null }) =>
    db.employeeMove.updateMany({ where: { id, status: from }, data }),

  cancelMoves: (db: Db, ids: readonly string[], now: Date) =>
    db.employeeMove.updateMany({ where: { id: { in: [...ids] }, status: { in: ['SCHEDULED', 'ACTIVE'] } }, data: { status: 'CANCELLED', cancelledAt: now } }),

  /** Scheduler: moves that start today or earlier, and loans whose last day has passed. */
  dueStarts: (today: Date) =>
    prisma.employeeMove.findMany({ where: { status: 'SCHEDULED', startsOn: { lte: today } }, include: MOVE_INCLUDE, orderBy: { startsOn: 'asc' } }),
  dueLoanEnds: (today: Date) =>
    prisma.employeeMove.findMany({ where: { kind: 'LOAN', status: 'ACTIVE', endsOn: { lt: today } }, include: MOVE_INCLUDE, orderBy: { endsOn: 'asc' } }),

  /** The door's getActiveLoans: loans into a site on a date. */
  activeLoansInto: (siteId: string, date: Date) =>
    prisma.employeeMove.findMany({
      where: { kind: 'LOAN', toSiteId: siteId, status: { not: 'CANCELLED' }, startsOn: { lte: date }, OR: [{ endsOn: null }, { endsOn: { gte: date } }] },
      select: { id: true, fromSiteId: true, startsOn: true, endsOn: true, employee: { select: { id: true, userId: true, name: true } } },
    }),

  // ---- who is told ----------------------------------------------------------------------------
  siteNames: async (ids: readonly string[]): Promise<Map<string, string>> => {
    const rows = await prisma.site.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } });
    return new Map(rows.map((r) => [r.id, r.name]));
  },
};
