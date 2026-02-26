import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const items = await prisma.menuItem.findMany({
    where: { deletedAt: null, isActive: true },
    select: { name: true, imageUrl: true, category: { select: { name: true } } },
    orderBy: [{ category: { displayOrder: 'asc' } }, { name: 'asc' }],
  });

  let currentCategory = '';
  for (const item of items) {
    if (item.category.name !== currentCategory) {
      currentCategory = item.category.name;
      console.log(`\n[${currentCategory}]`);
    }
    const img = item.imageUrl ? ' ✓' : '';
    console.log(`  ${item.name}${img}`);
  }
  console.log(`\nTotal: ${items.length} items`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
