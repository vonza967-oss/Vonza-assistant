# WhatsApp Connected App Plan

## Phase 10 Scope

Connected Apps Phase 10 adds WhatsApp Business as a capability foundation only. It is metadata, manual/status-only connection support, report-only readiness, dashboard copy, docs, and tests.

It adds:

- `whatsapp.business.webhook`
- `whatsapp.business.send.template`
- `whatsapp.business.send.session.reply`

It does not add schema or migration changes. The existing `connected_app_connections.metadata` field can safely represent non-secret WhatsApp identifiers, and `agent_connected_app_enablements` can represent explicit agent enablement for report-only readiness.

## Official Meta Documentation Checked

This plan is based on current official Meta WhatsApp Business Platform documentation for:

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

Do not store raw access tokens, app secrets, verify tokens, webhook secrets, OAuth codes, API keys, copied provider payloads, webhook endpoint URLs, or authorization headers in metadata or route responses. Meta access tokens are opaque strings and must be treated as secret material.

## Capability Boundaries

`whatsapp.business.webhook` represents verified inbound webhook readiness only. It requires `requiresWebhook: true`, `requiresSecret: true`, `externalExecution: false`, and `publicChatCallable: false`. In readiness, it can become ready only when an active manual connection, explicit agent enablement, and active generic webhook status exist.

`whatsapp.business.send.template` represents future approved-template outbound messaging only. Templates are WhatsApp Business Account assets, have categories such as authentication, marketing, and utility, and must be approved before use. This capability is not executable today.

`whatsapp.business.send.session.reply` represents future replies during an allowed customer-service window only. Meta's WhatsApp messaging rules distinguish replies inside the customer-service window from template messages used outside that window. This capability is not executable today.

Future WhatsApp work must separate inbound webhooks, session replies, and approved template messages.

## Webhook Notes For Future Work

A future WhatsApp webhook route must be a separate scoped phase. Meta webhook setup expects a publicly reachable TLS endpoint that handles:

- GET verification with `hub.mode`, `hub.challenge`, and `hub.verify_token`.
- POST JSON webhooks signed with `X-Hub-Signature-256`.
- Payloads for `whatsapp_business_account` entries, including metadata such as display phone number and phone number ID, plus message/contact/status changes.

The future route must validate the verify token and app-secret signature without logging or exposing either secret. It must enforce endpoint allowlists, owner/agent binding, connection status, event type allowlists, idempotency, replay safety, rate limiting, and safe redaction before storing proof or scheduling internal work.

Phase 10 adds no webhook receiver enabled yet.

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

Phase 10 sends no WhatsApp messages.

## Dashboard Copy

The authenticated Connected Apps dashboard can show WhatsApp Business as a foundation status panel with:

- `Manual/internal setup`
- `No WhatsApp messages sent`
- `No webhook receiver enabled yet`
- `No Meta OAuth/Embedded Signup yet`

The dashboard must not add token inputs, app-secret inputs, verify-token inputs, webhook-secret inputs, OAuth/Embedded Signup buttons, WhatsApp sender controls, public chat controls, or package activation controls.

## Non-Goals

- No schema or migration change.
- No runtime chat behavior.
- No widget/embed change.
- No WhatsApp webhook route.
- No inbound message processing.
- No outbound messages.
- No Meta OAuth/Embedded Signup.
- No WhatsApp Cloud API calls.
- No Twilio WhatsApp API calls.
- No package activation enforcement.
- No runtime permission enforcement.
- No public or anonymous WhatsApp route.
- No secrets committed or exposed.
