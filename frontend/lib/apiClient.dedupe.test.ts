import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from './apiClient';

const answer = () => Promise.resolve(new Response(JSON.stringify({ success: true, data: { n: 1 } }), { status: 200 }));

describe('apiClient shares identical reads that are in flight (finding 28)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('makes one call for three simultaneous identical reads, and asks again afterwards', async () => {
    const fetchMock = vi.fn(answer);
    vi.stubGlobal('fetch', fetchMock);
    await Promise.all([apiClient.get('/a', 't'), apiClient.get('/a', 't'), apiClient.get('/a', 't')]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await apiClient.get('/a', 't');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps different paths and different people apart', async () => {
    const fetchMock = vi.fn(answer);
    vi.stubGlobal('fetch', fetchMock);
    await Promise.all([apiClient.get('/a', 't'), apiClient.get('/b', 't'), apiClient.get('/a', 'other')]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
