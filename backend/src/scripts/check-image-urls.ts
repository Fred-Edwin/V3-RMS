import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const items = await prisma.menuItem.findMany({
    where: { deletedAt: null, isActive: true },
    select: { name: true, imageUrl: true },
    orderBy: { name: 'asc' },
  });

  const withImage = items.filter((i) => i.imageUrl);
  const without = items.filter((i) => !i.imageUrl);

  console.log(`\nWith image (${withImage.length}):`);
  withImage.forEach((i) => console.log(`  ✓ ${i.name}\n    ${i.imageUrl}`));

  console.log(`\nWithout image (${without.length}):`);
  without.forEach((i) => console.log(`  ✗ ${i.name}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
