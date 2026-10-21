import 'dotenv/config';
import { prisma } from '../config/database';
import { backfillReportsTo } from '../modules/workforce/people/hire/reports-to-backfill'; // a one-off script, not part of the public door

/** People fix 12: give people hired before the default the site manager as their boss. Safe to run again. */
const run = async (): Promise<void> => {
  const companies = await prisma.company.findMany({ select: { id: true } });
  for (const company of companies) {
    const result = await backfillReportsTo(company.id);
    console.log(`reports-to backfill: ${result.updated} set, ${result.skipped} left (no manager at the site)`);
  }
};

run()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
