import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { branchRepository } from '../../../repositories/branch-repository';
import {
  CAPABILITIES,
  ROLE_CAPABILITIES,
  actorCan,
  capabilitiesOf,
  requireCapability,
  requireHubActor,
  requireHubReader,
  roleCan,
} from './central-store-access';

vi.mock('../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));

const hubId = '11111111-1111-4111-8111-111111111111';
const actor = (role: string, siteId: string | null = hubId) => ({ id: 'u', role, siteId }) as never;

beforeEach(() => {
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubId } as never);
});

describe('the Central Store permissions table', () => {
  it('lets every desktop role read, and only the right ones write', () => {
    for (const role of ['STORE_MANAGER', 'ACCOUNTANT', 'DIRECTOR', 'MANAGER', 'SYSTEM_ADMIN']) {
      expect(roleCan(role, 'catalog.read'), role).toBe(true);
      expect(roleCan(role, 'suppliers.read'), role).toBe(true);
      expect(roleCan(role, 'restock.read'), role).toBe(true);
      expect(roleCan(role, 'audit.read'), role).toBe(true);
      expect(roleCan(role, 'payables.read'), role).toBe(true);
    }
    expect(roleCan('DIRECTOR', 'suppliers.write')).toBe(false);
    expect(roleCan('MANAGER', 'catalog.write')).toBe(false);
    expect(roleCan('ACCOUNTANT', 'catalog.write')).toBe(false);
    expect(roleCan('ACCOUNTANT', 'suppliers.write')).toBe(false);
  });

  it('gives the Accountant the money jobs: invoices, payments, payment methods, documents', () => {
    for (const c of ['payables.record_invoice', 'payables.record_payment', 'suppliers.write_payment_methods', 'suppliers.upload_documents'] as const) {
      expect(roleCan('ACCOUNTANT', c), c).toBe(true);
    }
  });

  it('hides supplier payment details from the Branch Manager only among the desktop roles', () => {
    expect(roleCan('MANAGER', 'suppliers.read_payment_details')).toBe(false);
    for (const role of ['STORE_MANAGER', 'ACCOUNTANT', 'DIRECTOR', 'SYSTEM_ADMIN']) {
      expect(roleCan(role, 'suppliers.read_payment_details'), role).toBe(true);
    }
  });

  it('lets the Store Attendant see item costs but keeps them blind to stock figures and financial data (6 Oct 2026)', () => {
    expect(capabilitiesOf('STORE_ATTENDANT').sort()).toEqual([
      'catalog.add_missing',
      'catalog.read',
      'catalog.see_costs',
      'counts.record',
      'dispatch.pack',
      'dispatch.read',
      'orders.read',
      'orders.receive',
      'orders.request',
      'prep.read',
      'prep.record',
      'requisitions.read',
      'suppliers.quick_add',
      'suppliers.read_basic',
      'waste.log',
      'waste.read',
      'waste.reverse_own',
    ]);
    expect(roleCan('STORE_ATTENDANT', 'catalog.see_costs')).toBe(true);
    for (const c of [
      'restock.read',
      'catalog.read_history',
      'payables.read',
      'payables.record_invoice',
      'payables.record_payment',
      'payables.record_deposit',
      'suppliers.read',
      'suppliers.read_payment_details',
      'audit.read',
    ] as const) {
      expect(roleCan('STORE_ATTENDANT', c), c).toBe(false);
    }
  });

  it('maps the Purchasing capabilities per role (owner decisions 4 Oct 2026)', () => {
    const table: Record<string, string[]> = {
      STORE_MANAGER: ['orders.read', 'orders.request', 'orders.approve', 'orders.cancel', 'orders.receive', 'payables.record_deposit'],
      SYSTEM_ADMIN: ['orders.read', 'orders.request', 'orders.approve', 'orders.cancel', 'orders.receive', 'payables.record_deposit'],
      STORE_ATTENDANT: ['orders.read', 'orders.request', 'orders.receive'],
      // The Accountant records money but does not raise orders.
      ACCOUNTANT: ['orders.read', 'payables.record_deposit'],
      DIRECTOR: ['orders.read'],
      MANAGER: ['orders.read'],
    };
    const all = ['orders.read', 'orders.request', 'orders.approve', 'orders.cancel', 'orders.receive', 'payables.record_deposit'] as const;
    for (const [role, held] of Object.entries(table)) {
      for (const c of all) expect(roleCan(role, c), `${role} ${c}`).toBe(held.includes(c));
    }
  });

  it('gives the System Admin everything except the "on behalf" rows and the department\'s own delivery count and branch waste log, and an unknown role nothing', () => {
    expect(capabilitiesOf('SYSTEM_ADMIN')).toHaveLength(CAPABILITIES.length - 6);
    expect(capabilitiesOf('SYSTEM_ADMIN')).not.toContain('branch_waste.log');
    expect(capabilitiesOf('SYSTEM_ADMIN')).not.toContain('branch_waste.reverse_own');
    expect(capabilitiesOf('SYSTEM_ADMIN')).not.toContain('requisitions.edit_on_behalf');
    expect(capabilitiesOf('SYSTEM_ADMIN')).not.toContain('requisitions.send_on_behalf');
    expect(capabilitiesOf('SYSTEM_ADMIN')).not.toContain('deliveries.count');
    expect(capabilitiesOf('SYSTEM_ADMIN')).not.toContain('deliveries.confirm_on_behalf');
    expect(capabilitiesOf('WAITER')).toEqual([]);
    expect(actorCan({ role: 'CHEF' } as never, 'catalog.read')).toBe(false);
  });

  it('only names capabilities that exist', () => {
    for (const caps of Object.values(ROLE_CAPABILITIES)) for (const c of caps ?? []) expect(CAPABILITIES).toContain(c);
  });
});

