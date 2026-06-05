# Package Manifest Contract

## Purpose

Agent packages describe a customer-facing assistant surface without changing the shared chat runtime by themselves. The package layer is a small contract for prompt blocks, metadata, report-only policy checks, and eval ownership.

The current production default is `front_desk_general`. The internal `hotel_concierge` package exists for code, eval testing, and controlled service-level assignment only. It is not sellable and not selectable in the dashboard. The `enterprise_request_desk` skeleton exists as unregistered Phase 1 product metadata, tests, and eval scaffolding only.

## Current Registry and Database Contract

- `src/agentPackages/index.js` imports the registered package manifests and exports `DEFAULT_AGENT_PACKAGE_KEY = "front_desk_general"`.
- `front_desk_general` remains the fallback for unknown, missing, or unset package keys.
- `hotel_concierge` is registered in code so tests, eval runners, and controlled internal assignment can exercise package selection.
- `enterprise_request_desk` is intentionally not imported by `src/agentPackages/index.js`; it is not a known runtime package key, not persistable, and not dashboard-selectable.
- Persisted agents are constrained to `package_key in ('front_desk_general', 'hotel_concierge')` in `db/schema.sql` and the PR 14 constraint-widening migration. The default remains `front_desk_general`.
- The non-runtime `_template` folder is documentation scaffolding only and must not be imported by `src/agentPackages/index.js`.

Changing which package is sellable requires a separate product and schema decision. Adding a manifest to the code registry is not enough to make a package production-ready.

## Manifest Shape

A package manifest is an object with stable, serializable metadata and optional package-owned helpers. Current manifests use frozen objects to avoid accidental mutation.

This is the current v1 contract. A future Product Package Contract v2 is proposed in `docs/architecture/product-runtime-engine-plan.md` for package-owned `surfaces`, `settingsSchema`, `dataRequirements`, `allowedActions`, `allowedTools`, `staffWorkflows`, `evalGates`, `activationRequirements`, and optional `connectedAppRequirements`. Those v2 sections are not implemented by the current runtime. Phase 2 PR F adds a report-only readiness service around the current manifest and registry state, Connected Apps Phase 3 lets that readiness output include optional connected-app metadata, Phase 4 designs the generic connected-app data model, Phases 5-8 add generic connection/enablement persistence, report-only readiness derivation, authenticated owner API routes, and a manual/status-only authenticated dashboard surface, Phase 9 mirrors Google Calendar from the existing Google operator flow into generic connection records, and Phase 10 adds WhatsApp Business foundation metadata only. None of those phases adds v2 runtime activation.

Required fields:

- `key`: Stable lowercase package identifier. Example: `front_desk_general`.
- `version`: Package contract version. Example: `0.1.0`.
- `label`: Human-readable package name for internal diagnostics and docs.
- `description`: Short explanation of the package scope.
- `supportedSurfaces`: Public surfaces the package can describe, currently `widget`, `full_page`, and `web_call`.

Package manifests may contain:

- `role`: Package identity and tone metadata used by package-specific prompt compilation.
- `intents`: Package-owned intent names used by tests, evals, and future analytics.
- `promptBlocks`: Prompt text blocks that compile into the existing prompt path.
- `riskRules`: Human-readable package safety rules. These are documentation and test metadata unless code explicitly consumes them.
- `actions`: Action request declaration keys. These describe staff-visible request types a package may create in later scoped work; they are not executable tools.
- `tools`: Tool declaration keys. These are metadata-only and are not executable tools.
- `connectedAppRequirements`: Future optional connected app capability keys for readiness reporting only. The example template uses `{ reportOnly: true, requiredCapabilities: [], optionalCapabilities: [] }`. Current registered packages do not require connected apps.
- `knowledgePolicy`: Report-only evidence policy for Answer Contract and Claim Verifier metadata.
- `verticals` and `purposes`: Compatibility helpers used by `front_desk_general` to preserve current vertical and widget-purpose behavior.

## Tool Declarations

Package `tools` entries are declaration keys that must exist in `src/services/tools/toolRegistry.js`.

They are not callable functions, provider integrations, or permission grants. The registry can answer questions such as whether a package declares `common.booking_link`, but it does not execute booking, contact, lead-capture, or availability actions.

Current tool registry behavior is metadata-only:

- `common.lead_capture`, `common.contact_route`, `common.booking_link`, and `common.human_handoff` describe existing shared Front Desk surfaces.
- `hotel.booking_availability` is planned metadata for `hotel_concierge`; it has no runtime surface and must not be treated as live inventory access.
- Tool validation may report invalid declarations in tests, but package tools do not block, rewrite, route, mutate, or execute visitor replies.

