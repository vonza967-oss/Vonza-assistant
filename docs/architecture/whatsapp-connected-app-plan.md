# WhatsApp Connected App Plan

## Phase 10-11 Scope

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

## Official Meta Documentation Checked

This plan is based on current official Meta WhatsApp Business Platform documentation for:

- [Graph API Webhooks getting started](https://developers.facebook.com/docs/graph-api/webhooks/getting-started)
- [WhatsApp Cloud API webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)
- [WhatsApp Cloud API webhook payload examples](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples)
- [Webhooks overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview/)
- [Webhook endpoint creation and verification](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint/)
- [Sending messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages/)
- [Message templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview/)
- [Access tokens](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens/)

## Safe Manual Metadata

Safe WhatsApp metadata can be stored only as redacted setup/status context:

- `whatsappBusinessAccountId`
- `phoneNumberId`
- `displayPhoneNumber`
- `businessDisplayName`
- `webhookVerifyStatus`
- `graphApiVersion`
- `webhookVerifiedAt`
- `lastWebhookReceivedAt`
- `lastWebhookObject`
- `lastWebhookEventTypes`

Do not store raw access tokens, app secrets, verify tokens, webhook secrets, OAuth codes, API keys, copied provider payloads, webhook endpoint URLs, authorization headers, contact phone numbers, message bodies, or full provider payloads in metadata or route responses. Meta access tokens are opaque strings and must be treated as secret material.

Phase 11 does not store raw verify tokens. Verification compares Meta's `hub.verify_token` against a deterministic SHA-256 verifier reference using the connection id as context. The current generic schema has no dedicated verifier-hash column, so this derived verifier reference is stored internally in `token_secret_ref` rather than public metadata. Future secret storage should replace this with a dedicated service-only secret/hash contract.

## Capability Boundaries

`whatsapp.business.webhook` represents verified inbound webhook readiness only. It requires `requiresWebhook: true`, `requiresSecret: true`, `externalExecution: false`, and `publicChatCallable: false`. In readiness, it can become ready only when an active manual connection, explicit agent enablement, and active generic webhook status exist.

`whatsapp.business.send.template` represents future approved-template outbound messaging only. Templates are WhatsApp Business Account assets, have categories such as authentication, marketing, and utility, and must be approved before use. This capability is not executable today.

`whatsapp.business.send.session.reply` represents future replies during an allowed customer-service window only. Meta's WhatsApp messaging rules distinguish replies inside the customer-service window from template messages used outside that window. This capability is not executable today.

Future WhatsApp work must separate inbound webhooks, session replies, and approved template messages.

## Phase 11 Webhook Verification

Meta webhook setup expects a publicly reachable TLS endpoint. Phase 11 supports only the foundation needed to verify setup safely:

- GET verification reads `hub.mode`, `hub.challenge`, and `hub.verify_token`.
- Verification succeeds only for an active WhatsApp Business generic connection whose derived verifier matches.
- On success, Vonza returns only the `hub.challenge` string and marks `webhook_status = active`.
- POST JSON payloads are accepted only enough to recognize `object = whatsapp_business_account` and message/status event types.
- POST updates only safe readiness metadata such as `lastWebhookReceivedAt`, `lastWebhookObject`, and `lastWebhookEventTypes`.

Phase 11 does not process inbound messages, does not normalize messages, does not create chat messages, does not create action requests, does not generate replies, and does not send WhatsApp messages. It also does not validate `X-Hub-Signature-256`; app-secret signature validation remains a required future phase.

Future WhatsApp webhook phases must separately handle app-secret signature validation, inbound message normalization, consent/session windows, idempotency/replay safety, and outbound messaging.

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

Phase 11 sends no WhatsApp messages.

## Dashboard Copy

The authenticated Connected Apps dashboard can show WhatsApp Business as a foundation status panel with:

- `Manual/internal setup`
- `No WhatsApp messages sent`
- `Webhook verification/readiness only`
- `No Meta OAuth/Embedded Signup yet`

The dashboard must not add token inputs, app-secret inputs, verify-token inputs, webhook-secret inputs, OAuth/Embedded Signup buttons, WhatsApp sender controls, public chat controls, or package activation controls.

## Non-Goals

- No schema or migration change.
- No runtime chat behavior.
- No widget/embed change.
- No inbound message processing.
- No outbound messages.
- No app-secret signature validation yet.
- No Meta OAuth/Embedded Signup.
- No WhatsApp Cloud API calls.
- No Twilio WhatsApp API calls.
- No package activation enforcement.
- No runtime permission enforcement.
- No public chat or widget WhatsApp behavior.
- No secrets committed or exposed.
