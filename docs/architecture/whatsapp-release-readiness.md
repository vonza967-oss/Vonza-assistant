# WhatsApp Release Readiness

Run date: 2026-06-03.

## Status

WhatsApp Connected Apps is release-ready for controlled staging enablement of manual staff replies and staff-reviewed AI drafts after the deployment checklist below is completed. It is not ready for broad production self-serve rollout.

Current implementation boundaries:

- No automatic replies.
- No AI-to-provider send.
- No runtime public chat behavior.
- No widget or embed behavior.
- No Meta OAuth or Embedded Signup.
- No Twilio WhatsApp.
- No package activation enforcement.
- No secrets in dashboard/client/docs.

## Migration Readiness

Deploy these migrations in exact timestamp order:

1. `20260602150000_connected_app_connection_foundation.sql`
2. `20260603105759_connected_app_inbound_events.sql`
3. `20260603133000_connected_app_inbound_threads.sql`
4. `20260603133840_connected_app_outbound_messages.sql`
5. `20260603143000_whatsapp_ai_reply_draft_context.sql`

Alignment checked:

- `db/schema.sql` contains the connected-app connection, enablement, inbound event, inbound thread, outbound audit, `thread_id`, and `normalized_message_text` final shape.
- `docs/sql/prod_recovery_full_current_main.sql` includes all five migrations in the same order with source comments.
- `docs/sql/prod_recovery_startup.sql` is startup-only and does not include these feature-gated WhatsApp tables; do not use it as the full WhatsApp rollout script.
- `src/services/schema/supabaseMigrationCatalog.js` includes all five migrations in order and marks them feature-gated.
- Schema gates include connected app tables through `src/services/schema/persistenceSchema.js`, `tests/schemaGate.test.js`, `tests/rlsSchema.test.js`, and `npm run check:schema-sync`.

PostgREST/Data API deploy note:

- Reload the PostgREST schema cache after applying the migrations, especially before dashboard/API smoke checks.
- On Supabase projects where new public tables are not automatically exposed to the Data API, confirm `authenticated` has table access for read-only dashboard paths. RLS still limits rows by owner.
- Connected app writes are expected to be service/internal writes, not public authenticated client writes.

## Feature Flags

Keep both WhatsApp feature flags off until migration deployment, schema-cache/Data API visibility checks, server-side configuration checks, and staging smoke pass.

`WHATSAPP_MANUAL_REPLIES_ENABLED`:

- Default: off.
- Enabled only by `1`, `true`, `enabled`, or `on`.
- Required before the manual dashboard reply route can send through the server-side provider path.
- When off, the manual send service writes a blocked audit row after owner/thread scope is established and does not call the provider.

`WHATSAPP_AI_REPLY_DRAFTS_ENABLED`:

- Default: off.
- Enabled only by `1`, `true`, `enabled`, or `on`.
- Requires manual replies to also be enabled before drafts can be generated.
- Draft route returns draft text for staff review only and never sends to the provider.

## WhatsApp Configuration Requirements

Configure server-side only before live use:

- Meta WhatsApp Business Account and approved test/business number.
- WhatsApp Cloud API phone number ID.
- Service-only access token or credential lookup for the target connection.
- Service-only destination resolver that maps the hashed inbound thread to a sendable WhatsApp recipient.
- Webhook verify token setup stored as a derived internal verifier reference, not raw dashboard metadata.
- App secret/signature validation setup if available through service-only configuration. Without it, POST signature status remains `not_configured` and production beta should not accept broad live traffic.
- Public HTTPS webhook URL for `GET/POST /integrations/whatsapp/webhook/:connectionId`.
- Target recipient constraints for staging, ideally Meta test recipient allow-list or a dedicated test number.
- No secrets, raw tokens, phone numbers, webhook URLs, copied provider payloads, or destination refs in dashboard fields, client code, docs, or committed files.

## Security And Privacy Audit

Verified current posture:

