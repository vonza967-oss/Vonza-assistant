# WhatsApp Connected App Plan

## Phase 10-14 Scope, Manual Reply, And AI Draft Milestones

Connected Apps Phase 10 adds WhatsApp Business as a capability foundation only. It is metadata, manual/status-only connection support, report-only readiness, dashboard copy, docs, and tests.

It adds:

- `whatsapp.business.webhook`
- `whatsapp.business.send.template`
- `whatsapp.business.send.session.reply`

Connected Apps Phase 11 adds only the WhatsApp inbound webhook verification/readiness foundation:

- `src/services/integrations/whatsappWebhookService.js`
- `GET /integrations/whatsapp/webhook/:connectionId`
- `POST /integrations/whatsapp/webhook/:connectionId`

It does not add schema or migration changes. The existing `connected_app_connections.token_secret_ref` can hold a derived verify-token hash reference for internal comparison, `connected_app_connections.metadata` can store only safe webhook readiness fields, and `agent_connected_app_enablements` can represent explicit agent enablement for report-only readiness.

Connected Apps Phase 12 adds only the next safe POST foundation layer:

- pure Meta `X-Hub-Signature-256` HMAC-SHA256 helper functions,
- raw-body route wiring so future signature enforcement can use exact provider bytes,
- redacted WhatsApp inbound event normalization for message/status/unknown summaries,
- safe aggregate readiness metadata for last received object, event types, message types, and signature status.

Phase 12 does not add inbound event storage, chat handoff, AI replies, outbound WhatsApp messages, WhatsApp Cloud API calls, Twilio WhatsApp API calls, Meta OAuth/Embedded Signup, package activation enforcement, or runtime chat behavior.

Connected Apps Phase 13 adds only the redacted inbound event storage foundation:

- `public.connected_app_inbound_events`,
- `src/services/integrations/connectedAppInboundEventService.js`,
- WhatsApp POST wiring that stores one safe event row per redacted normalized message/status/unknown summary.

Phase 13 persists redacted inbound events for audit and future routing preparation only. This is not a customer inbox, not chat handoff, not AI reply behavior, not outbound WhatsApp sending, not package activation enforcement, and not runtime chat behavior.

Connected Apps Phase 14 adds the manual read-only inbound staff inbox foundation:

- `public.connected_app_inbound_threads`,
- `src/services/integrations/connectedAppInboundThreadService.js`,
- authenticated owner routes for listing inbound threads, updating thread review status, and listing redacted inbound events,
- dashboard Connected Apps inbox copy and controls for review status only.

Phase 14 groups redacted WhatsApp inbound events by owner, connection, provider, app, capability, optional agent, and a hashed external conversation key. It stores the safe label `WhatsApp conversation`, not a customer phone number or profile name. It increments unread count only for inbound WhatsApp message events. Delivery/status events can update the thread's last event fields but do not increment unread count. Duplicate webhook retries reuse the existing event/thread state.

Phase 14 is a manual read-only staff inbox foundation. It has no WhatsApp replies, no AI handoff, no outbound messaging, no WhatsApp Cloud API calls, no Twilio WhatsApp API calls, no Meta OAuth/Embedded Signup, no package activation enforcement, no runtime public chat behavior, and no widget/embed change.

The manual staff reply milestone adds a separate, feature-flagged authenticated owner/dashboard path for staff-authored WhatsApp replies from inbound threads:

- `public.connected_app_outbound_messages` stores owner-readable redacted outbound audit rows with service/internal writes only.
- `src/services/integrations/whatsappManualReplyService.js` validates owner/thread/connection scope, active WhatsApp connection status, capability presence, optional agent enablement, manual actor id, feature flag, session-window proof, server-side credential lookup, and destination lookup before calling an injectable WhatsApp Cloud API provider client.
- `POST /agents/connected-app-inbound-threads/reply` accepts only authenticated owner/staff manual inputs (`threadId`, `messageText` or template fields, optional `agentId`, optional `capabilityKey`) and rejects tokens, phone fields, connection/provider overrides, and provider payloads.
- Dashboard composer copy is explicit that the manual send path is staff initiated and separate from any draft generation.

