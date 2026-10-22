// Recording helpers for the Workforce demo videos. Drives the real app in a real browser (Playwright) and records one video per scene.
// Rules baked in: happy path only; any console error, failed request or error toast stops the scene; a PIN is only ever typed into
// a masked field; sign-in happens off camera (stored session), so no credentials are shown.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const { chromium } = createRequire(join(root, 'frontend/package.json'))('@playwright/test');

export const BASE = process.env.DEMO_BASE ?? 'http://lane6.localhost:3106';
export const PASSWORD = 'WendoDemo#2026';
export const PIN = '4321'; // typed only into masked boxes
export const VIEWPORTS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const cacheDir = join(here, '.cache');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A visible pointer: video capture does not draw the real cursor. */
const POINTER = `(() => {
  if (window.__demoPointer) return;
  // A standard arrow (dark fill, white outline, soft shadow) whose tip sits exactly on the point, plus a cobalt ring that expands on each click.
  const dot = document.createElement('div');
  dot.style.cssText = 'position:fixed;z-index:2147483647;width:24px;height:30px;pointer-events:none;left:-100px;top:-100px;transform-origin:2px 2px;transition:transform .1s;filter:drop-shadow(0 1px 2px rgba(14,15,18,.35))';
  dot.innerHTML = '<svg width="24" height="30" viewBox="0 0 24 30" xmlns="http://www.w3.org/2000/svg"><path d="M2 2 L2 23.5 L7.6 18.4 L11.4 27 L15.2 25.3 L11.5 16.9 L19 16.6 Z" fill="#0E0F12" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const ring = document.createElement('div');
  ring.style.cssText = 'position:fixed;z-index:2147483646;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:2px solid #3B5BFF;pointer-events:none;opacity:0;left:-100px;top:-100px';
  const attach = () => { document.documentElement.appendChild(ring); document.documentElement.appendChild(dot); };
  document.documentElement ? attach() : addEventListener('DOMContentLoaded', attach);
  addEventListener('mousemove', (e) => { dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', (e) => {
    dot.style.transform = 'scale(.88)';
    ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px';
    ring.animate([{ transform: 'scale(.6)', opacity: .9 }, { transform: 'scale(3.2)', opacity: 0 }], { duration: 550, easing: 'ease-out' });
  }, true);
  addEventListener('mouseup', () => { dot.style.transform = 'scale(1)'; }, true);
  window.__demoPointer = true;
})();`;

/** Signs in off camera (so no credentials are ever filmed) and hands the session to the recording browser. */
export async function sessionFor(email, viewport, warmup) {
  mkdirSync(cacheDir, { recursive: true });
  const file = join(cacheDir, `${email.replace(/[^a-z0-9.]/gi, '_')}.json`);
  // Always a fresh sign-in: the refresh token is single-use, so a kept session goes stale after its first scene.
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  // A first sign-in on a "new phone" asks to trust it: answer off camera so the recording never shows the prompt.
  const trust = page.getByRole('button', { name: /yes, this is my phone/i });
  if (await trust.waitFor({ timeout: 4000 }).then(() => true, () => false)) {
    await trust.click();
    await page.waitForLoadState('networkidle').catch(() => {});
  }
  // Visit the screens the scene will use, once, off camera: the dev server compiles each page on first visit (seconds of blank screen).
  if (warmup) await warmup(page, (path) => page.goto(`${BASE}${path}`));
  await ctx.storageState({ path: file });
  await browser.close();
  return file;
}

export function clearSessions() {
  rmSync(cacheDir, { recursive: true, force: true });
}

