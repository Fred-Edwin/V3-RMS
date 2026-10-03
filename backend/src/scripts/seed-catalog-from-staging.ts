/**
 * seed-catalog-from-staging.ts
 *
 * Loads the reviewed Central Store catalog from
 * `docs/Item Catalog/staging/catalog-staging.json` (built from the stock
 * sheet and the real supplier documents; review document next to it):
 * categories, items, suppliers with contacts and payment methods, and one
 * supplier line per item and supplier seen on an invoice.
 *
 * Reference data ONLY: no restock levels, opening stock, orders, receipts or
 * invoices. Those come from the app (first blind count, department heads).
 *
 * Safe by default:
 *  - DRY RUN unless `--apply` is passed. A dry run executes the whole load
 *    inside one transaction, prints the report, then rolls back, so every
 *    constraint is really exercised and nothing is kept.
 *  - Idempotent: rows are matched by name within the hub org and left alone
 *    when they already exist (they are reported as "exists", never edited or
 *    deleted). Supplier lines are matched by supplier + item.
 *  - Production needs ALLOW_PRODUCTION_SEED=true, SEED_REPORTS_CONFIRM=YES and
 *    `--apply`, like the other seed scripts.
 *
 * D-15: everything is written under the hub org.
 *
 * Usage (from backend/):
 *   npx tsx src/scripts/seed-catalog-from-staging.ts              # dry run
 *   npx tsx src/scripts/seed-catalog-from-staging.ts --apply      # write
 *   SEED_ACTOR_EMAIL=someone@wendo.test ...                       # who "created" rows
 *   npx tsx src/scripts/seed-catalog-from-staging.ts --file path.json
 */

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config/env';

type ItemType = 'RAW_INGREDIENT' | 'PREPPED' | 'STOCKED';
type DeptTag = 'KITCHEN' | 'PASTRY' | 'BARISTA' | 'SERVICE' | 'HOUSEKEEPING';
type PayMethodType = 'BANK_TRANSFER' | 'MPESA_PAYBILL' | 'MPESA_TILL' | 'MPESA_SEND_MONEY' | 'CASH';

interface StagedLine {
  supplier: string;
  theirName: string;
  theirCode: string | null;
  buyUnit: string;
  packSize: number | null;
  price: number;
  priceDate: string;
  preferred: boolean;
}
interface StagedItem {
  key: string;
  name: string;
  type: ItemType;
  category: string;
  parentCategory: string | null;
  usageUnit: string;
  buyUnit: string;
  packSize: number | null;
  departments: DeptTag[];
  currentCost: number | null;
  lines: StagedLine[];
}
interface StagedPayMethod {
  type: PayMethodType;
  bankName?: string | null;
  bankBranch?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  paybillNumber?: string | null;
  accountReference?: string | null;
  isDefault: boolean;
}
interface StagedSupplier {
  name: string;
  tradingName?: string;
  type: 'REGULAR' | 'OCCASIONAL' | 'ONE_OFF' | 'MARKET';
  category: string;
  kraPin: string | null;
  vatRegistered: boolean;
  address: string;
  phone: string | null;
  email: string | null;
  terms: 'INVOICE_TO_FOLLOW' | 'PAY_NOW';
  paymentDays: number;
  notes: string;
  payMethods: StagedPayMethod[];
}
interface Staging {
  categories: { name: string; children: string[] }[];
  suppliers: Record<string, StagedSupplier>;
  items: StagedItem[];
}

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const fileArg = args.indexOf('--file');
const FILE =
  fileArg >= 0 && args[fileArg + 1]
    ? path.resolve(args[fileArg + 1] as string)
    : path.resolve(__dirname, '../../../docs/Item Catalog/staging/catalog-staging.json');

if (env.NODE_ENV === 'production') {
  if (!APPLY || process.env['ALLOW_PRODUCTION_SEED'] !== 'true' || process.env['SEED_REPORTS_CONFIRM'] !== 'YES') {
    console.error(
      'ERROR: refusing to run against production without --apply, ALLOW_PRODUCTION_SEED=true and ' +
        'SEED_REPORTS_CONFIRM=YES. (Run a dry run on a local database first.) Exiting.',
    );
    process.exit(1);
  }
}

class DryRunRollback extends Error {}

const report = {
  created: { categories: 0, suppliers: 0, contacts: 0, payMethods: 0, items: 0, supplierLines: 0 },
  exists: { categories: [] as string[], suppliers: [] as string[], items: [] as string[], supplierLines: [] as string[] },
  warnings: [] as string[],
};

const maskAccount = (n: string | null | undefined): string | null => (n ? `•••• ${n.slice(-4)}` : null);
const dec = (n: number | null | undefined): Prisma.Decimal | null =>
  n === null || n === undefined ? null : new Prisma.Decimal(n);

