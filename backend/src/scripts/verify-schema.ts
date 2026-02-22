import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const expectedTables = [
  'organizations',
  'users',
  'menu_categories',
  'menu_items',
  'branch_menu_items',
  'delivery_zones',
  'shifts',
  'shift_assignments',
  'clock_records',
  'orders',
  'order_items',
  'prep_tickets',
  '_prisma_migrations',
] as const;

const run = async (): Promise<void> => {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename = any(${expectedTables}::text[])
    order by tablename
  `;

  const indexes = await prisma.$queryRaw<Array<{ tablename: string; indexname: string }>>`
    select tablename, indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename = any(${expectedTables}::text[])
    order by tablename, indexname
  `;

  const missing = expectedTables.filter(
    (tableName) => !tables.some((table) => table.tablename === tableName),
  );

  console.log(
    JSON.stringify(
      {
        tableCount: tables.length,
        indexCount: indexes.length,
        missingTables: missing,
      },
      null,
      2,
    ),
  );
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
