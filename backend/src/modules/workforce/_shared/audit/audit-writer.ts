import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database'; // the one named exception to "no prisma outside a repository": the $transaction below
import { ValidationError } from '../../../../utils/errors';
import { deliverEvent, type WorkforceEvent } from '../events';
import { AUDIT_ACTIONS } from './audit-actions';
import { hashEntry } from './audit-hash';
import { auditRepository } from './audit-repository';
import type { AuditCategoryCode, AuditEntryInput, AuditEntryRecord } from './audit.types';

const assertRegistered = (action: string, category: AuditCategoryCode): void => {
  const allowed = (AUDIT_ACTIONS as Record<string, readonly AuditCategoryCode[]>)[action];
  if (!allowed) throw new ValidationError(`Audit action is not registered: ${action}`, 'AUDIT_ACTION_UNREGISTERED');
  if (!allowed.includes(category)) {
    throw new ValidationError(`Audit action ${action} may not be filed under ${category}`, 'AUDIT_CATEGORY_NOT_ALLOWED');
  }
};

/**
 * Primitive. Appends one entry to the company's chain using the caller's transaction client. It must be the LAST write
 * of the transaction, because it takes a row lock on the company's chain head until the transaction ends.
 * Throws ValidationError for an unregistered action or a category the action does not allow.
 * It cannot be called without a transaction client: there is no overload that opens its own.
 */
export async function writeAuditEntry(tx: Prisma.TransactionClient, input: AuditEntryInput): Promise<AuditEntryRecord> {
  assertRegistered(input.action, input.category);

  await auditRepository.ensureHead(tx, input.companyId);
  const head = await auditRepository.lockChainHead(tx, input.companyId);

  const row = {
    companyId: input.companyId,
    siteId: input.siteId,
    seq: head.lastSeq + 1n,
    occurredAt: new Date(),
    action: input.action,
    category: input.category,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    actorId: input.actor.id,
    actorRole: input.actor.role,
    actorName: input.actor.name,
    channel: input.channel ?? 'APP',
    subjectUserId: input.subjectUserId ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    reason: input.reason ?? null,
    deviceLabel: input.context?.deviceLabel ?? null,
    placeLabel: input.context?.placeLabel ?? null,
    prevHash: head.lastHash,
  };
  const hash = hashEntry(row);
  const record = await auditRepository.insertEntry(tx, { ...row, hash });
  await auditRepository.advanceHead(tx, input.companyId, row.seq, hash);
  return record;
}

export interface AuditedChange<T> {
  result: T;
  entries: AuditEntryInput[]; // usually one; one entry per bulk action, never one per row
  events?: WorkforceEvent[]; // emitted only after the transaction has committed
}

/**
 * The normal way to change something. Opens the transaction, runs the change, writes every entry, commits, then
 * emits the events. If `change` throws, nothing is written (no change, no entry, no event). If writing an entry
 * fails, the change rolls back with it.
 */
export async function runAudited<T>(change: (tx: Prisma.TransactionClient) => Promise<AuditedChange<T>>): Promise<T> {
  const outcome = await prisma.$transaction(async (tx) => {
    const done = await change(tx);
    for (const entry of done.entries) await writeAuditEntry(tx, entry);
    return done;
  });
  for (const event of outcome.events ?? []) deliverEvent(event);
  return outcome.result;
}
