# Dashboard Refactor Plan

## Sprint 1 Baseline

Line counts before Sprint 1:

| File | Lines |
| --- | ---: |
| `frontend/dashboard.js` | 21,921 |
| `frontend/dashboard.css` | 19,040 |
| `frontend/script.js` | 3,976 |
| `assistant-embed.js` | 1,203 |

Line counts after Sprint 1 extraction:

| File | Lines |
| --- | ---: |
| `frontend/dashboard.js` | 21,544 |
| `frontend/dashboard.css` | 19,040 |
| `frontend/script.js` | 3,976 |
| `assistant-embed.js` | 1,203 |
| `frontend/dashboardState.js` | 273 |
| `frontend/dashboardLabels.js` | 199 |

Lint warning baseline before Sprint 1: 106 warnings.

| Rule | Count |
| --- | ---: |
| `no-unused-vars` | 78 |
| `no-useless-assignment` | 15 |
| `no-dupe-keys` | 5 |
| `no-empty` | 4 |
| `no-unreachable` | 3 |
| `no-duplicate-imports` | 1 |

Lint warnings after Sprint 1: 92 warnings.

| Rule | Count |
| --- | ---: |
| `no-unused-vars` | 71 |
| `no-useless-assignment` | 15 |
| `no-unreachable` | 3 |
| `no-empty` | 2 |
| `no-duplicate-imports` | 1 |

Largest remaining warning clusters:

| File | Count |
| --- | ---: |
| `frontend/dashboard.js` | 54 |
| `src/services/conversion/conversionOutcomeService.js` | 12 |
| `frontend/script.js` | 4 |
| `src/services/operator/contactWorkspaceService.js` | 4 |
| `src/services/operator/operatorWorkspaceService.js` | 4 |

## Dashboard.js Section Map

Approximate current line ranges after Sprint 1:

| Area | Lines | Notes |
| --- | ---: | --- |
| Bootstrap constants, auth state, launch flags | 1-760 | Global state, billing config, capability flags, operator normalization. |
| Auth and dashboard language | 760-2,260 | Auth URL handling, legal links, Hungarian phrase maps, theme/language persistence. |
| Hash routing and UI state | 2,260-2,690 | Now delegated to `frontend/dashboardState.js` through thin wrappers. |
| Install/embed URL builders and shared helpers | 2,690-3,430 | Script snippets, hosted Front Desk URLs, QR endpoints, safe text helpers. |
| Setup/access/loading/auth rendering | 3,430-4,240 | Access gates, loading, auth entry, launch/onboarding screens. |
| Shell primitives and navigation | 4,240-4,900 | Page headers, toolbar, local nav, icons, sidebar. |
| Customers helpers and renderer | 4,900-6,520 | Customer identity, source labels, filters, rows, detail panel. |
| Home/operator/Today helpers | 6,520-8,120 | Copilot summaries, Today queue, review drawer, Home overview. |
| Settings and Front Desk renderers | 8,120-9,850 | Settings bridge, Front Desk practice/improvements/knowledge/library/launch. |
| Analytics logic and renderer | 9,850-13,670 | Conversation analysis, owner analytics, reports, action queue labels. |
| Connected tools renderers | 13,670-14,900 | Email/Calendar/Automations currently return coming-soon surfaces with unreachable legacy bodies. |
| Install renderer | 14,900-15,640 | Install status, methods, copy blocks, QR, full-page assistant install options. |
| Form parsing and save/import/copy actions | 15,640-17,260 | Assistant saves, full-page config, voice config, uploads, copy helpers. |
| Event binding | 17,260-20,980 | Shared dashboard events, filters, settings forms, queue actions, customer actions. |
| Local fixture and boot | 20,980-21,544 | Fixture-backed dashboard and authenticated boot flow. |

## Dashboard.css Section Map

Approximate current section ranges:

| Area | Lines | Notes |
| --- | ---: | --- |
| Global tokens, loading, auth, base shell | 1-1,270 | Root variables, loading skeleton, auth entry, base page structure. |
| Workspace shell, settings, Home base styles | 1,270-2,370 | Sidebar, workspace layout, settings layout, Home cards. |
| Today/review drawer/help assistant | 2,370-3,150 | Today queue, review drawer, dashboard help drawer. |
| Reference-style dashboard overrides | 3,150-4,730 | Compact shell overrides and Home/Today refinements. |
| Shared workspace panels and analytics | 4,730-5,665 | Workspace panels, analytics report/chart/source styles. |
| Onboarding, launch, preview, install base | 5,665-7,215 | Install cards, copy fields, QR, launch/onboarding surfaces. |
| Operator/connected-tool pages | 7,215-7,865 | Operator cards and email page styles. |
| Responsive adjustments | 7,865-8,220 | Broad breakpoint rules. |
| Global blue/white workspace rewrite | 8,220-14,415 | Later override layer for compact production shell. |
| Customers V2 | 14,515-15,020 | Customers-specific table/detail density and cards. |
| Compact desktop density overrides | 15,020-17,260 | Dashboard-wide logged-in density passes. |
| Final install overrides | 17,260-17,715 | Install wizard and method-card final overrides. |

