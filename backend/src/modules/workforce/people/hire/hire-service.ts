import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../../utils/errors';
import { logger } from '../../../../utils/logger';
import { runAudited } from '../../_shared/audit/audit-writer';
import { parseNairobiDate, toDateColumn } from '../../_shared/time/nairobi-time';
import { assertInScope, workforceCan, type AccessSubject } from '../../_shared/workforce-access';
import { getEffectiveRuleGroup } from '../../rules/rules-service';
import { employeesRepository } from '../employees/employees-repository';
import { employeesService } from '../employees/employees-service';
import { accountGateway } from '../people-account-gateway';
import { mayHireInto } from '../people-access';
import { resolveActor, told, todayOf } from '../people-context';
import { probationEnd } from '../people-dates';
import type { FileRequestKind } from '../people.constants';
import type { HireResult } from '../people.types';
import type { CreateLoginSchema, DraftBodySchema, HireBodySchema } from '../people-validators';
import { draftsRepository } from './drafts-repository';
import { hireRepository } from './hire-repository';

export type HireBody = z.infer<typeof HireBodySchema>;
export type DraftBody = z.infer<typeof DraftBodySchema>;
export type LoginBody = z.infer<typeof CreateLoginSchema>;

const ASK_AFTER_LOGIN: readonly FileRequestKind[] = ['NSSF_SHA', 'PHOTO_AND_DETAILS'];
const reasonOf = (error: unknown): string => (error instanceof AppError ? error.message : 'The account could not be created');

const draftView = (d: { id: string; kind: string; step: number; payload: Prisma.JsonValue; createdAt: Date; updatedAt: Date }) => ({
  id: d.id,
  kind: d.kind,
  step: d.step,
  payload: d.payload,
  createdAt: d.createdAt.toISOString(),
  updatedAt: d.updatedAt.toISOString(),
});

