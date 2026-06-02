# Connected Apps Data Model Plan

## Purpose

Connected Apps Phase 5 implements the minimal generic persistence and internal service foundation from the Phase 4 design. It adds canonical owner connection and agent enablement tables plus a service skeleton. Connected Apps Phase 6 adds a report-only readiness context helper that can derive `evaluateConnectedAppReadiness()` input from those generic records. Connected Apps Phase 7 exposes those records through authenticated owner-scoped dashboard API routes only. Connected Apps Phase 8 adds an authenticated dashboard/settings management surface over those routes. Connected Apps Phase 9 adds Google Calendar as the first provider-specific adapter into the generic records by mirroring the existing Google operator connection flow. Connected Apps Phase 10 adds a WhatsApp Business capability foundation: registry metadata, safe manual/status-only connection representation, readiness tests, dashboard copy, and docs. These phases do not add runtime chat behavior, widget/embed behavior, new Google scopes, generic OAuth setup, WhatsApp OAuth/Embedded Signup, WhatsApp webhook receiving, WhatsApp outbound sending, package activation enforcement, external API calls beyond existing Google operator workflows, generic provider clients, generic provider execution, or secrets.

The model separates three decisions that must not be collapsed:

- An owner or workspace connects a provider account.
- An owner enables a connected app capability for a specific agent.
- A later runtime permission service decides whether a specific operation may execute.

The current Connected Apps registry and readiness services remain metadata/report-only. The persistence records, Phase 7 API responses, and Phase 8/9 dashboard controls are status/configuration records only. Phases 6-9 can report whether generic records look ready for a package/agent/capability context, but those records, routes, dashboard controls, and reports do not grant runtime permission or execute providers. Existing Google provider-specific workflow remains the source of truth for OAuth, token refresh, Calendar sync, and approved Calendar mutation behavior.

## Implemented Owner Connection: `connected_app_connections`

`connected_app_connections` stores that an owner or workspace has a generic connected-app status record for a provider account or provider capability. It is the source of redacted connection status and provider account identity. It is not a grant for every agent, package, surface, or runtime operation.

Implemented fields:

- `id`: Stable connection id.
- `owner_user_id`: Owner/workspace scope. This must be present on every connection row.
- `provider`: Stable provider key such as `google`, `calendly`, `stripe`, `twilio`, or `whatsapp`.
- `app_key`: Stable app/catalog key such as `google.calendar`, `google.gmail`, `calendly.booking`, `stripe.billing`, `twilio.phone`, or `whatsapp.business`.
- `capability_keys`: Normalized connected capability keys, such as `google.calendar.read` or `calendly.booking.webhook`.
- `status`: Redacted lifecycle state constrained to `needs_setup`, `active`, `disabled`, `needs_attention`, or `revoked`.
- `provider_account_id`: Provider account identifier when safe to store server-side.
- `provider_account_label`: Redacted display label such as an email address, workspace name, masked phone number, or billing account label.
- `scopes_granted`: Normalized provider scopes and internal capability grants. This should be redacted before any frontend response.
- `webhook_status`: High-level webhook state such as `not_required`, `pending`, `active`, `disabled`, `needs_attention`, or `error`.
- `token_secret_ref`: Future-safe reference to secret storage outside the public status row.
- `last_verified_at`: Last successful provider verification, refresh, webhook verification, or trusted sync.
- `needs_attention_reason`: Redacted reason code or short owner-safe message.
- `metadata`: Redacted provider metadata for non-secret status and diagnostics.
- `created_at` / `updated_at`: Audit timestamps.

Connection rows intentionally omit generic encrypted token columns in this phase. If a later provider requires generic token storage, it must add an explicit encryption or service-only secret storage contract. Connection rows must never expose raw access tokens, refresh tokens, signing secrets, client secrets, webhook endpoint tokens, OAuth URLs with secrets, API keys, bearer tokens, or copied provider payloads to frontend code.

## Implemented Agent Enablement: `agent_connected_app_enablements`

`agent_connected_app_enablements` lets an internal/service path record which connected app capabilities a specific owner-scoped agent may use later. It is narrower than an owner connection and still does not itself grant provider execution.

Implemented fields:

- `id`: Stable enablement id.
- `owner_user_id`: Owner scope, duplicated for RLS, joins, and confused-deputy prevention.
- `agent_id`: Agent that may use the enabled capabilities.
- `connection_id`: Reference to `connected_app_connections.id`.
- `capability_keys`: Capability subset enabled for this agent.
- `enabled`: Boolean owner-controlled state.
- `approval_mode`: Execution approval policy constrained to `manual_review`, `owner_approved`, `automatic_internal`, or `disabled`.
- `allowed_surfaces`: Surfaces allowed to request this enablement, such as `dashboard`, `operator`, `internal`, or `webhook`.
- `package_key`: Optional package binding when a capability is meant only for a package such as `hotel_concierge`.
- `metadata`: Redacted enablement notes, readiness state, or package-specific display metadata.
- `created_at` / `updated_at`: Audit timestamps.

