/**
 * import-menu-images.ts
 *
 * Bulk-uploads menu item images to Cloudinary and saves the returned URLs
 * back to the database.
 *
 * HOW TO USE:
 *   1. Drop your .webp (or .jpg/.png) files into:
 *        backend/assets/menu-images/
 *      Name each file exactly after the menu item, e.g.:
 *        "Cappuccino.webp"  →  matches MenuItem where name = "Cappuccino"
 *
 *   2. Run:
 *        pnpm --dir backend menu:import-images
 *
 * BEHAVIOUR:
 *   - Matching is case-insensitive and trims whitespace.
 *   - Items that already have an imageUrl are SKIPPED unless --force is passed.
 *   - Files with no matching menu item are reported and skipped (not an error).
 *   - A summary is printed at the end.
 *
 * FLAGS:
 *   --force    Re-upload and overwrite even if the item already has an imageUrl.
 *   --dry-run  Show what would happen without uploading or writing to the DB.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { PrismaClient } from '@prisma/client';

// ── Config ──────────────────────────────────────────────────────────────────

const IMAGES_DIR = path.resolve(__dirname, '../../assets/menu-images');
const CLOUDINARY_FOLDER = 'wendo/menu';
const SUPPORTED_EXTENSIONS = ['.webp', '.jpg', '.jpeg', '.png'];

const FORCE = process.argv.includes('--force');
const DRY_RUN = process.argv.includes('--dry-run');

// ── Cloudinary ───────────────────────────────────────────────────────────────

cloudinary.config({
  cloud_name: process.env['CLOUDINARY_CLOUD_NAME'],
  api_key: process.env['CLOUDINARY_API_KEY'],
  api_secret: process.env['CLOUDINARY_API_SECRET'],
  secure: true,
});

function uploadBuffer(buffer: Buffer, publicId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_FOLDER,
        public_id: publicId,
        overwrite: true,
        resource_type: 'image',
        transformation: [{ fetch_format: 'auto', quality: 'auto' }],
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error('Cloudinary upload returned no result'));
          return;
        }
        resolve(result.secure_url);
      },
    );
    stream.end(buffer);
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    // 1. Read image files
    if (!fs.existsSync(IMAGES_DIR)) {
      console.error(`Images directory not found: ${IMAGES_DIR}`);
      process.exit(1);
    }

    const files = fs.readdirSync(IMAGES_DIR).filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return SUPPORTED_EXTENSIONS.includes(ext) && !f.startsWith('.');
    });

    if (files.length === 0) {
      console.log(`No image files found in ${IMAGES_DIR}`);
      process.exit(0);
    }

    console.log(`Found ${files.length} image file(s).${DRY_RUN ? ' [DRY RUN]' : ''}\n`);

    // 2. Load all active menu items
    const items = await prisma.menuItem.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, imageUrl: true },
    });

    const itemsByName = new Map(
      items.map((item) => [item.name.trim().toLowerCase(), item]),
    );

    // 3. Process each file
    const stats = { uploaded: 0, skipped: 0, unmatched: 0, errors: 0 };

    for (const file of files) {
      const ext = path.extname(file);
      const baseName = path.basename(file, ext).trim();
      const normalizedName = baseName.toLowerCase();

      const item = itemsByName.get(normalizedName);

      if (!item) {
        console.warn(`  ⚠  No menu item matched "${baseName}" — skipped`);
        stats.unmatched++;
        continue;
      }

      if (item.imageUrl && !FORCE) {
        console.log(`  ↷  "${item.name}" already has an image — skipped (use --force to overwrite)`);
        stats.skipped++;
        continue;
      }

      const filePath = path.join(IMAGES_DIR, file);

      if (DRY_RUN) {
        console.log(`  ✓  [dry-run] Would upload "${file}" → "${item.name}"`);
        stats.uploaded++;
        continue;
      }

      try {
        process.stdout.write(`  ↑  Uploading "${file}" → "${item.name}" … `);
        const buffer = fs.readFileSync(filePath);
        const publicId = slugify(item.name);
        const imageUrl = await uploadBuffer(buffer, publicId);
        await prisma.menuItem.update({
          where: { id: item.id },
          data: { imageUrl },
        });
        console.log(`done ✓`);
        stats.uploaded++;
      } catch (err) {
        console.error(`FAILED`);
        console.error(`     ${err instanceof Error ? err.message : String(err)}`);
        stats.errors++;
      }
    }

    // 4. Summary
    console.log('\n─────────────────────────────────');
    console.log(`Uploaded : ${stats.uploaded}`);
    console.log(`Skipped  : ${stats.skipped}`);
    console.log(`Unmatched: ${stats.unmatched}`);
    console.log(`Errors   : ${stats.errors}`);
    console.log('─────────────────────────────────');

    if (stats.errors > 0) {
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
