# CardOS MCP Server

> Issue and manage **virtual cards** from any MCP client — Claude, Cursor, and others — over the [Model Context Protocol](https://modelcontextprotocol.io).

[![MCP](https://img.shields.io/badge/MCP-server-blue)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

`cardos-mcp` is a small, safe MCP server that exposes the public **[CardOS](https://cardos.dev)** API as tools. Point your AI assistant at it and ask it to *check a balance, issue a card, or pull transactions* — in plain language.

It is a thin client over the public REST API: no provider internals, no secrets in the repo, and a **`cms_sk_test_…` key runs in sandbox** (no real money moves).

---

## Tools

| Tool | What it does |
|------|--------------|
| `list_products` | List card products (code, currency, limits, KYC requirement). |
| `get_balance` | Balance of an end user (by your external reference, e.g. a Telegram id). |
| `card_details` | Masked card details (last4, expiry, status). Raw PAN/CVV are never returned. |
| `list_transactions` | Transactions for a card (amount, currency, merchant, MCC, FX, status). |
| `issue_card` | 💳 Issue a virtual card. Money operation — sandbox with a test key; auto-idempotent so retries don't double-issue. |

## Quick start

1. **Get an API key** at **[cardos.dev/partner/developers](https://cardos.dev/partner/developers)** (a `cms_sk_test_…` key = sandbox).
2. **Run it.**

Once published to npm (no install needed):

```bash
CARDOS_API_KEY=cms_sk_test_xxx npx cardos-mcp
```

Or straight from source:

```bash
git clone https://github.com/DeFiTON/cardos-mcp && cd cardos-mcp
npm install && npm run build
CARDOS_API_KEY=cms_sk_test_xxx node dist/index.js
```

## Configure your client

### Claude Desktop

Add to `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "cardos": {
      "command": "npx",
      "args": ["-y", "cardos-mcp"],
      "env": { "CARDOS_API_KEY": "cms_sk_test_xxx" }
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "cardos": {
      "command": "npx",
      "args": ["-y", "cardos-mcp"],
      "env": { "CARDOS_API_KEY": "cms_sk_test_xxx" }
    }
  }
}
```

Any MCP-compatible client works the same way — `command: npx`, `args: ["-y", "cardos-mcp"]`, and `CARDOS_API_KEY` in the env.

## Example prompts

- *"What card products are available?"* → `list_products`
- *"Issue a sandbox card for user 123456."* → `issue_card`
- *"Show the last 20 transactions for card `<id>`."* → `list_transactions`
- *"What's the balance of user 123456?"* → `get_balance`

## Safety

- **Sandbox-first** — a `cms_sk_test_…` key never moves real money.
- **No secrets in the repo** — the key lives in your client config / env, never in git.
- **Money operations are explicit** (`issue_card`) and auto-idempotent (retries don't double-issue).
- Card details are returned **masked**; full card data is never exposed through this server.

## Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `CARDOS_API_KEY` | — | Your CardOS API key (required). |
| `CARDOS_BASE_URL` | `https://cardos.dev/api/v1` | Override the API base. |

## Develop

```bash
npm install
npm run build
CARDOS_API_KEY=cms_sk_test_xxx node dist/index.js
```

## Links

- **CardOS** — <https://cardos.dev>
- **API docs** — <https://cardos.dev/docs> · **Reference** — <https://cardos.dev/reference>
- **Model Context Protocol** — <https://modelcontextprotocol.io>

## License

MIT — see [LICENSE](./LICENSE).
