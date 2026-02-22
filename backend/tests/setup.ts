// Sets required environment variables for the test suite.
// These values are safe to commit — they are test-only secrets, never used in production.
process.env['NODE_ENV'] = 'test';
process.env['JWT_ACCESS_SECRET'] = 'test-access-secret-min-32-chars-long-ok';
process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-min-32-chars-long-ok';
process.env['FRONTEND_ORIGIN'] = process.env['FRONTEND_ORIGIN'] ?? 'http://localhost:3000';
process.env['DATABASE_URL'] = process.env['DATABASE_URL'] ?? 'postgresql://postgres:password@localhost:5432/wendo_rms_test';
process.env['REDIS_URL'] = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