const nextSupplierCode = async (tx: Prisma.TransactionClient, siteId: string): Promise<string> => {
  const counter = await tx.referenceCounter.upsert({
    where: { siteId_prefix: { siteId, prefix: 'SUPPLIER' } },
    update: { lastNumber: { increment: 1 } },
    create: { siteId, prefix: 'SUPPLIER', lastNumber: 1 },
    select: { lastNumber: true },
  });
  return `SUPPLIER-${String(counter.lastNumber).padStart(4, '0')}`;
};

const load = async (data: Staging): Promise<void> => {
  await prisma.$transaction(
    async (tx) => {
      const hub = await tx.site.findFirst({ where: { isHub: true }, select: { id: true, name: true } });
      if (!hub) throw new Error('No hub organization found. Run seed-dev.ts / the org seed first.');
      const siteId = hub.id;

      const actorEmail = process.env['SEED_ACTOR_EMAIL'];
      const actor = actorEmail
        ? await tx.user.findUnique({ where: { email: actorEmail }, select: { id: true, email: true, siteId: true } })
        : await tx.user.findFirst({
            where: { siteId, role: 'STORE_MANAGER', isActive: true },
            select: { id: true, email: true, siteId: true },
          });
      if (!actor) throw new Error('No Store Manager on the hub org. Set SEED_ACTOR_EMAIL to an existing user.');
      console.log(`Hub org: ${hub.name}\nActor (created-by): ${actor.email}\n`);

      // ---- categories (two levels) ----
      const categoryId = new Map<string, string>();
      const ensureCategory = async (name: string, parentId: string | null): Promise<string> => {
        const found = await tx.category.findFirst({
          where: { siteId, name: { equals: name, mode: 'insensitive' }, deletedAt: null },
          select: { id: true },
        });
        if (found) {
          report.exists.categories.push(name);
          categoryId.set(name, found.id);
          return found.id;
        }
        const created = await tx.category.create({
          data: { siteId, name, parentCategoryId: parentId },
          select: { id: true },
        });
        report.created.categories += 1;
        categoryId.set(name, created.id);
        return created.id;
      };
      for (const c of data.categories) {
        const parent = await ensureCategory(c.name, null);
        for (const child of c.children) await ensureCategory(child, parent);
      }

      // ---- suppliers ----
      const supplierId = new Map<string, string>();
      for (const [key, s] of Object.entries(data.suppliers)) {
        const found = await tx.supplier.findFirst({
          where: { siteId, name: { equals: s.name, mode: 'insensitive' }, deletedAt: null },
          select: { id: true },
        });
        if (found) {
          report.exists.suppliers.push(s.name);
          supplierId.set(key, found.id);
          continue;
        }
        const catId = categoryId.get(s.category);
        if (!catId) report.warnings.push(`Supplier ${s.name}: category "${s.category}" not found`);
        const created = await tx.supplier.create({
          data: {
            siteId,
            code: await nextSupplierCode(tx, siteId),
            name: s.name,
            tradingName: s.tradingName ?? null,
            type: s.type,
            categoryId: catId ?? null,
            kraPin: s.kraPin,
            vatRegistered: s.vatRegistered,
            notes: s.notes,
            address: s.address.trim() || '—',
            defaultPaymentTerms: s.terms,
            paymentDays: s.paymentDays,
            createdById: actor.id,
            updatedById: actor.id,
          },
          select: { id: true },
        });
        report.created.suppliers += 1;
        supplierId.set(key, created.id);

        if (s.phone || s.email) {
          // No named person appears on any document, so the contact carries the business name.
          await tx.supplierContact.create({
            data: { siteId, supplierId: created.id, name: s.name, role: 'OTHER', phone: s.phone, email: s.email, isPrimary: true },
          });
          report.created.contacts += 1;
        }
        for (const m of s.payMethods) {
          const pm = await tx.supplierPayMethod.create({
            data: {
              siteId,
              supplierId: created.id,
              type: m.type,
              bankName: m.bankName ?? null,
              bankBranch: m.bankBranch ?? null,
              accountName: m.accountName ?? null,
              accountNumber: m.accountNumber ?? null,
              paybillNumber: m.paybillNumber ?? null,
              accountReference: m.accountReference ?? null,
              isDefault: m.isDefault,
              createdById: actor.id,
            },
            select: { id: true },
          });
          await tx.supplierAuditLog.create({
            data: {
              siteId,
              supplierId: created.id,
              action: 'PAY_METHOD_CREATED',
              entityId: pm.id,
              before: Prisma.JsonNull,
              after: { type: m.type, bankName: m.bankName ?? null, account: maskAccount(m.accountNumber), paybill: m.paybillNumber ?? null, isDefault: m.isDefault },
              actorId: actor.id,
            },
          });
          report.created.payMethods += 1;
        }
      }

      // ---- items and supplier lines ----
      for (const it of data.items) {
        const found = await tx.inventoryItem.findFirst({
          where: { siteId, name: { equals: it.name, mode: 'insensitive' }, deletedAt: null },
          select: { id: true },
        });
        let itemId: string;
        if (found) {
          report.exists.items.push(it.name);
          itemId = found.id;
        } else {
          const catId = categoryId.get(it.category);
          if (!catId) report.warnings.push(`Item ${it.name}: category "${it.category}" not found`);
          const preferred = it.lines.find((l) => l.preferred);
          const created = await tx.inventoryItem.create({
            data: {
              siteId,
              name: it.name,
              type: it.type,
              categoryId: catId ?? null,
              preferredSupplierId: preferred ? (supplierId.get(preferred.supplier) ?? null) : null,
              buyUnit: it.buyUnit,
              usageUnit: it.usageUnit,
              conversionFactor: dec(it.packSize),
              packSize: it.buyUnit !== it.usageUnit ? dec(it.packSize) : null,
              departmentTags: it.type === 'RAW_INGREDIENT' ? [] : it.departments,
              currentCost: dec(it.currentCost) ?? new Prisma.Decimal(0),
            },
            select: { id: true },
          });
          report.created.items += 1;
          itemId = created.id;
        }

        for (const l of it.lines) {
          const sId = supplierId.get(l.supplier);
          if (!sId) {
            report.warnings.push(`Item ${it.name}: supplier "${l.supplier}" missing`);
            continue;
          }
          // A line is (supplier, item, buy unit, pack size); matches the supplier_items_line_key index.
          const existing = await tx.supplierItem.findFirst({
            where: {
              siteId,
              supplierId: sId,
              inventoryItemId: itemId,
              buyUnit: l.buyUnit,
              packSize: dec(l.packSize),
            },
            select: { id: true },
          });
          if (existing) {
            report.exists.supplierLines.push(`${l.supplier} / ${it.name}`);
            continue;
          }
          // One preferred supplier per item: never displace one that is already set.
          let isPreferred = l.preferred;
          if (isPreferred) {
            const already = await tx.supplierItem.findFirst({
              where: { siteId, inventoryItemId: itemId, isPreferred: true },
              select: { id: true },
            });
            if (already) {
              isPreferred = false;
              report.warnings.push(`${it.name}: already has a preferred supplier, ${l.supplier} added as not preferred`);
            }
          }
          await tx.supplierItem.create({
            data: {
              siteId,
              supplierId: sId,
              inventoryItemId: itemId,
              supplierItemName: l.theirName,
              supplierItemCode: l.theirCode,
              buyUnit: l.buyUnit,
              packSize: dec(l.packSize),
              lastPrice: dec(l.price),
              lastPriceAt: new Date(`${l.priceDate}T00:00:00.000Z`),
              isPreferred,
            },
          });
          report.created.supplierLines += 1;
        }
      }

      if (!APPLY) throw new DryRunRollback();
    },
    { timeout: 300_000, maxWait: 15_000 },
  );
};

