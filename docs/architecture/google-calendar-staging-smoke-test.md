# Google Calendar Staging Smoke Test

Run date: 2026-06-03

## Scope

This smoke record covers the hardened Google Calendar connection lifecycle against the configured staging Supabase target where possible. It is verification/docs only. No Google behavior, scopes, public chat calendar execution, widget/embed behavior, or package activation enforcement was added.

## Target Environment

- Supabase target: `wjrgzvprxkkgbjppxphk.supabase.co`
- Local Google OAuth server config: not present in this workspace for `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, and `GOOGLE_TOKEN_ENCRYPTION_SECRET`.
- Controlled owner/account: not created in this run.
- Controlled Google account/calendar: not connected in this run.
- Secrets/tokens: no OAuth codes, access tokens, refresh tokens, client secrets, provider payloads, or calendar private details were written to docs, logs, screenshots, or repo files.

## Prerequisite Checks

The configured Supabase target exposed the required lifecycle tables through the service-role smoke check:

| Table | Result |
| --- | --- |
| `google_oauth_states` | Visible |
| `google_connected_accounts` | Visible |
| `operator_calendar_events` | Visible |
| `connected_app_connections` | Visible |
| `agent_connected_app_enablements` | Visible |

## Smoke Results

| Step | Result | Notes |
| --- | --- | --- |
| Initial dashboard status | Not run | Requires authenticated dashboard session for a controlled owner. |
| Connect Google | Not run | Local Google OAuth server config was missing, so `/agents/google/connect/start` cannot produce a valid controlled OAuth flow from this workspace. |
| Connected Apps mirror | Verified by focused tests, not live OAuth | Tests cover mirror creation/update, read/write capability mapping from real Google scope URLs, status mapping, and redaction. A live mirror row was not created. |
| Agent enablement/readiness | Verified by focused tests, not live UI | Tests cover active connection plus explicit enablement becoming ready, disabled/needs-attention states blocking readiness, and public-chat execution remaining blocked. |
| Calendar sync/operator flow | Not run live | Requires a connected controlled Google account and test calendar. Existing tests cover operator calendar surfaces and approval-first mutation routes. |
| Reconnect | Verified by focused tests, not live OAuth | Tests cover reconnect updating the existing Google row, preserving account identity, and removing `google.calendar.write` from the mirror after a read-only downgrade. |
| Failure/needs-attention | Verified by focused tests, not live provider failure | Tests cover safe OAuth provider failure metadata and adapter mapping for expired, refresh-failed, permission-missing, and scope-missing states. |
| Disconnect | Verified by focused tests, not live route/UI | Tests cover authenticated owner scoping, local token clearing, Google account status `revoked`, Connected Apps mirror status `revoked`, enablement disablement, historical calendar event retention, and no provider revoke call. |
| Cleanup | Passed | No live OAuth, dashboard, Google account, calendar event, or staging data rows were created by this run. |

## Result Details

- OAuth/connect result: blocked by missing local Google OAuth server configuration and no authenticated controlled Google account session.
- Mirror/readiness result: focused tests passed for the lifecycle contract; live staging row creation was not performed.
- Sync result: not run because no controlled Google account was connected.
- Reconnect result: focused reconnect/scope-downgrade tests passed; live reauthorization was not performed.
- Failure/needs-attention result: focused safe-failure and status-mapping tests passed; live provider refresh/permission failure was not triggered.
- Disconnect result: focused disconnect service/route tests passed; live disconnect was not performed because no live connection was created.
- Cleanup result: no smoke-created staging data required cleanup.

## Limitations

- This is not a completed real-account Google OAuth smoke. The local workspace does not currently have the required Google OAuth environment variables configured.
- No browser dashboard smoke was run because there was no authenticated controlled owner session in this workspace.
- No calendar sync/import was run because no controlled Google account was connected.
- No scope-downgrade live OAuth test was run; only focused mocked lifecycle coverage was verified.
- No live refresh-token failure or permission failure was simulated against Google.

## Boundaries Confirmed

- No new Google scopes were added.
- No public chat calendar execution was added.
- No widget/embed files or behavior were changed.
- No package activation enforcement was added.
- No secrets, OAuth codes, access tokens, refresh tokens, client secrets, or real calendar details were committed or documented.
