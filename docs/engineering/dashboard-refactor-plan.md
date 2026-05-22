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

## Sprint 2 Baseline

Starting point before Sprint 2 edits:

| File | Lines |
| --- | ---: |
| `frontend/dashboard.js` | 21,544 |
| `frontend/dashboard.css` | 19,040 |

Starting lint warning count: 92 warnings.

| Rule | Count |
| --- | ---: |
| `no-unused-vars` | 71 |
| `no-useless-assignment` | 15 |
| `no-unreachable` | 3 |
| `no-empty` | 2 |
| `no-duplicate-imports` | 1 |

Starting test status:

- `npm run test:smoke`: passing, 613 tests.

## Sprint 2 Extraction

Extracted:

- `frontend/dashboardInstall.js`
  - install script generation
  - optional website widget URL generation
  - hosted Front Desk page URL generation
  - embedded Front Desk URL generation
  - smart embed and iframe snippet generation
  - QR endpoint generation
  - public page enabled/key helpers
  - install status copy/tone helpers
  - full-page customization detection
  - Install method metadata
- `frontend/dashboardState.js`
  - Settings main tab normalization
  - Settings main tab hash formatting
  - Settings Front Desk subtab normalization
  - Settings Front Desk subtab hash formatting
  - Settings Front Desk allowed subtab and label lists
  - nested `#settings/front-desk/...` state updates now normalize through shared helpers
- `frontend/settings/SettingsShell.js`
  - delegates Settings and Front Desk tab normalization to `window.VonzaDashboardState` when available, with the existing local fallback preserved.

Line counts after Sprint 2 extraction:

| File | Lines |
| --- | ---: |
| `frontend/dashboard.js` | 21,293 |
| `frontend/dashboard.css` | 19,040 |
| `frontend/dashboardInstall.js` | 353 |
| `frontend/dashboardState.js` | 384 |

Lint warnings after Sprint 2: 79 warnings.

| Rule | Count |
| --- | ---: |
| `no-unused-vars` | 61 |
| `no-useless-assignment` | 15 |
| `no-unreachable` | 3 |

Low-risk lint cleanup completed:

- Removed the duplicate billing plan import.
- Added intentional comments to two best-effort widget storage catches.
- Marked several dashboard-only legacy helper functions with the existing underscore convention so they no longer obscure active warnings.

Intentionally not extracted:

- The full Install DOM renderer, because it still owns many class names, copy buttons, QR state, and verification behaviors that are safer to move after this helper split has landed.
- Install event binding, because it coordinates copy buttons, QR download state, preview tracking, verification, and workspace refresh.
- Settings form rendering, because `SettingsShell.js` already owns it and Sprint 2 only needed shared tab-state normalization.
- Public assistant, widget, smart embed runtime, voice, RAG, WordPress plugin, and backend behavior.

Sprint 2 CSS split notes:

- `frontend/dashboard.css` was not changed.
- Install CSS is spread across base and late override layers:
  - base install/onboarding block around lines 5,665-7,144
  - install V2/status overrides around lines 13,428-13,517
  - install method-card override layer around lines 14,610-14,726
  - final install wizard overrides around lines 18,580-19,037
- Front Desk dashboard CSS is spread across:
  - early Front Desk layout around lines 1,666-2,470
  - workspace override blocks around lines 6,555-6,632
  - production Front Desk polish around lines 9,898-10,190
  - late density/dark/mobile override layers around lines 14,477-18,090
- Settings / Front Desk form CSS is already concentrated in `frontend/settings/settings.css`, mostly around lines 103-568.

Suggested CSS split order:

1. Keep `dashboard.css` as the ordered bundle until there is a build or explicit load-order plan.
2. Extract `frontend/settings/settings.css` ownership first only if SettingsShell remains a separately loaded asset.
3. Extract final Install overrides as the first dashboard CSS source slice, preserving their current late load order.
4. Extract Front Desk dashboard styles after the Front Desk renderer/helper ownership is clearer.

Remaining Sprint 2 risks:

- `frontend/dashboard.js` still owns the large Install renderer and most shared event binding.
- The Settings state now has shared helpers and SettingsShell fallbacks; both paths need to stay aligned until SettingsShell can require `dashboardState.js` ordering directly.
- Several old dashboard helper functions remain in the file for future decisions, even if they are not active today.

Largest remaining warning clusters:

| File | Count |
| --- | ---: |
| `frontend/dashboard.js` | 44 |
| `src/services/conversion/conversionOutcomeService.js` | 12 |
| `src/services/operator/contactWorkspaceService.js` | 4 |
| `src/services/operator/operatorWorkspaceService.js` | 4 |
| `frontend/script.js` | 2 |
| `src/services/operator/copilotProposalService.js` | 2 |
| `src/services/operator/todayCopilotService.js` | 2 |

## Sprint 3 Baseline

Starting point before Sprint 3 edits:

| File | Lines |
| --- | ---: |
| `frontend/dashboard.js` | 21,293 |
| `frontend/dashboard.css` | 19,040 |

Starting lint warning count: 79 warnings.

| Rule | Count |
| --- | ---: |
| `no-unused-vars` | 61 |
| `no-useless-assignment` | 15 |
| `no-unreachable` | 3 |

Starting test status:

- `node --test tests/dashboardVisibility.test.js tests/dashboardOperatorWorkspace.test.js`: passing, 114 tests.
- `npm run test:smoke`: passing, 613 tests.

## Sprint 3 Extraction

Extracted:

- `frontend/dashboardFrontDesk.js`
  - Front Desk tab metadata, labels, and normalization for `practice`, `improvements`, `knowledge`, `answer-library`, and `launch`
  - Front Desk and knowledge status summary helpers
  - training item source and reason labels
  - improvement and approved-answer source labels
  - training queue item renderer
  - approved answer card renderer
  - practice status and empty-state render fragments
  - Front Desk tab navigation renderer
  - dependency-injected Front Desk renderer helpers for Practice, Improvements, Knowledge, Answer library, Launch, and the full workspace panel
- `frontend/dashboard.js`
  - now delegates Front Desk renderer/helper work through `window.VonzaDashboardFrontDesk.createFrontDeskHelpers(...)`
  - retains thin compatibility wrappers for VM tests and existing dashboard call sites
  - fixes bare `#front-desk` navigation so it opens Practice instead of reusing a previously persisted nested tab
- `dashboard.html`, `src/routes/publicRoutes.js`, `src/utils/securityHeaders.js`, and `src/app/createApp.js`
  - load, version, classify, and no-store the new dashboard helper asset consistently with the other dashboard scripts

Line counts after Sprint 3 extraction:

| File | Lines |
| --- | ---: |
| `frontend/dashboard.js` | 20,776 |
| `frontend/dashboard.css` | 19,040 |
| `frontend/dashboardFrontDesk.js` | 896 |

Lint warnings after Sprint 3: 68 warnings.

| Rule | Count |
| --- | ---: |
| `no-unused-vars` | 50 |
| `no-useless-assignment` | 15 |
| `no-unreachable` | 3 |

Low-risk lint cleanup completed:

- Marked VM/test-exposed dashboard helpers as intentional where the browser still needs them available by name.
- Removed active Front Desk renderer/helper warnings by moving isolated render fragments into the namespace module.

Routes verified by tests and browser checks:

- `/dashboard#front-desk`
- `/dashboard#front-desk/practice`
- `/dashboard#front-desk/improvements`
- `/dashboard#front-desk/knowledge`
- `/dashboard#front-desk/answer-library`
- `/dashboard#front-desk/launch`

Intentionally not extracted:

- Front Desk event binding, because it is delegated through the shared dashboard event layer and coordinates live DOM state, refreshes, practice sends, feedback actions, and answer approval actions.
- Front Desk API calls, because they remain coupled to authenticated `fetchJson`, boot-time data refresh, workspace reloads, and global dashboard state.
- Practice send/save flows, because moving them without a broader event-boundary split would increase duplicate-listener risk.
- Public assistant, widget, smart embed, WordPress plugin, voice, billing, auth, schema, RAG, semantic search, and chat behavior.

Sprint 3 CSS split notes:

- `frontend/dashboard.css` was not changed.
- Front Desk dashboard CSS remains spread across:
  - early Front Desk layout around lines 1,666-2,470
  - workspace override blocks around lines 6,555-6,632
  - production Front Desk polish around lines 9,898-10,190
  - late density/dark/mobile override layers around lines 14,477-18,090
- The CSS was left bundled because the Front Desk styles rely on later override layers and load-order risk is still high.

Remaining Sprint 3 risks:

- `frontend/dashboard.js` still owns the Front Desk event/API boundary and most workspace refresh coupling.
- `frontend/dashboard.css` still has layered Front Desk overrides in the shared dashboard stylesheet.
- Some dashboard globals remain exposed for VM tests or legacy call sites, so additional lint burn-down should stay scoped and evidence-driven.

Recommended Sprint 4:

- Extract Customers helpers/render fragments into `frontend/dashboardCustomers.js`. This continues reducing `dashboard.js` risk without taking on the higher load-order risk of a CSS split.
- Treat lint burn-down as a secondary Sprint 4 target, limited to touched Customers code and any clearly dead VM-only wrappers.
- Defer dashboard CSS section splitting until one more renderer boundary lands or an ordered CSS bundling plan exists.

## Sprint 4 Baseline

Starting point before Sprint 4 edits:

| File | Lines |
| --- | ---: |
| `frontend/dashboard.js` | 20,776 |
| `frontend/dashboard.css` | 19,040 |

Starting lint warning count: 68 warnings.

| Rule | Count |
| --- | ---: |
| `no-unused-vars` | 50 |
| `no-useless-assignment` | 15 |
| `no-unreachable` | 3 |

Starting test status:

- `npm run test:smoke`: passing, 615 tests.

## Sprint 4 Extraction

Extracted:

- `frontend/dashboardCustomers.js`
  - customer identity and guest/identified detection helpers
  - source labels and source badge render fragments
  - customer reachability, owner-review, follow-up, and missing-contact state derivation
  - status badge derivation
  - primary/secondary customer action label helpers
  - customer metric cards, filter tab rendering, row rendering, detail panel rendering, chat panel rendering, and conversation-message rendering
  - Customers panel rendering through a dependency-injected `createCustomerHelpers(...)` bridge
- `frontend/dashboard.js`
  - now delegates Customers helpers/render fragments through `window.VonzaDashboardCustomers.createCustomerHelpers(...)`
  - retains thin compatibility wrappers for VM tests and existing dashboard call sites
  - keeps Customers event binding and API calls in the shared dashboard event layer
- `dashboard.html`, `src/routes/publicRoutes.js`, `src/utils/securityHeaders.js`, and `src/app/createApp.js`
  - load, version, classify, and no-store the new Customers helper asset consistently with the other dashboard scripts
- `frontend/dashboardLabels.js`
  - adds the explicit `Embedded assistant` customer source label used by Customers helpers and tests

Line counts after Sprint 4 extraction:

| File | Lines |
| --- | ---: |
| `frontend/dashboard.js` | 19,765 |
| `frontend/dashboard.css` | 19,040 |
| `frontend/dashboardCustomers.js` | 1,516 |

Lint warnings after Sprint 4: 58 warnings.

| Rule | Count |
| --- | ---: |
| `no-unused-vars` | 41 |
| `no-useless-assignment` | 14 |
| `no-unreachable` | 3 |

Customer action wording verification:

- Guest/no-contact rows derive `Needs review` and `Missing contact details`, not `Needs follow-up`.
- Guest/no-contact primary actions remain `Review conversation`.
- Identified/reachable customers can show `Needs follow-up` and `Review suggested reply`.
- Unavailable chat includes an explicit reason.
- `Send AI draft` remains absent from Customers markup.
- Source labels cover `Website widget`, `Front Desk page`, `Embedded assistant`, and `Unknown source` fallback behavior.

Intentionally not extracted:

- Customers event binding, because selection, filter application, chat expansion, selected-customer persistence, and detail-panel visibility are live DOM concerns inside `bindSharedDashboardEvents(...)`.
- Customers API calls, because fetching workspace contacts/conversations, marking reviewed, training actions, and follow-up drafting remain coupled to authenticated `fetchJson`, boot-time reloads, and global dashboard state.
- Backend APIs, schema, auth/access gates, billing, public assistant/widget/embed/WordPress/voice/RAG/chat behavior.

Sprint 4 CSS notes:

- `frontend/dashboard.css` was not changed or split.
- Customers CSS remains in layered blocks:
  - legacy/base contact controls around lines 2,330-3,145
  - main contacts workspace and row/detail styles around lines 4,272-4,560
  - production Customers override blocks around lines 17,226-17,655
  - late compact/density overrides around lines 18,115-18,132
