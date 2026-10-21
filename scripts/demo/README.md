# Workforce demo videos: record and assemble

Two stages, so a fix means re-recording one scene and re-assembling, in minutes.

```bash
# 0. the lane: seed, API (4106) and front end (3106) running; see backend/src/scripts/demo-data/workforce/README.md
cd backend && pnpm demo:seed --reset

# 1. record one scene (a real browser, 1440 x 900 desktop or 390 x 844 phone), into scripts/demo/out/<scene id>/
node scripts/demo/record.mjs people-sample            # [--out <dir>]

# 2. assemble a section: Aurora canvas, framed recording, captions, title and end cards -> one 1080p MP4
node scripts/demo/assemble/assemble.mjs scripts/demo/sections/people-sample.json   # [--in <dir>] [--out <file.mp4>]
```

- **Scenes** (`scenes/*.mjs`) export `{ id, role, viewport, warmup, run }`. Helpers in `lib.mjs`: `goto`, `click`, `type`, `typePin` (masked boxes only), `scroll`, `moveTo`, `pause`, `settle`, `caption`, `markStart`. Sign-in and the "Is this your phone?" prompt happen off camera. Any console error, failed request or error message stops the scene, so a bad take is never kept.
- **Design** lives in `assemble/design.mjs` and matches the approved Paper page "Demo videos · Caption design (21 Oct)": Aurora canvas with a slow drift and light grain (canvas only), recording at native size with a 1 px edge, plain-text captions, cobalt accent only on step numbers.
- Captions come from each scene's `captions.json` (time, text). Each stays 0.84 to 7 s.
- Needs `ffmpeg` and Playwright's Chromium (already present). The scene's `out/` folder and `.cache/` are not committed.
- Phone scenes: the recorder supports them (`viewport: 'phone'`); the assembler's phone layout (device shape, caption at the left) is **not built yet**.
