/**
 * seed-organizations.ts
 *
 * Creates the hub organization ("Wendo Central Kitchen", isHub: true) and
 * two branch organizations ("Nyeri Town", "Nyeri Highway") for local dev.
 * No org-creation script has existed in this codebase since seed-ck-org.ts
 * was retired — organizations were previously created by hand in Prisma
 * Studio. Written during Milestone Five Session B after a local DB reset
 * (migration checksum drift) wiped every organization row.
 *
 * Idempotent: upserts by name. Safe to re-run.
 * ONLY runs when NODE_ENV is not "production".
 *
 * Usage:
 *   npx tsx src/scripts/seed-organizations.ts
 */

import 'dotenv/config';
import { prisma } from '../config/database';
import { env } from '../config/env';

if (env.NODE_ENV === 'production') {
  console.error('ERROR: seed-organizations must not run in production. Exiting.');
  process.exit(1);
}

type OrgSpec = {
  name: string;
  address: string;
  city: string;
  latitude: string;
  longitude: string;
  isHub: boolean;
};

const ORGS: OrgSpec[] = [
  {
    name: 'Wendo Central Kitchen',
    address: 'Ring Road, Nyeri',
    city: 'Nyeri',
    latitude: '-0.4197',
    longitude: '36.9489',
    isHub: true,
  },
  {
    name: 'Nyeri Town',
    address: 'Kimathi Way, Nyeri Town',
    city: 'Nyeri',
    latitude: '-0.4225',
    longitude: '36.9515',
    isHub: false,
  },
  {
    name: 'Nyeri Highway',
    address: 'Nyeri-Nairobi Highway',
    city: 'Nyeri',
    latitude: '-0.4381',
    longitude: '36.9601',
    isHub: false,
  },
];

const run = async (): Promise<void> => {
  for (const spec of ORGS) {
    const existing = await prisma.organization.findFirst({ where: { name: spec.name } });
    if (existing) {
      console.log(`SKIP  ${spec.name} (already exists, id: ${existing.id})`);
      continue;
    }
    const created = await prisma.organization.create({
      data: {
        name: spec.name,
        address: spec.address,
        city: spec.city,
        latitude: spec.latitude,
        longitude: spec.longitude,
        isHub: spec.isHub,
        isActive: true,
      },
    });
    console.log(`OK    ${spec.name} — ${spec.isHub ? 'HUB' : 'branch'} (id: ${created.id})`);
  }
};

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
