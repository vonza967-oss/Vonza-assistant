# Agent Package Refactor Plan

## Purpose

This plan describes how to extract the current AI Front Desk behavior into an agent package interface without changing production behavior during the baseline phase.

The first package is `front_desk_general`. It must wrap the current Front Desk behavior before any new package, schema, tool, or vertical behavior is introduced. The full-page AI Front Desk remains the primary customer-facing surface; the website widget remains secondary.

As of PR 14, `front_desk_general` remains the production default. `hotel_concierge` exists for internal code, eval testing, and controlled service-level assignment only. Hotel Concierge is not dashboard-selectable, customer-selectable, or sellable.

## Current Baseline

The current Front Desk path is assembled across these production files:

- `src/services/chat/chatService.js` resolves the public chat context, mode, billing capacity, website knowledge, approved answers, RAG context, lead capture, direct routing, message storage, speech authorization, and report-only Answer Contract metadata.
- `src/services/chat/prompting.js` builds the system prompt, website context prompt, conversation guidance, web-call response style, repair prompt, and factual guardrail checks.
- `src/templates/businessVerticals.js` maps a stored business vertical to prompt guidance for supported verticals.
- `docs/evals/front-desk-live-baseline.md` records the current live eval baseline, Evidence Pack v1, Answer Contract v1, and Claim Verifier v1 status.
- `docs/rag-upgrade-plan.md` keeps retrieval hardening intentionally incremental.
- `docs/refactor-safety-checklist.md` defines the checks required before behavior-changing refactors.

No production JavaScript, schema, migrations, routes, dashboard, widget, embed, or chat behavior changes are part of this PR.

## Target Shape

The package interface should become a thin orchestration boundary around the existing Front Desk behavior first. A package should describe the current assistant surface and compile the same runtime inputs into the same prompt, retrieval, routing, lead-capture, and safety behavior.

Initial package shape:

```js
{
  key: "front_desk_general",
  version: "current",
  modes: ["text_chat", "full_page", "widget", "web_call"],
  resolveVertical(input) {},
  compilePrompt(input) {},
  resolveTools(input) {},
  evaluateRisk(input) {}
}
```

This is an architecture target, not a request to add the interface in this PR. The first implementation should keep existing response shapes and side effects unchanged.

## Status Through PR 10

The package architecture phases below have been completed through PR 10 in the current codebase, with enforcement still intentionally deferred:

- Phase 0: package architecture and Front Desk baseline docs exist.
- Phase 1: `front_desk_general` exists as the default package manifest.
- Phase 2: prompt compilation has been moved behind package-aware code while preserving current Front Desk behavior.
- Phase 3: Front Desk vertical lookup is exposed through the `front_desk_general` package.
- Phase 4: an in-memory package resolver defaults current traffic to `front_desk_general`.
- Phase 5: minimal `package_key` and `package_version` fields exist, with `front_desk_general` as the default.
- Phase 6: `hotel_concierge` exists as an internal/code-test package with dedicated evals.
- Phase 7: tool registry and knowledge policy checks exist as report-only metadata. They do not enforce, rewrite, block, route, mutate, or execute visitor-facing behavior.

PR 11 adds the package contract docs and future-package template only. It does not change runtime behavior.

PR 12 records the activation readiness checkpoint in `docs/architecture/agent-package-activation-readiness.md`. It keeps Hotel Concierge code/test-only, leaves `agents_package_key_check` limited to `front_desk_general`, and documents the blockers required before any DB, admin, dashboard, runtime tool, or enforcement activation.

PR 14 widens `agents_package_key_check` to allow `hotel_concierge` for controlled internal/service-level assignment only. Dashboard package UI, public switching, runtime tools, and enforcement remain off.

The next architecture track is the Phase 2 Product Runtime Engine plan in `docs/architecture/product-runtime-engine-plan.md`. That plan is intentionally separate from the completed prompt/eval package refactor. It describes future product-package declarations for surfaces, settings, data requirements, action requests, staff workflows, eval gates, and activation gates without changing current runtime behavior.

## Phased Plan

### Phase 0: Documentation and Baseline (completed)

- Add the architecture plan and package baseline docs.
- Keep the current chat service, prompt builder, vertical templates, DB schema, migrations, tests, widget, embeds, and dashboard unchanged.
- Use `docs/evals/front-desk-package-baseline.md` as the package parity contract for future PRs.

Exit criteria:

- Docs-only diff.
- `git diff --check` passes.
- If practical, `npm run eval:front-desk:json -- --answer-contract` runs and reports the same baseline expectations.

### Phase 1: Wrap Current Behavior With `front_desk_general` (completed)

Introduce an internal package definition that resolves to `front_desk_general` for all current public Front Desk traffic. This package must call the existing behavior rather than reimplementing it.

Required constraints:

- Current `/chat` handling remains the production path.
- Current full-page, widget, and web-call modes keep the same request normalization and response shape.
- Current lead capture, direct routing, speech authorization, message persistence, billing usage, approved-answer lookup, RAG context, repair pass, and final safety validation remain in place.
- Current eval side-effect guards remain clean.

