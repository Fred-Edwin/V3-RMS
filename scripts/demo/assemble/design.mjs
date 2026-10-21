// The approved caption design (Paper page "Demo videos · Caption design", v2), as HTML for the stills ffmpeg lays over the film.
// Canvas: Aurora (a cobalt-to-lavender sweep over cool grey). Recording frame 1440 x 900 at (240, 48), 12 px corners, 1 px edge.
// Captions: plain text on the canvas, no box. One accent (cobalt) for step numbers and labels.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const fonts = join(dirname(createRequire(import.meta.url).resolve('../../../frontend/node_modules/geist/package.json')), 'dist/fonts');
const face = (family, dir, file, weight) => `@font-face{font-family:'${family}';src:url('file://${join(fonts, dir, file)}');font-weight:${weight}}`;
const FONTS = [face('Geist', 'geist-sans', 'Geist-Regular.woff2', 400), face('Geist', 'geist-sans', 'Geist-Medium.woff2', 500), face('Geist', 'geist-sans', 'Geist-SemiBold.woff2', 600), face('Geist Mono', 'geist-mono', 'GeistMono-Medium.woff2', 500)].join('');

export const W = 1920, H = 1080, PAD = { x: 96, y: 54 }; // the canvas is drawn 192 x 108 px larger so it can drift
export const FRAME = { x: 240, y: 48, w: 1440, h: 900, r: 12 };
const INK = '#0E0F12', ACCENT = '#3B5BFF', MUTED = '#4A4F5A', RULE = '#C9CDD6';

const page = (body, bg = 'transparent', w = W, h = H) => `<!doctype html><meta charset="utf-8"><style>${FONTS}*{box-sizing:border-box;margin:0}html,body{width:${w}px;height:${h}px;background:${bg};font-family:Geist,sans-serif;overflow:hidden}.mono{font-family:'Geist Mono',monospace}</style>${body}`;

const aurora = (dx, dy) => `radial-gradient(1500px 900px at ${W + dx}px ${dy}px, rgba(79,107,255,.34), rgba(79,107,255,0) 72%), radial-gradient(800px 600px at ${W * 0.72 + dx}px ${dy}px, rgba(160,176,255,.38), rgba(160,176,255,0) 70%), radial-gradient(900px 700px at ${dx}px ${H + dy}px, rgba(59,91,255,.08), rgba(59,91,255,0) 70%), linear-gradient(165deg, #F4F5F9 0%, #E1E5EF 100%)`;

export const canvas = () => page('', aurora(PAD.x, PAD.y), W + PAD.x * 2, H + PAD.y * 2);
export const shadow = () => page(`<div style="position:absolute;left:${FRAME.x}px;top:${FRAME.y}px;width:${FRAME.w}px;height:${FRAME.h}px;border-radius:${FRAME.r}px;background:#fff;box-shadow:0 1px 2px rgba(20,30,80,.08),0 28px 70px rgba(40,60,160,.22)"></div>`);
export const edge = () => page(`<div style="position:absolute;left:${FRAME.x}px;top:${FRAME.y}px;width:${FRAME.w}px;height:${FRAME.h}px;border-radius:${FRAME.r}px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.65),0 0 0 1px rgba(20,30,80,.10)"></div>`);
export const mask = () => page(`<div style="width:${FRAME.w}px;height:${FRAME.h}px;border-radius:${FRAME.r}px;background:#fff"></div>`, '#000', FRAME.w, FRAME.h);

export const caption = (n, text) => page(`<div style="position:absolute;left:${FRAME.x}px;top:984px;width:${FRAME.w}px;display:flex;align-items:baseline;gap:28px"><span class="mono" style="font-size:22px;font-weight:500;color:${ACCENT};letter-spacing:.04em">${String(n).padStart(2, '0')}</span><span style="font-size:40px;line-height:48px;font-weight:500;color:${INK};letter-spacing:-.015em">${text}</span></div>`);

const row = (n, text, size, last) => `<div style="display:flex;align-items:center;gap:24px;padding:${size > 30 ? 22 : 18}px 0;border-top:1px solid ${RULE};${last ? `border-bottom:1px solid ${RULE}` : ''}"><span class="mono" style="font-size:18px;color:${ACCENT};width:28px">${String(n).padStart(2, '0')}</span><span style="font-size:${size}px;font-weight:500;color:${INK};letter-spacing:-.015em">${text}</span></div>`;

export const title = ({ kicker, title: t, summary, list }) => page(`<div style="position:absolute;left:96px;top:96px;width:780px;display:flex;flex-direction:column;gap:20px"><span class="mono" style="font-size:20px;font-weight:500;color:${ACCENT};letter-spacing:.12em">${kicker}</span><span style="font-size:168px;line-height:160px;font-weight:600;color:${INK};letter-spacing:-.045em">${t}</span><span style="font-size:36px;line-height:46px;color:${MUTED};width:780px">${summary}</span></div><div style="position:absolute;left:96px;top:640px;width:560px">${list.map((x, i) => row(i + 1, x, 26, i === list.length - 1)).join('')}</div>`);

export const end = ({ recap, list }) => page(`<div style="position:absolute;left:${FRAME.x}px;top:300px;width:760px;display:flex;flex-direction:column;gap:20px"><span class="mono" style="font-size:20px;font-weight:500;color:${ACCENT};letter-spacing:.12em">${recap}</span><div>${list.map((x, i) => row(i + 1, x, 40, i === list.length - 1)).join('')}</div></div><span style="position:absolute;left:${FRAME.x}px;top:960px;font-size:26px;font-weight:500;color:${MUTED}">Wendo Coffee Bistro · Workforce</span>`);