An enablement proves only that an owner-scoped agent-level allowance exists. Before execution, runtime must still prove the owner connection is active, the capability is enabled for the agent, the package declares or is allowed to request the capability, provider scopes satisfy the capability, the surface is allowed, the approval mode permits the operation, and the execution path is not public chat unless a later phase explicitly allows it.

## Implemented Readiness Context Derivation

Phase 6 adds `src/services/integrations/connectedAppReadinessContextService.js` for explicit internal/test callers that already have Supabase access. The helper reads only the generic tables:

- `connected_app_connections`, scoped by `owner_user_id`.
- `agent_connected_app_enablements`, scoped by `owner_user_id` and `agent_id`.

It returns a plain context object for `evaluateConnectedAppReadiness()` with required capabilities, optional capabilities, connected capabilities, provider statuses, scope grants, webhook statuses, approval mode, surface, and execution-request state.

A capability counts as connected only when the connection belongs to the owner, the connection status is `active`, the enablement belongs to the same owner and agent, the enablement has `enabled = true`, and the capability appears on both the connection and enablement. OAuth scope grants are derived from connection scopes but emitted only as known capability-level booleans, not raw OAuth URLs or provider payloads. Webhook status is derived from `connected_app_connections.webhook_status`. Approval mode and default surface are derived from matching enablement records.

The helper intentionally selects only non-secret fields required for readiness. It does not expose `token_secret_ref`, raw tokens, secret metadata, OAuth URLs, provider clients, account payloads, or webhook signing material. It does not call providers, start OAuth, provision webhooks, enforce activation, or query provider-specific legacy tables.

## Implemented Authenticated Owner API

Phase 7 adds authenticated owner-scoped routes in `src/routes/agentRoutes.js` for internal/manual setup and status review of the generic records. These routes follow existing `/agents/...` dashboard API conventions and require the existing auth path before returning registry or owner data.

Implemented routes:

- `GET /agents/connected-app-capabilities`: returns safe registry capability metadata only. It does not return handlers, provider clients, token refs, secrets, raw encrypted fields, OAuth URLs, or webhook URLs. Every current capability remains `publicChatCallable: false`.
- `GET /agents/connected-apps`: lists the authenticated owner's mapped `connected_app_connections` rows with optional `provider` and `status` filters.
- `POST /agents/connected-apps`: creates an owner-scoped generic connection status/configuration record only. It accepts provider/app/capability/status/redacted account label/scope/webhook-status/metadata fields and rejects raw token, secret, token-secret-ref, OAuth URL, provider client, handler, and execution fields.
- `POST /agents/connected-apps/status`: updates an owner-scoped connection status, needs-attention reason, webhook status, last verification timestamp, and redacted metadata. It rejects secret, OAuth URL, token-ref, provider client, handler, and execution fields.
- `GET /agents/:agentId/connected-apps`: verifies owner access to the agent and lists that agent's owner-scoped enablements. It can optionally include derived report-only readiness context/report from the generic records.
- `POST /agents/:agentId/connected-apps`: verifies owner access to the agent and creates or updates an agent enablement. It validates the connection belongs to the owner, the capability is known, and the capability appears on the selected connection. It accepts approval mode, enabled state, allowed non-public surfaces, optional package key, and redacted metadata. It does not execute providers.
- `GET /agents/:agentId/connected-app-readiness`: verifies owner access to the agent, builds a generic-record readiness context, and evaluates the existing report-only readiness service for required/optional capability query parameters.

All Phase 7 routes are authenticated owner/internal setup APIs only. There are no public or anonymous connected-app routes. The routes do not create OAuth URLs, do not start callbacks, do not provision provider webhooks, do not call external providers, do not construct provider clients, do not expose public chat/tool use, do not add package activation enforcement, and do not create widget/embed UI.

## Implemented Authenticated Dashboard Surface

Phase 8 adds a compact `Connected apps` management surface in the authenticated dashboard/settings area. Phase 9 updates that surface to show Google Calendar as a real adapter backed by the existing Google connection flow. Phase 10 adds a WhatsApp Business foundation panel for manual/status-only readiness. It fetches:

- `GET /agents/connected-app-capabilities`
- `GET /agents/connected-apps`
- `GET /agents/:agentId/connected-apps`
- `GET /agents/:agentId/connected-app-readiness`

