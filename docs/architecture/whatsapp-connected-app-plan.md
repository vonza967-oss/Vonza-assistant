# WhatsApp Connected App Plan

## Phase 10-14 Scope

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
- [Message templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview/)
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

`whatsapp.business.send.template` represents future approved-template outbound messaging only. Templates are WhatsApp Business Account assets, have categories such as authentication, marketing, and utility, and must be approved before use. This capability is not executable today.

`whatsapp.business.send.session.reply` represents future replies during an allowed customer-service window only. Meta's WhatsApp messaging rules distinguish replies inside the customer-service window from template messages used outside that window. This capability is not executable today.

Future WhatsApp work must separate inbound webhooks, session replies, and approved template messages.

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
- Phase 13 also writes those redacted summaries into `connected_app_inbound_events` with owner, connection, provider, app, optional capability, event type, message id, provider timestamp, source account/channel ids, redaction summary, and a dedupe key.
- Phase 14 resolves those stored WhatsApp message/status events into `connected_app_inbound_threads` using a hash of the raw external conversation key. The raw key is used only transiently for hashing and is not persisted or returned.

Phase 13 stores only redacted normalized event summaries. It still does not store full provider payloads, does not persist message body text, does not persist customer contact phone numbers or profile names, does not create chat messages, leads, action requests, booking requests, contacts, or outbound replies, and does not call WhatsApp or Twilio APIs.

Phase 14 stores only redacted thread grouping state. It still does not store full provider payloads, message body text, customer contact phone numbers, profile names, contacts/leads/action requests/booking requests/chat messages, outbound replies, provider payloads, or provider clients.

Future WhatsApp webhook phases must separately handle service-only app-secret storage or signing-secret references, full signature enforcement, consent/session windows, manual staff replies, and only later AI-drafted replies or outbound messaging.

## Outbound Notes For Future Work

A future sender must be a separate scoped phase. It must require:

- Explicit owner connection.
- Explicit agent enablement.
- Approved surface.
- Provider proof that the target phone number and WhatsApp Business Account are valid for the connection.
- Opt-in and policy compliance evidence.
- Approved template status before template sends.
- Customer-service-window proof before session replies.
- Safe logging and audit events before and after any provider call.
- Probably staff approval for customer-impacting outbound messages.

Phase 14 sends no WhatsApp messages. Manual staff replies are a future phase. AI-drafted replies are a later future phase after manual staff replies and review controls exist.

## Dashboard Copy

The authenticated Connected Apps dashboard can show WhatsApp Business as a foundation status panel with:

- `Manual/internal setup`
- `Inbound review only`
- `No WhatsApp replies sent`
- `No AI handoff`
- `No outbound messaging`
- `No Meta OAuth/Embedded Signup yet`

The authenticated Connected Apps dashboard can also show a compact `Connected app inbox` for redacted threads and recent redacted events. It may show thread status, provider/app, last event time, last event type/message type, unread count, the safe label `WhatsApp conversation`, and status controls for `reviewing`, `resolved`, `ignored`, and `archived`.

The dashboard must not add token inputs, app-secret inputs, verify-token inputs, webhook-secret inputs, OAuth/Embedded Signup buttons, WhatsApp reply controls, WhatsApp sender controls, AI draft controls, public chat controls, package activation controls, or phone number display.

## Non-Goals

- No runtime chat behavior.
- No widget/embed change.
- No outbound messages.
- No full app-secret signature enforcement until service-only secret storage/config exists.
- No chat handoff.
- No AI replies.
- No WhatsApp replies.
- No AI-drafted replies.
- No customer phone/profile/body persistence.
- No Meta OAuth/Embedded Signup.
- No WhatsApp Cloud API calls.
- No Twilio WhatsApp API calls.
- No package activation enforcement.
- No runtime permission enforcement.
- No public chat or widget WhatsApp behavior.
- No secrets committed or exposed.
