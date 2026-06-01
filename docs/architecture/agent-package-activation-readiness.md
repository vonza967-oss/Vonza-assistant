# Agent Package Activation Readiness

## Purpose

This document records the package activation readiness checkpoints before any customer-facing Hotel Concierge activation. It verifies the current package architecture state and documents boundaries that must stay closed before `hotel_concierge` can be selected, sold, or exposed in dashboard surfaces.

PR 14 adds the first controlled persistence step only: `hotel_concierge` can be assigned through an internal/service-level owner-scoped path. No dashboard package selector, public package switcher, runtime tool execution, or enforcement is activated.

## Current Production State

- `front_desk_general` remains the default package for all new and existing agents.
- `hotel_concierge` exists in code, tests, evals, and the controlled internal persistence path.
- `agents_package_key_check` permits only `front_desk_general` and `hotel_concierge` in `db/schema.sql` and the PR 14 constraint-widening migration.
- The package registry can resolve `hotel_concierge` for injected test/eval contexts and for persisted internal assignments.
- Dashboard package switching does not exist.
- No public, widget, embed, or anonymous route can switch package keys.
- Hotel live room availability is not implemented.

## Metadata and Report-Only Boundaries

- The tool registry is metadata-only, not executable.
- Package tool declarations do not call providers, grant permissions, route requests, mutate records, or execute visitor-facing actions.
- `hotel.booking_availability` is planned metadata only. It is not a live availability tool and must not be treated as room inventory access.
- Knowledge policy checks are report-only.
- Claim Verifier package policy checks are report-only.
- Answer Contract and Claim Verifier do not enforce, rewrite, or block visitor replies.
- Enforcement must remain off until report-only metrics are reviewed and a later PR explicitly scopes enforcement behavior.

## Files Inspected

- `docs/architecture/agent-package-refactor-plan.md`
- `docs/architecture/package-manifest-contract.md`
- `docs/architecture/creating-agent-package.md`
- `docs/architecture/package-eval-requirements.md`
- `docs/evals/front-desk-package-baseline.md`
- `docs/evals/hotel-concierge-baseline.md`
- `src/agentPackages/index.js`
- `src/agentPackages/front_desk_general/manifest.js`
- `src/agentPackages/hotel_concierge/manifest.js`
- `src/services/chat/knowledgePolicyService.js`
- `src/services/tools/toolRegistry.js`
- `db/schema.sql`

## PR 12 Check Results

Recorded on 2026-06-01.

| Check | Result |
| --- | --- |
| `npm run eval:front-desk:json -- --answer-contract` | Passed, 12/12 scenarios. The command resolved to live mode. |
| `npm run eval:hotel-concierge:json -- --answer-contract` | Passed, 12/12 scenarios in dry-run mode. |
| `FRONT_DESK_EVAL_MODE=dry-run npm run eval:front-desk:json -- --answer-contract` | Passed, 12/12 scenarios in dry-run mode. |
| `npm run test:smoke` | Passed, 965/965 tests. |
| `npm run check:schema-sync` | Passed. |
| `npm run lint` | Passed. |
| `git diff --check` | Passed. |

No live Front Desk variance occurred in this checkpoint, so no isolated scenario reruns were required.

The eval side-effect guards reported no forbidden DB writes, billing events, outbound messages, web-call sessions, or product events. Hotel eval package-resolution metadata resolved the synthetic package as `hotel_concierge`; this remains eval-only and does not use persisted DB package selection.

## PR 14 Persistence Step

PR 14 allows `hotel_concierge` to be persisted only through `updateAgentPackageAssignment()`, an internal/service-level helper that:

- validates package keys through the package registry,
- defaults omitted package versions from the manifest,
- updates only rows matching both `id` and `owner_user_id`,
- returns the mapped agent row, and
- is not wired to dashboard, public, widget, embed, or anonymous package switching.

The DB constraint is widened only from `front_desk_general` to `front_desk_general` plus `hotel_concierge`. The default remains `package_key = 'front_desk_general'` and `package_version = '0.1.0'`.

## Staging Smoke Result

Recorded on 2026-06-01 after applying the staging DB constraint that allows `hotel_concierge`.

- Service-only Hotel Concierge staging smoke passed 6/6 public chat prompts.
- The smoke used one temporary owner-scoped agent assigned through `updateAgentPackageAssignment()`.
- Public chat prompts exercised hotel availability, rate, guest privacy/reservation handling, documented policy answers, missing evidence handling, and safety handoff behavior.
- The temporary agent was rolled back to `front_desk_general`.
- Temporary smoke rows were deleted after the run.
- Cleanup verification returned 0 remaining smoke agents and 0 remaining smoke businesses.

The smoke did not enable dashboard or admin UI package selection, public package switching, widget/embed changes, runtime tool execution, or policy enforcement.

Current verification facts:

| Check | Result |
| --- | --- |
| `npm run eval:hotel-concierge:json -- --answer-contract` | Passed, 12/12 scenarios in dry-run mode. |
| `FRONT_DESK_EVAL_MODE=dry-run npm run eval:front-desk:json -- --answer-contract` | Passed, 12/12 scenarios in dry-run mode. |
| `npm run test:smoke` | Passed, 972/972 tests. |
| `npm run check:schema-sync` | Passed. |
| `npm run lint` | Passed. |
| `git diff --check` | Passed. |

## Activation Blockers

Before any Hotel Concierge activation, the team must:

- Decide activation scope: local/dev/staging/production.
- Decide whether to add an audited admin UI/route or keep assignments service/script-only.
- Keep dashboard UI hidden until stable.
- Define rollback path to `front_desk_general`.
- Keep enforcement off until report-only metrics are reviewed.
- Keep tools metadata-only until a later PR explicitly wires runtime execution and safety controls.

## Readiness Conclusion

The package architecture is stable for the current code/test/eval/internal-persistence boundary. `front_desk_general` remains the default, and no package is dashboard-selectable. `hotel_concierge` is persistable only through controlled internal/service assignment and must remain hidden from customer-facing selection until the blockers above are closed in later scoped work.
