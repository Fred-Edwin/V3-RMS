import { z } from 'zod';

const cookieDomainSchema = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) => !value || /^[A-Za-z0-9.-]+$/.test(value),
    'COOKIE_DOMAIN must be a bare domain (for example: v3-rms.vercel.app or .wendorms.co.ke)',
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default('/api/v1'),
  FRONTEND_ORIGIN: z.string().min(1).default('http://localhost:3000'),
  COOKIE_DOMAIN: cookieDomainSchema,
  DATABASE_URL: z.string().min(1).default('postgresql://postgres:password@localhost:5432/wendo_rms'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  REDIS_TOKEN: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(200),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).default(12),
  SYSTEM_ADMIN_EMAIL: z.string().email().optional(),
  SYSTEM_ADMIN_PASSWORD: z.string().min(8).optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().min(1),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  VAPID_KEY: z.string().optional().default(''),
  SKIP_SHIFT_VALIDATION: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  // Waiter stale-order liability only counts orders on/after this date (YYYY-MM-DD).
  // Orders before it are excluded from waiter liability — e.g. the Mar/Apr 2026 dual-run
  // backlog that was reconciled in the legacy system. Configurable so the line can move.
  LIABILITY_START_DATE: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'LIABILITY_START_DATE must be YYYY-MM-DD')
    .default('2026-05-01'),
  CLOCK_GEOFENCE_RADIUS_METRES: z.coerce.number().int().positive().max(1000).default(50),
  LOG_LEVEL: z.string().default('info'),
  LOG_PRETTY: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  SENTRY_DSN: z.string().url().optional(),
  // Cloudflare R2 (S3-compatible) for supplier documents. All four optional: when any is
  // missing, non-production falls back to an in-memory fake and production refuses uploads.
  R2_ACCOUNT_ID: z.string().optional().transform((v) => v || undefined),
  R2_ACCESS_KEY_ID: z.string().optional().transform((v) => v || undefined),
  R2_SECRET_ACCESS_KEY: z.string().optional().transform((v) => v || undefined),
  R2_BUCKET: z.string().optional().transform((v) => v || undefined),
});

export const env = envSchema.parse(process.env);
