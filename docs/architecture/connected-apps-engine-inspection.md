# Connected Apps Engine Inspection

Inspection date: 2026-06-02

This is an inspection, architecture, and contract-test planning document. Phase 5 now implements the minimal generic persistence and internal service foundation only. Phase 6 now derives report-only readiness context from those generic records. Phase 7 now exposes authenticated owner-scoped API routes over the registry and generic records only. Phase 8 now exposes those routes through an authenticated dashboard/settings management surface only. Phase 9 now implements the Google Calendar adapter by mirroring the existing Google operator connection into generic records. Phase 10 now adds the WhatsApp Business capability foundation as metadata, manual/status-only connection representation, readiness, dashboard copy, docs, and tests only. Phase 11 adds WhatsApp webhook verification/readiness. Phase 12 adds WhatsApp POST signature helpers and safe inbound event normalization only. These phases do not implement runtime chat behavior, widget/embed behavior, a new generic OAuth provider, generic webhook provider, WhatsApp message sender, package activation rule, generic external provider execution, public chat/tool use, or tool execution path.

## Executive summary

Vonza now has a minimal generic Connected Apps persistence/service foundation, authenticated owner-scoped status/readiness API routes, a compact authenticated dashboard management surface for those records, and Google Calendar as the first adapter into that generic model. It still does not have a generic OAuth/provider setup or execution engine.

The current repo has several external app integrations and integration-like records, but they are provider-specific:

- Google OAuth for the operator workspace, with Google Calendar as the default required scope and optional Gmail/Calendar write scopes.
- Calendly webhook provisioning and signed webhook ingestion for trusted booking-confirmation outcomes.
- Stripe hosted checkout, subscription webhooks, billing sync, and entitlement shadow logging.
- Twilio phone webhooks for inbound/status callbacks, backed by admin-assigned phone-number records.
- WhatsApp Business capability metadata for webhook readiness, future approved template messages, and future customer-service-window session replies. Phase 12 is still foundation-only and does not send WhatsApp messages, hand off inbound messages to chat, or generate AI replies.
- Package tools and action requests that are explicitly metadata-only or staff-review-only, not executable connected-app permissions.

The reusable pieces are patterns, not an engine: owner/agent scoping, hashed OAuth/webhook state tokens, AES-GCM encrypted secrets, provider scope summaries, route rate limiting, webhook signature validation, service-role-only server workflows, audit logs, readiness probes, and report-only/draft-first product boundaries.

The highest-risk gap for a future generic Connected Apps engine is that "provider connected" is not a complete authorization decision. Existing code can execute provider calls only inside Google operator workflows after route auth, owner/agent access checks, connection status checks, and scope checks. A generic engine needs a separate runtime permission check that proves: owner has the app connected, the agent is enabled to use it, the provider scopes/capabilities satisfy the action, the package is allowed to request that capability, the operation has the required human approval mode, and the public chat path is not the executor.

Phase 1 adds a report-only connected app capability registry in `src/services/integrations/connectedAppRegistry.js`. It describes known provider-specific capabilities only. It adds no schema, provider execution, chat behavior, dashboard controls, package activation, OAuth setup, provider clients, or self-serve connection flow. The standalone registry contract is documented in `docs/architecture/connected-app-capability-registry.md`.

Phase 2 adds a report-only readiness service in `src/services/integrations/connectedAppReadinessService.js`. It evaluates supplied package/agent readiness context against the Phase 1 registry and returns `ready`, `warning`, or `blocked` requirement details. It is pure service/test/doc work: no schema, migrations, runtime chat changes, dashboard/widget/embed changes, OAuth setup, provider execution, external API calls, package activation enforcement, or secrets.

Phase 5 adds `connected_app_connections`, `agent_connected_app_enablements`, and `src/services/integrations/connectedAppConnectionService.js` as generic persistence/service foundation only. It creates no OAuth flow, user-facing setup, dashboard/widget/embed surface, runtime chat behavior, provider clients, external API/provider execution, or package activation enforcement.

Phase 6 adds `src/services/integrations/connectedAppReadinessContextService.js` as an explicit service adapter that reads the generic connection and enablement records and builds plain input for the report-only readiness evaluator. It does not query provider-specific legacy tables, call providers, set up OAuth, enforce activation, or execute external APIs.

Phase 7 adds authenticated owner-scoped Connected Apps routes under `src/routes/agentRoutes.js`: `GET /agents/connected-app-capabilities`, `GET /agents/connected-apps`, `POST /agents/connected-apps`, `POST /agents/connected-apps/status`, `GET /agents/:agentId/connected-apps`, `POST /agents/:agentId/connected-apps`, and `GET /agents/:agentId/connected-app-readiness`. The routes use existing auth/agent-access conventions, return redacted registry/connection/enablement/readiness DTOs, and reject secret, token-ref, OAuth URL, provider client, handler, and execution fields. They do not add public/anonymous routes, OAuth/provider setup, provider execution, runtime chat behavior, widget/embed exposure, or package activation enforcement.

Phase 8 adds an authenticated dashboard/settings `Connected apps` surface. It fetches the Phase 7 capability, connection, agent enablement, and readiness endpoints; shows provider/capability labels, connection status, account label, scopes/capabilities, webhook status, agent enablement, approval mode, allowed surfaces, and report-only readiness; and posts only manual/status-only connection, status, and enablement updates. It does not add schema/migration changes, OAuth/provider setup, provider execution, runtime chat behavior, widget/embed exposure, package activation enforcement, package switching, public/anonymous routes, or secrets.

Phase 9 adds a Google Calendar adapter in `src/services/integrations/googleConnectedAppAdapter.js`. The existing Google OAuth start/callback, state storage, encrypted token storage, refresh, sync, and approved Calendar mutation workflow remains the source of truth. The adapter mirrors redacted Calendar connection status into `connected_app_connections` and lets the existing generic enablement endpoint explicitly enable selected Calendar capabilities for an owned agent. It does not add new Google scopes, chat execution, widget/embed behavior, public routes, package activation enforcement, generic provider execution, or automatic agent enablement.

Phase 10 adds WhatsApp Business as a capability foundation only. Phase 11 adds scoped webhook verification/readiness. Phase 12 adds POST signature helpers and safe inbound event normalization. `whatsapp.business.webhook` represents verified inbound webhook readiness and requires an active generic webhook status before report-only readiness can become ready. `whatsapp.business.send.template` represents future approved-template outbound messaging. `whatsapp.business.send.session.reply` represents future replies inside an allowed customer-service window. All three capabilities have `publicChatCallable: false`, `packageActivatable: false`, and `externalExecution: false` in this phase.

## What external app integrations exist today

### Google operator workspace

Current code:

- `src/routes/agentRoutes.js`
  - `POST /agents/google/connect/start`
  - `GET /google/oauth/callback`
  - `GET /agents/operator-workspace`
  - operator inbox, calendar, campaign, task, contact, and activation endpoints
- `src/services/operator/operatorWorkspaceService.js`
- `src/services/operator/operatorActivationService.js`
- `db/connected_operator_workspace.sql`
- `db/schema.sql`

Current behavior:

- The owner starts Google OAuth from an authenticated dashboard route after `requireActiveAgentAccess`.
- OAuth state is stored in `google_oauth_states` with a hashed state token, owner id, agent id, business id, requested scopes, redirect path, selected mailbox, expiry, and status.
- The callback is public, but it resolves only through the stored hashed state token and exchanges the authorization code server-side.
- Tokens are encrypted into `google_connected_accounts`.
- The default scope set is calendar-first: Calendar read plus identity scopes.
- Optional scopes include Calendar write, Gmail read, Gmail compose, and Gmail send.
- Operator services can sync Gmail threads, sync Calendar events, send Gmail replies, create/update/cancel Calendar events, and send campaign email through Gmail, but those mutations are owner-authenticated dashboard/operator actions, not public chat execution.

Provider-specific parts:

- Table names are Google-specific: `google_oauth_states`, `google_connected_accounts`.
- URLs, scopes, token exchange, refresh, userinfo, Gmail, and Calendar APIs are hard-coded.
- Account capability mapping is Google-scope-specific.
- `operator_*` inbox/calendar records reference `google_connected_accounts`.

Reusable parts:

- OAuth state record pattern.
- Hashed one-time state token.
- Expiring state lifecycle.
- Encrypted access/refresh tokens.
- Scope to capability summary.
- Account status and last-error handling.
- Connection/audit logs.
- Owner/agent/business scoping.
- Readiness probes for feature flag, env config, and schema.

### Calendly booking webhook

Current code:

- `src/routes/bookingRoutes.js`
- `src/services/bookings/bookingIntegrationService.js`
- `src/services/bookings/calendlyProvider.js`
- `scripts/provision-calendly-webhook.js`
- `db/agent_booking_integrations.sql`
- `db/schema.sql`

Current behavior:

- Internal CLI provisioning creates an `agent_booking_integrations` row for provider `calendly`.
- The webhook endpoint token is generated and stored only as a hash.
- The webhook signing secret is encrypted at rest with `BOOKING_WEBHOOK_ENCRYPTION_SECRET`.
- The public endpoint is `/bookings/webhooks/calendly/:token`.
- The route uses raw body parsing and booking webhook rate limiting.
- The service resolves by token hash, decrypts the signing secret, verifies Calendly HMAC signature and timestamp freshness, ignores unsupported events, checks active agent/owner scope, dedupes outcomes, and records a trusted `booking_confirmed` conversion outcome.

Provider-specific parts:

- `agent_booking_integrations.provider` is constrained to `calendly`.
- Webhook parser and signature scheme are Calendly-specific.
- The provisioning script is Calendly-only.
- The integration is booking-confirmation proof, not a generic app connection or executable tool.

Reusable parts:

- Hashed endpoint token.
- Encrypted webhook secret.
- Raw body route boundary.
- Signature and timestamp verification.
- Provider event-type filtering.
- Dedupe key pattern.
- Owner/agent active access check before accepting provider proof.

### Stripe billing

Current code:

- `src/routes/agentRoutes.js`
  - `POST /stripe/webhook`
  - `POST /create-checkout-session`
  - `POST /billing/change-plan`
- `src/services/billing/checkoutService.js`
- `src/services/billing/billingUsageService.js`
- `src/services/billing/stripeEntitlementShadowService.js`
- `db/schema.sql`

Current behavior:

- Authenticated owners can create hosted Stripe Checkout sessions.
- Checkout metadata carries `owner_user_id` and plan key.
- Checkout confirmation verifies session owner and paid status.
- Stripe webhooks use raw body parsing and `stripe.webhooks.constructEvent`.
- Subscription and checkout events sync owner billing and entitlement state.

Provider-specific parts:

- Stripe SDK, API version, Checkout Sessions, subscription items, and Stripe metadata shape are hard-coded.
- Billing records are owner-level, not agent-level connected apps.
- Stripe public/dashboard billing is not a generic provider permission surface.

Reusable parts:

- Raw body webhook verification.
- Owner metadata binding.
- Server-only secret usage.
- Owner-scoped billing record.
- Environment readiness requirements.

### Twilio phone webhooks

Current code:

- `src/routes/phoneRoutes.js`
- `src/services/phone/twilioWebhookService.js`
- `src/services/phone/phoneNumberService.js`
- `src/services/phone/phoneCallSessionService.js`
- `db/schema.sql`

Current behavior:

- Admin endpoints assign Twilio phone numbers to agents.
- Public Twilio inbound/status routes parse form-encoded bodies, apply rate limiting, and validate `X-Twilio-Signature`.
- Inbound calls are allowed only when the assigned number is active, phone channel is enabled, agent owner scope matches, agent access is active, billing is not capped, and caller rate limits pass.
- Call sessions are recorded in `agent_phone_call_sessions`.

Provider-specific parts:

- `agent_phone_numbers.provider` and `agent_phone_call_sessions.provider` are constrained to `twilio`.
- Twilio signature validation and form parameters are hard-coded.
- This is phone-channel infrastructure, not a general app connection.

Reusable parts:

- Provider-number assignment.
- Owner/agent/business scoping.
- Signature validation.
- Readiness checks before provider response.
- Per-caller rate limiting.

### WhatsApp Business capability foundation

Current code:

- `src/services/integrations/connectedAppRegistry.js`
- `src/services/integrations/connectedAppConnectionService.js`
- `src/services/integrations/connectedAppReadinessService.js`
- `src/services/integrations/connectedAppReadinessContextService.js`
- `src/services/integrations/whatsappWebhookService.js`
- `src/routes/agentRoutes.js`
- `src/routes/integrationRoutes.js`
- `frontend/settings/SettingsShell.js`
- `db/schema.sql`

Current behavior:

- Phase 10 adds `whatsapp.business.webhook`, `whatsapp.business.send.template`, and `whatsapp.business.send.session.reply` to the report-only registry.
- Authenticated owners can represent WhatsApp Business manual/status-only connection state with safe non-secret metadata in `connected_app_connections`.
- Safe metadata can include WhatsApp Business Account ID, phone number ID, display phone number, business display name, webhook verification status, Graph API version, webhook verified timestamp, last webhook receipt timestamp, last webhook object, safe event type names, safe message type names, and signature status.
- `whatsapp.business.webhook` can be report-ready only when a manual active connection, explicit agent enablement, and active generic webhook status exist.
- Template and session-reply capabilities can be report-ready for non-execution checks when a manual active connection and explicit agent enablement exist.
- Phase 11 adds `/integrations/whatsapp/webhook/:connectionId` for webhook verification/readiness only.
- Phase 12 validates `X-Hub-Signature-256` with HMAC-SHA256 when a service-only app secret is supplied, and otherwise records `not_configured` rather than a false verified status.
- Phase 12 normalizes inbound message/status/unknown events into redacted summaries only; it does not process inbound messages into chat or persist provider payloads.
- Execution requests remain blocked because WhatsApp definitions are not externally executable in this phase.
- Public chat execution remains blocked even when manual connection and enablement records exist.

Provider-specific parts:

- No WhatsApp Cloud API client exists.
- No Meta OAuth or Embedded Signup flow exists.
- The public WhatsApp webhook route exists only for verification/readiness metadata.
- No inbound WhatsApp message processor exists.
- No inbound chat handoff exists.
- No AI reply path exists.
- No outbound template or session reply sender exists.
- No Twilio WhatsApp API path exists.
- Token, app-secret, verify-token, webhook-secret, and access-token-looking fields are rejected at generic owner route/service boundaries.
- Full app-secret signature validation remains future until service-only app-secret storage or provider-specific signing-secret references exist.

Reusable parts:

- Generic owner connection and agent enablement records can safely represent non-secret readiness status.
- Readiness can separate inbound webhook readiness from future template and session-reply capabilities.
- Dashboard copy can expose provider foundation status without adding credential fields or execution buttons.
- Signature helper code can be reused after future service-only secret storage/config exists.
- Future WhatsApp work must separate inbound webhooks, session replies, and approved template messages.

### Gmail and Google connected tool references

Gmail exists only as part of the Google operator workspace. It is not a separate Gmail app registry entry.

The code has optional Google Gmail scopes and methods for Gmail read/send. Dashboard copy often keeps Email, Calendar, and Automations informational or beta-gated unless the operator workspace is enabled and connected.

### Booking/provider integration code

Booking has two different concepts:

- Booking route and Calendly webhook proof.
- Generic `agent_booking_requests` for staff-review requests.

Neither is a generic connected app engine. `agent_booking_integrations` is provider-specific and constrained to Calendly. `agent_booking_requests` is request-only and does not execute providers.

### Webhook signature and rate-limit handling

Current webhook protection:

- Stripe: raw body, Stripe signature construction, env-required webhook secret.
- Calendly: raw body, endpoint token hash, encrypted webhook secret, HMAC signature verification, timestamp freshness, route rate limit.
- Twilio: form body, Twilio signature validation against request URL candidates, route rate limit, caller rate limit.

Current rate-limit utility includes public chat, voice, phone webhook, booking webhook, widget bootstrap, install signals, auth-adjacent paths, and install verify. Production-like deploys require distributed rate limiting.

## Current data model and scoping

### Generic versus provider-specific

Provider-specific:

- `google_oauth_states`
- `google_connected_accounts`
- `agent_booking_integrations` constrained to `calendly`
- `agent_phone_numbers` constrained to `twilio`
- `agent_phone_call_sessions` constrained to `twilio`
- `owner_billing_accounts` and `owner_product_entitlements` store Stripe ids and billing state

Reusable but not generic connected-app records:

- `operator_audit_logs`
- `operator_workspace_activations`
- `operator_inbox_threads`
- `operator_inbox_messages`
- `operator_calendar_events`
- `operator_campaigns`
- `operator_campaign_steps`
- `operator_campaign_recipients`
- `operator_tasks`
- `agent_booking_requests`
- `agent_action_requests`
- `agent_conversion_outcomes`

Phase 5 generic foundation tables:

- `connected_app_connections` owner-scoped connection status records.
- `agent_connected_app_enablements` agent-scoped capability enablement records.

Still missing generic tables:

- `connected_apps` registry or manifest table.
- `connected_app_capabilities` or normalized scope/capability grants.
- `connected_app_webhook_endpoints` or `connected_app_webhooks`.
- `connected_app_oauth_states`.
- `connected_app_audit_events` independent of the Google operator workspace.
- Package requirement records such as `package_requires_app_capability`.

### Scoping present today

Owner/agent/business scoping is common but inconsistent in level:

- Google connection rows include `agent_id`, `business_id`, and `owner_user_id`.
- Calendly integration rows include `agent_id` and `owner_user_id`.
- Twilio phone numbers and sessions include `agent_id`, `business_id`, and `owner_user_id`.
- Stripe billing is owner-level.
- Package action requests include `owner_user_id`, `agent_id`, `business_id`, and `package_key`.
- Operator records generally include `agent_id`, `business_id`, and `owner_user_id`.

This means current integrations are mostly agent/workspace bound, but there is no explicit "owner connection, then optionally enable for agent A/package B" model.

### RLS and service-role expectations

`db/schema.sql` enables RLS for the integration-adjacent tables, including booking integrations, booking requests, phone numbers, phone call sessions, Google state/accounts, operator records, billing accounts, product entitlements, and usage ledger.

Policy coverage is not uniform:

- Owner policies exist for booking integrations, booking request reads, phone numbers, phone sessions, operator contacts, operator contact identities, operator tasks, operator business profiles, copilot proposal states, billing account reads, entitlements reads, and usage reads.
- The canonical policy section does not define explicit owner policies for `google_oauth_states`, `google_connected_accounts`, `operator_inbox_threads`, `operator_inbox_messages`, `operator_calendar_events`, `operator_campaigns`, `operator_campaign_steps`, `operator_campaign_recipients`, `operator_workspace_activations`, or `operator_audit_logs`.

The server uses Supabase service-role access for many backend workflows, and authenticated routes enforce owner/agent access in application code before calling services. For a generic Connected Apps engine, this should be made explicit: public/client visibility should be read-only and redacted, while token-bearing records remain server-only. The Phase 5 generic tables follow owner-select-only RLS and service/internal write expectations.

### Secret and token storage

Stored:

- Google access and refresh tokens are encrypted in `google_connected_accounts`.
- Calendly webhook signing secrets are encrypted in `agent_booking_integrations`.
- OAuth/webhook endpoint tokens are stored as hashes.

Not stored in DB as generic app secrets:

- Stripe secret key and webhook secret are env-only.
- Twilio auth token is env-only.
- Google client secret and token encryption secret are env-only.
- Calendly webhook encryption secret is env-only.

Public bundles should not include provider secrets. Existing frontend references provider status and public links, not secret values.

## Current routes, webhooks, and OAuth flows

### Public or provider-callback routes

- `POST /stripe/webhook`
  - Public provider callback.
  - Raw body.
  - Stripe signature required.
  - Syncs owner billing from trusted Stripe events.

- `POST /bookings/webhooks/calendly/:token`
  - Public provider callback.
  - Raw body.
  - Endpoint token hash lookup and Calendly signature required.
  - Records trusted booking outcome only after scope and active-agent checks.

- `POST /phone/twilio/inbound`
  - Public provider callback.
  - Form body.
  - Twilio signature required.
  - Returns TwiML and records call session.

- `POST /phone/twilio/status`
  - Public provider callback.
  - Form body.
  - Twilio signature required.
  - Updates call session state.

- `GET /google/oauth/callback`
  - Public OAuth callback.
  - Requires valid stored state token.
  - Exchanges code server-side.
  - Stores encrypted tokens and marks connection complete.

### Authenticated owner routes

- `GET /agents/connected-app-capabilities`
  - Authenticated owner route.
  - Returns safe connected-app registry metadata only.
  - Does not expose handlers, provider clients, token refs, raw encrypted fields, secrets, OAuth URLs, or webhook URLs.
  - Every current capability remains `publicChatCallable: false`.

- `GET /agents/connected-apps`
  - Authenticated owner route.
  - Lists only the owner's generic `connected_app_connections` records.
  - Supports `provider` and `status` filters.

- `POST /agents/connected-apps`
  - Authenticated owner route.
  - Creates a generic owner connection status/configuration record only.
  - Rejects raw token, secret, token-secret-ref, OAuth URL, provider client, handler, and execution fields.
  - Does not call providers or create OAuth/webhook setup.

- `POST /agents/connected-apps/status`
  - Authenticated owner route.
  - Updates only the owner's connection status, webhook status, needs-attention reason, last verification timestamp, and redacted metadata.
  - Rejects secret/token/OAuth/provider execution fields.

- `GET /agents/:agentId/connected-apps`
  - Authenticated owner route.
  - Verifies owner access to the agent before listing that agent's generic enablements.
  - Can optionally include derived report-only readiness context/report.

