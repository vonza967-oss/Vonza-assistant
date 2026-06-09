import test from "node:test";
import assert from "node:assert/strict";

import { FEATURE_STATES, getPublicLaunchProfile } from "../src/config/publicLaunch.js";

test("public launch profile defines the stable core and hides Google workspace surfaces", () => {
  const profile = getPublicLaunchProfile({
    operatorWorkspaceEnabled: true,
  });

  assert.equal(profile.mode, "public_cohort_v1");
  assert.equal(profile.product.name, "Vonza Website Widget");
  assert.match(profile.product.headline, /AI agent on your website in 5 minutes/i);
  assert.match(profile.product.purchaseSummary, /Website Widget/i);
  assert.equal(profile.icp.key, "service_businesses_with_inbound_leads");
  assert.equal(profile.matrix.front_desk.state, FEATURE_STATES.STABLE);
  assert.equal(profile.matrix.customize.label, "Widget configuration");
  assert.equal(profile.matrix.today.state, FEATURE_STATES.STABLE);
  assert.equal(profile.matrix.contacts.state, FEATURE_STATES.STABLE);
  assert.equal(profile.matrix.outcomes.state, FEATURE_STATES.STABLE);
  assert.equal(profile.matrix.inbox.state, FEATURE_STATES.HIDDEN);
  assert.equal(profile.matrix.calendar.state, FEATURE_STATES.HIDDEN);
  assert.equal(profile.matrix.automations.state, FEATURE_STATES.HIDDEN);
  assert.equal(profile.matrix.advanced_guidance.state, FEATURE_STATES.HIDDEN);
  assert.equal(profile.matrix.manual_outcome_marks.state, FEATURE_STATES.HIDDEN);
  assert.equal(profile.matrix.knowledge_fix_workflows.state, FEATURE_STATES.HIDDEN);
  assert.deepEqual(profile.beta, []);
});

test("public launch profile hides operator beta surfaces when the workspace flag is off", () => {
  const profile = getPublicLaunchProfile({
    operatorWorkspaceEnabled: false,
  });

  assert.equal(profile.matrix.contacts.state, FEATURE_STATES.STABLE);
  assert.equal(profile.matrix.google_connect.state, FEATURE_STATES.HIDDEN);
  assert.equal(profile.matrix.inbox.state, FEATURE_STATES.HIDDEN);
  assert.equal(profile.matrix.calendar.state, FEATURE_STATES.HIDDEN);
  assert.equal(profile.matrix.automations.state, FEATURE_STATES.HIDDEN);
});
