import type { AddressInfo } from 'node:net';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * The public verify route is reached through the real app with no sign-in. It once sat behind a legacy router that signs in every
 * path under the root, so a printed QR answered 401; this pins that it does not. A malformed number never touches the database.
 */
describe('the public verify route through the real app', { timeout: 120_000 }, () => {
  let server: ReturnType<(typeof import('../../../app'))['app']['listen']> | null = null;
  afterAll(() => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve())));

  it('answers without a sign-in, never cached, never indexed', async () => {
    const { app } = await import('../../../app');
    const { env } = await import('../../../config/env');
    server = app.listen(0);
    const res = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${env.API_PREFIX}/verify/ps/nonsense?h=zz`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
    const body = (await res.json()) as { data: { outcome: string } };
    expect(body.data.outcome).toBe('MALFORMED');
  });
});