- `POST /agents/:agentId/connected-apps`
  - Authenticated owner route.
  - Verifies owner access to the agent before creating or updating an enablement.
  - Validates the connection belongs to the owner and that each requested capability exists on the selected connection.
  - Accepts enabled state, approval mode, non-public allowed surfaces, optional package key, and redacted metadata only.

- `GET /agents/:agentId/connected-app-readiness`
  - Authenticated owner route.
  - Verifies owner access to the agent, derives generic-record readiness context, and evaluates report-only readiness.
  - Does not enforce package activation or execute providers.

- `POST /agents/google/connect/start`
  - Starts Google OAuth after authentication and active agent access.

- `GET /agents/operator-workspace`
  - Loads operator state and can force sync.

- `POST /agents/operator/inbox/draft-reply`
  - Drafts a local reply.

- `POST /agents/operator/inbox/send-reply`
  - Sends through Gmail only when Google is connected and `gmailSend` capability exists.

- `POST /agents/operator/calendar/draft`
  - Drafts local calendar mutation.

- `POST /agents/operator/calendar/approve`
  - Creates, updates, or cancels Google Calendar only when Google is connected and `calendarWrite` capability exists.

- `POST /agents/operator/campaigns/draft`
  - Drafts local campaign.

- `POST /agents/operator/campaigns/approve`
  - Marks campaign active locally.

- `POST /agents/operator/campaigns/send-due`
  - Sends through Gmail only when Google is connected and `gmailSend` capability exists.

- `GET /agents/action-requests` and `POST /agents/action-requests/status`
  - Staff-review action queue, not provider execution.

- `GET /agents/booking-requests` and `POST /agents/booking-requests/status`
  - Booking request review, not provider execution.

- `POST /create-checkout-session` and `POST /billing/change-plan`
  - Stripe billing actions for authenticated owners.

### Admin routes

- `GET /admin/phone-numbers`
- `POST /admin/phone-numbers/upsert`

Phone-number assignment is admin-only and audited. It is not self-serve connected-app setup.

## Current dashboard and settings surfaces

Dashboard/settings surfaces currently expose provider status in product-specific ways:

- Settings front-desk routing can detect Calendly booking links and show Calendly link/webhook readiness status.
- Operator workspace/home can show Google-connected status, Calendar context, Email/Calendar/Automations capability states, and Google connect buttons when feature gates and config allow.
- Email, Calendar, and Automations are frequently rendered as beta, planned, or informational areas when the workspace is not enabled or not self-serve.
- Billing is account-level plan management via Stripe, not a connected app setup surface.
- Phone/Twilio setup is admin-side, not an owner self-serve dashboard connection.

There is now a generic authenticated `Connected apps` dashboard/settings surface for manual/internal status records only. It lists provider/capability metadata, owner connection status records, agent enablements, and report-only readiness. It can create status-only records and update status/agent enablement, but it does not connect apps through OAuth, provision webhooks, store secrets, authorize packages, expose public chat tools, or execute providers.

## Current package, tool, and action relationship

### Package manifests

Packages currently declare:

- `key`
- `version`
- `label`
- `description`
- `supportedSurfaces`
- `actions`
- `tools`
- knowledge policy and package-specific metadata

They do not declare required or optional connected app capabilities. Future manifests may add optional `connectedAppRequirements` for readiness reporting, but that declaration would remain metadata only and would not grant provider permissions, start OAuth, enable package activation, or execute external providers.

### Connected app capability registry

`src/services/integrations/connectedAppRegistry.js` defines report-only metadata for current provider-specific capabilities:

- `google.calendar.read`
- `google.calendar.write`
- `google.gmail.read`
- `calendly.booking.webhook`
- `stripe.billing.webhook`
- `twilio.phone.webhook`

Every current registry entry has `publicChatCallable: false` and `packageActivatable: false`. The registry has no executable handlers, provider clients, tokens, secrets, OAuth URLs, webhook URLs, or external API calls. It returns frozen copy-safe data through helper functions only.

This registry is not a connected app setup surface. It is an inspection and readiness primitive for describing which provider-specific surfaces already exist and which generic engine pieces are still missing.

### Connected app readiness service

`src/services/integrations/connectedAppReadinessService.js` defines provider-neutral report-only readiness helpers:

- `evaluateConnectedAppReadiness(input)`
- `listConnectedAppReadinessRequirements(input)`

The input is intentionally plain-object/testable and not tied to Supabase. It accepts package key, agent id, required capabilities, optional capabilities, connected capabilities, provider statuses, scope grants, webhook statuses, approval mode, surface, and whether execution was requested.

The service reports:

- `ready` when the supplied metadata satisfies all declared required capabilities.
- `warning` when optional capabilities are missing or not ready.
- `blocked` when required capabilities are unknown, missing, disabled, in `needs_attention`, missing OAuth scope grants, missing active webhook status, or requesting execution that is not allowed by the registry and surface.

Public chat execution remains blocked for all current capabilities. The service does not call provider clients, Supabase, routes, chat services, dashboard code, widgets, embeds, OAuth endpoints, webhook provisioning, or external APIs. It returns redacted requirement details only and never returns secrets, tokens, OAuth URLs, webhook URLs, provider clients, or copied provider payloads.

### Connected app readiness context service

`src/services/integrations/connectedAppReadinessContextService.js` defines the explicit Phase 6 adapter:

- `buildConnectedAppReadinessContext(supabase, input)`

The helper reads owner-scoped `connected_app_connections` and owner/agent-scoped `agent_connected_app_enablements`. It emits a plain context object for `evaluateConnectedAppReadiness()` with required capabilities, optional capabilities, connected capabilities, provider statuses, scope grants, webhook statuses, approval mode, surface, and execution-request state.

A capability counts as connected only when the connection belongs to the owner, the connection status is `active`, the enablement belongs to the same owner and agent, the enablement is enabled, and the capability appears on both records. OAuth scope grants derive from connection scopes but are reduced to known capability grants. Webhook status derives from the connection `webhook_status`. Approval mode and default surface derive from the matching enablement.

The helper selects no token refs or metadata fields, returns no account payloads, and does not expose raw scopes that look like OAuth URLs. It does not call providers or infer capability state from Google, Calendly, Stripe, Twilio, WhatsApp, or other provider-specific legacy tables.

### Tool registry

`src/services/tools/toolRegistry.js` defines metadata-only tool declarations:

- `common.lead_capture`
- `common.contact_route`
- `common.booking_link`
- `common.human_handoff`
- `hotel.booking_availability`

These are not executable handlers. The hotel booking availability tool is planned metadata only and explicitly requires live booking evidence before stronger claims.

### Action request registry

`src/services/actions/actionRequestRegistry.js` defines staff-visible action request types for Hotel Concierge. Current definitions have:

- `requiresStaffAction: true`
- `requiresIntegration: false`
- `externalExecution: false`

`agentActionRequestService` rejects action definitions that require integrations or external execution for staff-visible request creation.

### Activation readiness

`agentPackageActivationReadinessService` includes an `integrations` context with fields such as `liveBooking`, `pms`, and `externalExecutionEnabled`, but current behavior is readiness/reporting oriented. It does not create connected app permissions or runtime provider access.

### Runtime permission checks

The runtime can check some provider-specific capabilities today:

- Google account has `calendarRead`, `calendarWrite`, `gmailRead`, `gmailCompose`, and `gmailSend`.
- Operator mutation services check connected account status and required Google capability before execution.

