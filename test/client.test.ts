import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CardOSClient, CardOSError } from '../src/client.js';

function mockFetch(responses: Array<{ ok?: boolean; status?: number; body?: unknown }>) {
  let i = 0;
  return vi.fn(async () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      text: async () => (r.body === undefined ? '' : JSON.stringify(r.body)),
    } as Response;
  });
}

describe('CardOSClient', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('requires an api key', () => {
    expect(() => new CardOSClient({ apiKey: '' })).toThrow(/apiKey/);
  });

  it('derives sandbox vs live mode from the key', () => {
    expect(new CardOSClient({ apiKey: 'cms_sk_test_x' }).mode).toBe('test');
    expect(new CardOSClient({ apiKey: 'cms_sk_live_x' }).mode).toBe('live');
  });

  it('sends Bearer auth and parses JSON', async () => {
    const f = mockFetch([{ body: { products: [{ product_code: 'VIRT-USD-NOKYC' }] } }]);
    vi.stubGlobal('fetch', f);
    const c = new CardOSClient({ apiKey: 'cms_sk_test_x' });
    const out = await c.get<{ products: unknown[] }>('/products');
    expect(out.products).toHaveLength(1);
    const [, init] = f.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer cms_sk_test_x' });
  });

  it('adds an Idempotency-Key for idempotent POSTs', async () => {
    const f = mockFetch([{ status: 201, body: { card_id: 'c1' } }]);
    vi.stubGlobal('fetch', f);
    const c = new CardOSClient({ apiKey: 'cms_sk_test_x' });
    await c.post('/cards', { external_user_ref: 'u1' }, true);
    const [, init] = f.mock.calls[0]!;
    expect((init as RequestInit).headers).toHaveProperty('Idempotency-Key');
  });

  it('throws a typed CardOSError on 4xx and does not retry', async () => {
    const f = mockFetch([{ ok: false, status: 401, body: { error: { code: 'unauthorized', message: 'Invalid or missing API key.' } } }]);
    vi.stubGlobal('fetch', f);
    const c = new CardOSClient({ apiKey: 'cms_sk_test_x', maxRetries: 2 });
    await expect(c.get('/balance')).rejects.toMatchObject({ status: 401, code: 'unauthorized' });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('retries transient 5xx then succeeds', async () => {
    const f = mockFetch([{ ok: false, status: 503 }, { ok: false, status: 503 }, { body: { ok: true } }]);
    vi.stubGlobal('fetch', f);
    const c = new CardOSClient({ apiKey: 'cms_sk_test_x', maxRetries: 2 });
    await expect(c.get('/products')).resolves.toMatchObject({ ok: true });
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('exposes CardOSError for callers to narrow', () => {
    const e = new CardOSError('boom', 500, 'server');
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(500);
  });

  it('uses a caller-supplied idempotencyKey when given', async () => {
    const f = mockFetch([{ status: 201, body: { card_id: 'c1' } }]);
    vi.stubGlobal('fetch', f);
    const c = new CardOSClient({ apiKey: 'cms_sk_test_x' });
    await c.post('/cards', { external_user_ref: 'u1' }, true, 'fixed-key');
    expect((f.mock.calls[0]![1] as RequestInit).headers).toMatchObject({ 'Idempotency-Key': 'fixed-key' });
  });

  it('does NOT retry a keyless POST on a transient 5xx', async () => {
    const f = mockFetch([{ ok: false, status: 503 }, { ok: false, status: 503 }]);
    vi.stubGlobal('fetch', f);
    const c = new CardOSClient({ apiKey: 'cms_sk_test_x', maxRetries: 2 });
    await expect(c.post('/cards/x/freeze')).rejects.toMatchObject({ status: 503 });
    expect(f).toHaveBeenCalledTimes(1); // keyless write → not replayed
  });
});
