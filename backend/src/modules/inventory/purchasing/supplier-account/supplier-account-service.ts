import type { Request } from 'express';
import { blindnessOf } from '../../_shared/blind-rule';
import { requireHubReader } from '../../_shared/central-store-access';
import { termsDaysOf, viewRow } from '../_shared/order-view';
import { purchasingError } from '../_shared/purchasing-errors';
import { owingOf, statementCsv, statementOf } from './supplier-account-logic';
import { supplierAccountRepository } from './supplier-account-repository';
import type { StatementQuery } from './supplier-account-validators';
import type { SupplierPurchasing, SupplierStatement } from './supplier-account.types';

type Actor = NonNullable<Request['user']>;

const day = (d: Date): string => d.toISOString().slice(0, 10);
/** The first of last month: the default start of a statement. */
const firstOfLastMonth = (now: Date): string => day(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));

const loadSupplier = async (siteId: string, supplierId: string) => {
  const supplier = await supplierAccountRepository.findSupplier(siteId, supplierId);
  if (!supplier) throw purchasingError('SUPPLIER_NOT_FOUND', 'That supplier does not exist.');
  return supplier;
};

export const supplierAccountService = {
  /** The supplier page's Orders tab: what we owe this supplier, and every order we have placed with them. */
  getOrders: async (actor: Actor, supplierId: string, now: Date = new Date()): Promise<SupplierPurchasing> => {
    const siteId = await requireHubReader(actor);
    await loadSupplier(siteId, supplierId);
    const orders = await supplierAccountRepository.findOrders(siteId, supplierId);
    const owing = owingOf(orders, day(now));
    const blind = blindnessOf(actor).financials;
    return {
      // A caller blind to financial data gets the orders but not what we owe.
      owing: blind
        ? { ...owing, owing: '', overdue: '', disputedAmount: '', creditHeld: '', late: { days1To30: '', days31To60: '', days61To90: '', days90Plus: '' }, invoices: [] }
        : owing,
      orders: orders.map((o) => viewRow(actor, o, now)),
    };
  },

  getStatement: async (actor: Actor, supplierId: string, query: StatementQuery, now: Date = new Date()): Promise<SupplierStatement> => {
    const siteId = await requireHubReader(actor);
    const supplier = await loadSupplier(siteId, supplierId);
    const orders = await supplierAccountRepository.findOrders(siteId, supplierId);
    return statementOf(
      { id: supplier.id, name: supplier.name, code: supplier.code, address: supplier.address, contactName: supplier.contacts[0]?.name ?? null, termsDays: termsDaysOf(supplier) },
      orders,
      { from: query.from ?? firstOfLastMonth(now), to: query.to ?? day(now) },
      now,
    );
  },

  getStatementCsv: async (actor: Actor, supplierId: string, query: StatementQuery, now: Date = new Date()): Promise<{ fileName: string; csv: string }> => {
    const statement = await supplierAccountService.getStatement(actor, supplierId, query, now);
    return { fileName: `statement-${statement.supplier.code}-${statement.from}-to-${statement.to}.csv`, csv: statementCsv(statement) };
  },
};