The runtime still cannot use a generic permission decision for provider execution. The Phase 5 service can persist and list generic connection/enablement status, but no runtime provider path consumes those records yet.

## Security model and risks

### What is currently strong

- OAuth state is random, hashed at rest, expiring, and scoped to owner/agent/business.
- Google tokens and Calendly webhook secrets are encrypted at rest.
- Provider webhook routes use raw/form body handling appropriate to signature validation.
- Stripe, Calendly, and Twilio signatures are verified.
- Webhook and public routes are rate limited.
- Dashboard provider mutations require authenticated owner access to the active agent.
- Provider mutations check connection status and required scope/capability.
- Safe logging redacts secrets, tokens, emails, phone numbers, bearer tokens, JWTs, and common key patterns.
- Public chat and package action registries are intentionally not provider execution surfaces.

### Risks if external apps become generic

- Treating a provider connection row as execution permission would bypass package, agent, scope, and approval intent.
- Owner-level connection reuse across agents could leak data unless explicit agent enablement exists.
- Package declarations could be misread as permission to call external providers.
- Public chat could become an implicit executor if app actions are wired into chat without a hard runtime gate.
- RLS policy gaps on token-bearing or operator tables could become more serious if generic client-side surfaces query them directly.
- Secrets could be accidentally surfaced in public bundles if dashboard status payloads are not redacted by contract.
- Webhook routing could become ambiguous if providers share endpoint paths without a registry and signature contract.
- Provider-specific refresh/error states could create confused-deputy behavior if generic retries do not bind owner, agent, and provider account.
- High-impact actions such as Gmail send, campaign send, and Calendar write need stronger confirmation, audit, and possibly re-auth before broader launch.

## What is reusable

- OAuth start/callback pattern.
- Hashed OAuth state and webhook endpoint tokens.
- Encrypted token/secret storage helpers.
- Provider scope to internal capability mapping.
- Owner/agent/business scoping conventions.
- Public webhook raw-body and signature validation pattern.
- Rate-limit middleware.
- Operator audit log shape.
- Feature-gated readiness probes.
- Package manifest validation.
- Tool metadata and action request registries.
- Staff-review and draft-first action models.
- Booking request proof rules.
- Conversion outcome dedupe/proof patterns.

## What is provider-specific or one-off

- Google table names and services.
- Google scopes and Gmail/Calendar API execution.
- Google operator workspace activation fields.
- Calendly-only booking integration table constraint.
- Calendly-only webhook provisioning script and parser.
- Stripe billing tables/metadata and Checkout/subscription logic.
- Twilio-only phone-number and call-session provider constraints.
- Dashboard status copy for Email, Calendar, Automations, Calendly, billing, and phone.
- `operator_*` records that reference Google connected accounts directly.

## What is missing for a generic Connected Apps engine

Vonza needs an engine layer with these concepts before adding broad app connections:

- A generic app registry/manifest:
  - provider key, display label, auth type, OAuth config, webhook config, supported capabilities, required scopes, data sensitivity, execution modes, and dashboard visibility.

- Owner-scoped app connection records:
  - owner id, provider key, provider account id, display email/name, status, encrypted secrets/tokens, scope grants, capability grants, expiry/refresh state, last error, and redacted public status.

- Optional agent-scoped app enablement records:
  - owner id, agent id, connection id, provider key, enabled capabilities, package grants, status, and approval mode.

- Capability model:
  - normalized capabilities such as `calendar.read`, `calendar.write`, `email.read`, `email.send`, `booking.confirmation.read`, `crm.contact.write`, `staff.notification.send`.

- Webhook endpoint registry:
  - provider key, endpoint token hash, signing secret reference, allowed event types, owner/agent binding, status, replay/dedupe strategy, and handler contract.

- OAuth callback/state pattern:
  - generic state table with provider key, requested capabilities/scopes, redirect path, owner id, optional agent id, expiry, state hash, and status.

- Secret storage/encryption contract:
  - key rotation plan, encryption purpose labels, never-return-secret DTOs, and tests that public bundles/docs do not contain secret-like values.

- Package activation requirements:
  - package manifests can declare required and optional app capabilities, but that declaration is not permission.

- Runtime permission check:
  - a single service that checks package, agent, owner, provider, connection status, scope/capability grants, approval mode, billing/access, and operation risk before provider execution.

- Dashboard Connected Apps setup surface:
  - app catalog, connection status, agent enablement, package readiness, scope/capability explanation, disconnect/reconnect, and audit history.

- Report-only integration readiness first:
  - before execution, dashboard and activation services can report missing app capabilities for packages and agents.

## Recommended architecture direction

### Phase 1: report-only registry

Add a code-only connected app registry with capability declarations. Do not add schema yet.

Implemented Phase 1 fields:

- `key`
- `provider`
- `appName`
- `capability`
- `label`
- `description`
- `status`
- `ownerScoped`
- `agentScoped`
- `requiresOAuth`
- `requiresWebhook`
- `requiresSecret`
- `externalExecution`
- `publicChatCallable`
- `packageActivatable`
- `allowedSurfaces`
- `proofSources`
- `existingCodeRefs`
- `safetyNotes`

Use it to produce readiness output such as:

- "Google Calendar is available as a provider-specific operator integration today."
- "Calendly webhook proof exists, but it is not a generic app connection."
- "Hotel Concierge requires no executable external app capability today."
- "Future package X would require `calendar.read` and optional `email.send`."

Current Phase 1 behavior is metadata/service/tests/docs only. It does not expose a dashboard setup surface, create app connections, enforce package activation, call providers, or let public chat execute external apps.

### Phase 2: report-only readiness service

Add a provider-neutral readiness service over the Phase 1 registry. Do not add schema yet.

Implemented Phase 2 behavior:

- Evaluates required and optional connected app capability keys from a plain-object context.
- Blocks unknown required capabilities.
- Blocks missing required capabilities.
- Warns on missing optional capabilities.
- Blocks required capabilities when provider status is `disabled` or `needs_attention`.
- Blocks required OAuth capabilities without a supplied scope grant.
- Blocks required webhook capabilities without a supplied active webhook status.
- Blocks public chat execution for every current capability.
- Keeps execution requests report-only and blocked unless every required capability is connected and the registry allows external execution for the requested non-public surface.
- Returns copy-safe redacted readiness DTOs.

Current Phase 2 behavior is service/tests/docs only. It does not expose a user-facing Connected Apps setup surface, create connections, start OAuth, provision webhooks, enforce package activation, call providers, call external APIs, mutate runtime chat, or enable public chat execution.

### Phase 3: activation readiness reporting

Thread the report-only readiness service into package activation readiness reports.

Implemented Phase 3 behavior:

- `agentPackageActivationReadinessService` accepts optional `context.connectedApps`.
- The service passes only report inputs to `evaluateConnectedAppReadiness()`: required capabilities, optional capabilities, connected capabilities, provider statuses, scope grants, webhook statuses, approval mode, surface, and execution-request state.
- The activation readiness output can include a separate `connectedApps` metadata block with `status`, requirement entries, summary counts, and `reportOnly: true`.
- Connected-app metadata does not change the activation readiness `status`, does not add activation enforcement, and does not enable runtime provider execution.
- When no connected-app context is supplied, current package activation readiness output remains unchanged.
- The output remains redacted and must not include secrets, tokens, OAuth URLs, webhook URLs, provider clients, or copied provider payloads.