It shows provider and capability labels, owner connection status, provider account labels, scopes/capability summaries, webhook status, agent enablement state, approval mode, allowed surfaces, and report-only readiness warnings. It can reuse the existing Google connect button for Google Calendar, create a manual/status-only connection record for non-adapter review, update a connection status, and create/update an agent enablement.

The Phase 9 dashboard copy is explicit: `Uses existing Google connection flow`, `No chat execution`, `No provider action without approval`, and `Report-only readiness`. Phase 10 WhatsApp copy is explicit: `Manual/internal setup`, `No WhatsApp messages sent`, `No webhook receiver enabled yet`, and `No Meta OAuth/Embedded Signup yet`. Manual/status-only records remain available for non-adapter review, but the Google Calendar adapter and WhatsApp Business foundation panel do not show or accept raw tokens, secrets, OAuth URLs, webhook URLs, provider client fields, executable handler fields, public chat callable controls, package selector/package switching controls, WhatsApp token inputs, or message-send controls. They do not add a new OAuth flow, call providers from the generic surface, provision webhooks, enforce package activation, expose public/anonymous connected-app routes, change runtime chat behavior, or change widget/embed bundles.

## Proposed Webhook Registry: `connected_app_webhooks`

`connected_app_webhooks` remains a future table. Phase 5 did not add it because no generic webhook setup, proof routing, or provider execution is implemented. A future webhook table would track provider webhook endpoint state independently from connection status. It would map provider events to owner, connection, and optional agent context without making events executable tools by default.

Future fields:

- `id`: Stable webhook registration id.
- `owner_user_id`: Owner scope.
- `connection_id`: Optional reference to `connected_app_connections.id`.
- `agent_id`: Optional agent context when the provider event is agent-bound.
- `provider`: Provider key.
- `app_key`: App/catalog key.
- `capability_keys`: Capabilities satisfied by the webhook, such as `calendly.booking.webhook`.
- `provider_webhook_id`: Provider-side webhook id when available.
- `endpoint_token_hash`: Hash of any opaque endpoint token.
- `signing_secret_ref` / `signing_secret_encrypted`: Secret reference or encrypted signing secret.
- `subscribed_events`: Provider event keys accepted by this endpoint.
- `status`: `pending`, `active`, `disabled`, `revoked`, `needs_attention`, or `error`.
- `last_event_at`: Last accepted provider event timestamp.
- `last_verified_at`: Last successful signature or provider verification.
- `dedupe_strategy`: Dedupe key contract, replay window, and idempotency expectations.
- `metadata`: Redacted non-secret provider endpoint metadata.
- `created_at` / `updated_at`: Audit timestamps.

Webhook handlers should verify signature, timestamp freshness, endpoint token hash, owner/agent binding, connection status, event allowlist, and idempotency before recording any proof or scheduling internal work. A webhook event is provider proof or a queued internal signal, not a generic tool execution grant.

## OAuth State and Session Contract

Future generic OAuth state should follow the current Google pattern but stay provider-neutral:

- State must be opaque, random, signed, and/or stored as a hash at rest.
- State records must bind to `owner_user_id` before redirecting to the provider.
- Optional `agent_id`, `app_key`, and `capability_keys` must be part of the state contract when the flow is agent- or package-driven.
- Redirect targets must be chosen from an allowlist; arbitrary query-provided redirects are not allowed.
- State must expire quickly and be rejected after expiry.
- State must be one-time use. Callback success, callback failure, cancellation, and timeout should make replay fail closed.
- Requested scopes must bind to provider, app, and capability keys. The callback must not upgrade scopes beyond the stored request.
- URLs must not carry secrets beyond provider `code` and `state`. Access tokens, refresh tokens, client secrets, signing secrets, API keys, and provider payload copies must not appear in query strings, redirect paths, logs, or public response bodies.

## Secret and Token Storage Contract

The generic model should support either encrypted token columns or references to external secret storage. The safer default is a redacted status row plus service-only secret material.

Required contract:

- Raw tokens and secrets are never returned to frontend, public routes, package manifests, readiness DTOs, or public logs.
- Secret material is encrypted with a purpose-specific key or stored behind a `token_secret_ref` / `signing_secret_ref`.
- Access to secret material is service-role/internal only.
- Logs redact bearer tokens, JWTs, provider tokens, API keys, signing secrets, webhook tokens, authorization codes, and provider payload values that could identify private account contents.
- Rotation and revocation must be supported: reconnect, disconnect, scope downgrade, token refresh failure, webhook secret rotation, and provider-side revocation should move the connection into a safe status.
- Scope requests should be least privilege. Capabilities should map from granted scopes, not from requested scopes alone.
- Public status DTOs should expose only provider, app label, capability keys, status, redacted account label, last verification time, and safe needs-attention reason codes.

