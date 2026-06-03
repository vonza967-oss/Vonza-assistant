# Google Calendar Integration Audit

Inspection date: 2026-06-03

## Executive summary

Google Calendar is not production-ready for broad user rollout today. The backend has a credible owner/operator foundation: authenticated Google OAuth start, hashed OAuth state, encrypted server-side token storage, token refresh, calendar sync, suggested slots, owner-approved calendar mutations, and a redacted mirror into generic Connected Apps records. It also preserves the most important product boundary: no public chat calendar execution.

The integration is best described as private-beta infrastructure. The highest-risk product gap is not the basic OAuth exchange. It is the combination of incomplete user lifecycle controls and split UX: there is no first-class disconnect/revoke path, reconnect/status recovery is indirect, the main Calendar workspace is hidden by launch gating, and Settings > Connected apps shows a generic mirror that users can confuse with runtime permission. A second high-risk hardening gap is failure logging around Google OAuth routes, which should be sanitized before wider rollout because token-exchange failures can carry provider request details in error objects.

Phase 1 implementation update: the code now hardens lifecycle/status/reconnect/disconnect only. Google account states such as stale, expired, refresh failed, and permission missing normalize to safe user-facing Connected Apps states: `active`, `needs_attention`, `disabled`, or `revoked`. Reconnect reuses the existing owner/agent Google account row when provider identity or email matches, and a scope downgrade updates the Connected Apps mirror so `google.calendar.write` is removed when the write scope is no longer granted. Authenticated owner-scoped disconnect locally marks the account `revoked`, clears encrypted token material, mirrors `revoked` into Connected Apps, and disables matching agent enablements. OAuth callback failures now store safe reason codes and reconnect guidance without raw codes, tokens, client secrets, or provider payloads. Phase 1 does not add new Google scopes, does not add public chat calendar execution, does not change widget/embed behavior, and does not enforce package activation.

Provider revoke note: Phase 1 performs local disconnect only. It does not call Google's revoke endpoint because this repo does not yet have an existing credential/client revoke path that is safely covered by tests. Provider-side revoke remains a future hardening item.

The original audit added no runtime behavior. It recommended production hardening in phases:

1. Status, reconnect, disconnect, and failure logging hardening.
2. Dashboard UX consolidation between the Google workspace and Connected Apps.
3. Readiness and scope accuracy improvements.
4. Staging smoke with a real Google test account.
5. Later only: public-agent calendar capability gates, still approval-first.

Current boundaries confirmed by inspection:

- No schema or migration change is required by this audit.
- No new Google scopes should be added.
- No public chat calendar execution exists or should be added in the next phase.
- No widget/embed changes are needed.
- No package activation enforcement exists or should be added in the next phase.
- No secrets should appear in frontend, docs, tests, logs, or route responses.

## What works today

- `POST /agents/google/connect/start` starts Google OAuth only after owner authentication and `requireActiveAgentAccess`.
- Default Google scopes are narrow: `openid`, `email`, `profile`, and `https://www.googleapis.com/auth/calendar.readonly`.
- Optional server-known scopes exist for later/private flows: `https://www.googleapis.com/auth/calendar.events`, `https://www.googleapis.com/auth/gmail.readonly`, `https://www.googleapis.com/auth/gmail.compose`, and `https://www.googleapis.com/auth/gmail.send`.
- OAuth state is stored in `google_oauth_states` with owner, agent, business, requested scopes, redirect path, selected mailbox, a hashed state token, status, and expiry.
- Tokens are encrypted into `google_connected_accounts` with AES-GCM helpers backed by `GOOGLE_TOKEN_ENCRYPTION_SECRET`.
- Refresh uses the stored refresh token when an access token is expired or near expiry.
- Calendar sync imports Google Calendar events into `operator_calendar_events`, builds daily summaries, detects conflicts, suggests slots, and creates owner tasks for booking/follow-up work.
- Calendar mutations are approval-first: draft rows are local/pending; actual Google create/update/cancel calls happen only through authenticated owner approval and only when calendar write scope is present.
- The Connected Apps adapter mirrors the existing Google account into `connected_app_connections` as `provider = google`, `app_key = google.calendar`, and redacted capability/status metadata.
- `google.calendar.read` is mirrored only from the real Google Calendar read or write scope URL. `google.calendar.write` is mirrored only from `https://www.googleapis.com/auth/calendar.events`.
- Connected Apps readiness remains report-only. It does not grant provider execution.
- Current registered packages do not auto-use Google Calendar and do not enforce connected-app activation.
- Public chat paths do not call Google OAuth, Gmail, or Calendar APIs.

