# Connected App Capability Registry

## Purpose

`src/services/integrations/connectedAppRegistry.js` is a report-only metadata registry for external app capabilities Vonza already knows about from provider-specific code.

It does not create a generic Connected Apps execution engine. It does not add chat behavior, generic provider clients, package activation, permission grants, or generic external execution. The Phase 8 dashboard surface renders this metadata for authenticated owners only as manual/status-only setup and report-only readiness. Phase 9 adds Google Calendar as the first adapter that mirrors the existing Google operator OAuth connection into generic records; the existing Google flow remains the source of truth for provider behavior. Connected Apps Phase 10 adds WhatsApp Business as a capability foundation only. Connected Apps Phase 11 adds a scoped WhatsApp webhook verification/readiness endpoint only. Phase 12 adds WhatsApp POST signature helper support and safe inbound event normalization only. Phase 13 persists redacted inbound summaries for audit/routing preparation, with nullable owner-scoped normalized WhatsApp text later added for staff-approved AI drafts only. Phase 14 groups redacted inbound WhatsApp events into a manual read-only staff inbox foundation only. The manual staff reply milestone adds a separate provider-specific, feature-flagged owner route and service for staff-authored WhatsApp session replies only. The AI draft milestone adds a separate feature-flagged owner route and service for staff-reviewed draft generation only. It still adds no inbound chat handoff, automatic replies, AI-to-provider send, Meta OAuth/Embedded Signup, Twilio WhatsApp API calls, package activation enforcement, public chat behavior, or widget/embed behavior.

Connected Apps Phase 2 adds `src/services/integrations/connectedAppReadinessService.js` as a provider-neutral, report-only evaluator over this registry. It can report whether supplied package/agent context appears `ready`, `warning`, or `blocked` for declared capabilities, but it still does not create a setup flow, enforce activation, call providers, or grant runtime permission.

Connected Apps Phase 3 threads that report into `src/services/agents/agentPackageActivationReadinessService.js` when activation readiness callers explicitly pass `context.connectedApps`. The activation readiness response can now include a `connectedApps` metadata block with overall connected-app status, requirement entries, and summary counts. This metadata does not change package activation status, does not enforce activation, and does not enable provider execution.

Connected Apps Phase 4 is documented in `docs/architecture/connected-apps-data-model-plan.md`. It designs future owner/workspace connection records, agent-level enablement records, webhook registry state, OAuth state contracts, token storage contracts, permission evaluation, RLS expectations, product UX, and adapter-first migration strategy. Phase 4 is docs/tests only; it adds no schema, migrations, runtime chat behavior, dashboard/widget/embed changes, OAuth/provider setup, external API/provider execution, package activation enforcement, or secrets.

Connected Apps Phase 5 implements only the generic persistence and internal service foundation from that plan: `connected_app_connections`, `agent_connected_app_enablements`, and `src/services/integrations/connectedAppConnectionService.js`. It still adds no user-facing setup, OAuth/provider setup, runtime chat behavior, dashboard/widget/embed changes, external API/provider execution, package activation enforcement, or secrets.

Connected Apps Phase 6 adds `src/services/integrations/connectedAppReadinessContextService.js`, an explicit report-only adapter from the Phase 5 generic records into the Phase 2 readiness service input shape. It still adds no user-facing setup, OAuth/provider setup, runtime chat behavior, dashboard/widget/embed changes, external API/provider execution, package activation enforcement, provider-specific legacy table inference, or secrets.

Connected Apps Phase 7 adds authenticated owner-scoped `/agents/...` API routes over the registry and generic records. The API is for internal/manual owner setup and status review only. It does not add OAuth/provider setup, provider execution, runtime chat behavior, widget/embed exposure, package activation enforcement, public chat/tool use, or secrets.

