#!/usr/bin/env node
/**
 * cardos-mcp — MCP server for CardOS.
 * Exposes the public CardOS REST API (https://cardos.dev/api/v1) as MCP tools so any
 * MCP client (Claude, Cursor, …) can issue and manage virtual cards.
 *
 * Auth: set CARDOS_API_KEY (your CardOS API key — get one at https://cardos.dev/partner/developers).
 * A `cms_sk_test_…` key runs in sandbox (no real money). `CARDOS_BASE_URL` overrides the API base.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

const API_KEY = process.env.CARDOS_API_KEY ?? '';
const BASE = (process.env.CARDOS_BASE_URL ?? 'https://cardos.dev/api/v1').replace(/\/$/, '');

if (!API_KEY) {
  process.stderr.write('cardos-mcp: set CARDOS_API_KEY (get one at https://cardos.dev/partner/developers)\n');
}

async function api(path: string, init: { method?: string; body?: unknown; idempotent?: boolean } = {}) {
  const headers: Record<string, string> = { Authorization: `Bearer ${API_KEY}` };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.idempotent) headers['Idempotency-Key'] = randomUUID();
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = (data as { error?: { message?: string } } | null)?.error?.message ?? JSON.stringify(data);
    throw new Error(`CardOS API ${res.status}: ${err}`);
  }
  return data;
}

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] };
}
function fail(e: unknown) {
  return { isError: true, content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }] };
}

const server = new McpServer({ name: 'cardos-mcp', version: '0.1.0' });

server.tool(
  'list_products',
  'List available card products (productCode, currency, issue/topup limits, whether KYC is required). Use a productCode when issuing a card.',
  {},
  async () => {
    try {
      const d = (await api('/products')) as { products?: unknown };
      return ok(d.products ?? d);
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'get_balance',
  'Get the balance of an end user (by your external reference, e.g. a Telegram id).',
  { external_user_ref: z.string().describe('Your reference for the end user (e.g. Telegram id).') },
  async ({ external_user_ref }) => {
    try {
      return ok(await api(`/balance?external_user_ref=${encodeURIComponent(external_user_ref)}`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'card_details',
  'Get masked details of a card (last4, expiry, status). Raw PAN/CVV are never returned here.',
  { card_id: z.string().describe('The card id returned by issue_card.') },
  async ({ card_id }) => {
    try {
      return ok(await api(`/cards/${encodeURIComponent(card_id)}`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'list_transactions',
  'List transactions for a card (amount, currency, merchant, MCC, FX, status).',
  {
    card_id: z.string().describe('The card id.'),
    limit: z.number().int().min(1).max(100).default(50).optional().describe('Max rows (default 50).'),
  },
  async ({ card_id, limit }) => {
    try {
      const q = limit ? `?limit=${limit}` : '';
      return ok(await api(`/cards/${encodeURIComponent(card_id)}/transactions${q}`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'issue_card',
  '💳 Issue a virtual card to an end user. Money operation — with a test key (cms_sk_test_…) this runs in sandbox (no real money). An idempotency key is generated automatically so retries do not double-issue.',
  {
    external_user_ref: z.string().describe('Your reference for the end user (e.g. Telegram id).'),
    product: z.string().optional().describe('productCode from list_products (optional — uses the project default if omitted).'),
  },
  async ({ external_user_ref, product }) => {
    try {
      return ok(await api('/cards', { method: 'POST', idempotent: true, body: { external_user_ref, ...(product ? { product } : {}) } }));
    } catch (e) {
      return fail(e);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`cardos-mcp running (base: ${BASE})\n`);
