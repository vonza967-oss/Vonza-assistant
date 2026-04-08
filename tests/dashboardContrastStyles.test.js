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
  assert.match(css, /\.workspace-page-overview \.support-panel-kicker,\s*\.workspace-page-overview \.today-review-detail-label,\s*\.workspace-page-overview \.today-next-chip-label\s*\{\s*color:\s*#60708b;/);
  assert.match(css, /\.workspace-page-overview \.today-queue-list\s*\{\s*gap:\s*0;\s*border:\s*1px solid #d7deea;/);
  assert.match(css, /\.workspace-page-overview \.today-side-column\s*\{[^}]*border-left:\s*1px solid #d7deea;/);
});