Connected Apps Phase 8 adds a compact authenticated dashboard/settings surface over the Phase 7 routes. It lists registry capabilities, owner connection status records, agent enablements, approval mode, allowed non-public surfaces, and report-only readiness. It can create manual/status-only connection records, update connection status, and create/update agent enablements. It does not add OAuth setup, provider setup, provider execution, runtime chat behavior, widget/embed exposure, package activation enforcement, public/anonymous routes, package switching, or secrets.

Connected Apps Phase 9 adds `src/services/integrations/googleConnectedAppAdapter.js` for Google Calendar only. The adapter mirrors successful existing Google Calendar connections and token-refresh issue states into `connected_app_connections` with redacted provider account label, capability keys, granted scope metadata, and status. It does not add new Google scopes, does not create a new OAuth flow, does not create agent enablements automatically, does not add public chat/tool execution, and does not expose tokens or OAuth codes.

Connected Apps Phase 10 adds three WhatsApp Business capability declarations: inbound webhook readiness, approved-template outbound messaging, and customer-service-window session replies. They are registry/report metadata and not generic execution grants. The manual reply service can use `whatsapp.business.send.session.reply` only through the authenticated owner route when the server feature flag, owner connection, optional agent enablement, session window, destination lookup, server-side credentials, and manual staff actor all pass. Template sends remain blocked until approved-template support is explicitly implemented. Registry data does not expose access tokens, app secrets, verify tokens, webhook secrets, provider payloads, or phone numbers.

Connected Apps Phase 11 adds `src/services/integrations/whatsappWebhookService.js` and `/integrations/whatsapp/webhook/:connectionId` for GET verification and POST readiness metadata only. GET handles Meta `hub.mode`, `hub.verify_token`, and `hub.challenge` verification against a derived verifier reference stored outside public metadata. POST recognizes `whatsapp_business_account` payloads and message/status event types only enough to update safe metadata. It does not process inbound messages, send replies, create chat messages, create action requests, validate app-secret signatures yet, start Meta OAuth/Embedded Signup, call the WhatsApp Cloud API, call Twilio WhatsApp APIs, or enforce package activation.

Connected Apps Phase 12 extends that service with pure helpers for Meta `X-Hub-Signature-256` validation, using HMAC-SHA256 over the raw POST body and constant-time comparison for valid `sha256=<hex>` signatures. The route now preserves raw JSON bytes, but because the current generic schema has no safe app-secret/signing-secret store, production POST handling records `lastWebhookSignatureStatus = not_configured` unless a future service-only secret provider supplies an app secret. Phase 12 also normalizes WhatsApp message/status/unknown events into redacted internal summaries and persists only aggregate metadata such as event types and message types. It does not persist full provider payloads, message body text, customer phone numbers, profile names, or normalized event rows.

Connected Apps Phase 13 adds `connected_app_inbound_events` and `connectedAppInboundEventService` for redacted inbound event storage only. WhatsApp POST writes one row per safe normalized message/status/unknown summary after validation, with owner/connection scope and message-derived dedupe where possible. It stores no full provider payload, sender phone number, contact profile name, contacts array, outbound reply, chat message, lead, action request, booking request, or contact record. The later AI draft milestone adds nullable `normalized_message_text` only for safe owner-scoped WhatsApp inbound message context; service validation rejects phone/email/URL/secret-looking text and the standard inbound event DTO does not expose it.

Connected Apps Phase 14 adds `connected_app_inbound_threads` and `connectedAppInboundThreadService` for manual read-only staff inbox grouping only. WhatsApp POST resolves message/status events into threads using a hashed external conversation key and the safe label `WhatsApp conversation`. It increments unread count only for inbound message events, does not increment for delivery/status events, and reuses existing event/thread state for duplicate webhook retries. The manual reply milestone adds `connected_app_outbound_messages`, `whatsappManualReplyService`, `POST /agents/connected-app-inbound-threads/reply`, and dashboard manual composer controls. The AI draft milestone adds `whatsappAiReplyDraftService`, `POST /agents/connected-app-inbound-threads/ai-draft`, and dashboard draft controls that populate the manual composer only. Those controls are feature-flagged off by default and remain staff/manual only: no automatic send, no send-AI shortcut, no phone number display, no token inputs, no provider payload fields, no public chat path, and no widget/embed behavior.

