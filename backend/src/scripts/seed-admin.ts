import 'dotenv/config';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { hashPassword } from '../utils/password';

const run = async (): Promise<void> => {
  if (!env.SYSTEM_ADMIN_EMAIL || !env.SYSTEM_ADMIN_PASSWORD) {
    throw new Error('SYSTEM_ADMIN_EMAIL and SYSTEM_ADMIN_PASSWORD are required to seed admin');
  }

  const existing = await prisma.user.findFirst({
    where: {
      role: 'SYSTEM_ADMIN',
    },
    select: {
      id: true,
      email: true,
    },
  });

  if (existing) {
    console.log(`System Admin already exists (${existing.email})`);
    return;
  }

  const passwordHash = await hashPassword(env.SYSTEM_ADMIN_PASSWORD);
  await prisma.user.create({
    data: {
      name: 'System Admin',
      email: env.SYSTEM_ADMIN_EMAIL,
      role: 'SYSTEM_ADMIN',
      organizationId: null,
      passwordHash,
      isActive: true,
    },
  });

  console.log(`System Admin seeded (${env.SYSTEM_ADMIN_EMAIL})`);
};

run()
  .catch((error: unknown) => {
    console.error('Failed to seed System Admin', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