## Current user flow

1. The owner opens the authenticated dashboard.
2. A Google connect button posts to `/agents/google/connect/start` with `agent_id`, `client_id`, `redirect_path: "/dashboard"`, and optionally a custom scope list.
3. The server verifies owner access to the agent and inserts a `google_oauth_states` row.
4. The browser is redirected to Google's OAuth URL. The URL uses offline access, `include_granted_scopes=true`, `prompt=consent`, the configured redirect URI, and the stored state token.
5. Google redirects to `/google/oauth/callback` with `state`, `code`, or `error`.
6. The callback resolves the hashed state, exchanges the code, reads Google userinfo, encrypts tokens, upserts `google_connected_accounts`, patches operator activation state, mirrors the generic Connected Apps connection, marks state completed, and redirects back to `/dashboard?google=connected`.
7. Later dashboard loads may auto-sync Calendar when the account is connected, Google env is configured, schema is available, calendar read scope is present, and the last calendar sync is stale.
8. The user can see Google state indirectly in Home/Customers summaries and Settings > Connected apps. The primary Calendar navigation is currently hidden by launch profile and `CONNECTED_TOOLS_SELF_SERVE_ENABLED = false`.

Current UX friction:

- After connecting, there is no dedicated "connected successfully, now run first sync" flow visible in the launch navigation.
- Settings > Connected apps shows the Google Calendar adapter and agent enablement, while the operator calendar workspace is hidden. Users may not know whether enabling a generic capability changes real Calendar behavior.
- The Google Calendar adapter can show read/write capability labels, but the default connect button requests read-only Calendar access.
- Reconnect is just the same connect button. It does not clearly explain whether the user is fixing expiry, changing scopes, or replacing the account.
- There is no visible disconnect/revoke action.

## Current data model

Primary Google tables:

- `google_oauth_states`
  - Owner/agent/business binding: `owner_user_id`, `agent_id`, `business_id`.
  - Provider: `provider`, default `google`.
  - OAuth request state: `requested_scopes`, `redirect_path`, `selected_mailbox`, `state_token_hash`, `status`, `expires_at`, `completed_at`, `metadata`.
  - Indexes: `(agent_id, owner_user_id)`, `status`, and unique `state_token_hash`.

- `google_connected_accounts`
  - Owner/agent/business binding: `owner_user_id`, `agent_id`, `business_id`.
  - Provider identity: `provider`, `provider_account_id`, `account_email`, `display_name`, `selected_mailbox`.
  - Granted access: `scopes`, `scope_audit`, `status`.
  - Token state: `access_token_encrypted`, `refresh_token_encrypted`, `token_expires_at`, `last_refreshed_at`, `last_sync_at`, `last_error`.
  - Indexes: unique `(agent_id, owner_user_id, provider, provider_account_id)`, unique non-null email, unique `(agent_id, owner_user_id, provider)`, plus owner/status indexes.

Calendar/operator tables:

- `operator_calendar_events`
  - Links to `google_connected_accounts`.
  - Stores owner/agent/business scope.
  - Stores provider event id, action type, source kind, status, approval status, title, description, attendee emails, start/end, timezone, location, contact/lead links, conflict state, and metadata.
  - Metadata currently includes Google event links, hangout link, organizer email, attendee names/emails/statuses, and extracted phone candidates from event text.

- `operator_tasks`
  - Stores conflict, appointment review, booking opportunity, and calendar mutation approval tasks.

- `operator_workspace_activations`
  - Tracks `google_connected`, `calendar_context_selected`, `calendar_synced`, and `first_calendar_action_reviewed`.

- `operator_audit_logs`
  - Records Google connect, token refresh, connection issue, and calendar approval audit events.

Generic Connected Apps tables:

- `connected_app_connections`
  - Owner-scoped generic connection/status records.
  - The Google Calendar adapter writes rows with `provider = google`, `app_key = google.calendar`, capability keys, redacted account label, scope URLs in `scopes_granted`, status, and metadata.
  - The adapter intentionally writes `token_secret_ref = null` and does not expose Google token ciphertext.