## Current Capabilities

The Phase 1 registry lists these provider-specific capabilities:

- `google.calendar.read`
- `google.calendar.write`
- `google.gmail.read`
- `calendly.booking.webhook`
- `stripe.billing.webhook`
- `twilio.phone.webhook`
- `whatsapp.business.webhook`
- `whatsapp.business.send.template`
- `whatsapp.business.send.session.reply`

Each declaration includes provider, app name, capability, status, owner/agent scoping flags, OAuth/webhook/secret requirements, allowed surfaces, proof sources, existing code references, and safety notes.

Every current declaration has:

- `publicChatCallable: false`
- `packageActivatable: false`

Some declarations have `externalExecution: true` because existing provider-specific operator workflows can execute Google Calendar/Gmail API calls after their own route auth, owner/agent checks, connection checks, and scope checks. WhatsApp send capabilities keep `externalExecution: false` in the registry because the manual reply route is provider-specific and feature-flagged, not generic connected-app execution. The flag is descriptive only. It is not a generic execution permission.

## Existing Provider Boundaries

Google remains the provider-specific operator workspace integration. Google Calendar is now the first adapter into the generic Connected Apps records, but OAuth start/callback, encrypted token storage, refresh, sync, and approved Calendar mutations remain in the existing Google operator workflow. Gmail exists only inside that Google operator workspace.

Calendly remains a signed booking webhook proof integration. It does not let public chat book, cancel, reschedule, or check live availability.

Stripe remains owner billing infrastructure. Stripe webhooks and checkout state are not agent connected-app grants.

Twilio remains admin/provider-specific phone webhook infrastructure. It is not an owner self-serve connected-app setup surface.

WhatsApp Business started as a Phase 10-14 Connected Apps capability foundation. Safe manual metadata may include a WhatsApp Business Account ID, phone number ID, business display name, webhook verification status, Graph API version, webhook verification timestamp, last webhook receipt timestamp, last webhook object, safe event type names, safe message type names, and signature status. The current foundation has a verification/readiness webhook route, signature helpers, redacted normalization, redacted inbound event audit storage, nullable safe normalized message text for draft context, manual staff inbox thread grouping, a separate feature-flagged manual staff session-reply service, and a separate feature-flagged staff-approved AI draft service. It has no inbound chat handoff, no automatic replies, no AI-to-provider send, no template sender, no OAuth/Embedded Signup setup, and no Twilio WhatsApp path. Cloud API sending is limited to the manual staff route after server-side credentials and destination lookup are configured. Future WhatsApp work must separately handle service-only app-secret storage/signing-secret references, full signature enforcement, richer consent/session proof, and approved template management.

## Helper Contract

The registry exposes pure helpers only:

- `getConnectedAppCapability(key)`
- `listConnectedAppCapabilities()`
- `listConnectedAppCapabilitiesForProvider(provider)`
- `hasConnectedAppCapability(key)`
- `validateConnectedAppCapabilityDeclarations(keys)`

Unknown and malformed keys fail closed. Returned data is copy-safe and frozen.

## Phase 2 Readiness Service

The readiness service exposes pure helpers only:

- `evaluateConnectedAppReadiness(input)`
- `listConnectedAppReadinessRequirements(input)`

The input is a plain object for tests and future adapters. It can include package key, agent id, required and optional capability keys, connected capabilities, provider statuses, scope grants, webhook statuses, approval mode, surface, and whether execution was requested.

Readiness is report-only:

