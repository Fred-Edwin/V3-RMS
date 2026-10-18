import 'dotenv/config';
import { prisma } from '../config/database';
import { carryOverLegacyRota } from '../modules/workforce/rota/legacy/legacy-carry-over';

/** Workforce slice 2: copy the legacy shifts and upcoming assignments into the new rota. Safe to run again. */
const run = async (): Promise<void> => {
  const result = await carryOverLegacyRota(new Date());
  console.log(`rota carry-over: ${result.templatesCreated} shifts, ${result.entriesCreated} entries, ${result.templatesSkipped} shifts left out, ${result.weeksLeftAlone} weeks already edited`);
};

run()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