- `agent_connected_app_enablements`
  - Owner/agent-scoped generic enablements.
  - The Google adapter does not auto-create these rows. Owners can explicitly enable capabilities from the generic dashboard surface.
  - These rows are readiness context, not runtime permission to call Google.

Schema/catalog alignment:

- `db/schema.sql` is canonical and contains the Google/operator tables.
- `db/connected_operator_workspace.sql` and `supabase/migrations/20260404001000_connected_operator_workspace.sql` are the original workspace migration source.
- `supabase/migrations/20260602150000_connected_app_connection_foundation.sql` adds the generic connection and enablement tables.
- `docs/sql/prod_recovery_full_current_main.sql` includes both the Google/operator workspace and Connected Apps foundation.
- `src/services/schema/supabaseMigrationCatalog.js` and related schema checks should continue to list any migration/recovery files if future changes add status/disconnect fields.

RLS/security expectations:

- RLS is enabled on all public app tables in `db/schema.sql`.
- Generic Connected Apps records have authenticated owner-select policies.
- Legacy Google/operator data is primarily server-mediated through authenticated dashboard APIs and service-role operations with explicit owner/agent filters.
- The current posture avoids broad direct browser access to Google token/event tables, but it increases the importance of complete server DTOs and clear dashboard status.

## OAuth, token, and security model

OAuth start:

- Route: `POST /agents/google/connect/start`.
- Requires owner auth and active agent access.
- Inserts only a hash of the random state token.
- Stores requested scopes and selected mailbox.
- Uses configured `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, and `GOOGLE_TOKEN_ENCRYPTION_SECRET`.

OAuth callback:

- Route: `GET /google/oauth/callback`.
- Public callback is expected for OAuth, but it must resolve a valid stored state.
- Exchanges code server-side, fetches userinfo, encrypts access/refresh tokens, and upserts the Google account.
- Preserves an existing refresh token if Google omits `refresh_token` on reconnect.
- Marks the OAuth state completed after successful persistence.

Token refresh:

- `ensureFreshGoogleAccessToken` refreshes when the token is missing, expired, or within two minutes of expiry.
- If the refresh token is missing or refresh fails, the account is marked `expired`, `last_error` is set, an audit row is written, and the generic Connected Apps mirror moves to `needs_attention`.
- On successful refresh, encrypted access token, expiry, `last_refreshed_at`, status, and mirror are updated.

Current hardening gaps:

- The callback does not explicitly require the OAuth state row to be `pending` or `provider = google` before exchanging a code.
- Expired OAuth state raises an error but is not consistently marked failed/expired for user-facing recovery.
- `redirect_path` is accepted from the authenticated start request and later used by the callback. It should be normalized to same-app dashboard paths only before broader rollout.
- Granted scopes are mapped from Google's token response, which is correct, but callback completion still marks activation `googleConnected` even if Calendar scope is missing or downgraded.
- There is no first-class disconnect or provider revoke flow.
- Route catch blocks around Google OAuth still use raw `console.error(err)`. Provider/token exchange errors should be logged through a redacted helper before production rollout.
- Token refresh failure status is stored and mirrored, but the launch dashboard does not yet provide a crisp "expired, reconnect now" user path.

## Current calendar sync and operator behavior

Calendar sync:

- Requires a connected Google account and calendar read capability.
- Sync window is narrow: roughly 30 hours back and 2 days ahead.
- Reads up to 40 primary calendar events.
- Upserts events into `operator_calendar_events` by connected account and provider event id.
- Stores title, description, location, attendee emails, start/end, timezone, Google links, attendee profiles, organizer email, and extracted phone candidates.
- Links events to leads by attendee email when possible.
- Records non-cancelled synced events as `booking_confirmed` conversion outcomes.
- Detects overlapping events and writes owner tasks.
- Builds missed booking opportunity tasks from leads without matching events.
- Builds suggested 60-minute business-hour slots from synced events.
- Updates `last_sync_at` and operator activation `calendar_synced`.

Operator workflow:

- `draftCalendarAction` creates or updates local `operator_calendar_events` rows with `approval_status = pending_owner`.
- Drafting does not call Google and does not require Google write access.
- `approveCalendarAction` requires Google config, a connected account, calendar write scope, and a fresh access token.
- Approval calls Google create/update/cancel, updates provider event id/status, marks approval approved, writes audit, and marks first calendar action reviewed.
- Calendar action routes require owner auth and active agent access.

Current behavior gaps:

- There is no visible dedicated failed-sync/reconnect recovery flow in the main launch dashboard.
- Calendar sync can treat any non-cancelled calendar event as booking-confirmed, even if it is an internal meeting. This can overstate conversion metrics and expose internal calendar PII in operator context.
- The model has no resource/staff/service/timezone availability contract beyond primary calendar events and simple business-hour slot suggestions.
- No provider webhook or incremental sync channel exists; sync is dashboard-load/refresh driven.
- No conflict lock, slot hold, or live availability guarantee exists.
- Owner-approved update/cancel flows depend on local draft data but do not surface provider-side stale event conflicts as a first-class review state.

## Connected Apps mirror behavior

Adapter: `src/services/integrations/googleConnectedAppAdapter.js`.

Mirror source of truth:

- Existing `google_connected_accounts` stays authoritative for Google OAuth, tokens, scopes, status, sync, and provider calls.
- Generic `connected_app_connections` is a redacted mirror for status/readiness display.

Capability mapping:

- `https://www.googleapis.com/auth/calendar.readonly` grants `google.calendar.read`.
- `https://www.googleapis.com/auth/calendar.events` grants both `google.calendar.read` and `google.calendar.write`.
- Capability keys alone, such as `google.calendar.read`, do not count as OAuth grants in readiness context.