- Unknown required capabilities block.
- Missing required capabilities block.
- Missing optional capabilities warn.
- Required capabilities block when their provider status is `disabled` or `needs_attention`.
- Required OAuth capabilities block without a supplied scope grant.
- Required webhook capabilities block without a supplied active webhook status.
- Execution requests block unless every required capability is connected and the registry definition allows external execution for the requested surface.
- Public chat execution remains blocked for all current capabilities.

The readiness output is redacted and copy-safe. It returns status codes, registry metadata, booleans, and fixed messages only. It does not return secrets, tokens, OAuth URLs, webhook URLs, provider clients, account ids, or copied provider payloads.

## Phase 3 Activation Readiness Reporting

Package activation readiness can accept optional connected-app context under `connectedApps`:

- `requiredCapabilities`
- `optionalCapabilities`
- `connectedCapabilities`
- `providerStatuses`
- `scopeGrants`
- `webhookStatuses`
- `approvalMode`
- `surface`
- `executionRequested`

When that context is present, activation readiness calls `evaluateConnectedAppReadiness()` and attaches the redacted result as report-only `connectedApps` metadata. The existing activation requirements, activation summary, and activation status remain based on package activation checks only. A blocked connected-app report is not package activation enforcement in this phase.

When no connected-app context is supplied, current packages behave as before and the activation readiness output omits connected-app metadata.

## Phase 6 Generic Record Readiness Context

The readiness context helper exposes:

- `buildConnectedAppReadinessContext(supabase, input)`

Input includes `ownerUserId`, `agentId`, `packageKey`, optional required capabilities, optional capabilities, optional surface, and optional execution-request state.

The helper reads only `connected_app_connections` and `agent_connected_app_enablements`. A capability is emitted as connected only when the owner-scoped connection is `active`, the same owner/agent has an enabled enablement for that connection, and the capability appears on both records. Scope grants come from connection scopes but are returned as known capability grants only. Webhook status comes from the connection `webhook_status`. Approval mode and default surface come from matching enablement records.

This helper is explicit: activation readiness does not query Supabase automatically. Callers or tests can build the context first, then pass it to `evaluateConnectedAppReadiness()` or to activation readiness under `context.connectedApps`.

The helper output is redacted and provider-neutral. It does not expose token refs, raw secrets, metadata secrets, OAuth URLs, webhook signing material, provider clients, account payloads, or copied provider responses. It does not call providers and does not query Google, Calendly, Stripe, Twilio, WhatsApp, or other provider-specific legacy tables. Phase 9 performs Google Calendar mirroring before this helper reads the generic records.

## Phase 7 Authenticated API Exposure

`src/routes/agentRoutes.js` exposes the registry and generic record status through authenticated owner routes only:

- `GET /agents/connected-app-capabilities`
- `GET /agents/connected-apps`
- `POST /agents/connected-apps`
- `POST /agents/connected-apps/status`
- `GET /agents/:agentId/connected-apps`
- `POST /agents/:agentId/connected-apps`
- `GET /agents/:agentId/connected-app-readiness`
- `GET /agents/connected-app-inbound-threads`
- `POST /agents/connected-app-inbound-threads/status`
- `POST /agents/connected-app-inbound-threads/ai-draft`
- `POST /agents/connected-app-inbound-threads/reply`
- `GET /agents/connected-app-inbound-events`

The capability route returns a safe projection of registry metadata. It deliberately does not expose executable handlers, provider clients, OAuth URLs, webhook URLs, token refs, raw encrypted fields, tokens, or secrets. Every current returned capability has `publicChatCallable: false`.

The owner connection routes are scoped to the authenticated owner. They can record generic provider/app/capability status, redacted account labels, scope names, webhook status, needs-attention reason, and redacted metadata. They reject raw token, secret, token-secret-ref, OAuth URL, provider client, handler, and execution fields. They do not call providers or create OAuth/provider setup artifacts.

