import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ctxFor } from '../../mock/demo-actors';
import { getOrder, type State } from '../../mock/engine';
import { SCENARIOS } from '../../mock/scenarios';
import { NextStep } from './purchase-file-screen';

/**
 * Component test: the "Next step" card on the purchase file, rendered for every role in each state. The key action of each flow
 * (approve, send, receive, add invoice, settle, pay, void) must show for the roles that hold the capability and be absent for the
 * rest, which see the same words with no button. The buttons come from `order.can`, which the permissions table drives.
 */
const now = new Date('2026-10-05T12:00:00Z');
type Role = Parameters<typeof ctxFor>[0];
const ROLES: Role[] = ['STORE_MANAGER', 'SYSTEM_ADMIN', 'STORE_ATTENDANT', 'ACCOUNTANT', 'DIRECTOR', 'MANAGER'];

const state = (key: string): State => (SCENARIOS.find((s) => s.key === key) as (typeof SCENARIOS)[number]).build(now);

/** The button and link labels the card shows this role for the first order in a scenario matching `pick`. */
function labels(scenario: string, role: Role, pick: (o: ReturnType<typeof getOrder>) => boolean): string[] {
  const s = state(scenario);
  const ctx = ctxFor(role);
  const order = s.orders.map((o) => getOrder(s, ctx, o.id, now)).find(pick);
  if (!order) throw new Error(`no order in ${scenario} matches for ${role}`);
  const noop = (): void => undefined;
  const html = renderToStaticMarkup(
    createElement(NextStep, { order, canReceive: ctx.can('orders.receive'), onApprove: noop, onWhatsapp: noop, onPrint: noop, onCopy: noop, onAdvance: noop, onInvoice: noop, onPay: noop, onSettle: noop, onVoid: noop, busy: false })
  );
  return Array.from(html.matchAll(/<(?:button|a)[^>]*>([\s\S]*?)<\/(?:button|a)>/g)).map((m) => (m[1] as string).replace(/<[^>]+>/g, '').trim());
}

const who = (scenario: string, pick: Parameters<typeof labels>[2], label: string): Role[] => ROLES.filter((r) => labels(scenario, r, pick).includes(label));

describe('the purchase file: the key action shows only for roles that may do it', () => {
  it('Review and approve: Store Manager and System Admin only', () => {
    expect(who('awaiting-approval', (o) => o.status === 'AWAITING_APPROVAL', 'Review and approve')).toEqual(['STORE_MANAGER', 'SYSTEM_ADMIN']);
  });

  it('Send on WhatsApp: whoever may raise or approve (Store Manager, System Admin, Attendant), not the readers or the Accountant', () => {
    expect(who('ready-to-send', (o) => o.status === 'APPROVED', 'Send on WhatsApp')).toEqual(['STORE_MANAGER', 'SYSTEM_ADMIN', 'STORE_ATTENDANT']);
  });

  it('Receive delivery: Store Manager, System Admin and Attendant', () => {
    expect(who('sent-with-deposit', (o) => o.status === 'SENT', 'Receive delivery')).toEqual(['STORE_MANAGER', 'SYSTEM_ADMIN', 'STORE_ATTENDANT']);
  });

  it('Record advance: Accountant, Store Manager and System Admin', () => {
    expect(who('sent-with-deposit', (o) => o.status === 'SENT', 'Record advance')).toEqual(['STORE_MANAGER', 'SYSTEM_ADMIN', 'ACCOUNTANT']);
  });

  it('Add invoice: Accountant, Store Manager and System Admin, never the Director, Branch Manager or Attendant', () => {
    expect(who('delivered-awaiting-invoice', (o) => o.status === 'DELIVERED', 'Add invoice')).toEqual(['STORE_MANAGER', 'SYSTEM_ADMIN', 'ACCOUNTANT']);
  });

  it('Record payment and Void invoice on an invoice to pay: the same three roles', () => {
    expect(who('invoice-to-pay', (o) => o.status === 'INVOICED', 'Record payment')).toEqual(['STORE_MANAGER', 'SYSTEM_ADMIN', 'ACCOUNTANT']);
    expect(who('invoice-to-pay', (o) => o.status === 'INVOICED', 'Void invoice')).toEqual(['STORE_MANAGER', 'SYSTEM_ADMIN', 'ACCOUNTANT']);
  });

  it('Settle dispute replaces Record payment on a disputed invoice, for the same three roles', () => {
    expect(who('invoice-disputed', (o) => o.status === 'INVOICED', 'Settle dispute')).toEqual(['STORE_MANAGER', 'SYSTEM_ADMIN', 'ACCOUNTANT']);
    expect(who('invoice-disputed', (o) => o.status === 'INVOICED', 'Record payment')).toEqual([]);
  });

  it('a payment cannot be started on a part-paid or paid invoice by a reader, and a closed file has no next step', () => {
    for (const r of ['DIRECTOR', 'MANAGER', 'STORE_ATTENDANT'] as Role[]) {
      expect(labels('part-paid', r, (o) => o.status === 'INVOICED').filter((l) => /Record payment|Void invoice|Settle/.test(l))).toEqual([]);
    }
    for (const r of ROLES) expect(labels('paid-in-full', r, (o) => o.status === 'CLOSED')).toEqual([]);
  });

  it('every reader still sees the words of the next step', () => {
    const s = state('invoice-to-pay');
    const order = getOrder(s, ctxFor('DIRECTOR'), s.orders[0]?.id ?? '', now);
    const html = renderToStaticMarkup(createElement(NextStep, { order, canReceive: false, onApprove: () => undefined, onWhatsapp: () => undefined, onPrint: () => undefined, onCopy: () => undefined, onAdvance: () => undefined, onInvoice: () => undefined, onPay: () => undefined, onSettle: () => undefined, onVoid: () => undefined, busy: false }));
    expect(html).toContain('Waiting to be paid');
    expect(html).toContain('The Accountant records the payment');
  });
});
