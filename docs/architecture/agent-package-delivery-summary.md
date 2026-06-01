# Agent Package Delivery Summary

## Scope

This summary consolidates the package architecture work through PR 15. It confirms the final state after the PR 14 service-only Hotel Concierge persistence step and the PR 15 delivery review.

## What Changed

- Packages: `front_desk_general` remains the default package. `hotel_concierge` is registered for internal code, tests, evals, and controlled service-level assignment.
- Prompt compiler: package role metadata, prompt blocks, risk rules, Front Desk vertical helpers, widget purpose helpers, and web-call style guidance compile into the existing prompt path without changing public response contracts.
- Resolver: package resolution defaults missing, blank, unknown, or malformed keys to `front_desk_general`; persisted agent package fields and eval overrides can resolve `hotel_concierge`.
- Schema: `agents.package_key` and `agents.package_version` are present. `package_key` defaults to `front_desk_general`; the DB check permits `front_desk_general` and `hotel_concierge`.
- Service assignment: `updateAgentPackageAssignment()` is the only internal service helper for persisted package changes. It validates package keys, defaults the version from the manifest, and scopes updates by both `id` and `owner_user_id`.
- Tools metadata: package tool declarations are metadata-only. The registry validates declarations and reports package/tool compatibility; it has no executable handlers or provider calls.
- Knowledge policy metadata: package policies are normalized to `report-only` and produce source-type support metadata only.
- Evals: Front Desk and Hotel Concierge package eval suites exist with Answer Contract and Claim Verifier metadata. Hotel dry-run passed in this review; Hotel live pass is documented in the Hotel Concierge baseline. Front Desk dry-run passed in this review.
- Staging smoke: after the DB constraint allowed `hotel_concierge`, the service-only smoke assigned one temporary owner-scoped agent through `updateAgentPackageAssignment()`, exercised public chat prompts, rolled the agent back to `front_desk_general`, deleted temporary rows, and verified cleanup.
- Docs: package contract, creation guide, eval requirements, activation readiness, Front Desk baseline, and Hotel Concierge baseline describe the current package boundaries.

## Current Safety Boundaries

- `front_desk_general` remains the production default.
- `hotel_concierge` is registered and persistable only through controlled internal/service assignment.
- No dashboard package selector exists.
- No admin UI package selector exists.
- No public, widget, embed, or anonymous package switching exists.
- No widget or embed changes were made for Hotel Concierge activation.
- Tools are metadata-only and are not wired to runtime execution.
- Knowledge policy checks are report-only.
- Answer Contract and Claim Verifier remain report-only.
- No package enforcement, rewrite, blocking, routing mutation, provider action, or runtime tool execution was added.
- Hotel live room availability is not implemented; `hotel.booking_availability` remains planned metadata only.

## Checks Last Run

Run date: 2026-06-01.

| Command | Result |
| --- | --- |
| Hotel Concierge staging smoke | Passed 6/6 public chat prompts after applying the DB constraint that allows `hotel_concierge`; cleanup verified 0 remaining smoke agents and 0 remaining smoke businesses. |
| `npm run eval:hotel-concierge:json -- --answer-contract` | Passed, 12/12 scenarios, dry-run mode. Side-effect guards clean for forbidden DB writes, billing events, outbound messages, web-call sessions, and product events. |
| `FRONT_DESK_EVAL_MODE=dry-run npm run eval:front-desk:json -- --answer-contract` | Passed, 12/12 scenarios, dry-run mode. Side-effect guards clean for forbidden DB writes, billing events, outbound messages, web-call sessions, and product events. |
| `npm run test:smoke` | Passed, 972/972 tests. |
| `npm run check:schema-sync` | Passed. |
| `npm run lint` | Passed. |
| `git diff --check` | Passed. |

## Live Eval Variance Notes

- Hotel Concierge live validation is documented in `docs/evals/hotel-concierge-baseline.md` as passing 12/12 after scoped hotel package/eval wording fixes.
- Hotel Concierge staging smoke validated the service-only persisted assignment path without adding customer-facing package selection or runtime execution.
- Front Desk dry-run is stable at 12/12 in this review.
- Front Desk live evals can show safe wording variance, especially around missing-contact fallback wording, concise style thresholds, or equivalent grounded phrasing. Treat those as review items before changing runtime behavior.
- Report-only Answer Contract, Claim Verifier, and knowledge policy metadata can show unsupported policy signals even when the visitor-facing answer remains safe; these signals are for review, not enforcement.

## Recommended Next Steps

- If Hotel Concierge needs operational activation, add an optional admin-only route behind auth or a seed script rather than public/dashboard selection.
- Keep the dashboard selector hidden.
- Keep admin UI package selection unimplemented until it is explicitly scoped.
- Keep enforcement off.
- Review report-only policy metrics before any enforcement decision.
- Design runtime tool execution later as a separate scoped project with provider, permission, audit, rollback, and safety controls.
