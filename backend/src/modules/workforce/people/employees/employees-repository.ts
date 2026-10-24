import type { HrDocumentType, Prisma, UserRole } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { ACTIVE_STATUSES } from '../people.constants';
import { payChangeWhere } from './employees-pay-filter';
import { FILE_INCLUDE, LIST_SELECT, activeHeadWhere, filterWhere, scopeWhere } from './employees-queries';
import type { FileRow, ListQuery, ListRow, ScopeFilter, SubjectFacts } from './employees-queries';

export type Db = Prisma.TransactionClient | typeof prisma;
export type { FileRow, ListQuery, ListRow, ScopeFilter, SubjectFacts };

/**
 * All Prisma access for reading and lightly editing an employee file. Every query carries `companyId` (or, for the few
 * lookups by a bare id, names the company through the row it finds). Nothing is ever deleted here. The shapes and where-builders
 * it uses are in `employees-queries.ts`.
 */
export const employeesRepository = {
  // ---- who is asking ---------------------------------------------------------------------
  /** One query for the access subject: their file's "clocks in" and the departments they head today. */
  async loadSubjectFacts(userId: string, today: Date): Promise<SubjectFacts> {
    const employee = await prisma.employee.findUnique({
      where: { userId },
      select: { id: true, tracksTime: true, heads: { where: activeHeadWhere(today), select: { departmentId: true } } },
    });
    if (!employee) return { employeeId: null, tracksTime: null, headOfDepartmentIds: [] };
    return { employeeId: employee.id, tracksTime: employee.tracksTime, headOfDepartmentIds: employee.heads.map((h) => h.departmentId) };
  },

  /** The file's own "clocks in" for a login, or null when the login has no file. */
  async tracksTimeOfUser(userId: string): Promise<boolean | null> {
    const employee = await prisma.employee.findUnique({ where: { userId }, select: { tracksTime: true } });
    return employee ? employee.tracksTime : null;
  },

  /** The door's getEmployee: a small summary for other modules. */
  findSummaryByUserId: (userId: string) =>
    prisma.employee.findUnique({
      where: { userId },
      select: { id: true, userId: true, name: true, siteId: true, departmentId: true, tracksTime: true, status: true, position: { select: { name: true } } },
    }),

  /** The actor's name and company (through their site; a System Admin has no site). */
  findActor: (userId: string) =>
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true, siteId: true, site: { select: { companyId: true } } } }),

  async findOnlyCompanyId(): Promise<string | null> {
    const companies = await prisma.company.findMany({ where: { isActive: true }, select: { id: true }, take: 2 });
    return companies.length === 1 ? (companies[0]?.id ?? null) : null;
  },

  findUserNames: (ids: readonly string[]) =>
    prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true, role: true } }),

  /** Position and site of people who have a file, by their login (for "Asked by Mercy Achieng, HR Manager, Head Office"). */
  findBriefsByUserIds: (ids: readonly string[]) =>
    prisma.employee.findMany({ where: { userId: { in: [...ids] } }, select: { userId: true, position: { select: { name: true } }, site: { select: { name: true } } } }),

  /** Who made the latest entry of one kind about a person, for the Activity tab ("confirmed by Mercy Achieng"). */
  async lastActorOf(companyId: string, employeeId: string, actions: readonly string[]): Promise<{ action: string; actorName: string; after: unknown } | null> {
    return prisma.auditEntry.findFirst({
      where: { companyId, subjectType: 'Employee', subjectId: employeeId, action: { in: [...actions] } },
      orderBy: { seq: 'desc' },
      select: { action: true, actorName: true, after: true },
    });
  },

  // ---- the file --------------------------------------------------------------------------
  findFileById: (companyId: string, id: string, today: Date): Promise<FileRow | null> =>
    prisma.employee.findFirst({ where: { companyId, id }, include: FILE_INCLUDE(today) }),

  findFileByUserId: (companyId: string, userId: string, today: Date): Promise<FileRow | null> =>
    prisma.employee.findFirst({ where: { companyId, userId }, include: FILE_INCLUDE(today) }),

  findFileByUserIdAnyCompany: (userId: string, today: Date): Promise<FileRow | null> =>
    prisma.employee.findFirst({ where: { userId }, include: FILE_INCLUDE(today) }),

  /** A bare row for writes inside a transaction. */
  findForWrite: (db: Db, companyId: string, id: string) => db.employee.findFirst({ where: { companyId, id } }),

  async siteNames(siteIds: readonly string[]): Promise<Map<string, string>> {
    const rows = await prisma.site.findMany({ where: { id: { in: [...siteIds] } }, select: { id: true, name: true } });
    return new Map(rows.map((r) => [r.id, r.name]));
  },

  // ---- lists -----------------------------------------------------------------------------
  async list(query: ListQuery, page: number, perPage: number): Promise<{ rows: ListRow[]; total: number }> {
    const where = filterWhere(query);
    const [rows, total] = await Promise.all([
      prisma.employee.findMany({ where, select: LIST_SELECT(query.today), orderBy: [{ name: 'asc' }, { id: 'asc' }], skip: (page - 1) * perPage, take: perPage }),
      prisma.employee.count({ where }),
    ]);
    return { rows, total };
  },

  /** For filters computed from the file's parts ("Needs finishing"): every match, then the service filters and pages. */
  listAll: (query: ListQuery): Promise<ListRow[]> =>
    prisma.employee.findMany({ where: filterWhere(query), select: LIST_SELECT(query.today), orderBy: [{ name: 'asc' }, { id: 'asc' }] }),

  async summary(companyId: string, scope: ScopeFilter, siteId: string | undefined, today: Date, monthStart: Date) {
    const base: Prisma.EmployeeWhereInput = { companyId, AND: [scopeWhere(scope), siteId ? { siteId } : {}] };
    const live: Prisma.EmployeeWhereInput = { AND: [base, { status: { not: 'EXITED' } }] };
    const [onFile, active, exited, noContract, joinedThisMonth, stillInProbation, casualPool, payChangesWaiting, payChangesMonth] = await Promise.all([
      prisma.employee.count({ where: base }),
      prisma.employee.count({ where: { AND: [base, { status: { in: [...ACTIVE_STATUSES] } }] } }),
      prisma.employee.count({ where: { AND: [base, { status: 'EXITED' }] } }),
      prisma.employee.count({ where: { AND: [live, { payType: 'MONTHLY_SALARY', contractStatus: { not: 'ACTIVE' } }] } }),
      prisma.employee.count({ where: { AND: [live, { startDate: { gte: monthStart } }] } }),
      prisma.employee.count({ where: { AND: [live, { probationEndsOn: { gte: today }, probationConfirmedOn: null }] } }),
      prisma.employee.count({ where: { AND: [live, { payType: 'DAILY_RATE' }] } }),
      prisma.employee.count({ where: { AND: [live, payChangeWhere('waiting', today)] } }),
      prisma.employee.count({ where: { AND: [live, payChangeWhere('month', today)] } }),
    ]);
    return { onFile, active, exited, noContract, joinedThisMonth, stillInProbation, casualPool, payChangesWaiting, payChangesMonth };
  },

  // ---- lookups ---------------------------------------------------------------------------
  sitesOfCompany: (companyId: string) =>
    prisma.site.findMany({ where: { companyId, isActive: true }, select: { id: true, name: true, type: true, isHub: true }, orderBy: { name: 'asc' } }),

  departmentsOfCompany: (companyId: string, siteIds?: readonly string[]) =>
    prisma.department.findMany({
      where: { site: { companyId }, ...(siteIds ? { siteId: { in: [...siteIds] } } : {}) },
      select: { id: true, siteId: true, name: true, key: true, status: true },
      orderBy: [{ siteId: 'asc' }, { position: 'asc' }, { name: 'asc' }],
    }),

  positionsOfCompany: (companyId: string) =>
    prisma.position.findMany({
      where: { companyId },
      select: { id: true, name: true, defaultTracksTime: true, loginRole: true, casualsAllowed: true, isActive: true, departments: { select: { departmentId: true } } },
      orderBy: { name: 'asc' },
    }),

  contractTypesOfCompany: (companyId: string) =>
    prisma.contractType.findMany({
      where: { isActive: true, OR: [{ siteId: null }, { site: { companyId } }] },
      select: { id: true, name: true, durationMonths: true },
      orderBy: { name: 'asc' },
    }),

  // ---- duplicates and accounts -----------------------------------------------------------
  async nationalIdTaken(companyId: string, nationalId: string, exceptId?: string): Promise<boolean> {
    const found = await prisma.employee.findFirst({ where: { companyId, nationalId, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
    return found !== null;
  },
  async phoneTaken(companyId: string, phone: string, exceptId?: string): Promise<boolean> {
    const found = await prisma.employee.findFirst({ where: { companyId, personalPhone: phone, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
    return found !== null;
  },
  async emailTaken(email: string): Promise<boolean> {
    const found = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    return found !== null;
  },

  /** Active human logins in the company with no file (the "adopt" list). */
  async unlinkedAccounts(companyId: string, page: number, perPage: number) {
    const where: Prisma.UserWhereInput = {
      isActive: true,
      deletedAt: null,
      role: { notIn: ['SYSTEM_ADMIN', 'KITCHEN_DISPLAY', 'BARISTA_DISPLAY'] as UserRole[] },
      employee: null,
      OR: [{ site: { companyId } }, { siteId: null }],
    };
    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true, role: true, createdAt: true, site: { select: { name: true } } },
        orderBy: { name: 'asc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.user.count({ where }),
    ]);
    return { rows, total };
  },

  findUserForAdoption: (userId: string) =>
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true, role: true, siteId: true, isActive: true, deletedAt: true, employee: { select: { id: true } }, site: { select: { companyId: true } } },
    }),

  // ---- documents -------------------------------------------------------------------------
  documentsOf: (employeeId: string) =>
    prisma.hrDocument.findMany({
      where: { employeeId },
      select: { id: true, documentType: true, fileName: true, uploadedById: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),

  findDocument: (employeeId: string, docId: string) =>
    prisma.hrDocument.findFirst({ where: { id: docId, employeeId }, select: { id: true, fileUrl: true, fileName: true, documentType: true } }),

  createDocument: (
    db: Db,
    data: { employeeId: string; legacyProfileId: string | null; documentType: HrDocumentType; fileName: string; fileUrl: string; uploadedById: string },
  ) =>
    db.hrDocument.create({
      data: {
        employeeId: data.employeeId,
        employeeProfileId: data.legacyProfileId,
        documentType: data.documentType,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        uploadedById: data.uploadedById,
      },
      select: { id: true, documentType: true, fileName: true, uploadedById: true, createdAt: true },
    }),

  // ---- small writes (the caller owns the transaction and the audit entry) ------------------
  updateEmployee: (db: Db, id: string, companyId: string, data: Prisma.EmployeeUncheckedUpdateManyInput) =>
    db.employee.updateMany({ where: { id, companyId }, data }),

  setPhoto: (db: Db, id: string, companyId: string, photoUrl: string) => db.employee.updateMany({ where: { id, companyId }, data: { photoUrl } }),

  // ---- who is told -----------------------------------------------------------------------
  async userIdsByRole(companyId: string, role: UserRole): Promise<string[]> {
    const rows = await prisma.user.findMany({
      where: { role, isActive: true, deletedAt: null, OR: [{ site: { companyId } }, { siteId: null }] },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  },
  async siteManagerUserIds(siteId: string): Promise<string[]> {
    const rows = await prisma.user.findMany({ where: { siteId, role: 'MANAGER', isActive: true, deletedAt: null }, select: { id: true } });
    return rows.map((r) => r.id);
  },
  async headUserIds(departmentId: string, today: Date): Promise<string[]> {
    const rows = await prisma.departmentHead.findMany({
      where: { departmentId, ...activeHeadWhere(today) },
      select: { employee: { select: { userId: true } } },
    });
    return rows.flatMap((r) => (r.employee.userId ? [r.employee.userId] : []));
  },

  // ---- file requests ---------------------------------------------------------------------
  createFileRequest: (data: { employeeId: string; kind: string; askedById: string }, db: Db = prisma) => db.fileRequest.create({ data }),
  findFileRequest: (employeeId: string, id: string) => prisma.fileRequest.findFirst({ where: { id, employeeId } }),
  remindFileRequest: (id: string, now: Date) => prisma.fileRequest.update({ where: { id }, data: { remindedAt: now } }),
  resolveFileRequests: (db: Db, employeeId: string, kinds: readonly string[], now: Date) =>
    db.fileRequest.updateMany({ where: { employeeId, resolvedAt: null, kind: { in: [...kinds] } }, data: { resolvedAt: now } }),
};
