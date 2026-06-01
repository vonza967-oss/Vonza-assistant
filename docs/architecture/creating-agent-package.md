# Creating an Agent Package

## Scope

Use this guide when adding a future package after `front_desk_general`. Package work must preserve the existing Front Desk runtime unless a PR explicitly changes behavior and has matching eval coverage.

The lightweight template lives in `src/agentPackages/_template`. It is example-only scaffolding. Do not import it from `src/agentPackages/index.js`, and do not treat it as a registered package.

## Steps

1. Define the package contract before writing runtime behavior.
   - Choose a stable `key`, `version`, `label`, and `description`.
   - Identify supported surfaces: `widget`, `full_page`, and/or `web_call`.
   - Write the package role, intents, prompt blocks, risk rules, tool declarations, and knowledge policy.

2. Start from the non-runtime template.
   - Copy the example files from `src/agentPackages/_template` into a new package folder.
   - Rename example identifiers and remove example-only comments.
   - Keep the package unregistered until tests and evals exist.

3. Keep tools declarative.
   - Add only metadata keys that are present in `src/services/tools/toolRegistry.js`.
   - Do not add provider calls, side effects, or action execution inside package tool files.
   - Treat planned capabilities as planned metadata until a separate runtime integration is approved.

4. Keep knowledge policy report-only.
   - Set `mode: "report-only"`.
   - Define allowed evidence source types for claim categories such as pricing, contact, service, availability, policy, and booking.
   - Use conditional rules for narrower claim classes that need stronger evidence, such as live room rates or guest-specific booking details.
   - Do not enforce, rewrite, block, or route based on knowledge policy in the package PR.

5. Add evals before registration or sales.
   - Create package-specific scenarios that cover common questions, missing information, risky claims, contact routes, prompt injection, multilingual behavior, and any voice/web-call expectations.
   - Add side-effect guards so evals cannot write production data, trigger billing, start web-call sessions, or send outbound messages.
   - Run Answer Contract and Claim Verifier in report-only mode and review the metadata before considering enforcement.

6. Register only after the package is safe to exercise.
   - Add the manifest import to `src/agentPackages/index.js` only after the package has focused tests and evals.
   - Registration in code does not make a package sellable.
   - Production selection needs a separate schema/product decision. The current DB constraint permits only `front_desk_general` and the controlled internal `hotel_concierge` assignment path.

## Sellable Package Gate

A future package is not sellable until all of these are true:

- The package has a manifest, prompt blocks, tool metadata, knowledge policy, tests, and package-specific eval docs.
- The package eval suite passes in dry-run mode and, when applicable, live mode.
- `front_desk_general` evals still pass, proving the default package was not regressed.
- Answer Contract and Claim Verifier report-only metadata has been reviewed for false positives and false negatives.
- Any DB constraint change, dashboard/admin control, billing/package entitlement, install flow, and public-access change is explicitly reviewed in its own PR.

Do not enable Answer Contract or Claim Verifier enforcement as part of making a new package visible. Enforcement remains a later decision after report-only data is stable.
