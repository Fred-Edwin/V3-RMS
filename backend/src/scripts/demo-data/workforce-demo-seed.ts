/**
 * The Workforce demo lane: a believable fictional Wendo on the throwaway lane 6 database, for the section videos.
 *   pnpm demo:seed            seeds once (does nothing if the demo is already there)
 *   pnpm demo:seed --reset    empties the lane database (keeps the company and positions), then seeds again
 *   pnpm demo:seed --wipe     empties it and stops
 * Logins and passwords: see ./workforce/README.md.
 */
import 'dotenv/config';
import { prisma } from '../../config/database';
import { out, resetLane, seedBase, type World } from './workforce/base';
import { seedHistory } from './workforce/history';
import { runFlows } from './workforce/flows';
import { seedSchedule } from './workforce/schedule';

async function main(): Promise<void> {
  const flags = new Set(process.argv.slice(2));
  if (flags.has('--reset') || flags.has('--wipe')) await resetLane();
  if (flags.has('--wipe')) return;
  if ((await prisma.employee.count()) > 0) {
    out('The demo is already seeded. Run with --reset to start again from empty.');
    return;
  }
  const world: World = await seedBase();
  await seedHistory(world);
  await runFlows(world);
  await seedSchedule(world);
  out('\nDone. Logins are in backend/src/scripts/demo-data/workforce/README.md');
}

main()
  .catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect().then(() => process.exit()));
