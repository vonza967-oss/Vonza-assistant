(function registerVonzaDashboardHelpers(global) {
  function trimText(value) {
    return String(value || "").trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeBillingPlanKey(value, plans = [], fallback = "growth") {
    const normalized = trimText(value).toLowerCase();
    return plans.some((plan) => plan?.key === normalized) ? normalized : fallback;
  }

  function formatPercent(value) {
    return `${Math.round(Number(value || 0))}%`;
  }

  function formatBillingDate(value) {
    if (!trimText(value)) {
      return "Not available yet";
    }

    const timestamp = new Date(value).getTime();

    if (!Number.isFinite(timestamp)) {
      return "Not available yet";
    }

    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  global.VonzaDashboardHelpers = Object.freeze({
    escapeHtml,
    trimText,
    normalizeBillingPlanKey,
    formatPercent,
    formatBillingDate,
  });
})(window);
