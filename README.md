<div align="center">

# CardOS MCP Server

**Issue and manage virtual cards from any AI assistant — over the [Model Context Protocol](https://modelcontextprotocol.io).**

[![CI](https://github.com/CMSCardOS/cardos-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/CMSCardOS/cardos-mcp/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/cardos-mcp.svg)](https://www.npmjs.com/package/cardos-mcp)
[![MCP](https://img.shields.io/badge/MCP-server-blue)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

</div>

`cardos-mcp` connects [CardOS](https://cardos.dev) to **Claude, Cursor, Windsurf, VS Code** and any MCP client. Point your assistant at it and ask, in plain language, to *check a balance, issue a card, pull transactions, file a dispute, or start KYC*.

It's a **thin, safe client** over the public CardOS REST API: no provider internals, no secrets in the repo, money operations are idempotent, card details stay masked, and a **`cms_sk_test_…` key runs in sandbox** (no real money).

---

## Quick start

1. **Get an API key** → **[cardos.dev/partner/developers](https://cardos.dev/partner/developers)** (a `cms_sk_test_…` key = sandbox).
2. **Run it** — published to npm:

```bash
CARDOS_API_KEY=cms_sk_test_xxx npx -y cardos-mcp
```

…or straight from source:

```bash
git clone https://github.com/CMSCardOS/cardos-mcp && cd cardos-mcp
npm install && npm run build
CARDOS_API_KEY=cms_sk_test_xxx node dist/index.js
```

## Add to your client

Drop this into your client config (`env` holds your key — see [`examples/`](./examples) for Claude Desktop, Cursor, Windsurf and VS Code):

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

| Client | Config file |
|--------|-------------|
| Claude Desktop | `claude_desktop_config.json` (Settings → Developer → Edit Config) |
| Cursor | `~/.cursor/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| VS Code | `.vscode/mcp.json` (use the `examples/vscode.json` shape) |

## Tools (26)

<details open><summary><b>Catalog &amp; balance</b></summary>

| Tool | Description |
|------|-------------|
| `list_products` | Card products: code, currency, limits, KYC requirement |
| `get_merchant_rates` | Per-merchant pricing |
| `get_balance` | End-user available balance |
</details>

<details open><summary><b>Cards</b></summary>

| Tool | Description |
|------|-------------|
| `issue_card` 💳 | Issue a virtual card (idempotent; sandbox with a test key) |
| `get_card` | Masked details (last4, expiry, status) |
| `freeze_card` / `unfreeze_card` / `close_card` | Lifecycle (idempotent) |
| `set_card_pin` | Set a 4-digit PIN (not stored by CardOS) |
| `set_card_controls` | Spend limits + blocked MCC/countries (auto-freeze on breach) |
| `reveal_card` | One-time hosted PAN/CVV link (PCI on CardOS) |
| `create_card_session` | Hosted manage + transactions screens for the end user |
| `list_card_transactions` | Transactions (amount, FX, commission, merchant, MCC, decline) |
</details>

<details><summary><b>Deposits</b></summary>

| Tool | Description |
|------|-------------|
| `create_deposit` 💳 | Crypto deposit invoice (idempotent) |
| `confirm_deposit_sandbox` | [sandbox] confirm a pending deposit |
| `simulate_transaction_sandbox` | [sandbox] inject a test transaction |
</details>

<details><summary><b>Statements, analytics, disputes, KYC, webhooks</b></summary>

| Tool | Description |
|------|-------------|
| `get_statement` | Statement (spent/received/fees + lines) |
| `get_spending_analytics` | Spending by category |
| `file_dispute` / `list_disputes` / `get_dispute` / `update_dispute` | Disputes |
| `start_kyc` / `get_kyc_status` | Hosted KYC flow |
| `register_webhook` / `list_webhooks` | Signed outbound events |
</details>

## Resources & prompts

- **Resources** — `cardos://docs` (auth/idempotency/webhooks orientation) and `cardos://openapi` (the live OpenAPI 3 spec). Clients can read these for context.
- **Prompts** — `issue_card_for_user` (guided end-to-end issuance) and `integrate_cardos` (integration walkthrough).

## Example prompts

- *"What card products are available?"* → `list_products`
- *"Issue a sandbox card for user 123456, then show its details."* → `issue_card` → `get_card`
- *"Top up user 123456 with $100 and confirm it."* → `create_deposit` → `confirm_deposit_sandbox`
- *"Freeze card `<id>` and set a $50 daily limit."* → `freeze_card` → `set_card_controls`

## Safety

- **Sandbox-first** — a `cms_sk_test_…` key never moves real money.
- **No secrets in the repo** — the key lives in your client config / env.
- **Idempotent money ops** — `issue_card` / `create_deposit` won't double-apply on retry.
- **Masked card data** — full PAN/CVV only via a one-time hosted link, never through this server or the model.
- See [SECURITY.md](./SECURITY.md).

## Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `CARDOS_API_KEY` | — | Your CardOS API key (**required**). |
| `CARDOS_BASE_URL` | `https://cardos.dev/api/v1` | Override the API base. |

## Develop

```bash
npm install
npm run build        # tsc → dist/
npm test             # vitest (network mocked)
npm run typecheck
```

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Links

- **CardOS** — <https://cardos.dev>
- **Docs** — <https://cardos.dev/docs> · **Reference** — <https://cardos.dev/reference> · **OpenAPI** — <https://cardos.dev/openapi-v1.yaml>
- **FAQ** — [FAQ.md](./FAQ.md) · **Changelog** — [CHANGELOG.md](./CHANGELOG.md)
- **Model Context Protocol** — <https://modelcontextprotocol.io>

## License

[MIT](./LICENSE)
