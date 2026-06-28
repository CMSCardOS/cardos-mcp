# FAQ

### What is this?
`cardos-mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the public **[CardOS](https://cardos.dev)** API as tools, resources and prompts. Connect it to any MCP client (Claude, Cursor, Windsurf, VS Code…) and ask, in plain language, to issue cards, check balances, pull transactions, and more.

### Do I need anything to use it?
A CardOS API key. Get one at **[cardos.dev/partner/developers](https://cardos.dev/partner/developers)**. A `cms_sk_test_…` key runs in **sandbox** — no real money moves.

### Is it safe? It touches cards and money.
Yes, by design:
- It's a **thin client over the public REST API** — no provider internals, no BIN, no card-network secrets.
- Your API key lives in your client config / env, **never in this repo**.
- **Money operations** (`issue_card`, `create_deposit`) are explicit and **idempotent** — a retry never double-applies.
- Card details come back **masked**; full PAN/CVV are only ever shown via a one-time **hosted** link (`reveal_card`), so they never pass through this server or the model.
- Sandbox is the default; live requires a `cms_sk_live_…` key.

### What's the difference between test and live?
The key prefix decides. `cms_sk_test_…` → sandbox (stubbed, no real money). `cms_sk_live_…` → production. The server reports its mode on startup.

### How does idempotency work?
For `issue_card` and `create_deposit` the server generates a fresh `Idempotency-Key` per call. If your client retries a tool call (timeout, network blip), CardOS returns the same result instead of creating a duplicate.

### Which tools are there?
26, grouped: catalog & balance, cards (issue/freeze/unfreeze/close/PIN/controls/reveal/session/transactions), deposits (+ sandbox confirm/simulate), statements & analytics, disputes, KYC, webhooks. Run `tools/list` in your client, or see the README table.

### What are the resources and prompts?
- Resources: `cardos://docs` (orientation) and `cardos://openapi` (the live OpenAPI spec). Clients can read these for context.
- Prompts: `issue_card_for_user` and `integrate_cardos` — guided, parameterised flows you can invoke from the client.

### How do webhooks work?
Register an endpoint with `register_webhook`; CardOS signs every delivery: `X-CardOS-Signature: t=<unix>,v1=<hex>` where `v1 = HMAC_SHA256(secret, "<t>.<raw_body>")`. Verify the signature and compare `t` to the current time (anti-replay).

### Can I point it at a self-hosted or staging CardOS?
Yes — set `CARDOS_BASE_URL`.

### It says "CARDOS_API_KEY is not set".
Add the env var to your client config (see README) or export it before running. The server still starts so `tools/list` works, but API calls will return 401 until a valid key is set.

### Where do I report bugs or request tools?
Open an issue: https://github.com/CMSCardOS/cardos-mcp/issues