Status mapping:

- Google `connected` with Calendar capability maps to generic `active`.
- Google `connected` without Calendar capability maps to `needs_attention` with `calendar_scope_missing`.
- Google `expired`, `error`, `failed`, or `pending` maps to `needs_attention` with a matching reason.
- Google `disabled` and `revoked` map through to disabled/revoked.

Redaction:

- Adapter payloads do not include access-token ciphertext, refresh-token ciphertext, OAuth codes, state tokens, client secrets, provider clients, or token secret refs.
- Metadata includes source, adapter, Google account id, agent id, business id, selected mailbox, email verification, capability summary, and mirror timestamp.

Readiness context:

- `connectedAppReadinessContextService` reads only generic connection/enablement tables.
- A capability counts as connected only when the owner connection is active, the agent enablement is enabled, and the capability appears on both records.
- Scope grants are emitted as capability booleans only when the real OAuth scope URL satisfies the registry definition.
- Readiness can block public chat execution, but it does not execute or authorize Google calls.

Agent enablement:

- The adapter does not auto-enable Google Calendar for agents.
- Owners can explicitly create/update `agent_connected_app_enablements`.
- Current registered packages have no connected app requirements, so enablement is report-only.

Current mirror gaps:

- The mirror can be stale if Google account status changes without a refresh attempt or callback path.
- There is no delete/disable mirror update from a Google disconnect flow because disconnect does not exist.
- Generic status and legacy operator status can disagree after scope downgrade or activation patch success with missing Calendar scope.
- Connected Apps UI labels can imply readiness while the launch calendar workspace remains hidden.

## Dashboard UX gaps

Current surfaces:

- Main dashboard launch profile hides `google_connect`, `inbox`, `calendar`, and `automations`.
- `CONNECTED_TOOLS_SELF_SERVE_ENABLED` is `false`, so even rendered Inbox/Calendar/Automations panels show beta/coming-soon states.
- Home/Customers can still include calendar-derived signals if backend data exists.
- Settings > Connected apps shows:
  - capability registry metadata
  - Google Calendar adapter status
  - connection records
  - agent enablement forms
  - report-only readiness
  - safety copy: no chat execution, no provider action without approval, report-only readiness
- Settings overview Integrations shows Gmail read and Calendar write status from operator workspace capabilities.

What is confusing:

- A user can connect Google from Settings > Connected apps but not get a clear primary Calendar workspace afterward.
- "Agent enablement" sounds like a runtime permission, but today it is report-only and not used by Google operator execution.
- Calendar read is the default OAuth path, while Calendar write appears in labels and approval flows but requires a different optional scope path.
- "Reconnect Google Calendar" does not distinguish expired token repair, scope upgrade, account replacement, or ordinary reauth.
- There is no disconnect button, no revoke explanation, and no "connected as X with scopes Y" user journey outside status cards.
- Failed sync and stale token errors surface as health strings, alerts, or generic needs-attention state rather than a dedicated recovery CTA.