## Permission Evaluation Contract

A future runtime permission service must be the only generic path to provider execution. A proposed service such as `assertConnectedAppCapabilityAllowed()` should fail closed unless all of these are true:

- The owner has an active `connected_app_connections` row for the provider/app.
- The connection belongs to the same `owner_user_id` as the agent and request context.
- The target agent has an enabled `agent_connected_app_enablements` row for the connection.
- The requested capability is included in the enablement `capability_keys`.
- The package declares or is otherwise explicitly allowed to request the capability.
- Package activation/readiness has not been interpreted as a provider permission by itself.
- Provider scopes and webhook state satisfy the requested capability.
- The request surface is in `allowed_surfaces`.
- The `approval_mode` allows the specific operation and risk level.
- Billing/access status and owner/agent access status allow the operation.
- The execution path is permitted for this capability by the registry and runtime policy.
- A durable audit event can be written before or as part of execution.
- Public chat execution is blocked by default. Any public chat provider execution would require a later explicit phase with separate product, approval, safety, audit, and eval gates.

The service should return redacted allow/deny decisions with reason codes. It must not return tokens, provider clients, raw provider records, OAuth URLs, or webhook signing material.

## Migration and Coexistence Strategy

Phase 5 adds `db/schema.sql`, `supabase/migrations/20260602150000_connected_app_connection_foundation.sql`, and the full current-main recovery bundle entries for `connected_app_connections` and `agent_connected_app_enablements`. Existing provider-specific tables continue unchanged. Phase 9 adds `src/services/integrations/googleConnectedAppAdapter.js`, which mirrors existing Google Calendar connection status into `connected_app_connections` after the existing Google OAuth callback and token-refresh issue paths. Destructive migration should not be proposed until the generic model is proven against production-like traffic.

Implemented provider-specific adapter mapping:

- `google_connected_accounts`: Google Calendar is the first generic Connected Apps adapter. The existing Google operator OAuth flow remains the source of truth for requested/granted scopes, encrypted token storage, refresh, sync, and provider behavior. The adapter mirrors only redacted owner/provider/app/capability status into `connected_app_connections` with `provider = google`, `app_key = google.calendar`, `google.calendar.read` when Calendar read or write scope is granted, and `google.calendar.write` only when Calendar write scope is granted. It does not create `agent_connected_app_enablements`; owners must explicitly enable selected capabilities for an owned agent through the existing generic enablement endpoint.

Future provider-specific adapter mapping:

- `agent_booking_integrations`: Keep as the Calendly-specific webhook proof table. A future adapter can expose a redacted `calendly.booking.webhook` connection/readiness DTO using `owner_user_id`, `agent_id`, `provider`, `status`, `provider_account_id`, `provider_event_type_id`, and webhook status. Endpoint token hashes and encrypted webhook secrets stay in the provider-specific table or service-only secret storage.
- Google OAuth/calendar tables: Keep `google_oauth_states` and `google_connected_accounts` for the operator workspace. The Phase 9 adapter coexists with those tables and does not replace their owner/agent checks.
- Google Gmail: Gmail remains inside the Google operator workspace. A future adapter can mirror `google.gmail.read` only if that scope is explicitly granted and the product phase requires it.
- Stripe billing/webhook handling: Keep Stripe as owner billing infrastructure. Billing webhooks may appear in registry/readiness metadata, but Stripe billing state is not an agent connected-app grant and should not become package execution permission.
- Twilio phone webhook handling: Keep Twilio phone numbers and call sessions as admin/provider-specific phone infrastructure. A future adapter can report redacted phone webhook readiness, but owner self-serve Twilio setup and agent enablements require a separate design.
- WhatsApp Business: Phase 10 does not add a provider-specific table or adapter. The existing generic connection row can represent safe manual metadata such as WhatsApp Business Account ID, phone number ID, display phone number, business display name, webhook verification status, and Graph API version. Access tokens, app secrets, verify tokens, webhook secrets, copied provider payloads, and endpoint URLs must not live in metadata or route responses. Future WhatsApp work must separate inbound webhooks, session replies, and approved template messages.

Later migration can add webhook state, generic OAuth state, adapter backfills, or more provider-specific mappings beside existing provider tables. Existing Google, Calendly, Stripe, Twilio, and future WhatsApp code should keep provider-specific execution checks until the generic permission service is at least as strict as the current flows.

## RLS and Security Model

