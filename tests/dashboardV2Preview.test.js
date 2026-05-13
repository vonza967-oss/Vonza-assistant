import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function readPreviewFile(fileName) {
  return readFileSync(path.join(repoRoot, "frontend", fileName), "utf8");
}

function renderPreview(hash = "") {
  const root = { innerHTML: "" };
  const listeners = new Map();
  const document = {
    title: "",
    getElementById(id) {
      return id === "v2-preview-root" ? root : null;
    },
    addEventListener(type, callback) {
      listeners.set(`document:${type}`, callback);
    },
  };
  const window = {
    location: { hash },
    addEventListener(type, callback) {
      listeners.set(`window:${type}`, callback);
    },
  };

  vm.runInNewContext(readPreviewFile("dashboard-v2-preview.js"), { document, window }, {
    filename: "frontend/dashboard-v2-preview.js",
  });

  return { document, root, window, listeners };
}

test("dashboard V2 preview renders compact mock dashboard sections", () => {
  const { document, root } = renderPreview();
  const html = root.innerHTML;

  assert.equal(document.title, "Vonza V2 Preview | Home");
  assert.match(html, /class="v2-app"/);
  assert.match(html, /Priority queue/);
  assert.match(html, /Assistant readiness/);
  assert.match(html, /Source activity/);
  assert.equal((html.match(/class="v2-metric-card"/g) || []).length, 4);
  assert.doesNotMatch(html, /Today's priority/);
});

test("dashboard V2 install preview uses equal step cards and semantic statuses", () => {
  const { document, root } = renderPreview("#install");
  const html = root.innerHTML;

  assert.equal(document.title, "Vonza V2 Preview | Install");
  assert.match(html, /v2-install-steps-grid/);
  assert.match(html, /Install steps/);
  assert.match(html, /class="v2-pill green">Installed/);
  assert.match(html, /class="v2-pill amber">Needs verification/);
  assert.match(html, /class="v2-pill green">Live/);
  assert.doesNotMatch(html, /class="v2-pill teal">(?:Installed|Live)/);
});

test("dashboard V2 polish CSS keeps neutral surfaces and semantic outlines", () => {
  const css = readPreviewFile("dashboard-v2-preview.css");

  assert.match(css, /--v2-bg:\s*#f4f6f9;/);
  assert.match(css, /\.v2-icon-badge\s*\{[^}]*background:\s*#ffffff;[^}]*border:\s*1px solid #dbe4ef;/s);
  assert.match(css, /\.v2-pill\s*\{[^}]*background:\s*#f8fafc;[^}]*border:\s*1px solid #dbe4ef;/s);
  assert.match(css, /\.v2-pill\.green\s*\{[^}]*color:\s*#166534;[^}]*border-color:\s*#9ac7a8;/s);
  assert.match(css, /\.v2-pill\.amber\s*\{[^}]*color:\s*#92400e;[^}]*border-color:\s*#d8a84e;/s);
  assert.match(css, /\.v2-pill\.red\s*\{[^}]*color:\s*#991b1b;[^}]*border-color:\s*#e19b9b;/s);
  assert.match(css, /\.v2-data-table tbody tr:nth-child\(even\):not\(\.is-selected\)\s*\{\s*background:\s*#fcfdff;/);
  assert.match(css, /\.v2-install-steps-grid\s*\{[^}]*grid-template-columns:\s*1fr;/s);
  assert.doesNotMatch(css, /v2-(?:blue|green|amber|red|purple)-soft/);
  assert.doesNotMatch(css, /background:\s*#(?:dff8f4|e7faf6|dbeafe|dcfce7|fef3c7|ffe4e6|ede9fe)/i);
});