- Inbound threads store `external_thread_key_hash` and safe label `WhatsApp conversation`, not raw phone numbers or profile names.
- Inbound events store redacted normalized summaries, not full provider payloads.
- Message bodies are not persisted except nullable `normalized_message_text` for WhatsApp inbound `message` events used by AI drafts.
- `normalized_message_text` is constrained by service and SQL guards: WhatsApp only, inbound received message only, trimmed, 1 to 1500 chars, and rejects URL-looking, email-looking, phone-looking, JWT-looking, Meta-token-looking, and secret-looking content.
- Dashboard inbound event DTOs do not expose `normalized_message_text`.
- Outbound audit rows store `destination_ref_hash`, redacted body length markers, redacted provider error text, and no provider payload.
- `connected_app_connections`, `agent_connected_app_enablements`, `connected_app_inbound_events`, `connected_app_inbound_threads`, and `connected_app_outbound_messages` have owner-scoped RLS select policies for `authenticated`.
- No connected-app table has an anon policy.
- No connected-app migration grants authenticated insert/update/delete policies.
- Connected Apps dashboard/API routes require authenticated owner scope.
- No public chat send path exists.
- AI draft creation has no provider client, no destination resolver, no WhatsApp Cloud API call, and writes only `draft` audit rows with `sent_at = null`.

## Runtime Behavior Audit

Verified paths:

- Webhook verification validates `hub.mode`, `hub.verify_token`, and `hub.challenge` against an active WhatsApp connection with webhook capability.
- POST signature helpers build and verify Meta `X-Hub-Signature-256` HMAC-SHA256 when a service-only app secret is supplied.
- Inbound POST storage writes redacted event rows and redacted thread rows only after connection scope validation.
- Inbox list/status APIs are authenticated and owner scoped.
- Manual replies require the server flag, owner actor match, owner-scoped thread/connection, active WhatsApp connection, capability, optional agent enablement, session-window proof, server-side destination lookup, and server-side credentials.
- Manual send route accepts staff text/template fields only; it rejects credentials, destination phone, provider payload, provider override, and connection override fields from clients.
- Template sends remain blocked until approved-template support is implemented.
- AI drafts require the AI flag, manual flag/readiness, owner actor match, active connection, manual session reply capability, optional agent enablement, session-window proof, and recent safe normalized text.
- AI draft route never sends to provider and returns only a safe draft DTO.
- Twilio WhatsApp is not used; Twilio code in this repo is phone webhook/call related, not WhatsApp sending.

## Dashboard Readiness

Verified dashboard states:

- Connected Apps setup is manual/status-only and says credentials do not belong in dashboard fields.
- WhatsApp foundation panel states manual/internal setup, inbound review only, feature-flagged manual replies, AI draft only, staff review, no automatic replies, and no Meta OAuth/Embedded Signup.
- WhatsApp inbox shows redacted threads/events and review status controls.
- Manual reply composer is visible only when `manualReplies.enabled === true`; otherwise it shows disabled copy.
- AI draft panel is visible only when AI drafts and manual replies are both enabled; otherwise it shows disabled copy.
- There are no token, secret, verify-token, webhook-secret, destination phone, provider payload, or phone number inputs for WhatsApp sending.
- There is no automatic reply toggle and no send-AI control.

## Staging Smoke Plan

