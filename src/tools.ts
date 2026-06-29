/** All CardOS MCP tools, grouped by area. Each handler is a thin, typed wrapper over the REST API. */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CardOSClient, CardOSError } from './client.js';

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };
const ok = (data: unknown): ToolResult => ({ content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] });
const fail = (e: unknown): ToolResult => {
  const text = e instanceof CardOSError ? `CardOS API error ${e.status}${e.code ? ` (${e.code})` : ''}: ${e.message}` : `Error: ${e instanceof Error ? e.message : String(e)}`;
  return { isError: true, content: [{ type: 'text', text }] };
};
const wrap = (fn: () => Promise<unknown>) => fn().then(ok, fail);

const userRef = z.string().min(1).max(128).describe('Your reference for the end user (e.g. a Telegram id). CardOS never requires PII.');
const cardId = z.string().min(1).describe('Card id returned by issue_card.');

export function registerTools(server: McpServer, client: CardOSClient): void {
  // ─────────── Catalog & balance ───────────
  server.tool('list_products', 'List available card products: productCode, currency, issue/topup limits, and whether KYC is required.', {}, () =>
    wrap(async () => (await client.get<{ products?: unknown }>('/products')).products ?? []),
  );
  server.tool('get_merchant_rates', 'Per-merchant pricing for products (e.g. for github, google).', { merchant: z.string().min(1).describe('Merchant name.') }, ({ merchant }) =>
    wrap(() => client.get('/products/rates', { merchant })),
  );
  server.tool('get_balance', "Get an end user's available balance.", { external_user_ref: userRef }, ({ external_user_ref }) =>
    wrap(() => client.get('/balance', { external_user_ref })),
  );

  // ─────────── Cards ───────────
  server.tool(
    'issue_card',
    '💳 Issue a virtual card to an end user. Money operation — a test key runs in sandbox (no real money). Idempotent: pass the same idempotency_key when retrying so a card is never issued twice.',
    {
      external_user_ref: userRef,
      product: z.string().optional().describe('productCode from list_products (optional; project default if omitted).'),
      idempotency_key: z.string().optional().describe('Stable key to make caller-side retries safe — reuse the SAME value if you retry this call after a timeout.'),
    },
    ({ external_user_ref, product, idempotency_key }) => wrap(() => client.post('/cards', { external_user_ref, ...(product ? { product } : {}) }, true, idempotency_key)),
  );
  server.tool('get_card', 'Masked card details (last4, expiry, status). Raw PAN/CVV are never returned here — use reveal_card.', { card_id: cardId }, ({ card_id }) =>
    wrap(() => client.get(`/cards/${encodeURIComponent(card_id)}`)),
  );
  server.tool('freeze_card', 'Freeze a card (reversible). Idempotent.', { card_id: cardId }, ({ card_id }) =>
    wrap(() => client.post(`/cards/${encodeURIComponent(card_id)}/freeze`)),
  );
  server.tool('unfreeze_card', 'Unfreeze a frozen card. Idempotent.', { card_id: cardId }, ({ card_id }) =>
    wrap(() => client.post(`/cards/${encodeURIComponent(card_id)}/unfreeze`)),
  );
  server.tool('close_card', 'Close a card permanently (irreversible). Idempotent.', { card_id: cardId }, ({ card_id }) =>
    wrap(() => client.post(`/cards/${encodeURIComponent(card_id)}/kill`)),
  );
  server.tool('set_card_pin', 'Set a 4-digit PIN. The PIN is not stored by CardOS.', { card_id: cardId, pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits') }, ({ card_id, pin }) =>
    wrap(() => client.post(`/cards/${encodeURIComponent(card_id)}/set-pin`, { pin })),
  );
  server.tool(
    'set_card_controls',
    'Set soft spend controls (per-transaction / daily / monthly limits, blocked MCC/countries). On breach the card is auto-frozen + an alert is sent (no hard auth-time block).',
    {
      card_id: cardId,
      per_txn_max_minor: z.number().int().nonnegative().optional().describe('Max per-transaction amount in minor units (cents).'),
      daily_max_minor: z.number().int().nonnegative().optional(),
      monthly_max_minor: z.number().int().nonnegative().optional(),
      blocked_mcc: z.array(z.string()).optional().describe('MCC codes to block.'),
      blocked_country: z.array(z.string()).optional().describe('ISO country codes to block.'),
    },
    ({ card_id, ...body }) => wrap(() => client.post(`/cards/${encodeURIComponent(card_id)}/controls`, body)),
  );
  server.tool(
    'reveal_card',
    'Mint a one-time hosted link that shows full card details (PAN/CVV) to the end user, bypassing you (PCI on CardOS). Short-lived, single-use. ⚠️ The result contains a sensitive one-time link — deliver it to the end user; do not store or log it.',
    { card_id: cardId },
    ({ card_id }) => wrap(() => client.post(`/cards/${encodeURIComponent(card_id)}/reveal`)),
  );
  server.tool(
    'create_card_session',
    'Mint hosted card screens (manage + transactions) on real data, to open in a webview for the end user — bypassing you. Returns manage_url / transactions_url. ⚠️ These are sensitive short-lived links — deliver to the end user; do not store or log them.',
    { card_id: cardId },
    ({ card_id }) => wrap(() => client.post(`/cards/${encodeURIComponent(card_id)}/session`)),
  );
  server.tool(
    'list_card_transactions',
    'List transactions for a card (amount, currency, commission, FX original amount/currency, merchant, MCC, decline reason, status).',
    { card_id: cardId, limit: z.number().int().min(1).max(100).optional().describe('Max rows (default 50).') },
    ({ card_id, limit }) => wrap(() => client.get(`/cards/${encodeURIComponent(card_id)}/transactions`, { limit })),
  );

  // ─────────── Deposits ───────────
  server.tool(
    'create_deposit',
    'Create a crypto deposit invoice to top up an end-user balance. Money operation — sandbox with a test key. Idempotent: pass the same idempotency_key when retrying.',
    {
      external_user_ref: userRef,
      amount: z.string().min(1).describe('Amount as a decimal string, e.g. "100".'),
      method: z.enum(['usdt_trc20', 'usdt_ton']).default('usdt_trc20'),
      idempotency_key: z.string().optional().describe('Stable key to make caller-side retries safe — reuse the SAME value if you retry after a timeout.'),
    },
    ({ external_user_ref, amount, method, idempotency_key }) => wrap(() => client.post('/deposits', { external_user_ref, amount, method }, true, idempotency_key)),
  );
  server.tool('confirm_deposit_sandbox', '[SANDBOX] Simulate confirmation of a pending deposit (test key only). In live, an on-chain watcher credits it.', { deposit_id: z.string().min(1) }, ({ deposit_id }) =>
    wrap(() => client.post(`/sandbox/deposits/${encodeURIComponent(deposit_id)}/confirm`)),
  );
  server.tool(
    'simulate_transaction_sandbox',
    '[SANDBOX] Inject a test card transaction (test key only) to exercise webhooks, analytics, controls and cashback.',
    {
      card_id: cardId,
      type: z.enum(['expense', 'refund', 'reversal', 'authorization']).default('expense'),
      amount: z.string().min(1).describe('Amount as a decimal string.'),
      merchant: z.string().optional(),
      mcc: z.string().optional(),
      country: z.string().optional(),
    },
    ({ card_id, ...body }) => wrap(() => client.post(`/sandbox/cards/${encodeURIComponent(card_id)}/transactions`, body)),
  );

  // ─────────── Statements & analytics ───────────
  server.tool(
    'get_statement',
    "An end user's statement (summary: spent/received/fees/holds + line items + balance).",
    { external_user_ref: userRef, days: z.number().int().min(1).max(365).optional().describe('Lookback window in days (default 30).') },
    ({ external_user_ref, days }) => wrap(() => client.get('/statements', { external_user_ref, days })),
  );
  server.tool(
    'get_spending_analytics',
    "Spending breakdown by category (from MCC) for an end user.",
    { external_user_ref: userRef, days: z.number().int().min(1).max(365).optional() },
    ({ external_user_ref, days }) => wrap(() => client.get('/analytics/spending', { external_user_ref, days })),
  );

  // ─────────── Disputes ───────────
  server.tool(
    'file_dispute',
    'Open a dispute on a transaction.',
    { transaction_id: z.string().min(1), reason: z.enum(['fraud', 'not_received', 'duplicate', 'incorrect_amount', 'other']), note: z.string().max(2000).optional() },
    ({ transaction_id, reason, note }) => wrap(() => client.post('/disputes', { transaction_id, reason, ...(note ? { note } : {}) })),
  );
  server.tool(
    'list_disputes',
    'List disputes, optionally filtered by user or status.',
    { external_user_ref: z.string().max(128).optional(), status: z.enum(['open', 'under_review', 'resolved_won', 'resolved_lost', 'withdrawn']).optional(), limit: z.number().int().min(1).max(100).optional() },
    (q) => wrap(() => client.get('/disputes', q)),
  );
  server.tool('get_dispute', 'Get one dispute by id.', { dispute_id: z.string().min(1) }, ({ dispute_id }) => wrap(() => client.get(`/disputes/${encodeURIComponent(dispute_id)}`)));
  server.tool(
    'update_dispute',
    'Update a dispute (status / note / provider reference).',
    { dispute_id: z.string().min(1), status: z.enum(['open', 'under_review', 'resolved_won', 'resolved_lost', 'withdrawn']).optional(), note: z.string().max(2000).optional(), provider_ref: z.string().max(256).optional() },
    ({ dispute_id, ...body }) => wrap(() => client.patch(`/disputes/${encodeURIComponent(dispute_id)}`, body)),
  );

  // ─────────── KYC ───────────
  server.tool(
    'start_kyc',
    'Start KYC for an end user. Returns a hosted url_for_user and a uuid to poll.',
    { external_user_ref: userRef, sort: z.string().max(64).default('basic').describe('KYC tier/sort (default "basic").') },
    ({ external_user_ref, sort }) => wrap(() => client.post('/kyc', { external_user_ref, sort })),
  );
  server.tool('get_kyc_status', 'Status of a KYC session by uuid.', { uuid: z.string().min(1) }, ({ uuid }) => wrap(() => client.get(`/kyc/${encodeURIComponent(uuid)}`)));

  // ─────────── Webhooks ───────────
  server.tool(
    'register_webhook',
    'Register an HTTPS endpoint for outbound events (credited, issued, transaction, card_status, balance). Returns the signing secret once. ⚠️ The result contains the signing secret — store it securely; do not log it.',
    { url: z.string().url(), events: z.array(z.enum(['credited', 'issued', 'transaction', 'card_status', 'balance'])).optional().describe('Event types (omit for all).') },
    ({ url, events }) => wrap(() => client.post('/webhook-endpoints', { url, ...(events ? { events } : {}) })),
  );
  server.tool('list_webhooks', 'List registered webhook endpoints (no secrets).', {}, () => wrap(() => client.get('/webhook-endpoints')));
}
