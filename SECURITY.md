# Security Policy

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue.
Use **Security → Report a vulnerability** in this repository (GitHub private reporting) with details and reproduction steps. We aim to acknowledge within 72 hours.

## Scope & design notes

- This server is a **thin client** over the public CardOS REST API. It exposes no provider internals, BIN data, or card-network secrets.
- The **API key** is supplied via environment / client config and is never committed. Treat `cms_sk_live_…` keys as production secrets.
- **Card details** are returned masked. Full PAN/CVV are delivered only through a one-time, short-lived **hosted** reveal link — they never pass through this server or the model context.
- **Money operations** (`issue_card`, `create_deposit`) are idempotent; retries do not double-apply.
- Prefer a **sandbox** (`cms_sk_test_…`) key for development and CI.

## Hardening tips

- Store the key in your MCP client's secret config, not in shell history.
- Use a scoped key per integration where possible and rotate it if exposed.
- Keep `CARDOS_BASE_URL` pointed at a host you trust.