1. Apply the five migrations in order.
2. Reload PostgREST schema cache and confirm table visibility for authenticated owner reads.
3. Create a temporary owner, business, agent, WhatsApp connection, and agent enablement with safe metadata only.
4. Verify GET webhook challenge succeeds for the valid verify token and fails for an invalid token.
5. POST a redacted WhatsApp message payload with no service app secret if staging lacks one; expect signature status `not_configured`, one inbound event, one inbound thread, unread count increment, no raw phone/profile/body in stored JSON except safe `normalized_message_text` when text is allowed.
6. Repeat the same POST and confirm dedupe/thread stability.
7. With `WHATSAPP_MANUAL_REPLIES_ENABLED` off, call the manual reply route and confirm provider client is not called and audit is `blocked`.
8. With `WHATSAPP_MANUAL_REPLIES_ENABLED=1`, inject a staging provider client plus server-side credential and destination resolvers; confirm exactly one provider call and one redacted `sent` or `failed` audit row.
9. If real Meta test credentials are present, run one real send only to the configured test recipient; confirm no destination or provider payload is persisted.
10. With both `WHATSAPP_MANUAL_REPLIES_ENABLED=1` and `WHATSAPP_AI_REPLY_DRAFTS_ENABLED=1`, inject or use the existing OpenAI client and confirm draft generation returns a draft DTO, writes a `draft` audit row, and does not call the WhatsApp provider.
11. Browser-check `/dashboard` Connected Apps hash/settings route with an authenticated owner fixture: disabled/enabled manual reply states, disabled/enabled AI draft states, no credential/phone inputs, no automatic reply toggle.
12. Clean all temporary rows and verify cleanup counts are zero.

## Go/No-Go

Manual replies in staging are go only when:

- Migrations are applied in order and schema cache is reloaded.
- Owner-scoped RLS/select checks pass.
- Server-side credential lookup and destination resolver are configured.
- Staging target recipient constraints are documented.
- Feature-off route blocks provider calls.
- Feature-on injected provider smoke passes.

AI drafts in staging are go only when:

- Manual replies are staging-go.
- `normalized_message_text` SQL/service constraints pass.
- AI draft feature-off blocks model calls.
- Feature-on draft smoke returns draft DTOs only and no provider call.
- Staff review copy and manual composer behavior are browser-checked.

Production beta is go only when:

- Staging manual reply and AI draft smoke pass end to end.
- Real Meta app-secret signature validation is configured or production traffic is constrained to a documented internal/test setup.
- Service-only secrets are configured outside dashboard/client/docs.
- Monitoring/log review confirms redaction and no provider payload persistence.
- Production rollout is limited to selected beta owners/test numbers with rollback by disabling flags.

Must remain disabled:

- Automatic WhatsApp replies.
- AI-to-provider sending.
- Meta OAuth/Embedded Signup.
- Twilio WhatsApp.
- Package activation enforcement based on WhatsApp readiness.
- Public chat, widget, and embed WhatsApp behavior.

## Checks

Required release checks:

- `node --check src/services/integrations/connectedAppRegistry.js`
- `node --check src/services/integrations/connectedAppConnectionService.js`
- `node --check src/services/integrations/connectedAppInboundEventService.js`
- `node --check src/services/integrations/connectedAppInboundThreadService.js`
- `node --check src/services/integrations/whatsappWebhookService.js`
- `node --check src/services/integrations/whatsappManualReplyService.js`
- `node --check src/services/integrations/whatsappAiReplyDraftService.js`
- `node --check src/routes/integrationRoutes.js`
- `node --check src/routes/agentRoutes.js`
- `node --check frontend/dashboard.js`
- `node --check frontend/settings/SettingsShell.js`
- `node --test tests/connectedAppConnectionService.test.js tests/connectedAppInboundEventService.test.js tests/connectedAppInboundThreadService.test.js tests/connectedAppReadinessService.test.js tests/connectedAppReadinessContextService.test.js tests/connectedAppRoutes.test.js tests/connectedAppDashboard.test.js tests/whatsappWebhookService.test.js tests/whatsappManualReplyService.test.js tests/whatsappAiReplyDraftService.test.js tests/rlsSchema.test.js tests/schemaGate.test.js`
- `npm run test:smoke`
- `npm run check:schema-sync`
- `npm run lint`
- `git diff --check`

## Blockers

No code blocker was found for controlled staging enablement. Operational blockers before production beta:

- Real service-only Meta app-secret/signature validation must be configured or production traffic must remain tightly constrained.
- Real service-only Cloud API credentials and destination resolver must be configured outside dashboard/client/docs.
- A production beta recipient/owner allow-list and rollback plan must be documented.
