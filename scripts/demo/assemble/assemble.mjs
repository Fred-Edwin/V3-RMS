// Usage: node scripts/demo/assemble/assemble.mjs <section.json> [--in <scenes dir>] [--out <file.mp4>]
// Joins recorded scenes into one 1080p MP4: Aurora canvas with a slow drift and a light grain, the recording framed at native size,
// designed captions, a title card and an end card. Captions come from each scene's captions.json (time + text).
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as design from './design.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(join(here, '../../../frontend/package.json'))('@playwright/test');
const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const sectionFile = args.find((a) => a.endsWith('.json'));
if (!sectionFile) { console.error('Usage: node scripts/demo/assemble/assemble.mjs <section.json> [--in <dir>] [--out <file.mp4>]'); process.exit(2); }
const section = JSON.parse(readFileSync(resolve(sectionFile), 'utf8'));
const inDir = resolve(opt('--in', join(here, '../out')));
const outFile = resolve(opt('--out', join(here, '../out', `${section.id}.mp4`)));
const work = join(dirname(outFile), `.assemble-${section.id}`);
mkdirSync(work, { recursive: true });

const TITLE = 4, END = 4, FADE = 0.4, HOLD_MAX = 7, HOLD_MIN = 0.84;

// 1. Stills, drawn from the approved design.
const browser = await chromium.launch();
const shot = async (name, html, w = design.W, h = design.H, transparent = true) => {
  const file = join(work, `${name}.html`);
  writeFileSync(file, html);
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(pathToFileURL(file).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(work, `${name}.png`), omitBackground: transparent });
  await page.close();
  return join(work, `${name}.png`);
};
const stills = {
  canvas: await shot('canvas', design.canvas(), design.W + design.PAD.x * 2, design.H + design.PAD.y * 2, false),
  shadow: await shot('shadow', design.shadow()),
  edge: await shot('edge', design.edge()),
  mask: await shot('mask', design.mask(), design.FRAME.w, design.FRAME.h, false),
  title: await shot('title', design.title(section)),
  end: await shot('end', design.end(section)),
};

// 2. Timeline: title card, scenes one after another, end card.
const scenes = section.scenes.map((id) => {
  const dir = join(inDir, id);
  return { dir, ...JSON.parse(readFileSync(join(dir, 'captions.json'), 'utf8')) };
});
let cursor = TITLE - 0.2;
const caps = [];
for (const s of scenes) {
  s.offset = cursor;
  s.captions.forEach((c, i) => {
    const start = c.time;
    const next = s.captions[i + 1]?.time ?? s.length - 0.3;
    const dur = Math.max(HOLD_MIN, Math.min(HOLD_MAX, next - start));
    caps.push({ n: i + 1, text: c.text, at: s.offset + start, dur });
  });
  cursor += s.length;
}
const scenesEnd = cursor;
const total = scenesEnd - 0.2 + END;
for (const c of caps) c.png = await shot(`cap-${c.n}-${Math.round(c.at * 100)}`, design.caption(c.n, c.text));
await browser.close();

// 3. One ffmpeg graph over the whole timeline.
const inputs = [], graph = [];
const add = (pre, file) => { inputs.push(...pre, '-i', file); return inputs.filter((x) => x === '-i').length - 1; };
const still = (file, dur) => add(['-loop', '1', '-framerate', '30', '-t', String(dur.toFixed(2))], file);
const faded = (label, idx, at, dur, fin = FADE, fout = FADE) => graph.push(`[${idx}:v]format=rgba,fade=t=in:st=0:d=${fin}:alpha=1,fade=t=out:st=${(dur - fout).toFixed(2)}:d=${fout}:alpha=1,setpts=PTS+${at.toFixed(2)}/TB[${label}]`);

const iCanvas = still(stills.canvas, total);
graph.push(`[${iCanvas}:v]crop=${design.W}:${design.H}:x='${design.PAD.x}+60*sin(2*PI*t/24)':y='${design.PAD.y}+34*cos(2*PI*t/30)',noise=alls=4:allf=t,format=rgba[bg]`); // light moving grain on the canvas only: keeps the gradient smooth after compression, leaves the app sharp
const span = scenesEnd - (TITLE - 0.2);
faded('shadow', still(stills.shadow, span), TITLE - 0.2, span);
faded('edge', still(stills.edge, span), TITLE - 0.2, span);
const masks = scenes.map(() => still(stills.mask, total));
scenes.forEach((s, i) => {
  const v = add(['-ss', String(s.trimStart), '-t', String(s.length.toFixed(2))], join(s.dir, 'scene.webm'));
  graph.push(`[${v}:v]fps=30,format=yuv420p[sv${i}]`, `[${masks[i]}:v]format=gray[mk${i}]`,
    `[sv${i}][mk${i}]alphamerge,fade=t=in:st=0:d=${FADE}:alpha=1,fade=t=out:st=${(s.length - FADE).toFixed(2)}:d=${FADE}:alpha=1,setpts=PTS-STARTPTS+${s.offset.toFixed(2)}/TB[sc${i}]`);
});
caps.forEach((c, i) => faded(`cp${i}`, still(c.png, c.dur), c.at, c.dur, 0.3, 0.3));
faded('title', still(stills.title, TITLE), 0, TITLE, 0.7, 0.5);
faded('end', still(stills.end, END), scenesEnd - 0.2, END, 0.7, 0.7);

let last = 'bg';
const over = (label, src, x = 0, y = 0) => { graph.push(`[${last}][${src}]overlay=${x}:${y}:format=auto:eof_action=pass[${label}]`); last = label; }; // eof_action=pass: a finished layer disappears instead of freezing on its last (faint) frame
over('o1', 'shadow');
scenes.forEach((_, i) => over(`os${i}`, `sc${i}`, design.FRAME.x, design.FRAME.y));
over('oe', 'edge');
caps.forEach((_, i) => over(`oc${i}`, `cp${i}`));
over('ot', 'title');
over('of', 'end');
graph.push(`[${last}]format=yuv420p[out]`);

const script = join(work, 'graph.txt');
writeFileSync(script, graph.join(';\n'));
execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-/filter_complex', script, '-map', '[out]', '-t', total.toFixed(2), '-r', '30', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-maxrate', '14M', '-bufsize', '28M', '-movflags', '+faststart', outFile], { stdio: 'inherit' });
console.log(`assembled ${outFile} (${total.toFixed(1)} s)`);
