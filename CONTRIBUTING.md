# Contributing

Thanks for your interest in improving `cardos-mcp`.

## Development

```bash
npm install
npm run build        # tsc → dist/
npm test             # vitest
npm run typecheck    # tsc --noEmit
CARDOS_API_KEY=cms_sk_test_xxx node dist/index.js   # run the server (stdio)
```

## Project layout

- `src/client.ts` — typed CardOS API client (timeouts, retries, idempotency, typed errors).
- `src/tools.ts` — MCP tools, grouped by area.
- `src/resources.ts` — MCP resources (`cardos://docs`, `cardos://openapi`).
- `src/prompts.ts` — MCP prompts.
- `src/index.ts` — server entry (stdio transport).
- `test/` — vitest suites (fetch is mocked; no network in CI).

## Guidelines

- **Keep it a thin client.** No provider internals, no business logic that belongs server-side.
- **Money tools are explicit and idempotent.** Anything that moves money sets `Idempotency-Key`.
- **Never return raw card data.** Card details stay masked; PAN/CVV only via the hosted reveal link.
- **No secrets in the repo.** Keys come from env / client config.
- Add a tool by registering it in `src/tools.ts` with a `zod` schema and a one-line description an agent can act on. Add a test if it has non-trivial logic.
- Run `npm run typecheck && npm test` before opening a PR.

## Commit / PR

Small, focused PRs. Describe the change and how you verified it. CI must pass (typecheck + build + test).
