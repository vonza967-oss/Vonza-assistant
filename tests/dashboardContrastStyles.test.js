import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function readDashboardCss() {
  return readFileSync(path.join(repoRoot, "frontend", "dashboard.css"), "utf8");
}

function getCssBlock(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`(^|\\n)${escaped}\\s*\\{([^}]*)\\}`, "m"));
  return match ? match[2] : "";
}

test("dashboard disabled controls use explicit disabled colors instead of opacity", () => {
  const css = readDashboardCss();
  const buttonDisabled = getCssBlock(css, "button:disabled");
  const disabledTestLink = getCssBlock(css, ".test-link.disabled");

  assert.match(buttonDisabled, /color:\s*#d7e0ea/i);
  assert.match(buttonDisabled, /background:\s*rgba\(71,\s*85,\s*105,\s*0\.24\)/i);
  assert.doesNotMatch(buttonDisabled, /opacity\s*:/i);

  assert.match(disabledTestLink, /color:\s*#d7e0ea/i);
  assert.match(disabledTestLink, /background:\s*rgba\(71,\s*85,\s*105,\s*0\.18\)/i);
  assert.doesNotMatch(disabledTestLink, /opacity\s*:/i);
});

test("dashboard light-shell overview keeps metadata and borders readable", () => {
  const css = readDashboardCss();

  assert.match(css, /\.today-queue-row-meta,\s*\.today-support-meta\s*\{\s*color:\s*#66768f;/);
  assert.match(css, /\.workspace-page-overview \.support-panel-kicker,\s*\.workspace-page-overview \.today-review-detail-label,\s*\.workspace-page-overview \.today-next-chip-label\s*\{\s*color:\s*#5f7190;/);
  assert.match(css, /\.workspace-page-overview \.today-queue-list\s*\{\s*gap:\s*0;\s*border:\s*1px solid #d7deea;/);
  assert.match(css, /\.workspace-page-overview \.today-side-column\s*\{[^}]*border-left:\s*1px solid #d7deea;/);
});

test("dashboard contact detail and row states stay crisp instead of washed out", () => {
  const css = readDashboardCss();

  assert.match(css, /\.contact-row\.active\s*\{[^}]*background:\s*rgba\(20,\s*184,\s*166,\s*0\.08\);[^}]*box-shadow:\s*inset 3px 0 0 rgba\(20,\s*184,\s*166,\s*0\.72\)/i);
  assert.match(css, /\.contact-detail-panel\s*\{[^}]*border:\s*1px solid var\(--surface-border\);[^}]*background:\s*linear-gradient/i);
  assert.match(css, /\.detail-panel-section\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.042\)/i);
});

test("dashboard chips and light-shell support panels use explicit readable surfaces", () => {
  const css = readDashboardCss();
  const contactFilterButton = getCssBlock(css, ".contact-filter-button");
  const contactFilterButtonActive = getCssBlock(css, ".contact-filter-button.active");
  const lightSupportPanel = getCssBlock(css, ".workspace-page-overview .support-panel");

  assert.match(contactFilterButton, /border:\s*1px solid var\(--surface-border\)/i);
  assert.match(contactFilterButton, /color:\s*var\(--muted-strong\)/i);
  assert.match(contactFilterButtonActive, /color:\s*white/i);
  assert.match(lightSupportPanel, /border:\s*1px solid #dbe4ef/i);
  assert.match(lightSupportPanel, /background:\s*#ffffff/i);
});

test("dashboard light-workspace badges and summary cards keep dark-on-light text", () => {
  const css = readDashboardCss();
  const workspaceBadgeRow = getCssBlock(css, ".workspace-badge-row");

  assert.match(workspaceBadgeRow, /display:\s*flex/i);
  assert.match(css, /\.workspace-page \.badge\.success,\s*\.workspace-page-overview \.badge\.success\s*\{[^}]*background:\s*#ddf5ea;[^}]*color:\s*#166349;/i);
  assert.match(css, /\.workspace-page \.badge\.warning,\s*\.workspace-page-overview \.badge\.warning\s*\{[^}]*background:\s*#fff1d7;[^}]*color:\s*#9b5e00;/i);
  assert.match(css, /\.workspace-page \.pill,\s*\.workspace-page \.badge,\s*\.workspace-page \.preview-status-pill,[^}]*color:\s*#4a5e7b;/i);
  assert.match(css, /\.overview-value,\s*\.operator-focus-title,\s*\.operator-checklist-title,\s*\.operator-empty-title\s*\{\s*color:\s*#22324a;/i);
  assert.match(css, /\.workspace-record-row-copy,[^}]*\.operator-focus-copy,[^}]*\.operator-empty-copy\s*\{\s*color:\s*#42536d;/i);
});