export const hireService = {
  // ---- drafts (W1 to W4) -----------------------------------------------------------------------------------------
  async listDrafts(subject: AccessSubject) {
    const ctx = await resolveActor(subject);
    return (await draftsRepository.listMine(ctx.companyId, subject.id)).map(draftView);
  },
  async createDraft(subject: AccessSubject, body: DraftBody) {
    const ctx = await resolveActor(subject);
    return draftView(await draftsRepository.create({ companyId: ctx.companyId, createdById: subject.id, kind: body.kind, step: body.step, payload: body.payload as Prisma.InputJsonValue }));
  },
  async updateDraft(subject: AccessSubject, id: string, body: DraftBody) {
    const ctx = await resolveActor(subject);
    const updated = await draftsRepository.update(ctx.companyId, subject.id, id, { kind: body.kind, step: body.step, payload: body.payload as Prisma.InputJsonValue });
    if (!updated) throw new NotFoundError('Draft not found');
    return draftView(updated);
  },
  async deleteDraft(subject: AccessSubject, id: string) {
    const ctx = await resolveActor(subject);
    if (!(await draftsRepository.remove(ctx.companyId, subject.id, id))) throw new NotFoundError('Draft not found');
    return { deleted: true as const };
  },

  // ---- hire (W5) -------------------------------------------------------------------------------------------------
  async hire(subject: AccessSubject, body: HireBody, now: Date = new Date()): Promise<HireResult> {
    const ctx = await resolveActor(subject);
    const today = todayOf(now);
    const { job, who } = body;
    const casual = job.employment === 'CASUAL';

    // 1. Authorise the place, and each part by its own capability.
    assertInScope(subject, 'employee.write_basic', { userId: null, siteId: job.siteId, departmentId: job.departmentId });
    if (body.pay && !workforceCan(subject, 'payprofile.write')) throw new ForbiddenError('Only HR sets pay', 'FIELD_NOT_ALLOWED');
    if (body.statutory && !workforceCan(subject, 'employee.write_sensitive')) throw new ForbiddenError('Only HR records statutory and bank details', 'FIELD_NOT_ALLOWED');
    if (body.login && !workforceCan(subject, 'employee.lifecycle')) throw new ForbiddenError('Only HR creates logins', 'FIELD_NOT_ALLOWED');
    if (body.existingUserId && !workforceCan(subject, 'employee.lifecycle')) throw new ForbiddenError('Only HR files an existing account', 'FIELD_NOT_ALLOWED');

    // 2. Department, position, reports-to.
    const department = await hireRepository.findDepartment(ctx.companyId, job.departmentId);
    if (!department || department.siteId !== job.siteId) throw new ValidationError('That department is not at that site', 'DEPARTMENT_NOT_AT_SITE');
    if (department.status !== 'ACTIVE') throw new ValidationError('That department is retired');
    const position = await hireRepository.findPosition(ctx.companyId, job.positionId);
    if (!position || !position.isActive) throw new ValidationError('That position is not available');
    if (!mayHireInto(subject, position)) throw new ForbiddenError('You cannot hire into this position', 'POSITION_NOT_ALLOWED');
    if (!position.departments.some((d) => d.departmentId === job.departmentId)) throw new ConflictError('That department does not offer this position', 'POSITION_NOT_OFFERED');
    if (casual && !position.casualsAllowed) throw new ConflictError('This position does not take casuals', 'CASUALS_NOT_ALLOWED');
    if (job.reportsToId) {
      const boss = await hireRepository.findActiveEmployee(ctx.companyId, job.reportsToId);
      if (!boss) throw new ValidationError('That manager is not an active employee');
    }
    // Nobody named (a department with no head): the site manager is the real approver, so the file says so.
    const reportsToId = job.reportsToId ?? (await hireRepository.findSiteManager(ctx.companyId, job.siteId))?.id ?? null;

    // 3. Duplicates, and the account being adopted.
    if (await employeesRepository.nationalIdTaken(ctx.companyId, who.nationalId)) {
      throw new ConflictError('Someone on file already has this ID number', 'DUPLICATE_NATIONAL_ID');
    }
    if (!body.confirmDuplicatePhone && (await employeesRepository.phoneTaken(ctx.companyId, who.phone))) {
      throw new ConflictError('Someone on file already has this phone number', 'DUPLICATE_PHONE');
    }
    if (body.login && (await employeesRepository.emailTaken(body.login.email))) throw new ConflictError('Email is already in use', 'EMAIL_IN_USE');

    let adopted: { id: string; legacyProfileId: string | null } | null = null;
    if (body.existingUserId) {
      const user = await employeesRepository.findUserForAdoption(body.existingUserId);
      if (!user || !user.isActive || user.deletedAt) throw new NotFoundError('Account not found');
      if (user.employee) throw new ConflictError('This account already has a file', 'LOGIN_EXISTS');
      if (['SYSTEM_ADMIN', 'KITCHEN_DISPLAY', 'BARISTA_DISPLAY'].includes(user.role)) throw new ForbiddenError('This account cannot have a file', 'ROLE_NOT_ALLOWED');
      if (user.site && user.site.companyId !== ctx.companyId) throw new NotFoundError('Account not found');
      adopted = { id: user.id, legacyProfileId: await accountGateway.findLegacyProfileId(user.id) };
    }

    // 4. The values to store.
    const startDate = parseNairobiDate(job.startDate);
    const tracksTime = job.tracksTime ?? position.defaultTracksTime;
    const months = casual ? 0 : (await getEffectiveRuleGroup(job.siteId, startDate, 'PROBATION')).values.defaultMonths;
    const probationEndsOn = probationEnd(startDate, months);
    const status = startDate <= today ? 'ACTIVE' : 'ONBOARDING';
    const statutory = body.statutory;

    const employeeId = await runAudited(async (tx) => {
      const employeeNumber = await hireRepository.nextEmployeeNumber(tx, ctx.companyId);
      const created = await hireRepository.createEmployee(tx, {
        companyId: ctx.companyId,
        siteId: job.siteId,
        userId: adopted?.id ?? null,
        employeeNumber,
        name: who.name,
        departmentId: job.departmentId,
        positionId: job.positionId,
        reportsToId,
        status,
        payType: casual ? 'DAILY_RATE' : 'MONTHLY_SALARY',
        contractStatus: 'NONE',
        tracksTime,
        tracksTimeOverride: tracksTime !== position.defaultTracksTime,
        startDate: toDateColumn(startDate),
        probationEndsOn: probationEndsOn ? toDateColumn(probationEndsOn) : null,
        photoUrl: who.photoUrl ?? null,
        nationalId: who.nationalId,
        kraPin: statutory?.kraPin ?? null,
        shaNumber: statutory?.shaNumber ?? null,
        nssfNumber: statutory?.nssfNumber ?? null,
        helbNumber: statutory?.helbNumber ?? null,
        personalPhone: who.phone,
        personalEmail: who.email ?? null,
        hiredById: subject.id,
        legacyProfileId: adopted?.legacyProfileId ?? null,
      });
      await hireRepository.createPayProfile(tx, {
        employeeId: created.id,
        amount: body.pay?.amount ?? null,
        overtimeEligible: body.pay?.overtimeEligible ?? false,
        standardWeekHours: body.pay?.standardWeekHours ?? null,
        standardDayHours: body.pay?.standardDayHours ?? null,
        payoutMethod: statutory?.payoutMethod ?? null,
        bankName: statutory?.bankName ?? null,
        bankBranch: statutory?.bankBranch ?? null,
        accountName: statutory?.accountName ?? null,
        accountNumber: statutory?.accountNumber ?? null,
        mpesaPhone: statutory?.mpesaPhone ?? null,
        updatedById: subject.id,
      });
      await hireRepository.createSpell(tx, { employeeId: created.id, startsOn: toDateColumn(startDate) });
      // Question 1: pay set at hire is in force at once; only later changes go to the Director.
      if (body.pay) {
        await hireRepository.createHirePayChange(tx, { employeeId: created.id, amount: body.pay.amount, effectiveFrom: toDateColumn(startDate), requestedById: subject.id, now });
      }
      if (body.draftId) await draftsRepository.removeInTx(tx, ctx.companyId, subject.id, body.draftId);

      const filled = [
        'name',
        'phone',
        'nationalId',
        ...(who.email ? ['email'] : []),
        ...(who.photoUrl ? ['photoUrl'] : []),
        ...(body.pay ? ['pay'] : []),
        ...(statutory ? ['statutory', 'payout'] : []),
      ];
      return {
        result: created.id,
        entries: [
          {
            companyId: ctx.companyId,
            siteId: job.siteId,
            actor: ctx.auditActor,
            action: adopted ? 'people.adopted' : 'people.hired',
            category: 'PEOPLE' as const,
            subjectType: 'Employee',
            subjectId: created.id,
            subjectUserId: adopted?.id ?? null,
            after: { employeeNumber, employment: job.employment, status, filled },
          },
        ],
        events: [
          {
            name: 'employee.hired' as const,
            occurredAt: now.toISOString(),
            payload: { siteId: job.siteId, employeeId: created.id, userId: adopted?.id ?? null, departmentId: job.departmentId, startDate },
          },
        ],
      };
    });

    await told(await employeesRepository.headUserIds(job.departmentId, toDateColumn(today)), 'employee.hired', { employeeId: employeeId });

    // 8. After commit: the login, as a second audited step. Failing here leaves the hire standing.
    let login: HireResult['login'] = { created: false };
    if (body.login) {
      try {
        await hireService.createLogin(subject, employeeId, body.login, now);
        login = { created: true };
      } catch (error) {
        logger.warn({ employeeId, err: error instanceof Error ? error.message : 'unknown' }, 'login creation after hire failed');
        login = { created: false, reason: reasonOf(error) };
      }
    }

    const employee = await employeesService.getFile(subject, employeeId);
    return { employee, login, nextStep: casual ? 'ADD_TO_ROTA' : job.employment === 'MONTHLY_WITH_CONTRACT' ? 'CREATE_CONTRACT' : 'FINISH_FILE' };
  },

  // ---- login (W24, and step 8 of a hire) -----------------------------------------------------------------------
  async createLogin(subject: AccessSubject, employeeId: string, body: LoginBody, now: Date = new Date()): Promise<{ userId: string }> {
    const ctx = await resolveActor(subject);
    const today = todayOf(now);
    const row = await employeesRepository.findFileById(ctx.companyId, employeeId, toDateColumn(today));
    if (!row) throw new NotFoundError('Employee not found');
    assertInScope(subject, 'employee.lifecycle', { userId: row.userId, siteId: row.siteId, departmentId: row.departmentId });
    if (row.status === 'EXITED') throw new ConflictError('This file is closed', 'ALREADY_EXITED');
    if (row.userId) throw new ConflictError('This person already has a login', 'LOGIN_EXISTS');
    if (row.payType === 'DAILY_RATE') throw new ConflictError('A casual has no login', 'CASUAL_HAS_NO_LOGIN');
    if (await employeesRepository.emailTaken(body.email)) throw new ConflictError('Email is already in use', 'EMAIL_IN_USE');

    // The account is created through the legacy staff service (never logs or stores the password).
    const created = await accountGateway.createLogin(
      { name: row.name, email: body.email, phone: row.personalPhone, role: body.loginRole, siteId: row.siteId, temporaryPassword: body.temporaryPassword },
      subject.id,
    );
    try {
      await runAudited(async (tx) => {
        await hireRepositoryLink(tx, ctx.companyId, row.id, created);
        const asked = await hireRepository.openFileRequestKinds(row.id);
        const kinds = ASK_AFTER_LOGIN.filter((k) => !asked.includes(k));
        if (kinds.length > 0) await hireRepository.createFileRequests(tx, { employeeId: row.id, kinds, askedById: subject.id });
        return {
          result: null,
          entries: [
            {
              companyId: ctx.companyId,
              siteId: row.siteId,
              actor: ctx.auditActor,
              action: 'people.login_created',
              category: 'PEOPLE' as const,
              subjectType: 'Employee',
              subjectId: row.id,
              subjectUserId: created.userId,
              after: { loginRole: body.loginRole },
            },
          ],
        };
      });
    } catch (error) {
      // The account exists but is not linked: stop it from being usable, and let HR retry.
      await accountGateway.setActive(created.userId, false);
      throw error;
    }
    await told([created.userId], 'file_request.asked', { kind: 'NSSF_SHA' });
    return { userId: created.userId };
  },
};

async function hireRepositoryLink(tx: Prisma.TransactionClient, companyId: string, employeeId: string, created: { userId: string; legacyProfileId: string | null }): Promise<void> {
  const result = await hireRepository.linkLogin(tx, companyId, employeeId, created);
  if (result.count === 0) throw new ConflictError('This person already has a login', 'LOGIN_EXISTS');
}
