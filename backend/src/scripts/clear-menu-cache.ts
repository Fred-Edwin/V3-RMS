import 'dotenv/config';
import Redis from 'ioredis';

const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
  tls: process.env['REDIS_URL']?.startsWith('rediss://') ? {} : undefined,
  lazyConnect: true,
});

async function main() {
  await redis.connect();
  const keys = await redis.keys('menu:*');
  if (keys.length === 0) {
    console.log('No menu cache keys found.');
  } else {
    await redis.del(...keys);
    console.log(`Cleared ${keys.length} menu cache key(s):`);
    keys.forEach((k) => console.log(`  ${k}`));
  }
}

main().catch(console.error).finally(() => redis.disconnect());