The agent enablement routes verify owner access to the URL agent, validate that the selected connection belongs to the same owner, and validate that enabled capabilities exist on the selected connection. Allowed surfaces must stay non-public under the service rules. The readiness route builds a report-only context from the generic records and evaluates the existing readiness service; it does not enforce package activation or provider execution.

## Phase 8-14 Authenticated Dashboard Surface

The dashboard/settings surface fetches `GET /agents/connected-app-capabilities`, `GET /agents/connected-apps`, `GET /agents/:agentId/connected-apps`, `GET /agents/:agentId/connected-app-readiness`, `GET /agents/connected-app-inbound-threads`, and `GET /agents/connected-app-inbound-events` for the selected/current agent. It shows provider labels, capability labels, connection status, provider account label, scopes/capability summary, webhook status, agent enablement status, approval mode, allowed surfaces, report-only readiness warnings, redacted inbound thread status, unread counts, safe labels, recent redacted events, AI draft feature status, and manual reply feature status.

The surface now labels the Google Calendar adapter as `Uses existing Google connection flow`, `No chat execution`, `No provider action without approval`, and `Report-only readiness`. WhatsApp Business inbox copy is explicit: `AI draft only`, `Staff must review before sending`, and `No automatic WhatsApp replies`. AI drafts populate the existing manual composer and the manual send button remains the only send path. Manual/status-only controls remain for non-adapter records. It does not show or accept raw token, secret, OAuth URL, webhook URL, provider client, handler, execution, public chat callable, package selector, package switching controls, WhatsApp app-secret inputs, WhatsApp token inputs, send-AI controls, auto-send controls, handoff controls, template-management UI, destination/phone inputs, provider payload fields, or customer phone number display.

## Non-Goals

- No new OAuth start, callback, scope, or provider setup flow. Google Calendar reuses the existing Google operator connection flow.
- No provider client construction.
- No executable handler metadata.
- No external API calls from the generic registry/readiness surface. The separate manual WhatsApp staff route can call Cloud API only after feature flag, owner/connection/capability/agent/session-window, server-side credential, and destination checks pass.
- No public chat provider execution.
- No widget or embed change.
- No package activation enforcement.
- No secrets, tokens, OAuth URLs, webhook URLs, account ids, or credentials in registry data.
- No OAuth/provider setup surface.
- No runtime permission enforcement.
- No automatic provider-specific legacy table inference in Phase 6. Google Calendar mirroring is explicit in Phase 9.
- No public or anonymous connected-app API route.
- No widget/embed exposure in Phase 7-8.
- No package activation enforcement through Phase 7 routes or Phase 8-14 dashboard controls.
- No WhatsApp inbound chat processing, automatic outbound sender, Meta OAuth/Embedded Signup, Twilio WhatsApp API call, full app-secret signature enforcement without future secret storage, automatic WhatsApp reply, AI-to-provider send, chat handoff, or package activation enforcement through the manual reply and AI draft milestones.

## Future Manifest Relationship

Package manifests may later declare optional `connectedAppRequirements` for readiness reporting. A requirement declaration must not be treated as a connected app grant, provider scope, OAuth permission, package activation rule, or runtime permission.

Current registered packages do not require connected apps. If a future manifest declares `connectedAppRequirements`, the readiness service may report missing or ready capabilities only when activation/reporting code explicitly supplies connected-app context. It must remain optional/report-only until a separate activation and runtime permission phase is explicitly implemented.

Before any provider execution can become generic, Vonza still needs explicit owner connection records, agent enablements, package grants, scope/capability checks, approval mode, audit logging, and a central runtime permission service.

The Phase 4 data model keeps those future pieces separate:

- `connected_app_connections` represents an owner/workspace connection status record only.
- `agent_connected_app_enablements` represents an owner-approved capability subset for one agent only.
- `connected_app_webhooks` would represent webhook endpoint/proof state only.

Phase 5 implements the first two records as persistence only. Those records are not enough by themselves to authorize provider execution, and the webhook registry remains future work.