const main = async (): Promise<void> => {
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} · ${FILE}`);
  const data = JSON.parse(readFileSync(FILE, 'utf8')) as Staging;
  console.log(
    `Staged: ${data.categories.length} top categories, ${Object.keys(data.suppliers).length} suppliers, ` +
      `${data.items.length} items, ${data.items.reduce((n, i) => n + i.lines.length, 0)} supplier lines\n`,
  );
  try {
    await load(data);
  } catch (e) {
    if (!(e instanceof DryRunRollback)) throw e;
  }
  const c = report.created;
  console.log(`${APPLY ? 'Created' : 'Would create'}:`);
  console.log(`  categories ${c.categories} · suppliers ${c.suppliers} · contacts ${c.contacts} · payment methods ${c.payMethods}`);
  console.log(`  items ${c.items} · supplier lines ${c.supplierLines}`);
  const e = report.exists;
  console.log(`\nAlready there (left alone): ${e.categories.length} categories, ${e.suppliers.length} suppliers, ${e.items.length} items, ${e.supplierLines.length} supplier lines`);
  if (e.suppliers.length) console.log(`  suppliers: ${e.suppliers.join(', ')}`);
  if (e.items.length) console.log(`  items: ${e.items.join(', ')}`);
  if (report.warnings.length) console.log(`\nWarnings:\n  ${report.warnings.join('\n  ')}`);
  console.log(APPLY ? '\nDone. Changes are committed.' : '\nDry run only: nothing was written. Re-run with --apply to write.');
};

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
