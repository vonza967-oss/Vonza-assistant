/**
 * @typedef {Object} DashboardAgentContract
 * @property {string} id
 * @property {string} accessStatus
 * @property {string=} publicAgentKey
 * @property {string=} installId
 * @property {Object=} installStatus
 * @property {Object=} fullPageConfig
 */

/**
 * @typedef {Object} DashboardActionQueueContract
 * @property {Array<Object>} items
 * @property {Object} summary
 * @property {Object} analyticsSummary
 * @property {Object} humanFollowUps
 * @property {Object} ownerNotifications
 * @property {boolean} persistenceAvailable
 * @property {boolean} migrationRequired
 */

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function addError(errors, condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

export function validateDashboardAgentContract(agent) {
  const errors = [];

  addError(errors, isPlainObject(agent), "agent must be an object");

  if (!isPlainObject(agent)) {
    return { ok: false, errors };
  }

  addError(errors, hasString(agent.id), "agent.id must be a non-empty string");
  addError(
    errors,
    ["pending", "active", "suspended"].includes(agent.accessStatus),
    "agent.accessStatus must be pending, active, or suspended"
  );

  if (agent.publicAgentKey !== undefined) {
    addError(errors, typeof agent.publicAgentKey === "string", "agent.publicAgentKey must be a string");
  }

  if (agent.installStatus !== undefined) {
    addError(errors, isPlainObject(agent.installStatus), "agent.installStatus must be an object");
  }

  if (agent.fullPageConfig !== undefined) {
    addError(errors, isPlainObject(agent.fullPageConfig), "agent.fullPageConfig must be an object");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function validateDashboardActionQueueContract(payload) {
  const errors = [];

  addError(errors, isPlainObject(payload), "action queue payload must be an object");

  if (!isPlainObject(payload)) {
    return { ok: false, errors };
  }

  addError(errors, Array.isArray(payload.items), "items must be an array");
  addError(errors, isPlainObject(payload.summary), "summary must be an object");
  addError(errors, isPlainObject(payload.analyticsSummary), "analyticsSummary must be an object");
  addError(errors, isPlainObject(payload.humanFollowUps), "humanFollowUps must be an object");
  addError(errors, isPlainObject(payload.ownerNotifications), "ownerNotifications must be an object");
  addError(errors, typeof payload.persistenceAvailable === "boolean", "persistenceAvailable must be boolean");
  addError(errors, typeof payload.migrationRequired === "boolean", "migrationRequired must be boolean");

  if (isPlainObject(payload.analyticsSummary)) {
    addError(errors, typeof payload.analyticsSummary.totalMessages === "number", "analyticsSummary.totalMessages must be numeric");
    addError(errors, typeof payload.analyticsSummary.visitorQuestions === "number", "analyticsSummary.visitorQuestions must be numeric");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
