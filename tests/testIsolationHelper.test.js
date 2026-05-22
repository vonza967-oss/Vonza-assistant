import test from "node:test";
import assert from "node:assert/strict";

import {
  applyEnv,
  resetBrowserGlobals,
  restoreEnv,
  snapshotEnv,
} from "./helpers/testIsolation.js";

test("test isolation helper restores changed and deleted env values", () => {
  process.env.VONZA_TEST_ISOLATION_PRESENT = "before";
  delete process.env.VONZA_TEST_ISOLATION_MISSING;
  const snapshot = snapshotEnv([
    "VONZA_TEST_ISOLATION_PRESENT",
    "VONZA_TEST_ISOLATION_MISSING",
  ]);

  applyEnv({
    VONZA_TEST_ISOLATION_PRESENT: "after",
    VONZA_TEST_ISOLATION_MISSING: "created",
  });

  restoreEnv(snapshot);

  assert.equal(process.env.VONZA_TEST_ISOLATION_PRESENT, "before");
  assert.equal(process.env.VONZA_TEST_ISOLATION_MISSING, undefined);
  delete process.env.VONZA_TEST_ISOLATION_PRESENT;
});

test("test isolation helper clears browser globals", () => {
  globalThis.window = {};
  globalThis.document = {};
  globalThis.localStorage = {};

  resetBrowserGlobals(["window", "document", "localStorage"]);

  assert.equal(globalThis.window, undefined);
  assert.equal(globalThis.document, undefined);
  assert.equal(globalThis.localStorage, undefined);
});
