/** MCP prompts — reusable, parameterised guidance the user can invoke from the client. */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerPrompts(server: McpServer): void {
  server.prompt(
    'issue_card_for_user',
    'Guide the assistant through issuing a virtual card for an end user, end to end.',
    { external_user_ref: z.string().describe('Your reference for the end user (e.g. a Telegram id).') },
    ({ external_user_ref }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Issue a virtual card for user "${external_user_ref}" using CardOS. Steps:
1. Call list_products and pick a productCode (prefer a no-KYC product unless KYC is required).
2. Check get_balance for the user. If the balance is too low, create_deposit and (in sandbox) confirm_deposit_sandbox.
3. Call issue_card with the user ref and chosen product. Report the masked card and card_id.
4. Offer next actions: reveal_card (one-time hosted PAN/CVV), create_card_session (hosted manage/transactions screens), or set_card_controls (spend limits).
Note: a cms_sk_test_… key runs in sandbox (no real money). Confirm before any live money action.`,
          },
        },
      ],
    }),
  );

  server.prompt('integrate_cardos', 'Walk through integrating CardOS into an app from scratch.', {}, () => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Help me integrate CardOS into my app. Read the cardos://docs resource first, then:
1. Confirm I have a test API key (cms_sk_test_…) — if not, point me to https://cardos.dev/partner/developers.
2. Explain the core flow: deposit → balance → issue_card → transactions → webhooks.
3. Show how to register a webhook (register_webhook) and verify its HMAC signature.
4. Run a sandbox smoke test using simulate_transaction_sandbox so I can see analytics and webhooks fire.
Keep money operations explicit and remind me they're idempotent.`,
        },
      },
    ],
  }));
}
