# Changelog

All notable changes to this project are documented here. This project adheres to [Semantic Versioning](https://semver.org).

## [0.2.1] — 2026-06-29
### Fixed (post-publish review: codex + grok)
- **Idempotency across caller retries** — `issue_card` / `create_deposit` accept an `idempotency_key`; reuse on retry to avoid double-issue/charge.
- **Retry safety** — only GET and keyed requests are retried; keyless POST/PATCH are never replayed.
- **Backoff** — exponential + jitter, honors `Retry-After`. **Query** via `URLSearchParams`.
- **Webhook events** corrected to `credited|issued|transaction|card_status|balance`.
- **Sensitive output** — `reveal_card` / `create_card_session` / `register_webhook` descriptions now warn that the result holds a one-time link or signing secret to deliver to the user, not log.

## [0.2.0] — 2026-06-28
### Added
- Full API coverage: **26 tools** across catalog, cards, deposits, statements, analytics, disputes, KYC and webhooks.
- **Resources**: `cardos://docs`, `cardos://openapi`.
- **Prompts**: `issue_card_for_user`, `integrate_cardos`.
- Typed `CardOSClient` with timeouts, bounded retries (429/5xx/network), automatic idempotency keys, and a typed `CardOSError`.
- Test suite (vitest), CI, registry manifests (`server.json`, `smithery.yaml`), and client config examples.

## [0.1.0]
### Added
- Initial MVP: 5 tools (`list_products`, `get_balance`, `card_details`, `list_transactions`, `issue_card`).
