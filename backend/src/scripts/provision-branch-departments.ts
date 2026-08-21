/**
 * provision-branch-departments.ts
 *
 * Creates the 5 BRANCH_DEPARTMENT locations (Kitchen, Pastry, Barista, Service,
 * Housekeeping — D-1a) for every non-hub organization. Every branch runs all
 * five departments; there is no per-branch configuration.
 *
 * Safe to run in any environment, including production. Idempotent: for each
 * (organization, departmentTag) pair, creates the location only if it does not
 * already exist. Safe to re-run whenever a new branch is added later.
 *
 * Usage:
 *   npx tsx src/scripts/provision-branch-departments.ts
 *   node dist/scripts/provision-branch-departments.js
 */

import 'dotenv/config';
import { DepartmentTag } from '@prisma/client';
import { prisma } from '../config/database';

const DEPARTMENTS: { tag: DepartmentTag; name: string }[] = [
  { tag: 'KITCHEN', name: 'Kitchen' },
  { tag: 'PASTRY', name: 'Pastry' },
  { tag: 'BARISTA', name: 'Barista' },
  { tag: 'SERVICE', name: 'Service' },
  { tag: 'HOUSEKEEPING', name: 'Housekeeping' },
];

const run = async (): Promise<void> => {
  const branchOrgs = await prisma.organization.findMany({
    where: { isHub: false },
    select: { id: true, name: true },
  });

  if (branchOrgs.length === 0) {
    console.log('No branch organizations found — nothing to provision.');
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const branch of branchOrgs) {
    for (const dept of DEPARTMENTS) {
      const existing = await prisma.location.findUnique({
        where: {
          organizationId_type_departmentTag: {
            organizationId: branch.id,
            type: 'BRANCH_DEPARTMENT',
            departmentTag: dept.tag,
          },
        },
        select: { id: true },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.location.create({
        data: {
          organizationId: branch.id,
          type: 'BRANCH_DEPARTMENT',
          departmentTag: dept.tag,
          name: `${branch.name} — ${dept.name}`,
        },
      });
      created++;
      console.log(`Created ${dept.name} department location for ${branch.name}`);
    }
  }

  console.log(`Done. Created ${created} location(s), skipped ${skipped} already-provisioned.`);
};

run()
  .catch((error: unknown) => {
    console.error('Failed to provision branch departments', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
