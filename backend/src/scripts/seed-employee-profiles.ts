/**
 * seed-employee-profiles.ts
 *
 * One-off script: creates an EmployeeProfile + seeds leave balances for every
 * active user that does not already have one.
 *
 * Excluded roles: DIRECTOR, HR_MANAGER, SYSTEM_ADMIN (org-level, no branch duties)
 *                  KITCHEN_DISPLAY, BARISTA_DISPLAY (shared display accounts, not individual staff)
 *                  ACCOUNTANT is NOT excluded — the accountant is a branch-based employee who needs leave.
 * Inactive users are also excluded.
 *
 * Safe to run multiple times — skips users who already have a profile.
 *
 * Usage (production):
 *   docker compose exec api node dist/scripts/seed-employee-profiles.js
 *
 * Usage (local):
 *   pnpm tsx src/scripts/seed-employee-profiles.ts
 */

import 'dotenv/config';
import { prisma } from '../config/database';

const EXCLUDED_ROLES = ['DIRECTOR', 'HR_MANAGER', 'SYSTEM_ADMIN', 'KITCHEN_DISPLAY', 'BARISTA_DISPLAY'];

const run = async (): Promise<void> => {
  console.log('🔍  Finding staff without an employee profile…');

  // Show skipped users so the output is transparent about what was intentionally excluded
  const skipped = await prisma.user.findMany({
    where: {
      OR: [
        { isActive: false },
        { role: { in: EXCLUDED_ROLES as never[] } },
      ],
    },
    select: { name: true, role: true, isActive: true },
    orderBy: { name: 'asc' },
  });

  if (skipped.length > 0) {
    console.log(`⏭️   Skipping ${skipped.length} user(s) (inactive or excluded role):\n`);
    for (const u of skipped) {
      const reason = !u.isActive ? 'inactive' : 'excluded role';
      console.log(`   – ${u.name} (${u.role}) [${reason}]`);
    }
    console.log('');
  }

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { notIn: EXCLUDED_ROLES as never[] },
      employeeProfile: null,
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  });

  if (users.length === 0) {
    console.log('✅  All eligible active staff already have profiles. Nothing to do.');
    return;
  }

  console.log(`📋  Found ${users.length} staff member(s) without a profile:\n`);
  for (const u of users) {
    console.log(`   • ${u.name} (${u.role})`);
  }
  console.log('');

  const leaveYear = new Date().getFullYear();
  let created = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const profile = await prisma.employeeProfile.create({
        data: {
          userId: user.id,
          employmentType: 'FULL_TIME',
          startDate: new Date(),
        },
      });

      // Seed leave balances — must match hrRepository.seedLeaveBalances defaults
      await prisma.$transaction([
        prisma.leaveBalance.upsert({ where: { employeeProfileId_leaveType_leaveYear: { employeeProfileId: profile.id, leaveType: 'ANNUAL',    leaveYear } }, create: { employeeProfileId: profile.id, leaveType: 'ANNUAL',    leaveYear, totalDays: 21 }, update: {} }),
        prisma.leaveBalance.upsert({ where: { employeeProfileId_leaveType_leaveYear: { employeeProfileId: profile.id, leaveType: 'SICK',      leaveYear } }, create: { employeeProfileId: profile.id, leaveType: 'SICK',      leaveYear, totalDays: 10 }, update: {} }),
        prisma.leaveBalance.upsert({ where: { employeeProfileId_leaveType_leaveYear: { employeeProfileId: profile.id, leaveType: 'EMERGENCY', leaveYear } }, create: { employeeProfileId: profile.id, leaveType: 'EMERGENCY', leaveYear, totalDays: 5  }, update: {} }),
        prisma.leaveBalance.upsert({ where: { employeeProfileId_leaveType_leaveYear: { employeeProfileId: profile.id, leaveType: 'UNPAID',    leaveYear } }, create: { employeeProfileId: profile.id, leaveType: 'UNPAID',    leaveYear, totalDays: 30 }, update: {} }),
      ]);

      console.log(`   ✓ ${user.name}`);
      created++;
    } catch (err) {
      console.error(`   ✗ ${user.name} — ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  console.log(`\n🎉  Done. Created: ${created}  Failed: ${failed}`);
};

run()
  .catch((err) => { console.error('Fatal:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