Current Phase 3 behavior is service/tests/docs only. It does not expose a user-facing Connected Apps setup surface, create connections, start OAuth, provision webhooks, enforce package activation, call providers, call external APIs, mutate runtime chat, change dashboard/widget/embed behavior, or enable public chat execution.

### Phase 4: generic connection model design

Phase 4 is docs/tests only. The detailed contract is `docs/architecture/connected-apps-data-model-plan.md`.

Design, but do not migrate immediately:

- `connected_app_connections`: future owner/workspace connection records with owner scope, provider, app key, capability keys, redacted provider account identity, status, scope grants, webhook status, token secret references or encrypted-token fields, last verification metadata, needs-attention reason, redacted metadata, and timestamps.
- `agent_connected_app_enablements`: future agent-level enablements that bind an owner, agent, connection, enabled capability subset, approval mode, allowed surfaces, optional package key, redacted metadata, and timestamps.
- `connected_app_webhooks`: future webhook endpoint/proof registry for provider event state, endpoint token hashes, signing secret references, provider webhook ids, allowed event keys, owner/connection/agent mapping, dedupe strategy, and status.
- Generic OAuth state/session contract: signed or hashed one-time state, owner binding, provider/app/capability binding, redirect allowlist, expiry, one-time use, and no secrets in URL/query parameters beyond provider `code` and `state`.
- Secret/token storage contract: raw tokens and signing secrets never reach frontend responses, package manifests, readiness DTOs, public logs, or public bundles; storage uses encryption or service-only secret references; rotation, revocation, redacted logging, and least-privilege scope mapping are required.
- Permission evaluation contract: provider execution must prove active owner connection, enabled agent capability, package declaration or explicit package allowance, sufficient scopes/webhook state, allowed surface, approval mode, billing/access state, audit logging, and execution policy. Public chat execution remains blocked by default.
- RLS/security model: owner-scoped redacted select only, no anon access, no public writes, service/internal writes first, separate secret material from status fields where practical, and audit logs for connect, reconnect, disconnect, scope change, enablement change, webhook verification, and execution decisions.

The model must not treat a provider connection row as runtime permission. Owner connection, agent enablement, package capability declaration, and operation approval remain separate checks.

Keep `db/schema.sql` canonical when a migration eventually happens. Phase 4 itself makes no schema or migration change.

### Phase 5: generic persistence and service foundation

Implemented Phase 5 behavior:

- Adds `public.connected_app_connections` for owner-scoped provider/app connection status.
- Adds `public.agent_connected_app_enablements` for owner-scoped agent capability enablements.
- Enables RLS on both tables.
- Adds authenticated owner-select-only policies.
- Keeps writes service/internal only by adding no authenticated write policies.
- Adds `src/services/integrations/connectedAppConnectionService.js` for create/list/status-update and enablement CRUD skeletons.
- Validates provider and capability keys against `connectedAppRegistry`.
- Rejects unknown capabilities, public surfaces, execution fields, provider clients, OAuth URL fields, and raw token/secret fields.
- Verifies the agent belongs to the owner before creating an enablement.
- Returns camelCase DTOs without raw tokens or token secret references.

Current Phase 5 behavior is schema/migration/service/tests/docs only. It does not expose a user-facing Connected Apps setup surface, start OAuth, provision webhooks, enforce package activation, call providers, call external APIs, mutate runtime chat, change dashboard/widget/embed behavior, or enable public chat execution.

### Phase 6: generic-record readiness context

Implemented Phase 6 behavior:

- Adds `src/services/integrations/connectedAppReadinessContextService.js`.
- Reads only `connected_app_connections` and `agent_connected_app_enablements`.
- Builds the plain context expected by `evaluateConnectedAppReadiness()`.
- Counts a capability as connected only when owner, agent, active connection, enabled enablement, and shared capability checks all pass.
- Derives OAuth grants from connection scopes, webhook status from connection webhook status, and approval mode/default surface from enablements.
- Keeps activation readiness pure: no automatic Supabase query is added to package activation readiness.
- Returns redacted context only and excludes token refs, metadata secrets, OAuth URLs, provider clients, and provider payloads.

Current Phase 6 behavior is service/tests/docs only. It does not expose a user-facing Connected Apps setup surface, start OAuth, provision webhooks, enforce package activation, call providers, call external APIs, mutate runtime chat, change dashboard/widget/embed behavior, or enable public chat execution.

### Phase 7: authenticated owner connected-app API

Implemented Phase 7 behavior:

- Adds authenticated owner-scoped Connected Apps routes under existing `/agents/...` dashboard API conventions.
- Exposes safe registry capability metadata without secrets, OAuth URLs, handlers, provider clients, or token refs.
- Lists, creates, and updates only the authenticated owner's generic connection status records.
- Lists, creates, and updates only agent enablements after owner access to the agent is verified.
- Validates connection owner scope, known capability keys, and capability membership on the selected connection.
- Builds report-only readiness context/report from generic records when requested.
- Rejects raw token, secret, token-secret-ref, OAuth URL, handler, provider client, public callable, and execution fields at the route/service boundary.
- Leaves every current capability `publicChatCallable: false`.

Current Phase 7 behavior is routes/service/tests/docs only. It does not add schema/migration changes, widget/embed exposure, runtime chat behavior, public/anonymous routes, OAuth/provider setup, provider webhook provisioning, external API/provider execution, package activation enforcement, runtime permission enforcement, provider-specific legacy adapters, or secrets.

### Phase 8: authenticated dashboard management surface

Implemented Phase 8 behavior:

- Adds a compact authenticated `Connected apps` surface in dashboard/settings.
- Fetches capability metadata, owner connection status records, selected-agent enablements, and selected-agent report-only readiness.
- Shows provider/capability labels, connection status, provider account label, scopes/capability summaries, webhook status, agent enablement status, approval mode, allowed surfaces, and readiness warnings.
- Creates manual/status-only owner connection records through `POST /agents/connected-apps`.
- Updates owner connection status through `POST /agents/connected-apps/status`.
- Creates or updates selected-agent enablements through `POST /agents/:agentId/connected-apps`.
- Labels manual records as status-only and labels the Google Calendar adapter as `Uses existing Google connection flow`, `No chat execution`, `No provider action without approval`, and `Report-only readiness`.
- Avoids raw token, secret, OAuth URL, webhook URL, provider client, executable handler, public chat callable, package selector, and package switching controls.

Current Phase 8 behavior is dashboard UI/tests/docs only. It does not add schema/migration changes, runtime chat behavior, widget/embed behavior, OAuth/provider setup, provider webhook provisioning, external API/provider execution, package activation enforcement, runtime permission enforcement, provider-specific legacy adapters, public/anonymous routes, package activation controls, package switching, or secrets.

### Phase 9: Google Calendar adapter

Implemented Phase 9 behavior:

- Adds `src/services/integrations/googleConnectedAppAdapter.js`.
- Hooks the adapter after existing successful Google OAuth connection finalization.
- Mirrors later Google token-refresh issue state into the generic connection as `needs_attention`.
- Writes `connected_app_connections` only; it never writes `agent_connected_app_enablements`.
- Uses `provider = google`, `app_key = google.calendar`, `google.calendar.read` when Calendar read/write scope is granted, and `google.calendar.write` only when Calendar write scope is granted.
- Keeps raw access tokens, refresh tokens, OAuth codes, state secrets, client secrets, and provider clients out of route responses, dashboard JavaScript, tests, docs, and logs.
- Reuses the existing dashboard Google connect button from the Connected Apps surface instead of inventing a new OAuth flow.