describe('requireCapability', () => {
  const run = (role: string, ...caps: Parameters<typeof requireCapability>) => {
    const next = vi.fn();
    requireCapability(...caps)({ user: actor(role) } as unknown as Request, {} as Response, next);
    return next;
  };
  it('passes when the role holds any one of them', () => {
    expect(run('ACCOUNTANT', 'suppliers.write', 'payables.record_invoice')).toHaveBeenCalled();
  });
  it('refuses a role that holds none, and a request with no user', () => {
    expect(() => run('DIRECTOR', 'suppliers.write')).toThrow(/permission/i);
    expect(() => requireCapability('catalog.read')({} as Request, {} as Response, vi.fn())).toThrow(/Authentication/);
  });
});

describe('the hub guards (D-15)', () => {
  it('requireHubActor admits the hub and the organization-less System Admin, and nobody else', async () => {
    await expect(requireHubActor(actor('STORE_MANAGER'))).resolves.toBe(hubId);
    await expect(requireHubActor(actor('SYSTEM_ADMIN', null))).resolves.toBe(hubId);
    await expect(requireHubActor(actor('MANAGER', 'branch-org'))).rejects.toThrow(/hub/i);
    await expect(requireHubActor(actor('ACCOUNTANT', null))).rejects.toThrow(/hub/i);
  });

  it('requireHubReader also admits a reader outside the hub, but still resolves to the hub', async () => {
    await expect(requireHubReader(actor('MANAGER', 'branch-org'))).resolves.toBe(hubId);
    await expect(requireHubReader(actor('STORE_ATTENDANT', 'branch-org'))).rejects.toThrow(/hub/i);
    await expect(requireHubReader(actor('STORE_ATTENDANT'))).resolves.toBe(hubId);
  });

  it('fails clearly when no hub is configured', async () => {
    vi.mocked(branchRepository.findHub).mockResolvedValue(null as never);
    await expect(requireHubActor(actor('STORE_MANAGER'))).rejects.toThrow(/No hub/);
  });
});

describe('the front end names the same capabilities', () => {
  it('lists exactly the names the backend table uses', () => {
    const file = resolve(process.cwd(), '../frontend/features/inventory/_shared/lib/capabilities.ts');
    const names = [...readFileSync(file, 'utf8').matchAll(/^\s+'([a-z_]+\.[a-z_]+)',?$/gm)].map((m) => m[1]).sort();
    expect(names).toEqual([...CAPABILITIES].sort());
  });
});
