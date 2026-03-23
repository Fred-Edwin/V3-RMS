import 'dotenv/config';
import { prisma } from '../config/database';

const run = async (): Promise<void> => {
  const existing = await prisma.organization.findFirst({
    where: { isHub: true },
    select: { id: true, name: true },
  });

  if (existing) {
    console.log(`CK org already exists: "${existing.name}" (${existing.id})`);
    return;
  }

  const ckOrg = await prisma.organization.create({
    data: {
      name: 'Wendo Central Kitchen',
      address: 'Central Kitchen',
      city: 'Nyeri',
      latitude: -0.4167,
      longitude: 36.9500,
      isHub: true,
      isActive: true,
    },
  });

  console.log(`Created CK org: "${ckOrg.name}" (${ckOrg.id})`);

  const updated = await prisma.user.updateMany({
    where: { role: 'STORE_MANAGER' },
    data: { organizationId: ckOrg.id },
  });

  console.log(`Assigned ${updated.count} Store Manager(s) to CK org`);
};

run()
  .catch((error: unknown) => {
    console.error('Failed to seed CK org', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