Current Phase 9 behavior is adapter/tests/docs/dashboard-copy alignment only. It adds no schema/migration change, no new Google scopes, no chat/tool provider execution, no widget/embed behavior, no public route, no package activation enforcement, no generic provider execution, no package switching, and no secrets.

Future provider-specific adapters can still be added later:

- Calendly proof adapter from `agent_booking_integrations`.
- Stripe billing adapter from `owner_billing_accounts`.
- Twilio phone adapter from `agent_phone_numbers`.
- WhatsApp Business adapter from a future webhook/OAuth/Cloud API setup, not from Phase 10 metadata alone.

Future provider-specific adapters should return redacted connection/readiness DTOs, not tokens or secrets.

Existing provider-specific tables should coexist with the generic model first:

- `agent_booking_integrations` stays the Calendly-specific signed webhook proof table.
- `google_oauth_states` and `google_connected_accounts` stay the Google operator workspace OAuth/account tables while the Google Calendar adapter mirrors only redacted generic status.
- Stripe billing/webhook handling stays account billing infrastructure, not an agent app grant.
- Twilio phone webhook handling stays admin/provider-specific phone infrastructure until a separate self-serve design exists.
- WhatsApp Business stays manual/status-only capability metadata until a separate inbound webhook, OAuth/Embedded Signup, and Cloud API design exists.

No destructive migration should be proposed until adapters have proven equivalent or stricter scoping, secret handling, and permission behavior.

### Phase 10: WhatsApp Business capability foundation

Implemented Phase 10 behavior:

- Adds `whatsapp.business.webhook`, `whatsapp.business.send.template`, and `whatsapp.business.send.session.reply` to the report-only registry.
- Keeps all WhatsApp capabilities `publicChatCallable: false`, `packageActivatable: false`, and `externalExecution: false`.
- Allows safe manual/status-only records for WhatsApp Business using the existing generic connection and enablement tables.
- Rejects WhatsApp access-token, app-secret, verify-token, webhook-secret, and API-key fields at route/service boundaries.
- Adds dashboard copy that states `Manual/internal setup`, `No WhatsApp messages sent`, `No webhook receiver enabled yet`, and `No Meta OAuth/Embedded Signup yet`.
- Keeps public chat execution blocked even when manual connection and enablement records exist.

Current Phase 10 behavior is registry/readiness/manual-status/dashboard-copy/tests/docs only. It adds no schema/migration change, no runtime chat behavior, no widget/embed behavior, no WhatsApp webhook route, no inbound message processing, no outbound message sending, no Meta OAuth/Embedded Signup, no WhatsApp Cloud API calls, no Twilio WhatsApp API calls, no package activation enforcement, no generic provider execution, and no secrets.

### Phase 11: WhatsApp webhook verification/readiness

Implemented Phase 11 behavior:

- Adds `/integrations/whatsapp/webhook/:connectionId` for Meta GET challenge verification and POST readiness metadata only.
- GET verification checks `hub.mode`, `hub.verify_token`, and `hub.challenge` against a derived verifier reference and returns only the challenge on success.
- POST recognizes `whatsapp_business_account` payloads and safe message/status event type names only enough to update readiness metadata.
- Keeps public chat execution blocked even when webhook readiness reports active.

Current Phase 11 behavior adds no schema/migration change, no runtime chat behavior, no widget/embed behavior, no inbound message processing, no outbound message sending, no Meta OAuth/Embedded Signup, no WhatsApp Cloud API calls, no Twilio WhatsApp API calls, no package activation enforcement, no generic provider execution, and no secrets.

### Phase 12: WhatsApp POST signature and normalization foundation

Implemented Phase 12 behavior:

- Adds pure Meta `X-Hub-Signature-256` helpers that support `sha256=<hex>` HMAC-SHA256 signatures and constant-time comparison.
- Adds raw-body route wiring so POST signature validation can use Meta's exact request body bytes.
- Records `not_configured` signature status when no service-only app secret is supplied, rather than marking the webhook verified.
- Normalizes WhatsApp message/status/unknown webhook changes into redacted internal summaries.
- Persists only safe aggregate metadata: last webhook receipt time, object, event types, message types, and signature status.

Current Phase 12 behavior does not process inbound messages, does not persist normalized events, does not store full provider payloads, does not store message body text, does not store customer phone numbers or profile names, does not create chat messages, leads, action requests, booking requests, contacts, or outbound replies, and does not call WhatsApp Cloud API or Twilio WhatsApp APIs. Full app-secret signature validation remains future until service-only app-secret storage or provider-specific signing-secret references exist.

### Future phase: runtime permission service

Add a central service such as `assertConnectedAppCapabilityAllowed()` before any generic provider execution exists.

It should require:

- authenticated owner or trusted provider webhook actor,
- active owner/agent access,
- package capability declaration,
- explicit agent enablement,
- active connection,
- required provider scopes/capabilities,
- operation risk approval mode,
- audit-log write,
- no public chat executor unless a later phase explicitly and safely allows it.

### Future execution-capable setup surface

Any later execution-capable Connected Apps setup surface must be a separate scoped phase after registry data, redacted status DTOs, provider-specific adapters, and runtime permission checks are stable. It should remain setup/status first and must not make public chat an executor by default.

## Phase 3 implementation result

The report-only Connected Apps readiness reporting phase is now the safest implemented next step:

- Add no schema/migration changes.
- Add no provider execution.
- Add no public chat behavior.
- Add no dashboard controls that initiate new app connections.
- Add no package activation change.
- Use the code-only registry to classify current Google, Gmail-in-Google, Calendly, Stripe, Twilio, and WhatsApp integrations as provider-specific.
- Add readiness DTOs that are redacted and app/agent/package aware.
- Include readiness DTOs in package activation readiness output only when callers explicitly supply connected-app context.
- Keep connected-app DTO status separate from package activation readiness status.
- Add docs and tests proving package tool metadata is not executable permission.

This keeps the product moving toward a generic engine without turning today's one-off integrations into an accidental authorization layer.

## Phase 4 design result

The Phase 4 data model plan is the current future-state design for generic persistence:

- Owner/workspace connection records and agent enablement records are separate.
- Webhook endpoint state is tracked separately from execution permission.
- OAuth state is signed/hashed, owner-bound, redirect-allowlisted, expiring, one-time use, and provider/capability-bound.
- Token and secret material stays service-only and redacted from frontend, logs, docs, package manifests, readiness reports, and public bundles.
- Permission evaluation must combine owner connection, agent enablement, package declaration, scope/webhook proof, allowed surface, approval mode, billing/access state, execution policy, and audit logging.
- Public chat provider execution remains blocked by default.
- Existing Google, Calendly, Stripe, Twilio, and future WhatsApp execution-specific tables should coexist through adapters before any generic migration.

Phase 4 adds no schema, migration, runtime chat change, dashboard/widget/embed change, OAuth/provider setup, external API/provider execution, package activation enforcement, or secrets.

## Phase 5 implementation result

Phase 5 adds generic persistence and an internal service skeleton only:

