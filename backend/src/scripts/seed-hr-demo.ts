/**
 * seed-hr-demo.ts
 *
 * Creates a small set of illustrative HR demo records so the HR module looks
 * populated and meaningful during a demo. All created records are tagged with
 * a notes field set to DEMO_TAG so they can be identified and cleaned up.
 *
 * What it creates:
 *   - 3 leave requests (one PENDING, one APPROVED, one REJECTED)
 *   - 2 disciplinary records (one VERBAL_WARNING, one WRITTEN_WARNING)
 *
 * Usage:
 *   # Create demo data
 *   docker compose exec api node dist/scripts/seed-hr-demo.js
 *
 *   # Clean up demo data only
 *   docker compose exec api node dist/scripts/seed-hr-demo.js --reset-only
 *
 * Local:
 *   pnpm tsx src/scripts/seed-hr-demo.ts [--reset-only]
 */

import 'dotenv/config';
import { prisma } from '../config/database';

const DEMO_TAG = '[hr-demo-seed]';

// ─── Reset ────────────────────────────────────────────────────────────────────

async function reset(): Promise<void> {
  console.log('🧹  Removing HR demo records…\n');

  const deletedDisciplinary = await prisma.disciplinaryRecord.deleteMany({
    where: { outcome: { contains: DEMO_TAG } },
  });

  const deletedLeave = await prisma.leaveRequest.deleteMany({
    where: { reason: { contains: DEMO_TAG } },
  });

  console.log(`   ✓ Deleted ${deletedLeave.count} demo leave request(s)`);
  console.log(`   ✓ Deleted ${deletedDisciplinary.count} demo disciplinary record(s)`);
  console.log('\n✅  Demo data removed.');
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  console.log('🌱  Seeding HR demo data…\n');

  // ── Find profiles to attach demo records to ───────────────────────────────
  // Pick staff who have profiles — prefer WAITER/BARISTA/CHEF roles
  const profiles = await prisma.employeeProfile.findMany({
    where: {
      user: {
        isActive: true,
        role: { in: ['WAITER', 'BARISTA', 'CHEF'] },
      },
    },
    include: {
      user: { select: { id: true, name: true, role: true, organizationId: true } },
      leaveBalances: { where: { leaveType: 'ANNUAL', leaveYear: new Date().getFullYear() } },
    },
    orderBy: { createdAt: 'asc' },
    take: 5,
  });

  if (profiles.length === 0) {
    console.error('❌  No eligible staff profiles found. Run seed-employee-profiles first.');
    process.exit(1);
  }

  // Find an HR_MANAGER or DIRECTOR to act as reviewer / issuer
  const reviewer = await prisma.user.findFirst({
    where: { role: { in: ['HR_MANAGER', 'DIRECTOR'] }, isActive: true },
    select: { id: true, name: true },
  });

  if (!reviewer) {
    console.error('❌  No HR_MANAGER or DIRECTOR found. Create one first via the admin panel.');
    process.exit(1);
  }

  console.log(`   Using reviewer: ${reviewer.name}`);
  console.log(`   Found ${profiles.length} staff profiles to attach demo records to.\n`);

  const now = new Date();
  let leaveCreated = 0;
  let discCreated = 0;

  // Unpack profiles — all accesses via named vars after guard checks
  const [prof0, prof1, prof2, prof3, prof4] = profiles;

  // ── Leave Request 1: PENDING (submitted 2 days ago, starts next week) ─────
  if (prof0) {
    const leaveBalance0 = prof0.leaveBalances[0];
    if (leaveBalance0 && prof0.user.organizationId) {
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2); // 3 days

      await prisma.leaveRequest.create({
        data: {
          employeeProfileId: prof0.id,
          leaveBalanceId: leaveBalance0.id,
          organizationId: prof0.user.organizationId,
          leaveType: 'ANNUAL',
          startDate,
          endDate,
          totalDays: '3',
          reason: `Annual leave — family gathering ${DEMO_TAG}`,
          status: 'PENDING',
        },
      });
      console.log(`   ✓ Leave PENDING — ${prof0.user.name} (Annual, 3 days next week)`);
      leaveCreated++;
    } else {
      console.log(`   ⚠  Skipped PENDING leave — ${prof0.user.name} has no annual balance or org`);
    }
  }

  // ── Leave Request 2: APPROVED (last month) ────────────────────────────────
  if (prof1) {
    const leaveBalance1 = prof1.leaveBalances[0];
    if (leaveBalance1 && prof1.user.organizationId) {
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 20);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1); // 2 days

      const req = await prisma.leaveRequest.create({
        data: {
          employeeProfileId: prof1.id,
          leaveBalanceId: leaveBalance1.id,
          organizationId: prof1.user.organizationId,
          leaveType: 'ANNUAL',
          startDate,
          endDate,
          totalDays: '2',
          reason: `Appointment and personal errands ${DEMO_TAG}`,
          status: 'APPROVED',
          reviewedById: reviewer.id,
          reviewedAt: new Date(startDate.getTime() - 3 * 24 * 60 * 60 * 1000),
          reviewComment: 'Approved. Enjoy your time off.',
        },
      });

      // Deduct from balance to reflect reality
      await prisma.leaveBalance.update({
        where: { id: leaveBalance1.id },
        data: { usedDays: { increment: 2 } },
      });

      console.log(`   ✓ Leave APPROVED — ${prof1.user.name} (Annual, 2 days, last month) [id: ${req.id.slice(0, 8)}…]`);
      leaveCreated++;
    } else {
      console.log(`   ⚠  Skipped APPROVED leave — ${prof1.user.name} has no annual balance or org`);
    }
  }

  // ── Leave Request 3: SICK / REJECTED ─────────────────────────────────────
  if (prof2) {
    const sickBalance = await prisma.leaveBalance.findUnique({
      where: {
        employeeProfileId_leaveType_leaveYear: {
          employeeProfileId: prof2.id,
          leaveType: 'SICK',
          leaveYear: now.getFullYear(),
        },
      },
    });
    if (sickBalance && prof2.user.organizationId) {
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 10);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 4); // 5 days

      await prisma.leaveRequest.create({
        data: {
          employeeProfileId: prof2.id,
          leaveBalanceId: sickBalance.id,
          organizationId: prof2.user.organizationId,
          leaveType: 'SICK',
          startDate,
          endDate,
          totalDays: '5',
          reason: `Feeling unwell, doctor's appointment ${DEMO_TAG}`,
          status: 'REJECTED',
          reviewedById: reviewer.id,
          reviewedAt: new Date(startDate.getTime() - 1 * 24 * 60 * 60 * 1000),
          reviewComment: 'Medical certificate required for sick leave exceeding 3 days.',
        },
      });
      console.log(`   ✓ Leave REJECTED — ${prof2.user.name} (Sick, 5 days, 10 days ago)`);
      leaveCreated++;
    } else {
      console.log(`   ⚠  Skipped REJECTED leave — ${prof2.user.name} has no sick balance or org`);
    }
  }

  // ── Disciplinary Record 1: VERBAL_WARNING ─────────────────────────────────
  const pd0 = prof3 ?? prof0;
  if (pd0?.user.organizationId) {
    const incidentDate = new Date(now);
    incidentDate.setDate(incidentDate.getDate() - 14);
    const actionDate = new Date(incidentDate);
    actionDate.setDate(actionDate.getDate() + 2);
    const expiresAt = new Date(actionDate);
    expiresAt.setMonth(expiresAt.getMonth() + 3);

    await prisma.disciplinaryRecord.create({
      data: {
        employeeProfileId: pd0.id,
        organizationId: pd0.user.organizationId,
        incidentDate,
        actionDate,
        category: 'ATTENDANCE',
        description: 'Staff member arrived 45 minutes late on three separate occasions within the same week without prior notification.',
        actionTaken: 'VERBAL_WARNING',
        outcome: `Verbal warning issued. Staff member was reminded of punctuality policy and asked to notify the manager in advance if late. ${DEMO_TAG}`,
        issuedById: reviewer.id,
        expiresAt,
      },
    });
    console.log(`   ✓ Disciplinary VERBAL_WARNING — ${pd0.user.name} (Attendance)`);
    discCreated++;
  }

  // ── Disciplinary Record 2: WRITTEN_WARNING ────────────────────────────────
  const pd1 = prof4 ?? prof1;
  if (pd1 && pd1.user.organizationId && pd1.id !== pd0?.id) {
    const incidentDate = new Date(now);
    incidentDate.setDate(incidentDate.getDate() - 30);
    const actionDate = new Date(incidentDate);
    actionDate.setDate(actionDate.getDate() + 3);
    const expiresAt = new Date(actionDate);
    expiresAt.setMonth(expiresAt.getMonth() + 6);

    await prisma.disciplinaryRecord.create({
      data: {
        employeeProfileId: pd1.id,
        organizationId: pd1.user.organizationId,
        incidentDate,
        actionDate,
        category: 'MISCONDUCT',
        description: 'Staff member was found using personal phone during service hours, affecting order quality and customer experience.',
        actionTaken: 'WRITTEN_WARNING',
        outcome: `Written warning issued and placed on file. A repeat incident within 6 months will result in a final warning. ${DEMO_TAG}`,
        issuedById: reviewer.id,
        acknowledged: true,
        acknowledgedAt: new Date(actionDate.getTime() + 1 * 24 * 60 * 60 * 1000),
        expiresAt,
      },
    });
    console.log(`   ✓ Disciplinary WRITTEN_WARNING — ${pd1.user.name} (Misconduct) — acknowledged`);
    discCreated++;
  }

  console.log(`\n🎉  Done. Created: ${leaveCreated} leave request(s), ${discCreated} disciplinary record(s).`);
  console.log(`\n💡  To remove demo data after the demo, run:`);
  console.log(`     docker compose exec api node dist/scripts/seed-hr-demo.js --reset-only\n`);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const isResetOnly = process.argv.includes('--reset-only');

(isResetOnly ? reset() : seed())
  .catch((err) => { console.error('Fatal:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