## Connected App Requirements

Future package manifests may include optional `connectedAppRequirements` entries that reference keys from `src/services/integrations/connectedAppRegistry.js`, such as `google.calendar.read` or `calendly.booking.webhook`.

Template shape:

```js
connectedAppRequirements: Object.freeze({
  reportOnly: true,
  requiredCapabilities: Object.freeze([]),
  optionalCapabilities: Object.freeze([]),
})
```

This is future readiness metadata only. A connected app requirement is not:

- an OAuth setup flow,
- a provider connection,
- a package activation rule,
- an agent or owner permission grant,
- a public chat callable tool,
- a webhook handler,
- a provider client,
- a secret, token, OAuth URL, or webhook URL.

`src/services/integrations/connectedAppReadinessService.js` can evaluate supplied metadata for these future declarations and return `ready`, `warning`, or `blocked` requirement details. `src/services/agents/agentPackageActivationReadinessService.js` can attach that result as a separate `connectedApps` metadata block when callers explicitly pass `context.connectedApps`. It is report-only. It does not call Supabase, provider clients, OAuth endpoints, webhook setup, external APIs, chat routes, dashboard code, widget code, or embed code.

Current registered package manifests do not declare connected app requirements, and package activation readiness does not enforce provider execution. Connected-app readiness status does not change package activation status in this phase. Tool metadata and package actions must remain separate from connected app capability metadata.

Current connected-app readiness rules:

- Unknown required capability blocks.
- Known required capability missing from supplied connected capabilities blocks.
- Optional missing capability warns.
- Required provider status `disabled` or `needs_attention` blocks.
- Required OAuth capability without a supplied scope grant blocks.
- Required webhook capability without a supplied active webhook status blocks.
- Public chat execution remains blocked for every current capability.
- Execution requests are still report-only and blocked unless all required capabilities are connected and the registry allows external execution for the requested non-public surface.

Generic Connected Apps records, authenticated owner/internal API routes, a manual/status-only authenticated dashboard surface, and a Google Calendar mirror adapter now exist. They are not generic OAuth/provider setup, runtime permission enforcement, or external provider execution. Existing Google OAuth/provider behavior remains the source of truth for Google Calendar. No external provider execution is enabled by manifest metadata, generic records, dashboard controls, or readiness reporting.

Connected Apps Phase 4 defines the data-model distinction package manifests will depend on:

- `connected_app_connections` are implemented owner/workspace provider/app status records.
- `agent_connected_app_enablements` are implemented per-agent capability enablement records.
- `connected_app_webhooks` would be webhook endpoint/proof state.

The implemented connection and enablement records do not turn a package `connectedAppRequirements` declaration into permission. A future runtime permission service must still verify owner connection, agent enablement, package allowance, provider scopes/webhook state, allowed surface, approval mode, billing/access state, execution policy, and audit logging. Public chat provider execution remains blocked by default.

## Action Request Declarations

Package `actions` entries are declaration keys that must exist in `src/services/actions/actionRequestRegistry.js`.

They are action-request metadata, not executable tools, provider clients, integrations, or policy-enforcement grants. The registry can answer questions such as whether `hotel_concierge` declares `hotel.bring_water`, but it does not create request records by itself, call staff systems, execute external providers, send notifications, mutate guest records, or change chat behavior.

Current action registry behavior is metadata/service validation only:

- `front_desk_general` declares no action requests in Phase 2 PR C. This is the safer package boundary because the production Front Desk must not gain new runtime behavior from metadata.
- `hotel_concierge` declares the initial staff-request types, including `common.human_handoff`, `hotel.bring_water`, `hotel.extra_towels`, `hotel.room_service_request`, `hotel.housekeeping_request`, `hotel.maintenance_issue`, `hotel.late_checkout_request`, and `hotel.staff_help`.
- Every initial action definition requires staff action, requires no integration, and has external execution disabled.
- Staff-visible request creation, dashboard queue work, public chat creation, provider execution, and policy enforcement require later PRs.

## Activation Readiness Checks

`src/services/agents/agentPackageActivationReadinessService.js` provides report-only activation readiness evaluation for package review and future automation.

Exports:

- `evaluateAgentPackageActivationReadiness(packageOrKey, context = {})`
- `listAgentPackageActivationRequirements(packageOrKey)`

The service returns deterministic plain objects with package key/version, overall `ready`, `blocked`, or `warning` status, individual activation requirement results, and activation summary counts. When `context.connectedApps` is explicitly supplied, it also returns a separate report-only `connectedApps` block with connected-app status, requirement entries, and summary counts. It does not call Supabase, OpenAI, routes, chat, dashboard, widget, embed, eval report files, provider clients, or external tools.