- Owner connection records and agent enablement records now exist in `db/schema.sql`, `supabase/migrations/20260602150000_connected_app_connection_foundation.sql`, and the full current-main recovery bundle.
- `connected_app_connections` has owner/provider/app/capability/status fields, redacted provider account fields, scope/webhook status, `token_secret_ref`, and metadata. Generic encrypted token columns are intentionally omitted until a future explicit encryption/storage phase.
- `agent_connected_app_enablements` has owner/agent/connection/capability fields, `enabled`, `approval_mode`, `allowed_surfaces`, optional `package_key`, and metadata.
- Both tables use authenticated owner-select-only RLS. No anon or authenticated write policies are added.
- `connectedAppConnectionService` persists and maps generic status records only. It does not call external APIs, generate OAuth URLs, construct provider clients, enforce package activation, or enable runtime provider execution.

## Phase 6 implementation result

Phase 6 adds report-only readiness derivation from the generic records:

- `buildConnectedAppReadinessContext()` reads owner connections and owner/agent enablements through explicit Supabase input.
- The helper maps active owner connections plus enabled same-agent capabilities into `connectedCapabilities`.
- Missing enablements, disabled enablements, inactive connections, mismatched capabilities, missing OAuth grants, and inactive webhooks remain blocked or warning conditions in the existing readiness evaluator.
- Public chat execution remains blocked in readiness output.
- Activation readiness still evaluates connected apps only when callers supply `context.connectedApps`; no automatic DB query or enforcement path was added.
- Provider-specific legacy tables are not queried or required in this phase.

## Phase 7 implementation result

Phase 7 adds authenticated owner-scoped API routes over existing generic records:

- Capability registry metadata is available through `GET /agents/connected-app-capabilities` only after auth and remains non-callable for public chat.
- Owner connection status records can be created, listed, and updated through authenticated `/agents/connected-apps` routes without accepting or returning token refs, raw tokens, secrets, OAuth URLs, provider clients, handlers, or execution fields.
- Agent enablements can be listed, created, and updated only after owner access to the agent is verified; connections and capabilities are validated before enablement.
- `GET /agents/:agentId/connected-app-readiness` derives readiness from `connected_app_connections` and `agent_connected_app_enablements` and returns report-only readiness output.
- No public/anonymous route, widget/embed surface, runtime chat behavior, OAuth/provider setup, external provider execution, package activation enforcement, package activation change, schema/migration change, or secret storage was added.

## Phase 8 implementation result

Phase 8 adds an authenticated dashboard management surface over existing generic records:

- The dashboard/settings `Connected apps` surface fetches registry capabilities, owner connection records, selected-agent enablements, and selected-agent report-only readiness.
- The surface displays provider/capability labels, connection status, account label, scopes/capability summary, webhook status, agent enablement state, approval mode, allowed surfaces, and readiness warnings.
- Dashboard controls create manual/status-only owner connection records, update connection status, and enable/disable selected capabilities for the selected agent.
- Copy now distinguishes manual/status-only records from the Google Calendar adapter.
- Controls do not accept raw token, secret, OAuth URL, webhook URL, provider client, handler, public chat callable, package selector, package switching, or execution fields.
- No schema/migration change, runtime chat behavior, widget/embed surface, OAuth/provider setup, external provider execution, package activation enforcement, runtime permission enforcement, public/anonymous route, package activation change, or secret storage was added.

## Phase 9 implementation result

Phase 9 adds Google Calendar as the first adapter into the generic Connected Apps model:

- `src/services/integrations/googleConnectedAppAdapter.js` maps existing `google_connected_accounts` state into `connected_app_connections`.
- Existing Google OAuth/provider behavior remains the source of truth for state validation, owner binding, scopes, encrypted token storage, refresh, sync, and Calendar API behavior.
- Successful Google Calendar connection finalization upserts the generic connection row.
- Calendar read scope grants `google.calendar.read`; Calendar write scope grants both `google.calendar.read` and `google.calendar.write`; missing Calendar scope claims no Calendar capability and marks the generic record `needs_attention`.
- Token/refresh issues map to `needs_attention`; disabled or revoked source states map to disabled/revoked generic status.
- The Connected Apps dashboard shows Google Calendar as using the existing Google connection flow and lets owners explicitly enable selected capabilities for the selected agent through the existing generic enablement endpoint.
- No agent is automatically enabled. Public chat execution remains blocked by readiness policy.
- No new Google scope, runtime chat/tool execution, widget/embed change, public route, package activation enforcement, generic provider execution, package switching, or secret exposure was added.

## Phase 10-12 implementation result

Phase 10 adds WhatsApp Business as a Connected Apps capability foundation, Phase 11 adds webhook verification/readiness, and Phase 12 adds POST signature helpers plus safe normalization:

- `whatsapp.business.webhook` represents future verified inbound webhook readiness only.
- `whatsapp.business.send.template` represents future approved-template outbound messaging only.
- `whatsapp.business.send.session.reply` represents future replies inside an allowed customer-service window only.
- The existing generic `connected_app_connections` and `agent_connected_app_enablements` records can represent manual active connection status and explicit agent enablement for report-only readiness.
- Safe metadata can include WhatsApp Business Account ID, phone number ID, display phone number, business display name, webhook verification status, Graph API version, webhook verified timestamp, last webhook receipt timestamp, last webhook object, safe event type names, safe message type names, and signature status.
- WhatsApp access tokens, app secrets, verify tokens, webhook secrets, API keys, OAuth codes, and access-token-looking values are rejected by the generic connection service and route boundaries.
- The dashboard shows WhatsApp Business foundation status with `Manual/internal setup`, `No WhatsApp messages sent`, `Webhook verification/readiness only`, and `No Meta OAuth/Embedded Signup yet`.
- Phase 12 can validate `X-Hub-Signature-256` only when a service-only app secret is supplied; otherwise POST signature status is `not_configured`.
- Full app-secret signature validation remains future until service-only app-secret storage or provider-specific signing-secret references exist.
- Future WhatsApp work must separate inbound webhooks, session replies, and approved template messages.
- Runtime execution must require explicit owner connection, agent enablement, approved surface, provider proof, safe logging, and probably staff approval.
- No schema/migration change, runtime chat behavior, widget/embed change, Meta OAuth/Embedded Signup, WhatsApp Cloud API call, Twilio WhatsApp API call, outbound messages, inbound chat handoff, AI replies, package activation enforcement, or secret exposure was added.

## Explicit current-state conclusions

- Vonza currently has a generic Connected Apps persistence/service foundation, authenticated owner/internal API routes, a manual/status-only authenticated dashboard surface, a Google Calendar mirror adapter, and a WhatsApp Business capability foundation, not a generic OAuth/provider setup or execution engine.
- Existing outside apps are Google, Calendly, Stripe, Twilio, and WhatsApp.
- Gmail exists only inside the Google operator workspace.
- Current reusable pieces are security and scoping patterns, not a generic engine.
- Current highest-risk gap is the lack of a central app capability and runtime permission service.
- Current package tools and action metadata are not executable integration permissions.
- Current public chat paths must not execute external providers directly.
- Current dashboard/settings surfaces now include a generic Connected apps status catalog, Google Calendar adapter status, and WhatsApp Business foundation status, but readiness remains report-only.
- No generic OAuth/provider Connected Apps setup exists yet; Google Calendar uses the existing Google operator flow.
- No runtime connected app permission enforcement exists yet.
- No external provider execution is enabled through package metadata or readiness reporting.

## Non-changes in this inspection

- No runtime chat changes.
- No widget or embed changes.
- No new external integration.
- No external provider execution added.
- No package activation change.
- No secrets committed.