Manual replies are off by default. `WHATSAPP_MANUAL_REPLIES_ENABLED` must be explicitly set to `1`, `true`, `enabled`, or `on`. The route and service do not add AI replies, automatic replies, public chat behavior, widget/embed changes, Meta OAuth/Embedded Signup, package activation enforcement, or Twilio WhatsApp.

The AI reply draft milestone adds staff-review-only draft generation for the authenticated WhatsApp inbox:

- `public.connected_app_inbound_events.normalized_message_text` can store nullable, owner-scoped normalized WhatsApp text only for inbound WhatsApp `message` events.
- `src/services/integrations/whatsappAiReplyDraftService.js` validates authenticated owner/staff actor, owner/thread/connection scope, active WhatsApp connection, `whatsapp.business.send.session.reply` capability, optional agent enablement, manual reply feature readiness, customer-service-window proof, and recent normalized inbound text before calling the existing OpenAI client.
- `POST /agents/connected-app-inbound-threads/ai-draft` accepts only `threadId`, optional `agentId`, optional staff instructions, and optional safe locale/tone values. It rejects token, secret, provider payload, destination/phone, raw message body, and auto-send fields, and returns only a safe draft DTO without internal ids or audit metadata.
- The dashboard shows `AI draft only`, `Staff must review before sending`, and `No automatic WhatsApp replies`. A generated draft populates the existing manual composer; the existing manual send button remains the only send path.
- Draft audit rows use `connected_app_outbound_messages.status = draft`, `approval_mode = manual_staff`, no `sent_at`, no provider message id, no provider status, redacted `body_redacted`, and metadata that records `draftTextStored = false`, `noProviderSend = true`, and `staffApprovalRequired = true`.

AI drafts are off by default. `WHATSAPP_AI_REPLY_DRAFTS_ENABLED` must be explicitly set to `1`, `true`, `enabled`, or `on`. Draft generation does not call WhatsApp Cloud API, does not call Twilio, does not write `sent` or `queued` outbound rows, does not create public chat messages, does not change widget/embed behavior, and does not enable automatic replies.

## Official Meta Documentation Checked

This plan is based on current official Meta WhatsApp Business Platform documentation for:

- [Graph API Webhooks getting started](https://developers.facebook.com/docs/graph-api/webhooks/getting-started)
- [Graph API Webhooks payload validation](https://developers.facebook.com/docs/graph-api/webhooks/getting-started#validate-payloads)
- [WhatsApp Cloud API webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)
- [WhatsApp Cloud API webhook payload examples](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples)
- [WhatsApp Cloud API webhook components](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components)
- [Webhooks overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview/)
- [Webhook endpoint creation and verification](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint/)
- [Sending messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages/)
- [WhatsApp Cloud API messages endpoint](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages)
- [WhatsApp Cloud API phone numbers](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/phone-numbers)
- [WhatsApp customer-service windows](https://developers.facebook.com/docs/whatsapp/pricing#customer-service-windows)
- [Message templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview/)
- [WhatsApp Cloud API error codes](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes)
- [WhatsApp Cloud API throughput and rate limits](https://developers.facebook.com/docs/whatsapp/cloud-api/overview#throughput)
- [Access tokens](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens/)

## Safe Manual Metadata

Safe WhatsApp metadata can be stored only as redacted setup/status context:

- `whatsappBusinessAccountId`
- `phoneNumberId`
- `businessDisplayName`
- `webhookVerifyStatus`
- `graphApiVersion`
- `webhookVerifiedAt`
- `lastWebhookReceivedAt`
- `lastWebhookObject`
- `lastWebhookEventTypes`
- `lastWebhookSignatureStatus`
- `lastWebhookMessageTypes`

Do not store raw access tokens, app secrets, verify tokens, webhook secrets, OAuth codes, API keys, copied provider payloads, webhook endpoint URLs, authorization headers, contact phone numbers, message bodies, or full provider payloads in metadata or route responses. Meta access tokens are opaque strings and must be treated as secret material.

Phase 11 does not store raw verify tokens. Verification compares Meta's `hub.verify_token` against a deterministic SHA-256 verifier reference using the connection id as context. The current generic schema has no dedicated verifier-hash column, so this derived verifier reference is stored internally in `token_secret_ref` rather than public metadata. Future secret storage should replace this with a dedicated service-only secret/hash contract.

Phase 12 does not store raw app secrets. The generic schema still lacks a safe provider-specific app-secret/signing-secret store, and `token_secret_ref` must not be overloaded with a raw Meta app secret. POST signature helpers can verify when a service-only caller supplies an app secret directly, but production POST metadata records `lastWebhookSignatureStatus = not_configured` until a future service-only secret reference or provider-specific secret store exists.

## Capability Boundaries

`whatsapp.business.webhook` represents verified inbound webhook readiness only. It requires `requiresWebhook: true`, `requiresSecret: true`, `externalExecution: false`, and `publicChatCallable: false`. In readiness, it can become ready only when an active manual connection, explicit agent enablement, and active generic webhook status exist.

`whatsapp.business.send.template` represents approved-template outbound messaging only. Templates are WhatsApp Business Account assets, have categories such as authentication, marketing, and utility, and must be approved before use. The current manual reply service deliberately blocks template sends until approved-template support is explicitly implemented and configured.

`whatsapp.business.send.session.reply` represents manual staff replies during an allowed customer-service window only. Meta's WhatsApp messaging rules distinguish replies inside the customer-service window from template messages used outside that window. Vonza enforces a conservative internal session-window guard from the thread's `metadata.lastInboundMessageAt` or last inbound message event time. This is internal policy proof, not provider proof.

WhatsApp work must keep inbound webhooks, manual session replies, and approved template messages separate.

## Message Context Privacy For AI Drafts

The chosen context boundary is minimal owner-scoped normalized text retention on inbound event rows. The generic webhook normalizer still does not store raw provider payloads, contacts arrays, profile names, sender phone numbers, destination numbers, URLs, or secret-looking values. `normalized_message_text` is nullable and constrained to WhatsApp inbound `message` events with a 1,500 character maximum. The service rejects phone-looking, email-looking, URL-looking, and secret-looking text before storage.

Dashboard inbound event DTOs do not expose `normalized_message_text`; they continue to show redacted event summaries. The AI draft service fetches recent text only by authenticated owner id and thread id, and returns an `insufficient_context` no-draft response without calling OpenAI when no safe recent text is available.

Staff instructions are not treated as customer context. They can steer tone/focus only and cannot include provider payload, destination, token, raw message body, or auto-send fields.

## Manual Outbound Audit And Sending Contract

`connected_app_outbound_messages` stores no destination phone number, no access token, no app secret, no verify token, no webhook secret, no full provider payload, and no raw error payload. `destination_ref_hash` uses the existing inbound thread hash. `body_redacted` stores only a length/preview-style marker such as `manual staff text redacted`, not the staff-authored message text. Metadata records that the row is manual staff reply audit, no AI reply, no automatic WhatsApp messages, message text was not stored, provider payload was not stored, and whether template support was implemented.

AI draft audit rows reuse the same table only with `status = draft`. They store no generated draft body, no sent timestamp, no provider result, no provider payload, and no customer destination. Draft text is returned to the authenticated dashboard response so staff can review/edit it in the manual composer.

The service can call WhatsApp Cloud API only after every guard passes. Credentials must come from server-side configuration or an injected service-only secret lookup such as `getWhatsAppCloudApiCredentials`; the dashboard/request body cannot supply tokens, phone number IDs, destinations, or provider payloads. The destination must come from a service-only destination resolver because inbound thread rows intentionally store only a hash. Tests inject the provider client and destination resolver so no live Meta request is required.

Text/session replies require `whatsapp.business.send.session.reply`, an active owner-scoped WhatsApp connection, optional agent enablement when an agent id is present, and a current internal customer-service-window proof. Outside-window text replies are blocked and audited as `blocked`. Template attempts require `whatsapp.business.send.template` but are blocked in this phase until approved-template support exists. Provider success writes `sent`; provider failure writes `failed` with redacted error status.

## Staging Smoke Record

The WhatsApp manual reply staging smoke record is in `docs/architecture/whatsapp-manual-reply-staging-smoke-test.md`.

On 2026-06-03, the configured Supabase target `wjrgzvprxkkgbjppxphk.supabase.co` exposed the required connected-app inbound event, inbound thread, and outbound message tables. A controlled smoke created temporary owner/business/agent/connection/enablement rows, verified hashed webhook challenge handling, stored one redacted inbound event/thread, verified duplicate POST dedupe, blocked feature-off manual reply without provider execution, ran a feature-on manual reply through an injected provider client exactly once, verified owner isolation and unsafe-field rejection, and cleaned all temporary rows back to zero.

The local environment did not contain service-only Meta app-secret, Cloud API token, phone-number-id, or authenticated dashboard-session configuration. As a result, signature status was correctly recorded as `not_configured`, the live Meta Cloud API send was not executed from this workspace, and browser dashboard smoke was not run. No code changes or bug fixes were made by the smoke.

## Release Readiness Checklist

The deployment-ready WhatsApp audit and checklist is in `docs/architecture/whatsapp-release-readiness.md`.

Current readiness status: controlled staging enablement is ready after the documented migration, schema-cache, server-side credential/destination, feature-flag, and smoke checks pass. Production beta remains blocked on operational configuration: service-only Meta app-secret/signature validation or tightly constrained test traffic, service-only Cloud API credentials, service-only destination lookup, recipient/owner allow-list, and rollback by disabling `WHATSAPP_MANUAL_REPLIES_ENABLED` and `WHATSAPP_AI_REPLY_DRAFTS_ENABLED`.

Deploy order for the WhatsApp Connected Apps data path:

1. `20260602150000_connected_app_connection_foundation.sql`
2. `20260603105759_connected_app_inbound_events.sql`
3. `20260603133000_connected_app_inbound_threads.sql`
4. `20260603133840_connected_app_outbound_messages.sql`
5. `20260603143000_whatsapp_ai_reply_draft_context.sql`

Reload PostgREST schema cache after deployment before dashboard/API smoke checks. Keep both WhatsApp feature flags off by default; only `1`, `true`, `enabled`, or `on` enables either flag.

## Phase 11 Webhook Verification And Phase 12-14 POST Foundation

Meta webhook setup expects a publicly reachable TLS endpoint. Phase 11 supports only the foundation needed to verify setup safely:

- GET verification reads `hub.mode`, `hub.challenge`, and `hub.verify_token`.
- Verification succeeds only for an active WhatsApp Business generic connection whose derived verifier matches.
- On success, Vonza returns only the `hub.challenge` string and marks `webhook_status = active`.
- POST JSON payloads are accepted only enough to recognize `object = whatsapp_business_account` and message/status event types.
- POST preserves raw JSON bytes before parsing so future signature enforcement can use Meta's exact HMAC input.
- POST can validate `X-Hub-Signature-256: sha256=<hex>` with HMAC-SHA256 when a service-only app secret is supplied.
- When no safe app-secret configuration exists, POST remains readiness-only and records signature status as `not_configured`, not verified.
- POST normalizes inbound webhook changes into redacted message/status/unknown summaries only. Normalized summaries may include entry id, WhatsApp Business phone number id, message id, message type, timestamp, status, and redacted indicators such as `hasText`, `textLength`, or `contactPresent`.
- POST updates only safe readiness metadata such as `lastWebhookReceivedAt`, `lastWebhookObject`, `lastWebhookEventTypes`, `lastWebhookSignatureStatus`, and `lastWebhookMessageTypes`.
- Phase 13 also writes those redacted summaries into `connected_app_inbound_events` with owner, connection, provider, app, optional capability, event type, message id, provider timestamp, source account/channel ids, redaction summary, and a dedupe key. The AI draft milestone can additionally store safe `normalized_message_text` under the context privacy boundary above.
- Phase 14 resolves those stored WhatsApp message/status events into `connected_app_inbound_threads` using a hash of the raw external conversation key. The raw key is used only transiently for hashing and is not persisted or returned.

Inbound event storage still does not store full provider payloads, customer contact phone numbers, profile names, contacts arrays, chat messages, leads, action requests, booking requests, contacts, or outbound replies, and it does not call WhatsApp or Twilio APIs. The only message text retention is the nullable owner-scoped `normalized_message_text` column for safe WhatsApp draft context.

Phase 14 stores only redacted thread grouping state. It still does not store full provider payloads, customer contact phone numbers, profile names, contacts/leads/action requests/booking requests/chat messages, outbound replies, provider payloads, or provider clients.

Future WhatsApp webhook phases must separately handle service-only app-secret storage or signing-secret references, full signature enforcement, richer consent/session proof, and approved template catalog management.

## Outbound Notes

The implemented manual sender is a separate scoped milestone. It requires:

- Explicit owner connection.
- Explicit agent enablement.
- Approved surface.
- Server-side destination lookup/proof that the target WhatsApp destination and WhatsApp Business Account are valid for the connection.
- Opt-in and policy compliance evidence.
- Approved template status before template sends.
- Customer-service-window proof before session replies.
- Safe logging and audit events before and after any provider call.
- A manual staff click/send for every customer-impacting outbound message.

AI-drafted replies are implemented only as staff-approval drafts. Automatic replies are not implemented.

## Dashboard Copy

The authenticated Connected Apps dashboard can show WhatsApp Business as a foundation status panel with:

- `Manual/internal setup`
- `Inbound review only`
- `Manual staff reply`
- `AI draft only`
- `Staff must review before sending`
- `No automatic WhatsApp replies`
- `No Meta OAuth/Embedded Signup yet`

The authenticated Connected Apps dashboard can also show a compact `Connected app inbox` for redacted threads and recent redacted events. It may show thread status, provider/app, last event time, last event type/message type, unread count, the safe label `WhatsApp conversation`, status controls for `reviewing`, `resolved`, `ignored`, and `archived`, an AI draft panel only when draft and manual reply readiness allow it, and a manual staff reply composer only when the server feature status is enabled.

The dashboard must not add token inputs, app-secret inputs, verify-token inputs, webhook-secret inputs, OAuth/Embedded Signup buttons, send-AI controls, auto-send controls, public chat controls, package activation controls, template-management UI, destination/phone inputs, provider-payload fields, or phone number display.

## Non-Goals

- No runtime chat behavior.
- No widget/embed change.
- No automatic outbound messages.
- No full app-secret signature enforcement until service-only secret storage/config exists.
- No chat handoff.
- No automatic AI replies.
- No AI-to-provider send.
- AI drafts require staff approval and manual sending.
- No customer phone/profile/full-payload persistence.
- No Meta OAuth/Embedded Signup.
- No WhatsApp Cloud API calls unless the manual-replies feature flag is on and server-side credentials, destination lookup, active owner connection, capability, optional agent enablement, and session-window checks pass.
- No Twilio WhatsApp API calls.
- No package activation enforcement.
- No runtime permission enforcement.
- No public chat or widget WhatsApp behavior.
- No secrets committed or exposed.
