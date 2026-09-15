#!/usr/bin/env node
/**
 * Fails the build if any source file references a `wds-*` design token that
 * isn't actually registered in `tailwind.wds.preset.ts` or `lib/cn.ts`'s
 * `customTextScale`. Without this, a typo like `bg-wds-bg` (the real token
 * is `bg-wds-canvas`) compiles fine and silently renders nothing — no error,
 * no warning, just a missing background someone has to find by screenshotting
 * (see docs/features/inventory/04-components.md's "Known issues" — this
 * exact class of bug hit the Inventory Milestone One build multiple times).
 *
 * Usage: pnpm check-wds-tokens
 * Exit code 0 = clean, 1 = unknown token(s) found.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = join(__dirname, '..');
const SCAN_DIRS = ['app', 'components', 'features'];
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx']);

// Tailwind utility prefixes that can carry a `wds-*` token suffix. Covers
// every prefix actually used across ui2/ and features/inventory/; extend
// this list if a new utility category starts using wds- tokens.
const UTILITY_PREFIXES = [
  'bg',
  'text',
  'border',
  'border-t',
  'border-b',
  'border-l',
  'border-r',
  'from',
  'to',
  'via',
  'fill',
  'stroke',
  'ring',
  'shadow',
  'rounded',
  'rounded-t',
  'rounded-b',
  'rounded-l',
  'rounded-r',
  'font',
  'divide',
  'outline',
  'decoration',
  'accent',
  'caret',
  'placeholder',
];

function collectFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue;
      collectFiles(full, out);
    } else if (SCAN_EXTENSIONS.has(extname(entry))) {
      out.push(full);
    }
  }
  return out;
}

/** Extract every registered `wds-*` token name (without the utility prefix) from the preset. */
function extractRegisteredTokens(): Set<string> {
  const presetSrc = readFileSync(join(ROOT, 'tailwind.wds.preset.ts'), 'utf8');
  const tokens = new Set<string>();

  // Top-level string keys: 'wds-canvas': ...  or  wds-canvas: ...
  for (const match of Array.from(presetSrc.matchAll(/['"]?(wds-[a-zA-Z0-9.-]+)['"]?\s*:/g))) {
    tokens.add(match[1]);
  }

  // Nested numeric/keyword shades: 'wds-neutral': { 0: ..., 50: ..., DEFAULT: ... }
  // or 'wds-text': { muted: ..., 'copy-muted': ... }. Reconstruct combined
  // names by scanning each `'wds-xxx': { ... }` block. Shade keys may
  // themselves contain dashes ('copy-muted'), so allow dashes/dots in the key.
  for (const block of Array.from(presetSrc.matchAll(/['"]?(wds-[a-zA-Z-]+)['"]?\s*:\s*\{([^}]*)\}/g))) {
    const base = block[1];
    const body = block[2];
    for (const shade of Array.from(body.matchAll(/['"]?([a-zA-Z0-9.-]+)['"]?\s*:/g))) {
      const key = shade[1];
      tokens.add(key === 'DEFAULT' ? base : `${base}-${key}`);
    }
  }

  // fontSize custom scale names double as text-wds-* utilities.
  const cnSrc = readFileSync(join(ROOT, 'lib', 'cn.ts'), 'utf8');
  for (const match of Array.from(cnSrc.matchAll(/['"]?(wds-[a-zA-Z0-9-]+)['"]?/g))) {
    tokens.add(match[1]);
  }

  return tokens;
}

function main(): void {
  const registered = extractRegisteredTokens();
  const prefixPattern = UTILITY_PREFIXES.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const usagePattern = new RegExp(`\\b(?:${prefixPattern})-(wds-[a-zA-Z0-9.-]+)`, 'g');

  const files = SCAN_DIRS.flatMap((d) => collectFiles(join(ROOT, d)));
  const problems: { file: string; token: string }[] = [];

  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const match of Array.from(src.matchAll(usagePattern))) {
      const token = match[1];
      if (!registered.has(token)) {
        problems.push({ file: file.replace(ROOT + '/', ''), token });
      }
    }
  }

  if (problems.length === 0) {
    console.log(`✓ ${files.length} files scanned — every wds-* token resolves to a registered utility.`);
    return;
  }

  console.error(`✗ Found ${problems.length} reference(s) to unregistered wds-* tokens:\n`);
  for (const { file, token } of problems) {
    console.error(`  ${file}: "${token}"`);
  }
  console.error(
    '\nEither the token name is a typo (check tailwind.wds.preset.ts / app/tokens.wds.css for the real name),' +
      '\nor it is a genuinely new token that needs to be added to tailwind.wds.preset.ts (and lib/cn.ts for fontSize).'
  );
  process.exit(1);
}

main();
