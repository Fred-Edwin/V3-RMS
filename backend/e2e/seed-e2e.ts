// Fixture seed for the Playwright payroll-autosave e2e test
// (frontend/e2e/payroll-autosave.spec.ts). Point DATABASE_URL at a disposable
// database before running this — never the shared dev/prod database, since
// the test freely edits payroll rows for the fixtures below.
//
//   createdb wendo_rms_e2e   # or: psql -c "CREATE DATABASE wendo_rms_e2e"
//   DATABASE_URL=postgresql://wendo_user:<password>@localhost:5433/wendo_rms_e2e npx prisma migrate deploy
//   DATABASE_URL=postgresql://wendo_user:<password>@localhost:5433/wendo_rms_e2e npx tsx e2e/seed-e2e.ts
//   DOTENV_CONFIG_PATH=<env file with DATABASE_URL pointed at wendo_rms_e2e> node dist/server.js
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

const ORG_ID = 'e2e00000-0000-4000-8000-000000000001';
const HR_USER_ID = 'e2e00000-0000-4000-8000-000000000002';
const WAITER_ID = 'e2e00000-0000-4000-8000-000000000003';
export const E2E_PASSWORD = 'E2ePassword123!';

async function main() {
  const passwordHash = await hashPassword(E2E_PASSWORD);

  await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: {
      id: ORG_ID,
      name: 'E2E Test Branch',
      address: '1 Test Street, Nyeri',
      city: 'Nyeri',
      latitude: -0.4197,
      longitude: 36.9489,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { id: HR_USER_ID },
    update: {},
    create: {
      id: HR_USER_ID,
      name: 'E2E HR Manager',
      email: 'e2e-hr-manager@wendo.test',
      role: 'HR_MANAGER',
      organizationId: null,
      passwordHash,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { id: WAITER_ID },
    update: {},
    create: {
      id: WAITER_ID,
      name: 'E2E Test Waiter',
      email: 'e2e-waiter@wendo.test',
      role: 'WAITER',
      organizationId: ORG_ID,
      passwordHash,
      isActive: true,
    },
  });

  console.log('E2E fixtures seeded.');
  console.log(`HR login: e2e-hr-manager@wendo.test / ${E2E_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error('E2E seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