Current readiness scope:

- Unknown package keys block safely instead of falling back for activation review.
- `front_desk_general` can report ready by default because it has no package-specific action request workflow or hotel data requirements.
- `hotel_concierge` internal readiness requires a registered package, valid action declarations, confirmed action request registry validation, enabled staff action queue, required hotel data flags, passing Hotel Concierge eval context, disabled public/dashboard/widget switching flags, disabled external execution or explicit integration readiness, and report-only policy mode.
- `hotel_concierge` public/dashboard readiness remains blocked by default. Any broader activation requires a later explicit activation PR.
- Missing recommended hotel data can warn; missing required hotel data blocks.
- Optional connected-app context can report connected-app readiness as metadata. Missing required connected-app capabilities can appear as `connectedApps.status = "blocked"`, optional missing capabilities can appear as warnings, and public chat execution requests remain blocked in metadata. These connected-app results do not change activation status or enforce package activation.

The readiness service does not enforce activation, create action requests, expose package selection, change public routes, change dashboard/admin UI, change widget/embed behavior, execute tools/providers, or enable policy enforcement.

## Knowledge Policy

`knowledgePolicy` defines which evidence source types are strong enough for package-specific claim categories. It is consumed by report-only metadata paths around Answer Contract and Claim Verifier.

Current behavior:

- `src/services/chat/knowledgePolicyService.js` normalizes every policy mode to `report-only`.
- Policy checks return structured metadata such as allowed source types, matched source types, unsupported evidence counts, and notes.
- Policy checks do not enforce, rewrite, block, mutate, or hide visitor-facing answers.
- Missing or unsupported evidence is a reporting signal only.

Answer Contract and Claim Verifier enforcement must remain off until report-only data has been reviewed across relevant evals and production-like traffic. A later enforcement PR must be explicitly scoped and must prove that the report-only signals are stable enough to act on.

## Current Packages

`front_desk_general` is the production AI Front Desk package. It preserves the existing public chat, full-page Front Desk, widget, web-call, lead capture, direct routing, approved-answer, RAG, Evidence Pack, Answer Contract, Claim Verifier, missing-info, multilingual, and factuality behavior.

`hotel_concierge` is internal-only. It documents hotel-specific role, intents, prompt blocks, risk rules, action request declarations, tool declarations, and knowledge policy, and it is exercised by the hotel concierge eval suite through injected package selection. It can be persisted only through controlled internal/service assignment and must not be offered to customers until product controls, docs, and eval gates are completed in a later PR.

`enterprise_request_desk` is unregistered Phase 1 product metadata for ESG-style qualified enterprise intake. It documents role, intake lanes, safe boundaries, and eval requirements, and is exercised through deterministic service tests/evals only. It is not imported into the runtime registry, not allowed by the current DB `agents.package_key` constraint, not exposed through dashboard selection, and not wired to public routes, QDH, widget/embed, persistence, external providers, or final quote/pricing behavior.

## Future Product Runtime Contract

Phase 2 should evolve packages from prompt/eval metadata into product runtime declarations without weakening the current v1 safety boundaries. The planned v2 sections are:

- `surfaces`: Engine-readable customer and staff surfaces, replacing descriptive-only `supportedSurfaces` over time.
- `settingsSchema`: Package settings for future admin/dashboard validation.
- `dataRequirements`: Required, recommended, and optional knowledge inputs for activation.
- `allowedActions`: Package-neutral action request types, such as `hotel.bring_water`, that create staff-visible work rather than executing providers directly.
- `allowedTools`: Future provider or internal tools allowed only after explicit integration configuration and activation gates.
- `connectedAppRequirements`: Future optional report-only app capability requirements for packages that need an external app before activation review. These declarations must validate against the connected app capability registry but must not be interpreted as provider execution permission.
- `staffWorkflows`: Staff-visible queues and lifecycle rules required before public real-world requests are enabled.
- `evalGates`: Package-specific eval suites required before activation.
- `activationRequirements`: Data, eval, action, workflow, integration, package-switching, and report-only policy review gates.

The full plan is in `docs/architecture/product-runtime-engine-plan.md`, with the generic connected-app persistence design in `docs/architecture/connected-apps-data-model-plan.md`. Until those sections are implemented, v1 behavior remains unchanged: `supportedSurfaces` is descriptive, `actions` are action-request declarations only, `tools` are metadata-only, connected app requirements are absent from current registered packages, knowledge policy is report-only, and activation readiness checks are report-only/service-only rather than runtime enforcement.
