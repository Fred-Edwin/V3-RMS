/**
 * test-lane-setup.ts
 *
 * Makes a clean lane database ready for the Workforce database tests (see docs/features/workforce/TESTING.md).
 * The database is the migrated `wendo_rms_template` copy: the base company, two branches, the Central Store and the
 * `@wendo.test` logins, with no demo people. This helper adds only what the tests expect and the base lacks:
 *   - the signing PIN 1234 on every `@wendo.test` login (the base copy holds dev PINs nobody remembers). It writes no PIN
 *     backup file and reads none, so it cannot overwrite one; the tests that sign with another PIN restore this one;
 *   - a cleared lane Redis (try counters and rate limits), refused for any Redis that is not on ports 6401 to 6409;
 *   - the `hr@wendo.test` login (HR Manager, no branch), which the base does not hold.
 * Safe to re-run: it changes nothing the second time. Never seeds demo data. Ends by itself.
 *
 * Usage (lane database only):
 *   DATABASE_URL=postgresql://.../wendo_rms_lane3 REDIS_URL=redis://127.0.0.1:6403 pnpm exec tsx src/scripts/test-lane-setup.ts
 */
import 'dotenv/config';
import { prisma } from '../config/database';
import { redisClient } from '../config/redis';
import { comparePin, hashPassword, hashPin } from '../utils/password';

const TEST_PIN = '1234';
const TEST_PASSWORD = 'password123';
const HR = 'hr@wendo.test';

async function main(): Promise<void> {
  const url = process.env['DATABASE_URL'] ?? '';
  if (!/_lane\d*(\?|$)/.test(url)) throw new Error('Refusing to run: DATABASE_URL is not a lane database.');

  const hr = await prisma.user.findUnique({ where: { email: HR }, select: { id: true } });
  if (!hr) {
    await prisma.user.create({
      data: { name: 'Test HR Manager', email: HR, role: 'HR_MANAGER', passwordHash: await hashPassword(TEST_PASSWORD), isTestUser: true },
    });
    console.log(`created ${HR}`);
  }

  // One department with a person and no head (a "gap"): the Organisation and Home tests count on at least one, and the base copy
  // gives every staffed department a head. A single waiter at Nyeri Town in Service, which has no head.
  const town = await prisma.site.findFirst({ where: { name: 'Nyeri Town', type: 'BRANCH' }, select: { id: true, companyId: true } });
  if (town) {
    const [service, waiter] = await Promise.all([
      prisma.department.findFirst({ where: { siteId: town.id, key: 'SERVICE' }, select: { id: true } }),
      prisma.position.findFirst({ where: { companyId: town.companyId, name: 'Waiter' }, select: { id: true } }),
    ]);
    const exists = await prisma.employee.findFirst({ where: { companyId: town.companyId, employeeNumber: 'W-TESTGAP' }, select: { id: true } });
    if (service && waiter && !exists) {
      await prisma.employee.create({
        data: {
          companyId: town.companyId, siteId: town.id, departmentId: service.id, positionId: waiter.id, employeeNumber: 'W-TESTGAP',
          name: 'Test Service Waiter', status: 'ACTIVE', payType: 'MONTHLY_SALARY', startDate: new Date('2026-01-05T00:00:00Z'),
        },
      });
      console.log('created the staffed department with no head (Nyeri Town, Service)');
    }
  }

  // The base copy carries dev PINs nobody remembers; the tests sign with 1234. A PIN that is not 1234 is replaced, so the run always
  // starts from the same state. (The tests that use another PIN save and restore this one themselves.)
  const logins = await prisma.user.findMany({ where: { email: { endsWith: '@wendo.test' } }, select: { id: true, pinHash: true } });
  const stale: string[] = [];
  for (const u of logins) if (!u.pinHash || !(await comparePin(TEST_PIN, u.pinHash))) stale.push(u.id);
  if (stale.length > 0) await prisma.user.updateMany({ where: { id: { in: stale } }, data: { pinHash: await hashPin(TEST_PIN) } });
  console.log(`PIN ${TEST_PIN} set on ${stale.length} of ${logins.length} test login(s)`);

  // Try counters and rate limits live in the lane's Redis; leftovers from an earlier run change what the limit tests see.
  const redisUrl = process.env['REDIS_URL'] ?? '';
  if (!/:640\d\b/.test(redisUrl)) throw new Error('Refusing to clear Redis: REDIS_URL is not a lane Redis (port 6401 to 6409).');
  await redisClient.flushdb();
  console.log('lane Redis cleared');
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    redisClient.disconnect();
    process.exit(1);
  });