Phase 5 RLS assumes these tables could live in an exposed schema:

- Owner users may select only their own redacted connection and enablement status rows.
- Anonymous users have no access.
- No authenticated insert, update, delete, or all policies exist in Phase 5.
- Initial writes are service/internal only.
- If dashboard writes are later added, they must be authenticated owner writes scoped to the owner and active agent, with server-side validation.
- Secret material should be separated from public status fields where practical. Token-bearing or signing-secret-bearing records should be service-role-only, preferably in a private table/schema or behind service-only access paths.
- RLS policies should not depend on user-editable metadata claims.
- Audit logs should record connect, reconnect, disconnect, scope change, enablement change, approval-mode change, webhook verification, provider execution decision, provider execution attempt, and provider execution result.
- Audit events should include owner, agent, connection, capability, package, surface, actor, decision, reason codes, and redacted provider identifiers.

The design should preserve current owner/agent scoping, service-role-only secret handling, and RLS expectations instead of weakening them to make generic setup easier.

## Product UX Contract

The future user flow should be explicit and staged:

1. The owner connects an app at the workspace/account level.
2. The connect flow explains requested capabilities and provider scopes before redirecting or provisioning.
3. The owner chooses which capabilities are available from the connected provider account.
4. The owner enables selected capabilities for a specific agent.
5. Package readiness reports show missing, ready, warning, or blocked app capabilities as report-only status.
6. Execution remains approval-gated until a later explicit execution phase.
7. Disconnect, reconnect, scope downgrade, and needs-attention states are visible without exposing secrets.

The UI should make owner connection and agent enablement distinct. A connected provider account should not imply every agent can use it, and agent enablement should not imply public chat can execute provider actions.

## Non-Goals For Phase 5

- No runtime chat changes.
- No dashboard, widget, or embed changes.
- No OAuth/provider setup.
- No external API or provider execution.
- No package activation enforcement.
- No generic connected app setup surface.
- No runtime permission enforcement.
- No secrets committed.

## Non-Goals For Phase 6

- No schema or migration changes.
- No runtime chat changes.
- No dashboard, widget, or embed changes.
- No OAuth/provider setup.
- No external API or provider execution.
- No package activation enforcement.
- No generic connected app setup surface.
- No runtime permission enforcement.
- No provider-specific legacy table inference.
- No secrets committed.

## Non-Goals For Phase 7-10

- No schema or migration changes.
- No runtime chat changes.
- No widget or embed changes.
- No new OAuth/provider setup. Google Calendar uses the existing Google operator connection flow.
- No external API or provider execution.
- No package activation enforcement.
- No generic OAuth setup, provider setup, or execution-capable Connected Apps surface.
- No runtime permission enforcement.
- No automatic agent enablement from provider-specific legacy tables.
- No public or anonymous connected-app routes.
- No token-secret-ref, raw token, raw secret, OAuth URL, provider client, handler, or execution fields accepted or returned by the new API routes.
- No WhatsApp webhook receiver, inbound message processing, outbound message sending, Meta OAuth/Embedded Signup, Cloud API calls, Twilio WhatsApp API calls, template execution, session reply execution, or package activation enforcement.
- No secrets committed.

## Implementation Status

Phase 5 is implemented as schema, migration, service, tests, and docs only. Phase 6 is implemented as a service/tests/docs readiness adapter over the generic records only. Phase 7 is implemented as authenticated owner-scoped routes, service tightening, tests, and docs only. Phase 8 is implemented as authenticated dashboard UI/tests/docs only. Phase 9 is implemented as a Google Calendar adapter over the existing Google operator connection flow. Phase 10 is implemented as a WhatsApp Business capability foundation with metadata/readiness/manual-status/dashboard-copy/docs/tests only. Generic persistence now exists, readiness can be derived from those records, authenticated owners/internal setup paths can create/list/update redacted generic connection and enablement records, successful Google Calendar connections mirror into `connected_app_connections`, and WhatsApp Business can be represented manually with safe non-secret metadata. The dashboard can reuse the existing Google connect flow, show WhatsApp Business foundation status, manage manual/status-only records, explicitly enable selected capabilities for an agent, and show report-only readiness. No new Google scopes, generic OAuth/provider setup, Meta OAuth/Embedded Signup, WhatsApp webhook receiver, WhatsApp message sender, runtime permission enforcement, generic external API/provider execution, widget/embed behavior, runtime chat behavior, package activation enforcement, package switching, or generic secret storage exists yet. The current connected app registry and readiness services remain metadata/report-only, and provider-specific integrations remain provider-specific unless a scoped adapter explicitly mirrors redacted state into generic records.
