import { ForbiddenError } from '../../../../utils/errors';
import { nairobiDateOf, parseNairobiDate, toDateColumn } from '../../_shared/time/nairobi-time';
import { scopeOf, workforceCan, type AccessSubject } from '../../_shared/workforce-access';
import { getEffectiveRuleGroup } from '../../rules/rules-service';
import { mayHireInto, readScopeOf } from '../people-access';
import { resolveActor, todayOf } from '../people-context';
import { EXIT_REASONS, EXIT_UNDO_DAYS, HIRE_LOGIN_ROLES, PAY_CHANGE_REASONS, PROBATION_VERDICTS } from '../people.constants';
import type { ListResponse, Lookups, Pagination, PeopleSummary, UnlinkedAccount } from '../people.types';
import { blocksPayroll, listRowOf, needsFinishing } from './employee-file-view';
import { employeesRepository } from './employees-repository';

export const pagination = (total: number, page: number, perPage: number): Pagination => ({ total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) });

/** The counts, pick-lists and checks around the People list. Merged into `employeesService`. */
export const employeeLookupsService = {
  async summary(subject: AccessSubject, siteId: string | undefined): Promise<PeopleSummary> {
    const ctx = await resolveActor(subject);
    const scope = readScopeOf(subject);
    const today = todayOf();
    const monthStart = parseNairobiDate(`${today.slice(0, 7)}-01`);
    const counts = await employeesRepository.summary(ctx.companyId, scope, siteId, toDateColumn(today), toDateColumn(monthStart));
    const list = await employeesRepository.listAll({ companyId: ctx.companyId, scope, ...(siteId ? { siteId } : {}), filter: 'needs_finishing', today: toDateColumn(today) });
    const rows = list.map((row) => listRowOf(subject, row));
    const mayReadPay = workforceCan(subject, 'payprofile.read');
    return { ...counts, payChangesWaiting: mayReadPay ? counts.payChangesWaiting : null, payChangesMonth: mayReadPay ? counts.payChangesMonth : null, needsFinishing: rows.filter((r) => needsFinishing(r.gaps)).length, blocksPayroll: rows.filter((r) => blocksPayroll(r.gaps)).length };
  },

  async lookups(subject: AccessSubject): Promise<Lookups> {
    if (!workforceCan(subject, 'employee.read_basic') && !workforceCan(subject, 'org.read')) throw new ForbiddenError('You do not have permission to perform this action');
    const ctx = await resolveActor(subject);
    const scope = scopeOf(subject, 'employee.read_basic') ?? scopeOf(subject, 'org.read');
    const sites = (await employeesRepository.sitesOfCompany(ctx.companyId)).filter((s) => scope === 'all' || s.id === subject.siteId);
    const [departments, positions, contractTypes] = await Promise.all([
      employeesRepository.departmentsOfCompany(ctx.companyId, sites.map((s) => s.id)),
      employeesRepository.positionsOfCompany(ctx.companyId),
      employeesRepository.contractTypesOfCompany(ctx.companyId),
    ]);
    // Offer only what this role may create (finding 56): positions it may hire into, and departments that still offer one.
    const hirable = positions.filter((p) => mayHireInto(subject, p));
    const offeredDepartmentIds = new Set(hirable.flatMap((p) => p.departments.map((d) => d.departmentId)));
    const shownDepartments = subject.role === 'STORE_MANAGER' ? departments.filter((d) => offeredDepartmentIds.has(d.id)) : departments;
    const ruleSite = sites[0]?.id ?? subject.siteId;
    const rule = ruleSite ? (await getEffectiveRuleGroup(ruleSite, todayOf(), 'PROBATION')).values : { defaultMonths: 0, maxExtensions: 0, maxExtensionMonths: 0 };
    return {
      sites: sites.map((s) => ({ id: s.id, name: s.name, type: s.type, isHub: s.isHub })),
      departments: shownDepartments.map((d) => ({ id: d.id, siteId: d.siteId, name: d.name, inventoryTag: d.key, isActive: d.status === 'ACTIVE' })),
      positions: hirable.map((p) => ({
        id: p.id,
        name: p.name,
        defaultTracksTime: p.defaultTracksTime,
        loginRole: p.loginRole,
        casualsAllowed: p.casualsAllowed,
        departmentIds: p.departments.map((d) => d.departmentId),
        isActive: p.isActive,
      })),
      assignableLoginRoles: workforceCan(subject, 'employee.lifecycle') ? [...HIRE_LOGIN_ROLES] : [],
      exitReasons: [...EXIT_REASONS],
      payChangeReasons: [...PAY_CHANGE_REASONS],
      probationVerdicts: [...PROBATION_VERDICTS],
      contractTypes,
      probationRule: { defaultMonths: rule.defaultMonths, maxExtensions: rule.maxExtensions, maxExtensionMonths: rule.maxExtensionMonths },
      exitUndoDays: EXIT_UNDO_DAYS,
    };
  },

  /** Booleans only, never a name (R4). */
  async duplicateCheck(subject: AccessSubject, input: { nationalId?: string; phone?: string; email?: string }) {
    const ctx = await resolveActor(subject);
    const [nationalId, phone, email] = await Promise.all([
      input.nationalId ? employeesRepository.nationalIdTaken(ctx.companyId, input.nationalId) : false,
      input.phone ? employeesRepository.phoneTaken(ctx.companyId, input.phone) : false,
      input.email ? employeesRepository.emailTaken(input.email) : false,
    ]);
    return { nationalId, phone, email };
  },

  async unlinkedAccounts(subject: AccessSubject, page: number, perPage: number): Promise<ListResponse<UnlinkedAccount>> {
    const ctx = await resolveActor(subject);
    const { rows, total } = await employeesRepository.unlinkedAccounts(ctx.companyId, page, perPage);
    return {
      success: true,
      data: rows.map((u) => ({ userId: u.id, name: u.name, email: u.email, role: u.role, siteName: u.site?.name ?? null, createdOn: nairobiDateOf(u.createdAt) })),
      pagination: pagination(total, page, perPage),
    };
  },
};
