# Enterprise Request Desk Product Plan

Plan date: 2026-06-05

Enterprise Request Desk is a separate product layer on top of the Vonza Engine. It is not Quote Desk HU, and it must not inherit QDH routes, naming, setup flow, dashboard, or `agent_quote_requests` persistence.

Target hierarchy:

- Vonza Engine
  - AI Front Desk
  - Quote Desk HU
  - Enterprise Request Desk / ESG Request Desk

## Phase 1 Scope

Phase 1 creates a qualified enterprise intake layer for ESG-style enquiries:

- public qualified intake behavior, represented in service/test/eval code only;
- service-lane classification;
- one qualifying follow-up question at a time;
- structured internal brief DTO for owner/staff review;
- ESG-style fixture context for tests/evals only.

No public route, dashboard selector, persistence table, schema migration, widget/embed change, external provider call, quote calculation, or operations cockpit is added in this phase.

## Shared Engine vs Product Layer

Shared Vonza Engine patterns:

- Front Desk business-context grounding for supported service questions;
- package prompt-block shape and risk-rule metadata;
- deterministic safety boundaries for missing facts, exact pricing, prompt injection, and internal metadata;
- report-only eval and readiness style.

Enterprise-specific layer:

- `enterprise_request_desk` unregistered product/package metadata skeleton;
- ESG-style intake lane taxonomy;
- enterprise request field extraction for service need, location/site, timing/urgency, and contact route;
- structured owner/staff handoff brief;
- Enterprise eval scenarios and CLI command.

The adapter can accept an injected shared Front Desk turn for service questions, but default behavior is deterministic and report-only.

## ESG-Style First Pilot

Fixture context is limited to safe test/eval positioning:

- business name: ESG Holding Zrt.;
- service area: országos, Budapest központtal;
- service types: őrzés-védelem, portaszolgálat / objektumvédelem, facility management, biztonságtechnika, audit / compliance.

The fixture does not scrape ESG, use private data, claim customer references, claim certifications, or assert unverified proof. It exists only to exercise the first target use case.

## Lane Taxonomy

Phase 1 lanes:

- `security_guarding`: őrzés-védelem, vagyonőr, élőerős guarding, járőr.
- `reception_object_protection`: portaszolgálat, objektumvédelem, recepciós/beléptetési security.
- `facility_management`: létesítményüzemeltetés, karbantartás, takarítás, FM support.
- `security_technology`: CCTV, kamera, beléptető, access control, riasztó, biztonságtechnika.
- `audit_compliance`: audit, compliance, szabályzat, kockázatértékelés, megfelelőség.
- `mixed_enterprise_request`: több lane-t érintő enterprise igény.
- `general_enquiry`: biztonságos fallback általános kérdésekre vagy hiányos megkeresésre.

Each lane defines Hungarian label, coverage notes, qualifying questions, safe required fields, and the handoff summary shape. The required Phase 1 brief fields are service need, location/site, timing/urgency, and contact route.

## Explicit Deferrals

Deferred out of Phase 1:

- operations cockpit;
- QR site reporting;
- SLA clocks, tickets, or operational lifecycle;
- vendor panels;
- compliance document generation;
- external integrations or provider calls;
- final quote calculation, exact pricing, or guaranteed pricing;
- QDH request creation or QDH dashboard integration;
- schema/persistence until review shape is proven.

## Activation Boundary

`src/agentPackages/enterprise_request_desk/manifest.js` is intentionally not imported by `src/agentPackages/index.js`.

This means:

- `enterprise_request_desk` is not a known runtime package key;
- persisted `agents.package_key` is unchanged;
- no dashboard package selector is added;
- no public package switching is added;
- no widget/embed behavior changes;
- no schema migration is needed for Phase 1.

Future public activation requires a separate scoped PR covering route/auth decisions, persistence design, review UI, eval gates, RLS/owner scoping, and deployment checks.

## Verification Surface

Focused checks:

- `node --test tests/enterpriseRequestDeskProduct.test.js`
- `npm run eval:enterprise-request-desk:json`

Broader regression checks still include QDH, Front Desk, smoke, schema sync, lint, and diff checks before commit.
