# WhatsApp Manual Reply Staging Smoke Test

Run date: 2026-06-03

Target environment: configured Supabase target `wjrgzvprxkkgbjppxphk.supabase.co`.

## Scope

This smoke verified the WhatsApp manual inbox and manual staff reply path against controlled staging data. It did not add feature behavior or change runtime public chat behavior.

No real tokens, verify tokens, app secrets, access tokens, phone numbers, endpoint secrets, raw provider payloads, or real customer message body text were committed or recorded. The local environment did not provide WhatsApp verify-token, app-secret, Cloud API token, phone-number-id, or authenticated dashboard-session configuration. The live Meta Cloud API send and authenticated browser dashboard smoke were therefore not executed from this workspace; the feature-on send used the service's injected provider-client path with controlled non-secret test doubles and verified that the provider client would be called exactly once after all guards passed.

## Migration And Table Status

Required migration targets:

- `20260603105759_connected_app_inbound_events.sql`
- `20260603133000_connected_app_inbound_threads.sql`
- `20260603133840_connected_app_outbound_messages.sql`

PostgREST did not expose migration history schemas from this environment, so migration rows could not be read directly through the available Supabase HTTP client. Required table visibility was verified instead:

| Table | Status Before Smoke |
| --- | --- |
| `connected_app_connections` | Present, count 0 |
| `agent_connected_app_enablements` | Present, count 0 |
| `connected_app_inbound_events` | Present, count 0 |
| `connected_app_inbound_threads` | Present, count 0 |
| `connected_app_outbound_messages` | Present, count 0 |

No migration files were applied during this smoke.

## Controlled Setup

Temporary rows were created with generated ids only:

- one owner id,
- one business,
- one agent,
- one WhatsApp Business `connected_app_connections` record,
- one `agent_connected_app_enablements` record.

The WhatsApp connection used only safe metadata:

- `whatsappBusinessAccountId`
- `phoneNumberId`
- `businessDisplayName`
- `graphApiVersion`
- `webhookVerifyStatus`

The webhook verifier used the existing derived verify-token hash reference in `token_secret_ref`. The raw verify token was generated in-process and was not stored in metadata or returned by route/service DTOs.

`WHATSAPP_MANUAL_REPLIES_ENABLED` was unset/off by default in the local environment.

## Results

| Area | Result |
| --- | --- |
| Webhook verification | Passed. A valid subscribe challenge returned only the challenge and moved webhook status to `active`. An invalid verify token was rejected. The raw verify token was not stored. |
| Inbound webhook POST | Passed with controlled safe payload data. Signature status was `not_configured` because no service-only app secret was configured; it was not falsely marked verified. |
| Inbound event/thread storage | Passed. One redacted inbound event row and one redacted thread row were created. The thread unread count became 1. A duplicate POST did not create a second active event or thread. |
| Redaction | Passed. The serialized event/thread DTOs did not contain the controlled inbound message body, contact phone, or contact profile name. |
| No unrelated runtime writes | Passed for the scoped owner. No outbound messages existed before manual reply. PostgREST count checks for some unrelated tables returned null or unavailable from this environment, but no chat/runtime services were invoked by the smoke. |
| Feature off reply | Passed. With `WHATSAPP_MANUAL_REPLIES_ENABLED` unset/off, manual reply was blocked with `whatsapp_manual_replies_disabled`, the provider client was not called, and a blocked outbound audit row was recorded. |
| Feature on manual reply | Passed through injected provider-client verification. With `WHATSAPP_MANUAL_REPLIES_ENABLED=1`, owner/actor scope, agent enablement, active connection, capability, destination lookup, credentials lookup, and customer-service-window proof passed. The injected provider client was called exactly once and a sent outbound audit row was created. |
| Live Meta Cloud API send | Not run from this workspace. Required server-side Meta test credentials were not configured locally. |
| Outbound safety | Passed. The sent audit row stored provider message id/status safely, did not store destination phone number, did not store raw provider payload, and stored only `body_redacted` for staff text. |
| Owner isolation | Passed. A different generated owner id could not list the created thread. |
| Unsafe request body fields | Passed. A token-like reply request field was rejected before provider execution. |
| Template send | Blocked before provider execution. In this setup the connection did not include template capability, so the block occurred before the explicit approved-template-support guard. Approved-template support remains unimplemented. |
| Dashboard API state | Passed at service/API-data level: thread listing returned the controlled redacted inbox thread and manual reply feature status supports disabled/enabled UI states. |
| Dashboard browser smoke | Not run from this workspace because no authenticated dashboard fixture/session was available locally. |

## Cleanup

Cleanup deleted temporary rows by generated owner/id scope.

| Table | Cleanup Count |
| --- | --- |
| `connected_app_connections` | 0 |
| `agent_connected_app_enablements` | 0 |
| `connected_app_inbound_events` | 0 |
| `connected_app_inbound_threads` | 0 |
| `connected_app_outbound_messages` | 0 |
| `agents` | 0 |
| `businesses` | 0 |

No real provider/test app configuration outside the smoke scope was modified.

## Bugs Fixed

None. This was verification/docs only.

## Safety Boundaries Confirmed

- No secrets were committed or pasted into docs/tests.
- No AI replies were created.
- No automatic replies were created.
- No runtime public chat behavior was touched.
- No widget or embed files were touched.
- No Meta OAuth or Embedded Signup was added or used.
- No Twilio WhatsApp path was added or used.
- No package activation enforcement was added.
- WhatsApp manual replies remain feature-flagged off by default.
- Template sends remain blocked unless a future approved-template implementation is explicitly added.
