// Usage: node scripts/demo/record.mjs <scene-name> [--out <dir>] [--fresh-login]
// Records scripts/demo/scenes/<scene-name>.mjs into <out>/<scene id>/scene.webm + captions.json (default out: scripts/demo/out).
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { clearSessions, openScene } from './lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--out');
const outAt = args.indexOf('--out');
const outDir = resolve(outAt >= 0 ? args[outAt + 1] : join(here, 'out'));
if (!name) { console.error('Usage: node scripts/demo/record.mjs <scene-name> [--out <dir>] [--fresh-login]'); process.exit(2); }
if (args.includes('--fresh-login')) clearSessions();

const scene = (await import(pathToFileURL(join(here, 'scenes', `${name}.mjs`)).href)).default;
const s = await openScene({ id: scene.id, role: scene.role, viewport: scene.viewport, outDir, warmup: scene.warmup });
try {
  await scene.run(s);
  console.log(`recorded ${await s.finish()}`);
} catch (err) {
  await s.finish().catch(() => {});
  console.error(err.message);
  process.exit(1);
}
process.exit(0);
