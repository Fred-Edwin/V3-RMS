import { findHubSiteId, inventoryNotify, type Audience, type Notification } from '../_shared/notify';
import type { PushMessage } from '../counting/_shared/count-notify';
import { requisitionNotices, type RequisitionNotice } from './requisitions-events';
import { requisitionsListRepository } from './requisitions-list-repository';

/**
 * Turns each requisition notice (published by the writes after commit) into a notification through the one layer
 * (`_shared/notify.ts`). The map rows of the contract (§7) it wires:
 *
 *   1  SECTION_SENT        -> the Branch Manager (push), badge on the branch; if it was filled in on behalf, the head is told instead
 *   2  QUANTITY_CHANGED    -> the head of that department (push), badge on the branch
 *   3  URGENT_SET          -> the Branch Manager now (push). The Director hears after 1 hour (the worker job)
 *   4  APPROVED            -> every head whose list was in (push); the store by BADGE only (hub room); the Branch Manager too when
 *                             the Director or System Admin signed
 *  13  CANCELLED           -> every head whose list was not skipped (push); the store would hear if it was approved (never in Block 1)
 *  and the writes the contract says "tell" someone: NUDGED (the head), SECTION_EDITED_ON_BEHALF (the head),
 *  ADDITION_ADDED (the Branch Manager), ADDITION_APPROVED (the head).
 *
 * Wording uses titles (Branch Manager, a department's name), never a person's name. The link opens the file.
 */
const linkOf = (requisitionId: string): string => `/app/branch/requisitions/${requisitionId}`;

const message = (n: RequisitionNotice, title: string, body: string, urgency: PushMessage['urgency'] = 'normal', tagSuffix = ''): PushMessage => ({
  title,
  body,
  link: linkOf(n.requisitionId),
  tag: `requisition-${n.type.toLowerCase()}-${n.requisitionId}${tagSuffix}`,
  data: { type: `requisition_${n.type.toLowerCase()}`, requisitionId: n.requisitionId },
  urgency,
});

export interface NoticeDeps {
  send: (n: Notification) => Promise<void>;
  /** Departments of the requisition (ids): the ones that sent, or every one that was not skipped. */
  departmentIds: (requisitionId: string, siteId: string, onlySent: boolean) => Promise<string[]>;
  hubSiteId: () => Promise<string | null>;
}

export const createNoticeHandler = (deps: NoticeDeps) => {
  const managers = (siteId: string): Audience => ({ kind: 'roles', siteId, roles: ['MANAGER'] });
  const heads = (siteId: string, departmentIds: string[]): Audience => ({ kind: 'department', siteId, departmentIds, headsOnly: true });

  return async (n: RequisitionNotice): Promise<void> => {
    const branch = [n.siteId];
    switch (n.type) {
      case 'SECTION_SENT': {
        if (n.onBehalf) {
          await deps.send({
            audiences: [heads(n.siteId, [n.departmentId])],
            message: message(n, 'Your list was sent', `The Branch Manager filled in and sent the ${n.departmentName} list for ${n.reference}.`, 'normal', `-${n.departmentId}`),
            badgeSites: branch,
            reason: 'requisition.sent_on_behalf',
          });
          return;
        }
        await deps.send({
          audiences: [managers(n.siteId)],
          message: n.readyToApprove
            ? message(n, 'Ready to approve', `Every list is in for ${n.reference}.`)
            : message(n, 'A list is waiting', `${n.departmentName} has sent its list for ${n.reference}.`, 'normal', `-${n.departmentId}`),
          badgeSites: branch,
          reason: 'requisition.sent',
        });
        return;
      }
      case 'SECTION_EDITED_ON_BEHALF':
        await deps.send({
          audiences: [heads(n.siteId, [n.departmentId])],
          // One tag per requisition and department, so repeated saves replace each other instead of piling up.
          message: message(n, 'Your list was changed', `The Branch Manager changed the ${n.departmentName} list for ${n.reference}.`, 'normal', `-${n.departmentId}`),
          badgeSites: branch,
          reason: 'requisition.edited_on_behalf',
        });
        return;
      case 'QUANTITY_CHANGED':
        await deps.send({
          audiences: [heads(n.siteId, [n.departmentId])],
          message: message(n, 'A quantity was changed', `${n.itemName} on ${n.reference}: ${n.from} to ${n.to}${n.reason ? ` · ${n.reason}` : ''}`, 'normal', `-${n.departmentId}`),
          badgeSites: branch,
          reason: 'requisition.quantity_changed',
        });
        return;
      case 'URGENT_SET':
        await deps.send({
          audiences: [managers(n.siteId)],
          message: message(n, 'Urgent requisition', `${n.reference} is marked Urgent.`, 'high'),
          badgeSites: branch,
          reason: 'requisition.urgent',
        });
        return;
      case 'NUDGED':
        await deps.send({
          audiences: [heads(n.siteId, [n.departmentId])],
          message: message(n, 'Your list is waited for', `The Branch Manager is waiting for the ${n.departmentName} list on ${n.reference}.`, 'normal', `-${n.departmentId}`),
          badgeSites: branch,
          reason: 'requisition.nudged',
        });
        return;
      case 'APPROVED': {
        const hub = await deps.hubSiteId();
        const departmentIds = await deps.departmentIds(n.requisitionId, n.siteId, true);
        await deps.send({
          audiences: [heads(n.siteId, departmentIds), ...(n.signedAs === 'BRANCH_MANAGER' ? [] : [managers(n.siteId)])],
          message: message(n, 'Requisition approved', `${n.reference} is approved and with the Central Store.`),
          // The store hears by badge (its To pack count), not by push.
          badgeSites: hub ? [n.siteId, hub] : branch,
          reason: 'requisition.approved',
        });
        return;
      }
      case 'CANCELLED': {
        const hub = await deps.hubSiteId();
        const departmentIds = await deps.departmentIds(n.requisitionId, n.siteId, false);
        await deps.send({
          audiences: [heads(n.siteId, departmentIds)],
          message: message(n, 'Requisition cancelled', `${n.reference} was cancelled · ${n.reason}`),
          badgeSites: hub ? [n.siteId, hub] : branch,
          reason: 'requisition.cancelled',
        });
        return;
      }
      case 'ADDITION_ADDED':
        await deps.send({
          audiences: [managers(n.siteId)],
          message: message(n, 'Added lines to approve', `${n.departmentName} added lines to ${n.reference} after approval.`, 'normal', `-${n.additionId}`),
          badgeSites: branch,
          reason: 'requisition.addition_added',
        });
        return;
      case 'ADDITION_APPROVED':
        await deps.send({
          audiences: [heads(n.siteId, [n.departmentId])],
          message: message(n, 'Added lines approved', `The lines ${n.departmentName} added to ${n.reference} are approved.`, 'normal', `-${n.additionId}`),
          badgeSites: branch,
          reason: 'requisition.addition_approved',
        });
        return;
    }
  };
};

const handler = createNoticeHandler({
  send: (n) => inventoryNotify.send(n),
  departmentIds: (requisitionId, siteId, onlySent) => requisitionsListRepository.listSectionDepartmentIds(requisitionId, siteId, onlySent),
  hubSiteId: findHubSiteId,
});

let started = false;

/** Subscribes the notification layer to the requisition writes. Called once at start-up (a second call does nothing). */
export const startRequisitionNotices = (): void => {
  if (started) return;
  started = true;
  requisitionNotices.subscribe(handler);
};