This phase should make package resolution observable in internal metadata or tests only. It should not require customer-visible schema fields.

### Phase 2: Extract the Prompt Compiler (completed)

Move prompt assembly behind a package-owned compiler while preserving the current generated prompt semantics.

The compiler should cover:

- System prompt behavior from `buildChatSystemPrompt`.
- Website/business context prompt behavior from `buildBusinessContextForChat`.
- Evidence Pack rendering input from the current approved-answer, business-profile, semantic chunk, and keyword fallback path.
- Conversation guidance from `buildConversationGuidance`.
- Web-call spoken style instructions.
- Repair prompt behavior from `buildBusinessReplyRepairPrompt`.
- Vertical prompt block insertion from the current vertical template lookup.

Parity should be measured with focused prompt snapshot coverage plus the Front Desk eval suite. The compiler extraction should be mechanical and should not rewrite tone, safety rules, missing-info copy, or conversion behavior.

### Phase 3: Move Vertical Lookup Behind the Package (completed)

After prompt compiler parity, move vertical lookup behind the package boundary.

The current stored business or agent vertical should remain the input. The package should resolve that input to the same template guidance currently provided by `src/templates/businessVerticals.js`.

Package-based vertical lookup should not add new vertical behavior in the same PR. The current supported templates are the baseline:

- `clinic`
- `web_studio`
- `home_services`

Unknown or general verticals should continue to produce no vertical-specific prompt block.

### Phase 4: Add an In-Memory Package Resolver Before Schema (completed)

Add a resolver that maps current traffic to an in-memory package definition before adding persistent package fields.

Resolver behavior:

- Default all existing Front Desk traffic to `front_desk_general`.
- Default the version to the current package version.
- Keep resolution deterministic and server-side.
- Avoid schema, migration, dashboard, install, and public route changes.

This phase gives the codebase a package seam while preserving production data shape.

### Phase 5: Add Minimal Schema Only After Parity (completed; PR 14 widened the constraint for controlled Hotel Concierge assignment)

Only after `front_desk_general` parity is proven should persistent package fields be added.

The minimal later schema fields are:

- `package_key`
- `package_version`

Do not add broad tool, risk, vertical, product, or package configuration columns in the same step. If schema is added later, `db/schema.sql` must remain canonical and aligned with the migration, and existing agents should default to `front_desk_general` with the current version.

### Phase 6: Add `hotel_concierge` Only After Front Desk Parity (completed for internal/code-test use)

`hotel_concierge` must come after the general Front Desk package has parity across text chat, full-page mode, widget mode, web-call mode, lead capture, approved answers, RAG/evidence metadata, missing-info behavior, Hungarian behavior, and factuality guardrails.

Do not introduce hotel-specific prompts, tools, schema, eval expectations, or dashboard controls before the general package is stable.

### Phase 7: Add Tool Registry and Risk Enforcement Later (metadata completed; enforcement deferred)

Tool registry and risk enforcement should come after package resolution and prompt compiler parity.

Initial registry work should be report-only:

- Record which package would allow each tool family.
- Record which risk policy would apply to pricing, contact, booking, service, policy, availability, lead capture, and outbound actions.
- Do not block, rewrite, route, or mutate visitor replies based on the new registry in the first pass.

Only after report-only data is stable should enforcement be enabled. Pricing and contact are the safest first enforcement candidates because they already have focused guardrails and Claim Verifier reporting. Answer Contract and Claim Verifier enforcement must remain off until report-only data has been reviewed and a later PR explicitly scopes enforcement behavior.

## Package Parity Contract

`front_desk_general` parity means:

- Text chat answers stay concise, grounded, and conversion-aware.
- Full-page mode remains the primary public Front Desk experience.
- Widget mode keeps the same secondary behavior.
- Web-call mode keeps spoken style, page-only source normalization, and web-call session metadata.
- Lead capture states, prompts, capture actions, and response fields remain compatible.
- Booking, quote, checkout, contact, and capture routing remain compatible.
- Owner-approved answers remain preferred when relevant.
- Evidence Pack metadata remains redacted and inspectable.
- Answer Contract and Claim Verifier remain report-only until a later enforcement PR.
- Missing information is stated plainly without inventing facts.
- Hungarian and multilingual behavior remains tied to the visitor conversation.
- Prompt injection and factuality guardrails remain at least as strict as the current implementation.

## Verification Gates for Future Implementation PRs

Future behavior-changing package PRs should run the relevant parts of the refactor safety checklist. At minimum:

- `npm run eval:front-desk:json -- --answer-contract`
- `npm run test:smoke`
- `npm run check:schema-sync` if schema or migration files are touched
- `npm run lint`
- `git diff --check`

If public assistant, widget, embed, dashboard UI, or web-call behavior is touched, run the corresponding browser checks before merge.

Product Runtime Engine implementation PRs should also preserve the separation between package declarations and execution. Action requests should be staff-visible before any real-world action happens, live provider tools should require explicit integration configuration, and activation gate enforcement should be scoped separately from answer mutation or policy enforcement.