CSS was not split in Sprint 1. The file contains multiple late override layers, so load-order risk is high until section ownership is clearer.

## Proposed Module Boundaries

- `frontend/dashboardState.js`: hash parsing, section aliasing, install method normalization, Front Desk tab normalization, dashboard UI-state normalization.
- `frontend/dashboardLabels.js`: stable source/status/outcome labels and small formatting helpers.
- Future `frontend/dashboardInstall.js`: Install page state, URL snippets, QR helpers, copy button helpers.
- Future `frontend/dashboardCustomers.js`: customer identity/source/status helpers and Customers renderer.
- Future `frontend/dashboardAnalytics.js`: analytics formatting/report helpers.
- Future CSS split: keep `dashboard.css` as the final bundle initially, then extract source files only if the app has a safe concatenation or explicit ordered load plan.

## Sprint 1 Extraction

Extracted:

- `frontend/dashboardState.js`
  - hash path/search parsing
  - section hash aliases
  - install method/hash normalization
  - Front Desk section/hash normalization
  - customer filter hash normalization
  - dashboard UI-state defaults and normalization
- `frontend/dashboardLabels.js`
  - date-time local input formatting
  - customer source labels
  - action queue status labels
  - follow-up and knowledge-fix status labels
  - outcome labels
  - capture-rate formatting
- Dashboard document loading and cache-busting were updated for the new classic script files.
- Focused VM tests now load and assert the extracted helpers directly.

Low-risk lint cleanup completed:

- Removed unused install/date/billing helper wrappers.
- Removed unused dashboard language failure flag.
- Removed duplicate Hungarian phrase keys where later values already won.
- Converted a few unused `catch (error)` bindings to bare `catch`.
- Added comments to two intentionally empty storage-failure catches.

## Should Wait

- Rendering extraction for Home, Customers, Front Desk, Analytics, Settings, and Install should wait for per-section snapshot tests or browser checks.
- CSS splitting should wait. Current late override blocks are order-sensitive.
- Connected-tool unreachable code cleanup should be a product decision because the legacy bodies document unfinished beta direction.
- Broad unused-function removal should wait because many helpers may still be exercised through VM harnesses or planned gated surfaces.

## Risk Notes

- Dashboard loading uses classic scripts. New modules must attach to `window.VonzaDashboard...` and load before `dashboard.js`.
- Keep dashboard browser helpers as flat `frontend/` assets unless static routing is adjusted first. A `frontend/dashboard/` directory collides with the existing `/dashboard` route and can trigger an Express static slash redirect.
- `frontend/dashboard.js` still owns too many renderers and event handlers.
- `frontend/dashboard.css` has multiple override eras, making visual regressions likely if split aggressively.
- Several tests assert source text inside `dashboard.js`; future extraction may require test updates away from brittle string checks.
- Some connected-tool renderers intentionally return early, leaving unreachable code warnings.

## Test Isolation Risks Found

- The smoke suite previously showed one full-run failure for `tests/dashboardOperatorWorkspace.test.js` while that file passed alone, suggesting order-sensitive VM/global state or resource pressure.
- Many tests mutate `process.env`; most use local restore helpers, but this remains a suite-wide risk if new tests skip restoration.
- Dashboard and widget tests create VM `window`/`document` mocks with shared timer APIs and storage mocks. These are mostly per-harness, but missing script loads can produce behavior that differs from the browser document.
- Some tests assert raw source strings or CSS text instead of public behavior, so mechanical refactors can fail tests even when runtime behavior is unchanged.
- No tiny safe suite-level fix was obvious in Sprint 1 beyond loading the new helper scripts in dashboard VM harnesses.

## Next 3 Sprints

Sprint 2:

- Extract Install page URL/snippet/QR helpers and method state.
- Extract Settings and Front Desk tab state helpers.
- Create a safe CSS split plan, but only split CSS if load order can be preserved with tests/browser checks.

Sprint 3:

- Extract Customers page helper logic and renderer in one bounded module.
- Add/adjust tests around customer action wording and state transitions.
- Reduce `frontend/dashboard.js` by another meaningful chunk without changing UI behavior.

Sprint 4:

- Burn down lint warnings, starting with duplicate keys, empty catches, useless assignments, and clearly dead helpers.
- Run a dedicated test isolation cleanup pass.
- Add CI reliability notes for order-sensitive smoke tests and dashboard browser checks.
