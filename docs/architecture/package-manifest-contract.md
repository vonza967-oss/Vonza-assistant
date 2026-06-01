# Package Manifest Contract

## Purpose

Agent packages describe a customer-facing assistant surface without changing the shared chat runtime by themselves. The package layer is a small contract for prompt blocks, metadata, report-only policy checks, and eval ownership.

The current production default is `front_desk_general`. The internal `hotel_concierge` package exists for code, eval testing, and controlled service-level assignment only. It is not sellable and not selectable in the dashboard.

## Current Registry and Database Contract

- `src/agentPackages/index.js` imports the registered package manifests and exports `DEFAULT_AGENT_PACKAGE_KEY = "front_desk_general"`.
- `front_desk_general` remains the fallback for unknown, missing, or unset package keys.
- `hotel_concierge` is registered in code so tests, eval runners, and controlled internal assignment can exercise package selection.
- Persisted agents are constrained to `package_key in ('front_desk_general', 'hotel_concierge')` in `db/schema.sql` and the PR 14 constraint-widening migration. The default remains `front_desk_general`.
- The non-runtime `_template` folder is documentation scaffolding only and must not be imported by `src/agentPackages/index.js`.

Changing which package is sellable requires a separate product and schema decision. Adding a manifest to the code registry is not enough to make a package production-ready.

## Manifest Shape

A package manifest is an object with stable, serializable metadata and optional package-owned helpers. Current manifests use frozen objects to avoid accidental mutation.

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
- `tools`: Tool declaration keys. These are metadata-only and are not executable tools.
- `knowledgePolicy`: Report-only evidence policy for Answer Contract and Claim Verifier metadata.
- `verticals` and `purposes`: Compatibility helpers used by `front_desk_general` to preserve current vertical and widget-purpose behavior.

## Tool Declarations

Package `tools` entries are declaration keys that must exist in `src/services/tools/toolRegistry.js`.

They are not callable functions, provider integrations, or permission grants. The registry can answer questions such as whether a package declares `common.booking_link`, but it does not execute booking, contact, lead-capture, or availability actions.

Current tool registry behavior is metadata-only:

- `common.lead_capture`, `common.contact_route`, `common.booking_link`, and `common.human_handoff` describe existing shared Front Desk surfaces.
- `hotel.booking_availability` is planned metadata for `hotel_concierge`; it has no runtime surface and must not be treated as live inventory access.
- Tool validation may report invalid declarations in tests, but package tools do not block, rewrite, route, mutate, or execute visitor replies.

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

`hotel_concierge` is internal-only. It documents hotel-specific role, intents, prompt blocks, risk rules, tool declarations, and knowledge policy, and it is exercised by the hotel concierge eval suite through injected package selection. It can be persisted only through controlled internal/service assignment and must not be offered to customers until product controls, docs, and eval gates are completed in a later PR.
