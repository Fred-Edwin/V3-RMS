/**
 * seed-dev.ts
 *
 * Creates a complete set of local development accounts across all active
 * branches for multi-role, multi-branch testing.
 * ONLY runs when NODE_ENV is not "production". Safe to re-run — idempotent.
 *
 * Global (one account, assigned to the hub/first org):
 *   director1@dev.test  — DIRECTOR
 *
 * Per branch (using branch slug derived from the org name):
 *   manager   — 1
 *   waiter    — 4
 *   chef      — 4
 *   barista   — 4
 *   kds       — 1  (KITCHEN_DISPLAY)
 *   bds       — 1  (BARISTA_DISPLAY)
 *
 * Email pattern (per-branch):  <role><n>.<branch-slug>@dev.test
 * Email pattern (director):    director1@dev.test
 * Password:                    password123
 *
 * Example for branch "Nyeri Town" (slug: nyeritown):
 *   manager1.nyeritown@dev.test
 *   waiter1.nyeritown@dev.test  ... waiter4.nyeritown@dev.test
 *   chef1.nyeritown@dev.test    ... chef4.nyeritown@dev.test
 *   barista1.nyeritown@dev.test ... barista4.nyeritown@dev.test
 *   kds1.nyeritown@dev.test
 *   bds1.nyeritown@dev.test
 *
 * Usage:
 *   docker compose exec api node dist/scripts/seed-dev.js
 */

import 'dotenv/config';
import { UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { hashPassword } from '../utils/password';

if (env.NODE_ENV === 'production') {
  console.error('ERROR: seed-dev must not run in production. Exiting.');
  process.exit(1);
}

const DEV_PASSWORD = 'password123';

/** Convert org name to a safe email slug: "Nyeri Town" → "nyeritown" */
const toSlug = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]/g, '');

type RoleSpec = {
  role: UserRole;
  prefix: string;
  count: number;
};

const BRANCH_ROLE_SPECS: RoleSpec[] = [
  { role: UserRole.MANAGER, prefix: 'manager', count: 1 },
  { role: UserRole.WAITER, prefix: 'waiter', count: 4 },
  { role: UserRole.CHEF, prefix: 'chef', count: 4 },
  { role: UserRole.BARISTA, prefix: 'barista', count: 4 },
  { role: UserRole.KITCHEN_DISPLAY, prefix: 'kds', count: 1 },
  { role: UserRole.BARISTA_DISPLAY, prefix: 'bds', count: 1 },
];

const upsertUser = async (
  email: string,
  name: string,
  role: UserRole,
  organizationId: string,
  passwordHash: string,
): Promise<boolean> => {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    return false; // skipped
  }

  await prisma.user.create({
    data: { name, email, role, organizationId, passwordHash, isActive: true },
  });

  return true; // created
};

const run = async (): Promise<void> => {
  const orgs = await prisma.organization.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, isHub: true },
  });

  if (orgs.length === 0) {
    throw new Error(
      'No active organizations found. Create at least one organization before running seed-dev.',
    );
  }

  console.log(`Found ${orgs.length} active organization(s).\n`);

  const passwordHash = await hashPassword(DEV_PASSWORD);
  let totalCreated = 0;
  let totalSkipped = 0;

  // --- Director: one global account, assigned to the hub org (or first org) ---
  const hubOrg = orgs.find((o) => o.isHub) ?? orgs[0]!;
  const directorEmail = 'director1@dev.test';

  console.log(`── Global`);
  const dirCreated = await upsertUser(
    directorEmail,
    'Dev Director',
    UserRole.DIRECTOR,
    hubOrg.id,
    passwordHash,
  );
  if (dirCreated) {
    console.log(`  OK    ${directorEmail} — DIRECTOR (org: ${hubOrg.name})`);
    totalCreated++;
  } else {
    console.log(`  SKIP  ${directorEmail}`);
    totalSkipped++;
  }
  console.log();

  // --- Per-branch accounts ---
  for (const org of orgs) {
    const slug = toSlug(org.name);
    console.log(`── ${org.name} (slug: ${slug})`);

    for (const spec of BRANCH_ROLE_SPECS) {
      for (let n = 1; n <= spec.count; n++) {
        const email = `${spec.prefix}${n}.${slug}@dev.test`;
        const name = `Dev ${spec.prefix.charAt(0).toUpperCase() + spec.prefix.slice(1)} ${n} (${org.name})`;
        const created = await upsertUser(email, name, spec.role, org.id, passwordHash);

        if (created) {
          console.log(`  OK    ${email} — ${spec.role}`);
          totalCreated++;
        } else {
          console.log(`  SKIP  ${email}`);
          totalSkipped++;
        }
      }
    }

    console.log();
  }

  console.log(`Done. Created: ${totalCreated}  Skipped (already existed): ${totalSkipped}`);

  // --- Summary table ---
  console.log(`\nDev accounts — password: ${DEV_PASSWORD}`);
  console.log(`\nGlobal`);
  console.log('─'.repeat(52));
  console.log(`  DIRECTOR          ${directorEmail}`);

  for (const org of orgs) {
    const slug = toSlug(org.name);
    console.log(`\n${org.name}`);
    console.log('─'.repeat(52));
    for (const spec of BRANCH_ROLE_SPECS) {
      for (let n = 1; n <= spec.count; n++) {
        const email = `${spec.prefix}${n}.${slug}@dev.test`;
        console.log(`  ${spec.role.padEnd(16)}  ${email}`);
      }
    }
  }
};

run()
  .catch((error: unknown) => {
    console.error('seed-dev failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
