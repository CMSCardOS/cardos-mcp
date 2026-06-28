/** MCP resources — context the client can read (OpenAPI spec, docs pointers). */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const DOCS = `# CardOS — developer context

Base URL: https://cardos.dev/api/v1
Auth: Authorization: Bearer <CARDOS_API_KEY>  (cms_sk_test_… = sandbox, cms_sk_live_… = production)
Money operations (issue_card, create_deposit) are idempotent — retries do not double-apply.
Card details are returned masked; full PAN/CVV are shown only via a one-time hosted reveal link (reveal_card).
The card provider is abstracted away — only "CardOS" is exposed.

Docs:   https://cardos.dev/docs
Reference (Scalar): https://cardos.dev/reference
OpenAPI: https://cardos.dev/openapi-v1.yaml

Webhooks are signed: X-CardOS-Signature: t=<unix>,v1=<hex>, where v1 = HMAC_SHA256(secret, "<t>.<raw_body>").`;

async function fetchText(url: string, timeoutMs = 10_000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export function registerResources(server: McpServer, baseUrl: string): void {
  const origin = baseUrl.replace(/\/api\/v1$/, '');

  server.resource('CardOS developer guide', 'cardos://docs', { description: 'Auth, idempotency, webhooks and links — quick orientation for an agent.', mimeType: 'text/markdown' }, async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'text/markdown', text: DOCS }],
  }));

  server.resource('CardOS OpenAPI specification', 'cardos://openapi', { description: 'The full OpenAPI 3 spec (YAML) for the CardOS Tenant API.', mimeType: 'application/yaml' }, async (uri) => {
    const text = await fetchText(`${origin}/openapi-v1.yaml`).catch((e) => `# Could not fetch OpenAPI spec: ${(e as Error).message}\n# See ${origin}/openapi-v1.yaml`);
    return { contents: [{ uri: uri.href, mimeType: 'application/yaml', text }] };
  });
}
