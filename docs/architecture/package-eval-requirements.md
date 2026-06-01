# Package Eval Requirements

## Purpose

Every agent package needs eval coverage before it can be sold, selected by customers, or trusted for package-specific behavior. Evals are the package parity and safety contract.

`front_desk_general` remains the production default package. `hotel_concierge` is internal/code/eval-only and can be persisted only through controlled service-level assignment. It exists to prove the package architecture can support a second package without changing public product behavior.

## Required Coverage

Each package eval suite should cover:

- Known factual answers from strong evidence.
- Missing prices, fees, services, policies, availability, booking details, and contact routes.
- Contact, booking, quote, checkout, lead capture, and human handoff expectations when those surfaces apply.
- Prompt injection inside retrieved website, policy, or manual content.
- Package-specific high-risk claims.
- Multilingual behavior for at least one non-English visitor flow when relevant.
- Web-call or voice-style behavior when the package supports `web_call`.
- Side-effect safety: no forbidden DB writes, billing events, web-call sessions, outbound messages, or production integrations.

## Report-Only Metadata

Answer Contract, Claim Verifier, and knowledge policy checks remain report-only for package evals.

The eval report should record enough metadata to review safety signals:

- package key and resolved package key
- evidence metadata, redacted where needed
- Answer Contract risk types and warnings
- Claim Verifier support status
- knowledge policy source-type checks
- side-effect guard results

Eval reports must not expose copied secrets, raw private records, or full evidence text unless an explicit debug option is used in a local-only context.

## Front Desk Requirements

The Front Desk package must continue passing the baseline eval suite:

```sh
npm run eval:front-desk:json -- --answer-contract
```

The current baseline scenarios are documented in `docs/evals/front-desk-package-baseline.md`. Future package work must not regress `front_desk_general`, because it remains the production default. The DB constraint permits `front_desk_general` and `hotel_concierge`, but Hotel Concierge persistence is limited to controlled internal/service-level assignment.

## Hotel Concierge Requirements

The hotel package must continue passing its internal eval suite:

```sh
npm run eval:hotel-concierge:json -- --answer-contract
```

The hotel suite is an internal code-test suite. Passing it does not make `hotel_concierge` sellable, dashboard-selectable, publicly selectable, or available outside the controlled internal/service-level assignment path.

## Enforcement Gate

Answer Contract and Claim Verifier enforcement must stay off until report-only data is reviewed. Before enforcement can be considered, the team must document:

- which risk types are eligible for enforcement
- false-positive and false-negative review from evals and production-like traffic
- visitor-facing fallback behavior
- owner/admin observability
- rollback behavior
- package-specific differences in evidence requirements

Until that review exists, package policy signals can be logged, tested, and reported only. They must not block, rewrite, or mutate visitor-facing replies.
