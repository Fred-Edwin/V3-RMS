#!/usr/bin/env node
/**
 * Pixel-diffs a built screen/component screenshot against its Paper reference
 * screenshot. Both PNGs must already exist at identical dimensions — this
 * script does not capture screenshots itself.
 *
 * Usage:
 *   pnpm tsx scripts/visual-diff.ts <paper.png> <built.png> [outDiff.png] [--threshold=2]
 *
 * Exit code 0 = pass (mismatch % <= threshold), 1 = fail, 2 = usage/IO error.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

function main() {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));
  const thresholdArg = args.find((a) => a.startsWith('--threshold='));
  const threshold = thresholdArg ? Number(thresholdArg.split('=')[1]) : 2;

  const [paperPath, builtPath, outPath] = positional;
  if (!paperPath || !builtPath) {
    console.error(
      'Usage: pnpm tsx scripts/visual-diff.ts <paper.png> <built.png> [outDiff.png] [--threshold=2]'
    );
    process.exit(2);
  }

  const paper = PNG.sync.read(readFileSync(paperPath));
  const built = PNG.sync.read(readFileSync(builtPath));

  if (paper.width !== built.width || paper.height !== built.height) {
    console.error(
      `Dimension mismatch: paper=${paper.width}x${paper.height} built=${built.width}x${built.height}. ` +
        `Capture the built screenshot at the exact same viewport width as the Paper artboard (1440 desktop / 390 mobile) before diffing.`
    );
    process.exit(2);
  }

  const { width, height } = paper;
  const diff = new PNG({ width, height });

  const mismatchedPixels = pixelmatch(paper.data, built.data, diff.data, width, height, {
    threshold: 0.1, // per-pixel color-difference sensitivity, not the pass/fail threshold
    alpha: 0.3,
    diffColor: [255, 0, 0],
  });

  const mismatchPercent = (mismatchedPixels / (width * height)) * 100;

  if (outPath) {
    writeFileSync(outPath, PNG.sync.write(diff));
  }

  console.log(
    `${mismatchPercent.toFixed(2)}% mismatch (${mismatchedPixels} / ${width * height} px), threshold ${threshold}%`
  );

  if (mismatchPercent > threshold) {
    console.error(`FAIL — exceeds ${threshold}% threshold${outPath ? `. See ${outPath}` : ''}`);
    process.exit(1);
  }

  console.log('PASS');
}

main();