Production UX target:

- One clear Google Calendar status card should be the source of truth.
- The card should show account label, last sync, granted capability level, sync health, stale/expired state, and the next action.
- Connected Apps should explain that it mirrors status and readiness only.
- The operator Calendar surface should either be intentionally private beta with no connect CTA, or be promoted with a complete first-run/reconnect/disconnect journey.

## Safety and privacy risks

1. OAuth failure logging
   - Google OAuth route catch blocks should not log raw error objects.
   - Token exchange errors can include provider request config.
   - Use redacted route logging before production rollout.

2. Missing disconnect/revoke
   - Users cannot revoke from Vonza.
   - Generic records cannot be reliably disabled from the source Google account lifecycle.
   - Production users need disconnect, revoke-at-provider guidance, and clear data retention expectations.

3. Scope downgrade mismatch
   - Callback maps granted scopes correctly, but activation can still mark Google connected even when Calendar scope is missing.
   - Generic mirror can show `needs_attention` while operator activation says connected.

4. Calendar event PII
   - Synced event titles, descriptions, locations, attendee emails, attendee names, organizer email, Google links, and extracted phones can contain sensitive business/customer data.
   - This must stay owner-scoped and server-mediated.
   - Any future public-agent use must use a minimized, redacted availability/appointment context rather than raw event content.

5. Booking/outcome accuracy
   - Non-cancelled Calendar events can become `booking_confirmed` outcomes.
   - Internal meetings can inflate conversion metrics unless event/customer classification is tightened.

6. State lifecycle
   - State tokens are random and hashed, but callback should explicitly enforce pending status and fail closed on completed/failed/expired rows.
   - Old state rows need cleanup or an expiry/status maintenance story.

7. Public chat boundary
   - Current public chat does not execute Google Calendar.
   - Future public-agent capability must remain approval-first and must not expose raw calendar data, live provider mutation, or confirmed booking claims without separate gates.

## Test coverage gaps

Existing useful coverage:

- Default Google connect scopes are identity plus read-only Calendar.
- Google connect route forwards explicit scope lists.
- Google OAuth callback persists encrypted-account state and mirrors Google Calendar into generic Connected Apps records.
- Adapter grants read/write only from real Google scope URLs.
- Adapter omits token ciphertext and OAuth artifacts.
- Missing Calendar scope maps to generic `needs_attention`.
- Connected Apps readiness requires active connection plus agent enablement.
- Scope URLs, not capability key strings, satisfy OAuth scope grants.
- Public chat execution remains blocked in readiness.
- Current packages do not auto-require or enforce Google Calendar.
- Dashboard Connected Apps copy avoids credential/OAuth/provider execution controls.
- Widget/embed/chat bundles do not include Connected Apps dashboard endpoints.

Missing or weak coverage to add before rollout:

- OAuth callback rejects completed, failed, expired, non-Google, or reused state rows before exchanging code.
- OAuth callback normalizes `redirect_path` to safe same-app paths.
- Callback with missing/downgraded Calendar scope does not mark operator activation as fully connected/synced.
- Reconnect preserves or replaces refresh tokens as intended and records a clear audit reason.
- Disconnect/revoke updates `google_connected_accounts`, `connected_app_connections`, activation state, and user-facing status.
- Refresh-token missing/failure produces a stable dashboard reconnect CTA and mirrors `needs_attention`.
- Cross-owner access cannot start, list, draft, approve, enable, or read another owner's Google/Calendar records.
- Calendar sync failure does not log token-bearing provider details.
- Calendar event PII is not exposed in public routes, public chat, widget, embed, docs, or frontend static fixtures.
- Calendar sync does not classify all internal calendar events as customer booking outcomes.
- Connected Apps agent enablement remains report-only until an explicit runtime permission service exists.
- Staging smoke with a real Google test account covers connect, first sync, reconnect, missing env, refresh, and disconnect.

## Recommended improvement phases

### Phase 1: status, reconnect, disconnect, and logging hardening

Goal: make the existing private-beta integration safe and understandable without expanding capability.

Recommended work:

