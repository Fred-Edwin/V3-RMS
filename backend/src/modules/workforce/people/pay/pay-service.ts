import type { z } from 'zod';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import type { AuditEntryInput } from '../../_shared/audit/audit.types';
import { fromDateColumn, parseNairobiDate, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import { assertInScope, assertNotSelf, inScope, lockedGroupsFor, workforceCan, type AccessSubject } from '../../_shared/workforce-access';
import { employeesRepository } from '../employees/employees-repository';
import { targetOf } from '../people-access';
import { verifySignerPin } from '../../_shared/pin/signer-pin';
import { resolveActor, told, todayOf } from '../people-context';
import { PAYOUT_CASH_REFUSAL, payoutAllowed } from '../rules/statutory-formats';
import { maskTail } from '../rules/people-masking';
import type { PayChangeRow, PayView } from '../people.types';
import type { PayChangeDecisionSchema, PayChangeSchema, PayProfileSchema } from '../people-validators';
import { changeRows, money } from './pay-change-rows';
import { hourlyEquivalent } from './pay-math';
import { payRepository } from './pay-repository';

export type PayProfileBody = z.infer<typeof PayProfileSchema>;
export type PayChangeBody = z.infer<typeof PayChangeSchema>;
export type PayDecisionBody = z.infer<typeof PayChangeDecisionSchema>;

type EmployeeBrief = NonNullable<Awaited<ReturnType<typeof payRepository.findEmployee>>>;
const loadScoped = async (subject: AccessSubject, companyId: string, id: string): Promise<EmployeeBrief> => {
  const employee = await payRepository.findEmployee(companyId, id);
  if (!employee) throw new NotFoundError('Employee not found');
  return employee;
};

export const payService = {
  // ---- R8: open the pay card -------------------------------------------------------------------------------------
  async view(subject: AccessSubject, id: string): Promise<PayView> {
    const ctx = await resolveActor(subject);
    const employee = await loadScoped(subject, ctx.companyId, id);
    const target = targetOf(employee);
    const own = employee.userId !== null && employee.userId === subject.id;
    const canRead = inScope(subject, 'payprofile.read', target) || (own && inScope(subject, 'me.payprofile', target));
    if (!canRead) throw new NotFoundError('Employee not found');

    const profile = employee.payProfile;
    const history = await changeRows(await payRepository.historyOf(employee.id), employee.name);
    const view: PayView = {
      payType: employee.payType,
      amount: profile?.amount ? money(profile.amount) : null,
      overtimeEligible: profile?.overtimeEligible ?? false,
      standardWeekHours: profile?.standardWeekHours ? profile.standardWeekHours.toFixed(2) : null,
      standardDayHours: profile?.standardDayHours ? profile.standardDayHours.toFixed(2) : null,
      hourlyEquivalent: hourlyEquivalent(
        employee.payType,
        profile?.amount ? money(profile.amount) : null,
        profile?.standardWeekHours ? profile.standardWeekHours.toFixed(2) : null,
        profile?.standardDayHours ? profile.standardDayHours.toFixed(2) : null,
      ),
      payoutMethod: profile?.payoutMethod ?? null,
      bank: profile
        ? {
            name: profile.bankName,
            branch: profile.bankBranch,
            accountName: profile.accountName,
            accountNumberMasked: own ? profile.accountNumber : maskTail(profile.accountNumber),
            mpesaPhoneMasked: own ? profile.mpesaPhone : maskTail(profile.mpesaPhone),
          }
        : null,
      history,
      pending: history.find((h) => h.status === 'PENDING') ?? null,
      locked: lockedGroupsFor(subject, target).filter((g) => g === 'pay' || g === 'bank'),
    };
    if (view.locked.includes('bank')) view.bank = null;

    if (!own) {
      await runAudited(async () => ({
        result: null,
        entries: [
          {
            companyId: ctx.companyId,
            siteId: employee.siteId,
            actor: ctx.auditActor,
            action: 'people.pay_opened',
            category: 'SENSITIVE_VIEW' as const,
            subjectType: 'Employee',
            subjectId: employee.id,
            subjectUserId: employee.userId,
          },
        ],
      }));
    }
    return view;
  },

  // ---- W9: payout, bank, overtime, hours (never the amount) ------------------------------------------------------
  async updateProfile(subject: AccessSubject, id: string, body: PayProfileBody): Promise<PayView> {
    const ctx = await resolveActor(subject);
    const employee = await loadScoped(subject, ctx.companyId, id);
    // The Accountant's Edit is the bank and account only; HR and above also set overtime and hours.
    const bankOnly = !inScope(subject, 'payprofile.write', targetOf(employee));
    assertInScope(subject, bankOnly ? 'payprofile.write_bank' : 'payprofile.write', targetOf(employee));
    assertNotSelf(subject, targetOf(employee)); // nobody changes their own bank or pay details
    if (employee.status === 'EXITED') throw new ConflictError('This file is closed', 'ALREADY_EXITED');

    const { reason, ...fields } = body;
    if (bankOnly && (['overtimeEligible', 'standardWeekHours', 'standardDayHours'] as const).some((k) => fields[k] !== undefined)) {
      throw new ForbiddenError('You can change the bank and account only', 'FIELD_NOT_ALLOWED');
    }
    const profile = employee.payProfile;
    if (fields.payoutMethod && !payoutAllowed(employee.payType === 'DAILY_RATE', fields.payoutMethod)) {
      throw new ValidationError(PAYOUT_CASH_REFUSAL, 'PAYOUT_NOT_ALLOWED');
    }
    const methodChanged = !!fields.payoutMethod && fields.payoutMethod !== (profile?.payoutMethod ?? null);
    const bankKeys = ['payoutMethod', 'bankName', 'bankBranch', 'accountName', 'accountNumber', 'mpesaPhone'] as const;
    const touchesBank = bankKeys.some((k) => fields[k] !== undefined);
    const hadBank = !!profile?.accountNumber || !!profile?.mpesaPhone;
    const bankChanged = touchesBank && hadBank && bankKeys.some((k) => fields[k] !== undefined && fields[k] !== (profile?.[k] ?? null));
    if (bankChanged && !reason) throw new ValidationError('Say why the bank details are changing', 'REASON_REQUIRED');

    const names = Object.keys(fields);
    await runAudited(async (tx) => {
      await payRepository.updateProfile(tx, employee.id, { ...fields, updatedById: subject.id });
      return {
        result: null,
        entries: [
          {
            companyId: ctx.companyId,
            siteId: employee.siteId,
            actor: ctx.auditActor,
            action: 'people.payprofile_updated',
            category: 'PAY_SETUP' as const,
            subjectType: 'Employee',
            subjectId: employee.id,
            subjectUserId: employee.userId,
            // The method is a label, not a secret; account numbers and amounts never go in the entry.
            ...(methodChanged ? { before: { payoutMethod: profile?.payoutMethod ?? null } } : {}),
            after: { changed: names, ...(methodChanged ? { payoutMethod: fields.payoutMethod ?? null } : {}) },
            reason: bankChanged ? (reason ?? null) : null,
          },
        ],
      };
    });
    if (bankChanged || methodChanged) await told(await payRepository.accountantUserIds(ctx.companyId), 'pay.bank_changed', { employeeId: employee.id, name: employee.name });
    return payService.viewQuiet(subject, employee.id);
  },

  /** The view without writing a "pay opened" entry: used to answer a write the caller just made. */
  async viewQuiet(subject: AccessSubject, id: string): Promise<PayView> {
    const ctx = await resolveActor(subject);
    const employee = await loadScoped(subject, ctx.companyId, id);
    const profile = employee.payProfile;
    const history = await changeRows(await payRepository.historyOf(employee.id), employee.name);
    const amount = profile?.amount ? money(profile.amount) : null;
    const week = profile?.standardWeekHours ? profile.standardWeekHours.toFixed(2) : null;
    const day = profile?.standardDayHours ? profile.standardDayHours.toFixed(2) : null;
    return {
      payType: employee.payType,
      amount,
      overtimeEligible: profile?.overtimeEligible ?? false,
      standardWeekHours: week,
      standardDayHours: day,
      hourlyEquivalent: hourlyEquivalent(employee.payType, amount, week, day),
      payoutMethod: profile?.payoutMethod ?? null,
      bank: profile
        ? { name: profile.bankName, branch: profile.bankBranch, accountName: profile.accountName, accountNumberMasked: maskTail(profile.accountNumber), mpesaPhoneMasked: maskTail(profile.mpesaPhone) }
        : null,
      history,
      pending: history.find((h) => h.status === 'PENDING') ?? null,
      locked: lockedGroupsFor(subject, targetOf(employee)).filter((g) => g === 'pay' || g === 'bank'),
    };
  },

  // ---- W10: ask for a pay change ---------------------------------------------------------------------------------
  async requestChange(subject: AccessSubject, id: string, body: PayChangeBody, now: Date = new Date()): Promise<PayChangeRow> {
    const ctx = await resolveActor(subject);
    const today = todayOf(now);
    const employee = await loadScoped(subject, ctx.companyId, id);
    assertInScope(subject, 'payprofile.write', targetOf(employee));
    assertNotSelf(subject, targetOf(employee)); // nobody changes their own pay
    if (employee.status === 'EXITED') throw new ConflictError('This file is closed', 'ALREADY_EXITED');
    const effectiveFrom = parseNairobiDate(body.effectiveFrom);
    if (effectiveFrom < today) throw new ValidationError('A pay change cannot start in the past', 'EFFECTIVE_DATE_PAST');
    await verifySignerPin(subject.id, body.pin, now.getTime());
    // Owner decision, 21 Oct 2026: a Director's own change needs no second Director. It applies at once; HR and the Accountant are told.
    const byDirector = subject.role === 'DIRECTOR';
    const startsNow = effectiveFrom <= today;

    const created = await runAudited(async (tx) => {
      if (await payRepository.findPending(tx, employee.id)) throw new ConflictError('There is already a pay change waiting for the Director', 'PAY_CHANGE_PENDING');
      let change = await payRepository.createChange(tx, {
        employeeId: employee.id,
        amount: body.amount,
        effectiveFrom: toDateColumn(effectiveFrom),
        reason: body.reason,
        requestedById: subject.id,
      });
      if (byDirector) {
        await payRepository.decide(tx, change.id, { status: 'APPROVED', decidedById: subject.id, decidedAt: now, decisionNote: null, appliedAt: startsNow ? now : null });
        if (startsNow) await payRepository.setAmount(tx, employee.id, change.amount.toFixed(2), subject.id);
        change = (await payRepository.findChangeIn(tx, ctx.companyId, change.id)) ?? change;
      }
      const entries: AuditEntryInput[] = [
        {
          companyId: ctx.companyId,
          siteId: employee.siteId,
          actor: ctx.auditActor,
          action: 'people.pay_change_requested',
          category: 'PAY_SETUP',
          subjectType: 'PayChange',
          subjectId: change.id,
          subjectUserId: employee.userId,
          after: { reason: body.reason, effectiveFrom: body.effectiveFrom },
        },
      ];
      if (byDirector) {
        entries.push({
          companyId: ctx.companyId,
          siteId: employee.siteId,
          actor: ctx.auditActor,
          action: 'people.pay_change_decided',
          category: 'PAY_SETUP',
          subjectType: 'PayChange',
          subjectId: change.id,
          subjectUserId: employee.userId,
          after: { decision: 'APPROVED', appliedNow: startsNow, byDirector: true }, // no amount
        });
      }
      return {
        result: change,
        entries,
        events: [
          { name: 'pay.change_requested' as const, occurredAt: now.toISOString(), payload: { employeeId: employee.id, payChangeId: change.id, requestedById: subject.id } },
        ],
      };
    });
    if (byDirector) {
      const hr = await employeesRepository.userIdsByRole(ctx.companyId, 'HR_MANAGER');
      await told([...hr, ...(await payRepository.accountantUserIds(ctx.companyId))], 'pay.changed_by_director', { employeeId: employee.id, name: employee.name }); // no amount
    } else {
      await told(await payRepository.directorUserIds(ctx.companyId), 'pay.change_requested', { employeeId: employee.id, name: employee.name });
    }
    return (await changeRows([created], employee.name))[0]!;
  },

  // ---- W11: the Director decides -----------------------------------------------------------------------------------
  async decide(subject: AccessSubject, changeId: string, body: PayDecisionBody, now: Date = new Date()): Promise<PayChangeRow> {
    const ctx = await resolveActor(subject);
    const today = todayOf(now);
    const found = await payRepository.findChange(ctx.companyId, changeId);
    if (!found) throw new NotFoundError('Pay change not found');
    if (!workforceCan(subject, 'payprofile.approve')) throw new ForbiddenError('You do not have permission to perform this action');
    // Nobody approves their own: not a change for themself, and not one they asked for.
    if ((found.employee.userId !== null && found.employee.userId === subject.id) || found.requestedById === subject.id) {
      throw new ForbiddenError('You cannot decide your own pay change', 'SELF_APPROVAL');
    }
    if (found.status !== 'PENDING') throw new ConflictError('This pay change has already been decided', 'PAY_CHANGE_NOT_PENDING');
    await verifySignerPin(subject.id, body.pin, now.getTime());

    const approve = body.decision === 'APPROVE';
    const startsNow = fromDateColumn(found.effectiveFrom) <= today;
    await runAudited(async (tx) => {
      const decided = await payRepository.decide(tx, found.id, {
        status: approve ? 'APPROVED' : 'DECLINED',
        decidedById: subject.id,
        decidedAt: now,
        decisionNote: body.note ?? null,
        appliedAt: approve && startsNow ? now : null,
      });
      if (decided.count === 0) throw new ConflictError('This pay change has already been decided', 'PAY_CHANGE_NOT_PENDING');
      if (approve && startsNow) await payRepository.setAmount(tx, found.employeeId, found.amount.toFixed(2), subject.id);
      return {
        result: null,
        entries: [
          {
            companyId: ctx.companyId,
            siteId: found.employee.siteId,
            actor: ctx.auditActor,
            action: 'people.pay_change_decided',
            category: 'PAY_SETUP' as const,
            subjectType: 'PayChange',
            subjectId: found.id,
            subjectUserId: found.employee.userId,
            after: { decision: approve ? 'APPROVED' : 'DECLINED', appliedNow: approve && startsNow },
          },
        ],
        events: [
          {
            name: 'pay.change_decided' as const,
            occurredAt: now.toISOString(),
            payload: { employeeId: found.employeeId, payChangeId: found.id, decision: approve ? ('APPROVED' as const) : ('DECLINED' as const), decidedById: subject.id },
          },
        ],
      };
    });
    await told([found.requestedById], 'pay.change_decided', { employeeId: found.employeeId, name: found.employee.name, decision: approve ? 'APPROVED' : 'DECLINED' });
    const fresh = await payRepository.findChange(ctx.companyId, changeId);
    return (await changeRows([fresh ?? found], found.employee.name))[0]!;
  },

  // ---- R11 ---------------------------------------------------------------------------------------------------------
  async listChanges(subject: AccessSubject, status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'CANCELLED'): Promise<PayChangeRow[]> {
    const ctx = await resolveActor(subject);
    return changeRows(await payRepository.listChanges(ctx.companyId, status), (r) => r.employee.name);
  },

  /** The amount in force on a date, for payroll (exported through the door). Null when nothing was ever approved. */
  async amountOn(employeeId: string, date: NairobiDate): Promise<string | null> {
    const amount = await payRepository.amountOn(employeeId, toDateColumn(date));
    return amount ? money(amount) : null;
  },
};
