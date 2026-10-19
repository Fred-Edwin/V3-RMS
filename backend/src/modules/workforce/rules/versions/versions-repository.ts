import type { Prisma, RuleConfirmation, RuleGroup, RuleVersionWithdrawal } from '@prisma/client';
import { withDetails, type RuleVersionRow } from '../resolve/rules-repository';

/**
 * Every write to the rules store. Insert only: a version, a confirmation or a withdrawal is never updated or deleted
 * (a static test checks this file and the read repository). All three run inside the caller's audited transaction.
 */

export interface NewRuleVersion {
  companyId: string;
  siteId: string | null;
  group: RuleGroup;
  version: number;
  effectiveFrom: Date; // a @db.Date value
  values: Prisma.InputJsonValue;
  reason: string;
  createdById: string;
  createdByRole: string;
  idempotencyKey: string | null;
}

export interface NewRuleConfirmation {
  ruleVersionId: string;
  scope: string;
  confirmedById: string;
  confirmerRole: string;
  note: string | null;
}

export interface NewRuleWithdrawal {
  ruleVersionId: string;
  withdrawnById: string;
  withdrawnByRole: string;
  reason: string;
}

export const versionsRepository = {
  /** Holds a lock on one (company, group, site) timeline until the transaction ends, so two saves cannot both take the next number. */
  lockScope: async (db: Prisma.TransactionClient, companyId: string, group: RuleGroup, siteId: string | null): Promise<void> => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rules:${companyId}:${group}:${siteId ?? 'company'}`}))`;
  },

  createVersion: (db: Prisma.TransactionClient, data: NewRuleVersion): Promise<RuleVersionRow> => db.ruleVersion.create({ data: { ...data }, include: withDetails }),

  createConfirmation: (db: Prisma.TransactionClient, data: NewRuleConfirmation): Promise<RuleConfirmation> => db.ruleConfirmation.create({ data }),

  createWithdrawal: (db: Prisma.TransactionClient, data: NewRuleWithdrawal): Promise<RuleVersionWithdrawal> => db.ruleVersionWithdrawal.create({ data }),
};