/** Opens a scene: a browser at the right size, already signed in, recording to <outDir>/<id>/. */
export async function openScene({ id, role, viewport = 'desktop', outDir, warmup }) {
  const size = VIEWPORTS[viewport];
  const dir = join(outDir, id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const storageState = await sessionFor(role, size, warmup);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: size, recordVideo: { dir, size }, storageState, deviceScaleFactor: 1, ...(viewport === 'phone' ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.addInitScript(POINTER);
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text().slice(0, 160)}`));
  page.on('pageerror', (e) => problems.push(`page error: ${e.message.slice(0, 160)}`));
  page.on('response', (r) => r.status() >= 400 && !r.url().includes('/_next/') && problems.push(`${r.status()} ${r.url().slice(0, 120)}`));
  const t0 = Date.now();
  const captions = [];
  let at = { x: size.width / 2, y: size.height / 2 };
  let startAt = 0;

  const s = {
    page, viewport, size,
    /** Marks where the film begins: everything before it (the app's start-up splash) is cut when assembling. */
    markStart() { startAt = (Date.now() - t0) / 1000; },
    /** A caption that starts now and stays until the next one (or `ms`). */
    caption(text, ms) { captions.push({ time: +((Date.now() - t0) / 1000).toFixed(2), text, ...(ms ? { hold: ms / 1000 } : {}) }); },
    async pause(ms = 1200) { await sleep(ms); },
    /** Waits until the page has stopped loading: network quiet, no spinner, no skeleton. */
    async settle() {
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForFunction(() => !document.querySelector('[aria-busy="true"], [data-loading="true"], .animate-spin'), null, { timeout: 15000 }).catch(() => {});
      await sleep(400);
      // Next's own route announcer is always a role="alert"; only a real message with text, outside it, counts.
      const toast = await page.evaluate(() => [...document.querySelectorAll('[role="alert"], [data-sonner-toast][data-type="error"]')].filter((el) => !el.closest('next-route-announcer') && (el.textContent ?? '').trim().length > 0).length);
      if (toast) throw new Error('An error message is on screen: stopping so a bad take is never kept.');
    },
    async goto(path) { await page.goto(`${BASE}${path}`); await s.settle(); await s.moveTo(at.x + 1, at.y + 1, 2); },
    /** Glides the pointer to a point or a locator, easing in and out. */
    async moveTo(target, y, steps = 28) {
      let x = target;
      if (typeof target !== 'number') {
        const box = await target.boundingBox();
        if (!box) throw new Error('Cannot move to something that is not on screen.');
        x = box.x + box.width / 2; y = box.y + box.height / 2;
      }
      const from = at;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
        await sleep(14);
      }
      at = { x, y };
    },
    async click(locator) { await locator.scrollIntoViewIfNeeded(); await s.moveTo(locator); await sleep(250); await locator.click(); await sleep(300); },
    /** Types at a natural, slightly uneven pace. */
    async type(locator, text, { masked = false } = {}) {
      await s.click(locator);
      for (const ch of text) { await page.keyboard.type(ch); await sleep(70 + Math.random() * 70); }
      if (!masked && /^\d{4}$/.test(text)) throw new Error('A PIN may only be typed through typePin().');
    },
    /** A PIN goes only into a masked (password-type) box, fixed value. */
    async typePin(locator) {
      const kind = await locator.getAttribute('type');
      if (kind !== 'password') throw new Error('Refusing to type a PIN into a box that shows what is typed.');
      await s.type(locator, PIN, { masked: true });
    },
    async scroll(px = 400) { for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, px / 8); await sleep(60); } await sleep(300); },
    /** Ends the scene: flushes the video, writes the captions, and fails if anything went wrong on the way. */
    async finish() {
      const length = +((Date.now() - t0) / 1000).toFixed(2);
      await sleep(800);
      await ctx.close();
      await browser.close();
      const file = readdirSync(dir).find((f) => f.endsWith('.webm'));
      renameSync(join(dir, file), join(dir, 'scene.webm'));
      // Times are relative to the cut start, so the captions file matches the trimmed film.
      const shifted = captions.map((c) => ({ ...c, time: +Math.max(0, c.time - startAt).toFixed(2) }));
      writeFileSync(join(dir, 'captions.json'), JSON.stringify({ id, viewport, trimStart: +startAt.toFixed(2), length: +(length - startAt).toFixed(2), captions: shifted }, null, 2));
      if (problems.length) throw new Error(`The take is not clean:\n  ${problems.join('\n  ')}`);
      return dir;
    },
  };
  return s;
}
