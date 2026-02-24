import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { PrepStation } from '@prisma/client';
import { prisma } from '../config/database';

interface RawMenuItem {
  item: string;
  price_kes: number;
}

type RawMenuCatalog = Record<string, RawMenuItem[]>;

interface ParsedCategory {
  name: string;
  prepStation: PrepStation;
  displayOrder: number;
  items: RawMenuItem[];
}

interface CliOptions {
  filePath: string;
  dryRun: boolean;
}

const categoryPrepStationOverrides: Record<string, PrepStation> = {
  'Coffee Syrups': 'BARISTA',
};

const parseCliOptions = (): CliOptions => {
  const defaultPath = path.resolve(process.cwd(), 'src', 'scripts', 'data', 'menu-catalog.json');
  const args = process.argv.slice(2);

  let filePath = defaultPath;
  let dryRun = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--file') {
      const candidate = args[index + 1];
      if (!candidate) {
        throw new Error('Missing value for --file');
      }

      filePath = path.resolve(process.cwd(), candidate);
      index += 1;
      continue;
    }

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
  }

  return {
    filePath,
    dryRun,
  };
};

const parseCategoryKey = (rawKey: string): { name: string; prepStation: PrepStation } => {
  const trimmed = rawKey.trim();
  const match = /^(.*)\(([^)]+)\)\s*$/.exec(trimmed);

  if (match) {
    const name = (match[1] ?? '').trim();
    const suffix = (match[2] ?? '').trim().toUpperCase();

    if (suffix === 'BARISTA' || suffix === 'KITCHEN') {
      return {
        name,
        prepStation: suffix,
      };
    }

    if (suffix === 'ADD-ONS' || suffix === 'ADD-ONS ') {
      const override = categoryPrepStationOverrides[name];
      if (!override) {
        throw new Error(`Category "${trimmed}" has ADD-ONS suffix but no prep-station override`);
      }

      return {
        name,
        prepStation: override,
      };
    }

    throw new Error(`Unsupported category suffix "${suffix}" in "${trimmed}"`);
  }

  const override = categoryPrepStationOverrides[trimmed];
  if (!override) {
    throw new Error(`Category "${trimmed}" is missing prep station suffix and has no override`);
  }

  return {
    name: trimmed,
    prepStation: override,
  };
};

const loadCatalog = async (filePath: string): Promise<ParsedCategory[]> => {
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as RawMenuCatalog;

  return Object.entries(parsed).map(([rawCategoryKey, items], index) => {
    const category = parseCategoryKey(rawCategoryKey);

    const normalizedItems = items.map((item) => {
      if (!item.item.trim()) {
        throw new Error(`Category "${rawCategoryKey}" contains an item with empty name`);
      }

      if (!Number.isFinite(item.price_kes) || item.price_kes < 0) {
        throw new Error(`Item "${item.item}" has invalid price_kes: ${item.price_kes}`);
      }

      return {
        item: item.item.trim(),
        price_kes: item.price_kes,
      };
    });

    return {
      name: category.name,
      prepStation: category.prepStation,
      displayOrder: index,
      items: normalizedItems,
    };
  });
};

const run = async (): Promise<void> => {
  const options = parseCliOptions();
  const categories = await loadCatalog(options.filePath);

  if (options.dryRun) {
    const itemCount = categories.reduce((sum, category) => sum + category.items.length, 0);
    console.log(
      `Dry run validation successful: categories=${categories.length}, items=${itemCount}. No data was written.`,
    );
    return;
  }

  let createdCategories = 0;
  let updatedCategories = 0;
  let createdItems = 0;
  let updatedItems = 0;

  for (const category of categories) {
    const existingCategory = await prisma.menuCategory.findUnique({
      where: {
        name: category.name,
      },
      select: {
        id: true,
      },
    });

    const categoryRecord = await prisma.menuCategory.upsert({
      where: {
        name: category.name,
      },
      create: {
        name: category.name,
        prepStation: category.prepStation,
        displayOrder: category.displayOrder,
        isActive: true,
      },
      update: {
        prepStation: category.prepStation,
        displayOrder: category.displayOrder,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (existingCategory) {
      updatedCategories += 1;
    } else {
      createdCategories += 1;
    }

    for (const item of category.items) {
      const existingItem = await prisma.menuItem.findFirst({
        where: {
          categoryId: categoryRecord.id,
          name: item.item,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (existingItem) {
        await prisma.menuItem.update({
          where: {
            id: existingItem.id,
          },
          data: {
            price: item.price_kes.toFixed(2),
            isActive: true,
            deletedAt: null,
          },
        });
        updatedItems += 1;
      } else {
        await prisma.menuItem.create({
          data: {
            categoryId: categoryRecord.id,
            name: item.item,
            description: null,
            price: item.price_kes.toFixed(2),
            isActive: true,
          },
        });
        createdItems += 1;
      }
    }
  }

  console.log(
    `Menu import complete: categories created=${createdCategories}, categories updated=${updatedCategories}, items created=${createdItems}, items updated=${updatedItems}`,
  );
};

run()
  .catch((error: unknown) => {
    console.error('Failed to import menu', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
