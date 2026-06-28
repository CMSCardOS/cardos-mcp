#!/usr/bin/env node
/**
 * cardos-mcp — Model Context Protocol server for CardOS.
 *
 * Lets any MCP client (Claude, Cursor, Windsurf, …) issue and manage virtual cards through the
 * public CardOS API. A thin, safe wrapper: no provider internals, no secrets in the repo, and a
 * cms_sk_test_… key runs in sandbox (no real money).
 *
 * Config: CARDOS_API_KEY (required), CARDOS_BASE_URL (optional). Get a key at
 * https://cardos.dev/partner/developers.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CardOSClient } from './client.js';
import { registerTools } from './tools.js';
import { registerResources } from './resources.js';
import { registerPrompts } from './prompts.js';

const VERSION = '0.2.0';

async function main(): Promise<void> {
  const apiKey = process.env.CARDOS_API_KEY ?? '';
  const baseUrl = (process.env.CARDOS_BASE_URL ?? 'https://cardos.dev/api/v1').replace(/\/$/, '');
  if (!apiKey) {
    process.stderr.write('cardos-mcp: CARDOS_API_KEY is not set. Get one at https://cardos.dev/partner/developers\n');
  }

  const client = new CardOSClient({ apiKey: apiKey || 'cms_sk_test_unset', baseUrl, userAgent: `cardos-mcp/${VERSION}` });
  const server = new McpServer({ name: 'cardos-mcp', version: VERSION });

  registerTools(server, client);
  registerResources(server, baseUrl);
  registerPrompts(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`cardos-mcp ${VERSION} running — base: ${baseUrl}, mode: ${client.mode}\n`);
}

main().catch((err) => {
  process.stderr.write(`cardos-mcp: fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