- Add sanitized logging for Google OAuth start/callback and token exchange failures.
- Enforce OAuth state `provider = google`, `status = pending`, and unexpired status before code exchange.
- Mark expired/reused/failed states consistently.
- Normalize callback redirect targets to dashboard-internal paths.
- Add a Google account status service that derives one user-facing state: `not_connected`, `connected_read_only`, `connected_read_write`, `needs_reconnect`, `scope_missing`, `sync_failed`, `env_unavailable`, or `migration_required`.
- Add disconnect and local revoke flow:
  - mark Google account disabled/revoked
  - clear or retire encrypted tokens according to retention policy
  - mirror generic connection disabled/revoked
  - patch operator activation state
  - record audit
  - explain provider-side revocation if Google API revoke is not implemented yet
- Add focused tests for state replay, redirect normalization, disconnect mirror updates, refresh failure, and missing Calendar scope.

Do not add:

- New Google scopes.
- Public chat execution.
- Widget/embed behavior.
- Package activation enforcement.
- Schema/migration changes unless a later scoped design proves existing fields cannot represent status.

### Phase 2: dashboard UX consolidation between Google workspace and Connected Apps

Goal: remove user confusion after connect.

Recommended work:

- Create one Google Calendar status module used by Home/Settings/Connected Apps.
- Show account label, capability level, last sync, last error, and next action in one place.
- Make "Reconnect" reason-specific: expired token, scope upgrade, account replacement, or retry failed sync.
- Add a clear "Disconnect Google Calendar" action once Phase 1 exists.
- Decide product gating:
  - either keep Calendar private-beta and remove connect CTAs from user-facing launch settings, or
  - expose Calendar as a coherent self-serve workspace with first sync and recovery.
- Update Connected Apps copy so "agent enablement" is labeled report-only for Google until a runtime permission service exists.
- Avoid showing Calendar write as available unless the write scope is actually granted or the user is in a scoped upgrade flow.

### Phase 3: readiness and scope accuracy improvements

Goal: make all status/reporting consistent with real Google grants.

Recommended work:

- Treat missing Calendar read/write grants as an explicit Google connection issue, not just generic mirror `needs_attention`.
- Keep operator activation fields aligned with granted capabilities.
- Add readiness reason codes for `scope_downgraded`, `refresh_expired`, `disconnect_required`, and `mirror_stale`.
- Add tests that capability keys alone never satisfy OAuth scope grants across adapter, readiness, and package activation reports.
- Add drift checks that registry Google OAuth scope URLs match adapter scope constants.
- Make Connected Apps readiness continue to avoid provider-specific legacy table reads.

### Phase 4: staging smoke with a real Google test account

Goal: prove the flow outside mocks before calling it production-ready.

Smoke checklist:

- Fresh connect with default read-only Calendar scope.
- First sync imports only expected test events.
- Last sync and account label appear correctly.
- Missing/expired refresh token produces needs-reconnect status.
- Reconnect repairs status without duplicate account rows.
- Optional write-scope test account can create, update, and cancel a test event only after owner approval.
- Disconnect removes/retires local access and mirrors disabled/revoked generic status.
- No token, code, client secret, refresh token, or provider response payload appears in logs or route responses.
- Public chat and widget/embed routes remain unchanged and cannot access calendar execution.

### Phase 5: later only, public-agent calendar capability gates

Goal: consider public-agent calendar functionality only after private operator workflow is production-grade.

Required gates:

- Separate runtime permission service, not Connected Apps readiness alone.
- Explicit package declaration and owner enablement.
- Surface allowlist that still blocks public chat mutation by default.
- Approval-first action requests for any create/update/cancel.
- Minimized availability context, not raw event titles/descriptions/attendees.
- Booking confirmation policy that prevents chat from claiming confirmed bookings without trusted proof.
- Audit logs, evals, staging smoke, and rollback plan.

Out of scope until that phase:

- Public chat calendar create/update/cancel.
- Live availability guarantees.
- Slot holds.
- Provider mutation from widget/embed.
- Automatic package activation.
- New Google OAuth scopes.

## Production-readiness conclusion

Google Calendar should not be marketed or shipped as production-ready self-serve user functionality today. It is a solid private-beta backend/operator foundation with good safety boundaries, but it lacks production-grade lifecycle controls, recovery UX, disconnect/revoke, scope/status consistency, real-account smoke evidence, and clear dashboard consolidation.

Recommended next phase: Phase 1 status, reconnect, disconnect, and logging hardening.