- CSS split remains risky because Customers styles depend on later production-shell overrides and shared workspace tokens.

Remaining Sprint 4 risks:

- `frontend/dashboard.js` still owns Customers event/API coupling.
- Customers renderers now depend on injected dashboard primitives; load order is covered by tests but remains important for classic scripts.
- Some compatibility wrappers remain in `dashboard.js` for VM tests and legacy call sites.
- The lint total is below 60, but remaining warnings are mostly outside Customers or require product decisions around legacy connected-tool bodies.

Recommended Sprint 5:

- Analytics helper extraction is the next best renderer-boundary sprint.
- Keep CSS split/load-order hardening as a separate sprint after another renderer module lands.
- Continue lint burn-down only where warnings are clearly dead or already touched by the active sprint.

## Dashboard.js Section Map

Approximate current line ranges after Sprint 4:

| Area | Lines | Notes |
| --- | ---: | --- |
| Bootstrap constants, auth state, launch flags | 1-760 | Global state, billing config, capability flags, operator normalization. |
| Auth and dashboard language | 760-2,260 | Auth URL handling, legal links, Hungarian phrase maps, theme/language persistence. |
| Hash routing and UI state | 2,260-2,690 | Delegated to `frontend/dashboardState.js` through thin wrappers. |
| Install/embed helper bridge and shared helpers | 2,690-3,260 | Install URL/snippet/status helpers now come from `frontend/dashboardInstall.js`. |
| Setup/access/loading/auth rendering | 3,430-4,240 | Access gates, loading, auth entry, launch/onboarding screens. |
| Shell primitives and navigation | 4,240-4,900 | Page headers, toolbar, local nav, icons, sidebar. |
| Customers compatibility bridge | 4,860-5,170 | Delegates customer helpers/renderers to `frontend/dashboardCustomers.js`. |
| Home/operator/Today helpers | 5,170-7,110 | Copilot summaries, Today queue, review drawer, Home overview. |
| Settings and Front Desk renderers | 7,110-8,850 | Settings bridge, Front Desk practice/improvements/knowledge/library/launch. |
| Analytics logic and renderer | 8,850-12,650 | Conversation analysis, owner analytics, reports, action queue labels. |
| Connected tools renderers | 12,650-13,880 | Email/Calendar/Automations currently return coming-soon surfaces with unreachable legacy bodies. |
| Install renderer | 13,880-14,620 | Install status, methods, copy blocks, QR, full-page assistant install options. |
| Form parsing and save/import/copy actions | 14,620-16,240 | Assistant saves, full-page config, voice config, uploads, copy helpers. |
| Event binding | 16,240-19,760 | Shared dashboard events, filters, settings forms, queue actions, customer actions. |
| Local fixture and boot | 19,200-19,765 | Fixture-backed dashboard and authenticated boot flow. |

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

- `frontend/dashboardState.js`: hash parsing, section aliasing, install method normalization, Settings tab normalization, Front Desk tab normalization, dashboard UI-state normalization.
- `frontend/dashboardLabels.js`: stable source/status/outcome labels and small formatting helpers.
- `frontend/dashboardInstall.js`: Install page URLs, snippets, QR helpers, status copy, method metadata, and public page helpers.
- `frontend/dashboardFrontDesk.js`: Front Desk tab metadata, status summaries, source/reason labels, and isolated Front Desk render fragments.
- `frontend/dashboardCustomers.js`: customer identity/source/status/action helpers and Customers render fragments.
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

Sprint 3:

- Extract the Front Desk workspace renderer/helper logic into a bounded `frontend/dashboardFrontDesk.js` classic-script module.
- Keep SettingsShell form rendering where it is; focus on Front Desk practice/improvements/knowledge/library/launch renderer helpers and state.
- Add/adjust tests around Front Desk tab persistence, training queue actions, approved answers, practice mode, and launch readiness.

Sprint 4:

- Extract Customers helper logic and renderer in one bounded module.
- Add/adjust tests around customer action wording and state transitions.
- Reduce `frontend/dashboard.js` by another meaningful chunk without changing UI behavior.

Sprint 5:

- Burn down lint warnings, starting with useless assignments, connected-tool unreachable bodies after a product decision, and clearly dead helpers.
- Run a dedicated test isolation cleanup pass.
- Add CI reliability notes for order-sensitive smoke tests and dashboard browser checks.
