/**
 * CardOS API client — typed, with timeouts, bounded retries, idempotency and safe errors.
 * Wraps the public REST API at https://cardos.dev/api/v1. No provider internals are exposed.
 */
import { randomUUID } from 'node:crypto';

export interface CardOSClientOptions {
  apiKey: string;
  baseUrl?: string;
  /** Per-request timeout in ms (default 20000). */
  timeoutMs?: number;
  /** Retries for transient failures (429/5xx/network). Default 2. */
  maxRetries?: number;
  /** User-Agent appended for observability. */
  userAgent?: string;
}

export class CardOSError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'CardOSError';
  }
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const backoff = (attempt: number) => {
  const base = Math.min(8000, 250 * 2 ** attempt);
  return Math.floor(base / 2 + Math.random() * (base / 2)); // capped exponential + full jitter
};
const retryAfterMs = (res: Response): number | null => {
  const ra = res.headers?.get?.('retry-after');
  if (!ra) return null;
  const secs = Number(ra);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const when = Date.parse(ra);
  return Number.isFinite(when) ? Math.max(0, when - Date.now()) : null;
};

export class CardOSClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly userAgent: string;

  constructor(opts: CardOSClientOptions) {
    if (!opts.apiKey) throw new Error('CardOSClient: apiKey is required');
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? 'https://cardos.dev/api/v1').replace(/\/$/, '');
    this.timeoutMs = opts.timeoutMs ?? 20_000;
    this.maxRetries = opts.maxRetries ?? 2;
    this.userAgent = opts.userAgent ?? 'cardos-mcp';
  }

  /** Sandbox keys start with cms_sk_test_. */
  get mode(): 'test' | 'live' {
    return this.apiKey.startsWith('cms_sk_live_') ? 'live' : 'test';
  }

  async request<T = unknown>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    opts: { query?: Record<string, string | number | boolean | undefined>; body?: unknown; idempotent?: boolean; idempotencyKey?: string } = {},
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (opts.query) {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(opts.query)) if (v !== undefined && v !== null) sp.append(k, String(v));
      const qs = sp.toString();
      if (qs) url += `?${qs}`;
    }
    const headers: Record<string, string> = { Authorization: `Bearer ${this.apiKey}`, 'User-Agent': this.userAgent };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    const idemKey = opts.idempotencyKey ?? (opts.idempotent ? randomUUID() : undefined);
    if (idemKey) headers['Idempotency-Key'] = idemKey;

    // Only replay requests that are safe to repeat: GET, or anything carrying an Idempotency-Key.
    // A keyless POST/PATCH may have been applied server-side before a timeout — never retry it.
    const retrySafe = method === 'GET' || idemKey !== undefined;

    let lastErr: CardOSError | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
      try {
        const res = await fetch(url, { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, signal: ctrl.signal });
        const text = await res.text();
        let data: unknown = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = text;
        }
        if (res.ok) return data as T;

        const e = (data as { error?: { code?: string; message?: string } } | null)?.error;
        lastErr = new CardOSError(e?.message ?? `CardOS ${method} ${path} → ${res.status}`, res.status, e?.code, data);
        if (retrySafe && RETRYABLE.has(res.status) && attempt < this.maxRetries) {
          await sleep(retryAfterMs(res) ?? backoff(attempt));
          continue;
        }
        throw lastErr;
      } catch (err) {
        if (err instanceof CardOSError) throw err;
        const isAbort = (err as Error).name === 'AbortError';
        lastErr = new CardOSError(isAbort ? `Request timed out after ${this.timeoutMs}ms` : `Network error: ${(err as Error).message}`, 0, isAbort ? 'timeout' : 'network');
        if (retrySafe && attempt < this.maxRetries) {
          await sleep(backoff(attempt));
          continue;
        }
        throw lastErr;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr ?? new CardOSError('request failed', 0, 'unknown');
  }

  get = <T = unknown>(path: string, query?: Record<string, string | number | boolean | undefined>) => this.request<T>('GET', path, { query });
  post = <T = unknown>(path: string, body?: unknown, idempotent = false, idempotencyKey?: string) => this.request<T>('POST', path, { body, idempotent, idempotencyKey });
  patch = <T = unknown>(path: string, body?: unknown) => this.request<T>('PATCH', path, { body });
}
