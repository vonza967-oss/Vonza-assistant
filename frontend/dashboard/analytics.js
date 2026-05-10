function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1).replace(/\.0$/, "")}%`;
}

function getAgentId() {
  return new URLSearchParams(window.location.search).get("agent_id") || "";
}

async function getAuthToken() {
  if (window.VonzaAuth?.getAccessToken) {
    return window.VonzaAuth.getAccessToken();
  }

  if (window.VonzaSupabase?.auth?.getSession) {
    const { data } = await window.VonzaSupabase.auth.getSession();
    return data?.session?.access_token || "";
  }

  if (window.supabase?.createClient && window.VONZA_SUPABASE_URL && window.VONZA_SUPABASE_ANON_KEY) {
    const client = window.supabase.createClient(
      window.VONZA_SUPABASE_URL,
      window.VONZA_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          detectSessionInUrl: true,
        },
      }
    );
    const { data } = await client.auth.getSession();
    return data?.session?.access_token || "";
  }

  return "";
}

function renderQuestionRows(items = [], emptyCopy) {
  if (!items.length) {
    return `<p class="standalone-analytics-empty">${escapeHtml(emptyCopy)}</p>`;
  }

  return `
    <table class="standalone-analytics-table">
      <tbody>
        ${items.map((item) => `
          <tr>
            <td>${escapeHtml(item.summary || item.question || "Customer question")}</td>
            <td>${escapeHtml(item.count ? `${item.count}x` : item.createdAt || "")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderAnalytics(data) {
  const root = document.getElementById("owner-analytics-root");
  const metrics = data.metrics || {};
  const aiUsage = data.aiUsage || {};

  root.innerHTML = `
    <div class="standalone-analytics-header">
      <div>
        <p class="overview-label">${escapeHtml(data.agent?.name || "Vonza")}</p>
        <h1>Owner analytics</h1>
        <p>Conversation, lead, conversion, question, and AI-capacity metrics for this front desk.</p>
      </div>
      <a class="ghost-button" href="/dashboard">Back to dashboard</a>
    </div>

    <section class="standalone-analytics-metrics">
      ${[
        ["Total conversations", formatNumber(metrics.totalConversations)],
        ["Leads captured", formatNumber(metrics.leadsCaptured)],
        ["Conversion rate", formatPercent(metrics.conversionRate)],
        ["AI capacity used", formatPercent(aiUsage.percentUsed)],
      ].map(([label, value]) => `
        <article class="analytics-report-metric-card">
          <p class="analytics-report-metric-label">${escapeHtml(label)}</p>
          <strong class="analytics-report-metric-value">${escapeHtml(value)}</strong>
        </article>
      `).join("")}
    </section>

    <section class="workspace-card-soft">
      <h2 class="flat-section-title">AI usage vs plan capacity</h2>
      <div class="standalone-analytics-capacity">
        <div class="standalone-analytics-bar" aria-label="AI usage">
          <span style="width:${Math.min(100, Math.max(0, Number(aiUsage.percentUsed || 0)))}%"></span>
        </div>
        <p>${escapeHtml(aiUsage.statusLabel || "Usage unavailable")} (${escapeHtml(aiUsage.planName || aiUsage.planKey || "plan")})</p>
      </div>
    </section>

    <section class="standalone-analytics-grid">
      <article class="workspace-card-soft">
        <h2 class="flat-section-title">Top visitor questions</h2>
        ${renderQuestionRows(data.topVisitorQuestions || [], "No repeated visitor questions yet.")}
      </article>
      <article class="workspace-card-soft">
        <h2 class="flat-section-title">Missed questions</h2>
        ${renderQuestionRows(data.missedQuestions || [], "No unknown-answer pattern detected yet.")}
      </article>
    </section>
  `;
}

async function boot() {
  const root = document.getElementById("owner-analytics-root");
  const agentId = getAgentId();

  if (!agentId) {
    root.innerHTML = `
      <h1>Owner analytics</h1>
      <p class="standalone-analytics-empty">Open this page with an agent_id query parameter from the dashboard.</p>
    `;
    return;
  }

  const token = await getAuthToken();
  const url = new URL("/dashboard/analytics", window.location.origin);
  url.searchParams.set("agent_id", agentId);

  const response = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Could not load analytics.");
  }

  renderAnalytics(data);
}

boot().catch((error) => {
  const root = document.getElementById("owner-analytics-root");
  root.innerHTML = `
    <h1>Owner analytics</h1>
    <p class="standalone-analytics-empty">${escapeHtml(error.message || "Could not load analytics.")}</p>
  `;
});
