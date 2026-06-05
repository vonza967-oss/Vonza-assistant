(function initEnterpriseRequestDeskDashboard() {
  const root = document.getElementById("erdp-dashboard-root");
  const accountRoot = document.getElementById("erdp-account");
  const statusRoot = document.getElementById("erdp-dashboard-status");
  const FIXTURE_STORAGE_KEY = "VONZA_ENTERPRISE_REQUEST_DESK_FIXTURE_REQUESTS";
  const REVIEW_ACTIONS = Object.freeze([
    ["needs_info", "Hiányzó adat"],
    ["needs_staff_review", "Staff review"],
    ["routed", "Belső továbbítás"],
    ["declined", "Elutasítva"],
    ["archived", "Archiválás"],
  ]);
  const REVIEW_ACTION_SET = new Set(REVIEW_ACTIONS.map(([status]) => status));

  let authClient = null;
  let authSession = null;
  let authUser = null;
  let state = {
    records: [],
    summary: null,
    selectedId: "",
    requestError: null,
  };

  if (!root) {
    return;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function trimText(value) {
    return String(value ?? "").trim();
  }

  function setStatus(message = "") {
    if (statusRoot) {
      statusRoot.textContent = message;
    }
  }

  function getApiPrefix() {
    return window.location.pathname.startsWith("/esg-request-desk")
      ? "/esg-request-desk"
      : "/enterprise-request-desk";
  }

  function hasAuthConfig() {
    return Boolean(window.VONZA_SUPABASE_URL && window.VONZA_SUPABASE_ANON_KEY && window.supabase?.createClient);
  }

  function createAuthClientIfNeeded() {
    if (authClient || !hasAuthConfig()) {
      return authClient;
    }

    authClient = window.supabase.createClient(
      window.VONZA_SUPABASE_URL,
      window.VONZA_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          detectSessionInUrl: true,
        },
      }
    );

    authClient.auth.onAuthStateChange((_event, session) => {
      authSession = session || null;
      authUser = authSession?.user || null;
      renderAccount();
    });

    return authClient;
  }

  async function ensureAuthSession() {
    const client = createAuthClientIfNeeded();

    if (!client) {
      return null;
    }

    const { data, error } = await client.auth.getSession();
    if (error) {
      throw error;
    }

    authSession = data?.session?.access_token ? data.session : null;
    authUser = authSession?.user || null;
    renderAccount();
    return authSession;
  }

  function getAuthHeaders(headers = {}) {
    return {
      ...headers,
      ...(authSession?.access_token ? { Authorization: `Bearer ${authSession.access_token}` } : {}),
    };
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: getAuthHeaders(options.headers || {}),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(data?.error || "A kérés nem sikerült.");
      error.code = data?.code || "";
      throw error;
    }

    return data;
  }

  function readFixtureRows() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(FIXTURE_STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeFixtureRows(rows = []) {
    window.localStorage.setItem(FIXTURE_STORAGE_KEY, JSON.stringify(rows.slice(0, 20)));
  }

  function seedFixtureRowsIfNeeded() {
    const existing = readFixtureRows();
    if (existing.length) {
      return existing;
    }

    const rows = [
      {
        id: "erd-fixture-seed-1",
        lane: "facility_management",
        laneLabel: "Facility management",
        confidence: "medium",
        requestText: "Facility management támogatás kell egy budapesti telephelyre, karbantartás és takarítás egyeztetéssel, jövő héten. Telefon: +36 30 123 4567.",
        siteOrObject: "telephely",
        locationText: "Budapest",
        serviceNeed: "Facility management támogatás",
        timingText: "jövő héten",
        urgency: "egyeztethető",
        contactName: "",
        contactEmail: "",
        contactPhone: "+36 30 123 4567",
        missingFields: [],
        structuredBrief: {
          lane: "facility_management",
          laneLabelHu: "Facility management",
          serviceNeed: "Facility management támogatás",
          locationOrSite: "Budapest telephely",
          urgencyOrTiming: "jövő héten",
          contactNeed: "Biztonságos elérhetőség megadva a visszajelzéshez.",
          staffSummaryHu: "Belső brief: Facility management. Igény: karbantartás és takarítás egyeztetés. Helyszín/objektum: budapesti telephely.",
        },
        status: "request_received",
        statusReason: "",
        staffNotes: "Fixture seed request.",
        createdAt: "2026-06-05T09:00:00.000Z",
        updatedAt: "2026-06-05T09:00:00.000Z",
      },
    ];
    writeFixtureRows(rows);
    return rows;
  }

  function formatDateTime(value) {
    if (!value) {
      return "Nincs megadva";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Nincs megadva";
    }

    return new Intl.DateTimeFormat("hu-HU", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  function valueOrEmpty(value) {
    return trimText(value) || "Nincs megadva";
  }

  function statusLabel(status) {
    switch (trimText(status).toLowerCase()) {
      case "request_received":
        return "Új";
      case "needs_info":
        return "Hiányzó adat";
      case "needs_staff_review":
        return "Staff review";
      case "routed":
        return "Belső továbbítás";
      case "declined":
        return "Elutasítva";
      case "archived":
        return "Archivált";
      default:
        return "Review";
    }
  }

  function statusBadgeClass(status) {
    switch (trimText(status).toLowerCase()) {
      case "needs_info":
        return "needs-info";
      case "needs_staff_review":
        return "reviewing";
      case "routed":
        return "routed";
      case "declined":
      case "archived":
        return "closed";
      default:
        return "";
    }
  }

  function buildSummary(records) {
    const count = (statuses) => records.filter((record) =>
      statuses.includes(trimText(record.status).toLowerCase())
    ).length;

    return {
      total: records.length,
      requestReceived: count(["request_received"]),
      needsInfo: count(["needs_info"]),
      needsStaffReview: count(["needs_staff_review"]),
      routed: count(["routed"]),
      closed: count(["declined", "archived"]),
    };
  }

  function normalizeRecord(record = {}) {
    const brief = record.structuredBrief || record.structured_brief || {};

    return {
      id: trimText(record.id),
      lane: trimText(record.lane),
      laneLabel: trimText(record.laneLabel || record.lane_label || brief.laneLabelHu || brief.lane_label_hu),
      confidence: trimText(record.confidence),
      requestText: trimText(record.requestText || record.request_text),
      siteOrObject: trimText(record.siteOrObject || record.site_or_object || brief.siteType || brief.site_type),
      locationText: trimText(record.locationText || record.location_text || brief.locationOrSite || brief.location_or_site),
      serviceNeed: trimText(record.serviceNeed || record.service_need || brief.serviceNeed || brief.service_need),
      timingText: trimText(record.timingText || record.timing_text || brief.urgencyOrTiming || brief.urgency_or_timing),
      urgency: trimText(record.urgency),
      contactName: trimText(record.contactName || record.contact_name || brief.contactName || brief.contact_name),
      contactEmail: trimText(record.contactEmail || record.contact_email || brief.contactEmail || brief.contact_email),
      contactPhone: trimText(record.contactPhone || record.contact_phone || brief.contactPhone || brief.contact_phone),
      missingFields: Array.isArray(record.missingFields || record.missing_fields)
        ? (record.missingFields || record.missing_fields).map(trimText).filter(Boolean)
        : [],
      structuredBrief: brief && typeof brief === "object" ? brief : {},
      status: trimText(record.status || "request_received"),
      statusReason: trimText(record.statusReason || record.status_reason),
      staffNotes: trimText(record.staffNotes || record.staff_notes),
      createdAt: record.createdAt || record.created_at || null,
      updatedAt: record.updatedAt || record.updated_at || null,
    };
  }

  function getSelectedRecord() {
    if (!state.records.length) {
      return null;
    }

    return state.records.find((record) => record.id === state.selectedId) || state.records[0];
  }

  function renderAccount() {
    if (!accountRoot) {
      return;
    }

    if (window.VONZA_LOCAL_ENTERPRISE_DASHBOARD_FIXTURE === true) {
      accountRoot.innerHTML = `<span class="erdp-account-email">Local fixture</span>`;
      return;
    }

    if (!authUser?.email) {
      accountRoot.innerHTML = "";
      return;
    }

    accountRoot.innerHTML = `
      <span class="erdp-account-email">${escapeHtml(authUser.email)}</span>
      <button class="erdp-button" type="button" data-erdp-sign-out>Kilépés</button>
    `;
  }

  function renderAuthGate(message = "") {
    root.innerHTML = `
      <section class="erdp-auth-card" aria-label="ESG Request Desk belépés">
        <div>
          <h2>Belépés szükséges</h2>
          <p>Az Enterprise Request Desk review felület owner-scoped és csak bejelentkezett felhasználóknak érhető el.</p>
          ${message ? `<p>${escapeHtml(message)}</p>` : ""}
        </div>
        <form class="erdp-auth-form" data-erdp-auth-form>
          <label class="erdp-field">
            Email
            <input type="email" name="email" autocomplete="email" required>
          </label>
          <label class="erdp-field">
            Jelszó
            <input type="password" name="password" autocomplete="current-password">
          </label>
          <div class="erdp-auth-actions">
            <button class="erdp-button erdp-button-primary" type="submit" data-erdp-auth-mode="password">Belépés</button>
            <button class="erdp-button" type="button" data-erdp-auth-mode="magic">Varázslink küldése</button>
          </div>
        </form>
      </section>
    `;
  }

  function renderAuthUnavailable() {
    root.innerHTML = `
      <section class="erdp-empty">
        <div>
          <h2>A Supabase Auth nincs beállítva</h2>
          <p>A dashboard HTML betöltött, de az élő Enterprise Request Desk queue-hoz auth konfiguráció szükséges.</p>
        </div>
      </section>
    `;
  }

  function metric(label, value) {
    return `
      <article class="erdp-metric">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </article>
    `;
  }

  function renderMetrics(summary) {
    return `
      <section class="erdp-metrics" aria-label="Enterprise Request Desk áttekintés">
        ${metric("Összes kérés", summary.total || 0)}
        ${metric("Új", summary.requestReceived || 0)}
        ${metric("Hiányzó adat", summary.needsInfo || 0)}
        ${metric("Staff review", summary.needsStaffReview || 0)}
        ${metric("Belső továbbítás / lezárt", (summary.routed || 0) + (summary.closed || 0))}
      </section>
    `;
  }

  function renderRequestRow(record, selected) {
    return `
      <button
        class="erdp-request-row ${selected ? "is-active" : ""}"
        type="button"
        data-erdp-select-request="${escapeHtml(record.id)}"
      >
        <strong>${escapeHtml(valueOrEmpty(record.serviceNeed || record.laneLabel))}</strong>
        <span>${escapeHtml(valueOrEmpty(record.laneLabel))} · ${escapeHtml(valueOrEmpty(record.locationText || record.siteOrObject))}</span>
        <span>${escapeHtml(valueOrEmpty(record.requestText))}</span>
        <em>${escapeHtml(statusLabel(record.status))} · ${escapeHtml(formatDateTime(record.createdAt))}</em>
      </button>
    `;
  }

  function renderQueue(records, selectedRecord) {
    return `
      <section class="erdp-panel" id="queue" aria-label="Request queue">
        <div class="erdp-panel-header">
          <div>
            <h2>Request queue</h2>
            <p>Request-only Enterprise intake. A queue csak briefet, hiányzó adatot és staff review állapotot kezel.</p>
          </div>
          <button class="erdp-button" type="button" data-erdp-refresh>Frissítés</button>
        </div>
        <div class="erdp-panel-body">
          <div class="erdp-request-list">
            ${records.length
              ? records.map((record) => renderRequestRow(record, record.id === selectedRecord?.id)).join("")
              : `<div class="erdp-empty"><p>Még nincs beérkezett Enterprise Request Desk kérés.</p></div>`}
          </div>
        </div>
      </section>
    `;
  }

  function detailItem(label, value) {
    return `
      <div class="erdp-detail-item">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(valueOrEmpty(value))}</strong>
      </div>
    `;
  }

  function missingFieldLabel(field) {
    switch (trimText(field)) {
      case "service_need":
        return "szolgáltatási igény";
      case "location_or_site":
        return "helyszín vagy objektum";
      case "urgency_or_timing":
        return "időzítés vagy sürgősség";
      case "contact_need":
        return "biztonságos kapcsolati adat";
      default:
        return field;
    }
  }

  function getContactNeeded(record) {
    if (record.contactEmail || record.contactPhone) {
      return "Kapcsolati adat megadva";
    }

    return record.structuredBrief?.contactNeed || "Kapcsolati adat hiányzik a visszajelzéshez.";
  }

  function renderDetail(record) {
    if (!record) {
      return `
        <section class="erdp-panel" id="detail" aria-label="Structured brief">
          <div class="erdp-panel-header">
            <div>
              <h2>Structured brief</h2>
              <p>Válasszon ki egy kérést a részletekhez.</p>
            </div>
          </div>
          <div class="erdp-panel-body">
            <div class="erdp-empty"><p>A brief, missing fields, contact need és staff jegyzet itt jelenik meg.</p></div>
          </div>
        </section>
      `;
    }

    const missingFields = record.missingFields;
    const staffSummary = trimText(record.structuredBrief?.staffSummaryHu || record.structuredBrief?.staff_summary_hu);
    const saveStatus = REVIEW_ACTION_SET.has(record.status) ? record.status : "needs_staff_review";

    return `
      <section class="erdp-panel" id="detail" aria-label="Structured brief">
        <div class="erdp-panel-header">
          <div>
            <h2>Structured brief</h2>
            <p>Lane, hiányzó mezők, kapcsolat és staff jegyzet request review-hoz.</p>
          </div>
        </div>
        <div class="erdp-panel-body">
          <div class="erdp-detail-title">
            <h3>${escapeHtml(valueOrEmpty(record.serviceNeed || record.laneLabel))}</h3>
            <span class="erdp-badge ${escapeHtml(statusBadgeClass(record.status))}">${escapeHtml(statusLabel(record.status))}</span>
          </div>
          <div class="erdp-detail-grid">
            ${detailItem("Lane", record.laneLabel)}
            ${detailItem("Confidence", record.confidence)}
            ${detailItem("Objektum / site", record.siteOrObject)}
            ${detailItem("Helyszín", record.locationText)}
            ${detailItem("Szolgáltatási igény", record.serviceNeed)}
            ${detailItem("Időzítés", record.timingText || record.urgency)}
            ${detailItem("Kapcsolat szükséges", getContactNeeded(record))}
            ${detailItem("Kapcsolattartó", record.contactName)}
            ${detailItem("Email", record.contactEmail)}
            ${detailItem("Telefon", record.contactPhone)}
            ${detailItem("Beérkezett", formatDateTime(record.createdAt))}
            ${staffSummary ? detailItem("Belső összefoglaló", staffSummary) : ""}
          </div>
          <div>
            <span class="erdp-submit-note">Hiányzó adatok</span>
            <div class="erdp-missing-list">
              ${missingFields.length
                ? missingFields.map((field) => `<span>${escapeHtml(missingFieldLabel(field))}</span>`).join("")
                : "<span>nincs hiányzó minimális adat</span>"}
            </div>
          </div>
          <label class="erdp-field">
            Státusz oka
            <textarea data-erdp-status-reason>${escapeHtml(record.statusReason)}</textarea>
          </label>
          <label class="erdp-field">
            Staff jegyzet
            <textarea data-erdp-staff-notes>${escapeHtml(record.staffNotes)}</textarea>
          </label>
          <div class="erdp-actions" aria-label="Biztonságos review státuszok">
            ${REVIEW_ACTIONS.map(([status, label]) => `
              <button
                class="erdp-button ${status === "declined" ? "erdp-button-danger" : ""}"
                type="button"
                data-erdp-status-action="${escapeHtml(status)}"
                data-erdp-request-id="${escapeHtml(record.id)}"
              >${escapeHtml(label)}</button>
            `).join("")}
            <button
              class="erdp-button erdp-button-primary"
              type="button"
              data-erdp-status-action="${escapeHtml(saveStatus)}"
              data-erdp-request-id="${escapeHtml(record.id)}"
            >Jegyzet mentése</button>
          </div>
        </div>
      </section>
    `;
  }

  function renderRecent(records) {
    const recent = records.slice(0, 5);

    return `
      <section class="erdp-panel" aria-label="Legutóbbi Enterprise Request Desk kérések">
        <div class="erdp-panel-header">
          <div>
            <h2>Legutóbbi kérések</h2>
            <p>Tényleges request rekordokból épül, nem demo pitch lista.</p>
          </div>
        </div>
        <div class="erdp-panel-body erdp-recent">
          ${recent.length ? recent.map((record) => `
            <div class="erdp-recent-row">
              <div>
                <strong>${escapeHtml(valueOrEmpty(record.serviceNeed || record.laneLabel))}</strong>
                <span>${escapeHtml(statusLabel(record.status))} · ${escapeHtml(valueOrEmpty(record.laneLabel))} · ${escapeHtml(valueOrEmpty(record.locationText || record.siteOrObject))}</span>
              </div>
              <time>${escapeHtml(formatDateTime(record.createdAt))}</time>
            </div>
          `).join("") : `
            <div class="erdp-empty"><p>Nincs megjeleníthető kérés.</p></div>
          `}
        </div>
      </section>
    `;
  }

  function renderDashboard() {
    const records = state.records;
    const summary = state.summary || buildSummary(records);
    const selectedRecord = getSelectedRecord();

    root.innerHTML = `
      <div class="erdp-dashboard">
        <section class="erdp-safety-strip" aria-label="Enterprise Request Desk határok">
          <div>
            <strong>Working pilot loop: public intake -> structured request -> owner review.</strong>
            <p>Különálló pilot felület, amely intake rekordot és owner review munkát kezel.</p>
          </div>
          <span>Request intake / review</span>
        </section>
        ${state.requestError ? `
          <section class="erdp-error-strip" aria-label="Enterprise Request Desk betöltési hiba">
            <strong>A request queue nem tölthető be.</strong>
            <p>${escapeHtml(state.requestError.message)}</p>
          </section>
        ` : ""}
        ${renderMetrics(summary)}
        <div class="erdp-workspace">
          ${renderQueue(records, selectedRecord)}
          ${renderDetail(selectedRecord)}
        </div>
        ${renderRecent(records)}
      </div>
    `;
  }

  async function loadRequests() {
    if (window.VONZA_LOCAL_ENTERPRISE_DASHBOARD_FIXTURE === true) {
      const records = seedFixtureRowsIfNeeded().map(normalizeRecord);
      state = {
        ...state,
        records,
        summary: buildSummary(records),
        selectedId: state.selectedId || records[0]?.id || "",
        requestError: null,
      };
      renderAccount();
      setStatus(records.length ? "Local fixture queue betöltve." : "Nincs fixture request.");
      renderDashboard();
      return;
    }

    setStatus("Enterprise Request Desk queue betöltése...");
    try {
      const data = await fetchJson(`${getApiPrefix()}/requests?limit=100`);
      const records = Array.isArray(data.records) ? data.records.map(normalizeRecord) : [];
      state = {
        ...state,
        records,
        summary: data.summary || buildSummary(records),
        selectedId: state.selectedId || records[0]?.id || "",
        requestError: null,
      };
      setStatus(records.length ? "Enterprise Request Desk queue betöltve." : "Még nincs beérkezett kérés.");
    } catch (error) {
      state = {
        ...state,
        records: [],
        summary: buildSummary([]),
        requestError: {
          code: error.code || "",
          message: error.message || "Enterprise Request Desk queue nem tölthető be.",
        },
      };
      setStatus(state.requestError.message);
    }
    renderDashboard();
  }

  async function updateRequestStatus(button) {
    const requestId = trimText(button.dataset.erdpRequestId);
    const status = trimText(button.dataset.erdpStatusAction);
    const statusReason = root.querySelector("[data-erdp-status-reason]")?.value || "";
    const staffNotes = root.querySelector("[data-erdp-staff-notes]")?.value || "";

    if (!requestId || !status) {
      return;
    }

    button.disabled = true;
    setStatus("Review állapot mentése...");

    try {
      if (window.VONZA_LOCAL_ENTERPRISE_DASHBOARD_FIXTURE === true) {
        const rows = readFixtureRows();
        const now = new Date().toISOString();
        const updatedRows = rows.map((record) => record.id === requestId
          ? {
            ...record,
            status,
            statusReason,
            staffNotes,
            updatedAt: now,
          }
          : record);
        writeFixtureRows(updatedRows);
        state.records = updatedRows.map(normalizeRecord);
        state.summary = buildSummary(state.records);
        state.selectedId = requestId;
      } else {
        const data = await fetchJson(`${getApiPrefix()}/requests/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            request_id: requestId,
            status,
            status_reason: statusReason,
            staff_notes: staffNotes,
          }),
        });
        const nextRecord = normalizeRecord(data.request || {});
        state.records = state.records.map((record) => record.id === nextRecord.id ? nextRecord : record);
        state.summary = buildSummary(state.records);
        state.selectedId = nextRecord.id;
      }

      setStatus("Review állapot mentve.");
      renderDashboard();
    } catch (error) {
      setStatus(error.message || "Nem sikerült menteni az állapotot.");
      button.disabled = false;
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = trimText(new FormData(form).get("email"));
    const password = trimText(new FormData(form).get("password"));

    if (!email || !password) {
      setStatus("Email és jelszó szükséges a belépéshez.");
      return;
    }

    setStatus("Belépés...");
    const { data, error } = await authClient.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus(error.message || "Belépés sikertelen.");
      return;
    }

    authSession = data.session || null;
    authUser = authSession?.user || null;
    renderAccount();
    await loadRequests();
  }

  async function handleMagicLink(button) {
    const form = button.closest("form");
    const email = trimText(new FormData(form).get("email"));

    if (!email) {
      setStatus("Add meg az email címet a varázslinkhez.");
      return;
    }

    button.disabled = true;
    setStatus("Varázslink küldése...");

    try {
      const { error } = await authClient.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.href,
        },
      });

      if (error) {
        throw error;
      }

      setStatus("Varázslink elküldve.");
    } catch (error) {
      button.disabled = false;
      setStatus(error.message || "Nem sikerült elküldeni a varázslinket.");
    }
  }

  async function boot() {
    if (window.VONZA_LOCAL_ENTERPRISE_DASHBOARD_FIXTURE === true) {
      await loadRequests();
      return;
    }

    if (!hasAuthConfig()) {
      renderAuthUnavailable();
      setStatus("Auth konfiguráció hiányzik.");
      return;
    }

    try {
      await ensureAuthSession();
      if (!authSession || !authUser) {
        renderAuthGate();
        setStatus("Jelentkezzen be az Enterprise Request Desk review felülethez.");
        return;
      }

      await loadRequests();
    } catch (error) {
      renderAuthGate(error.message || "");
      setStatus(error.message || "Enterprise Request Desk dashboard nem tölthető be.");
    }
  }

  document.addEventListener("click", async (event) => {
    const target = event.target;
    const selectButton = target.closest?.("[data-erdp-select-request]");
    const statusButton = target.closest?.("[data-erdp-status-action]");
    const refreshButton = target.closest?.("[data-erdp-refresh]");
    const signOutButton = target.closest?.("[data-erdp-sign-out]");
    const magicButton = target.closest?.('[data-erdp-auth-mode="magic"]');

    if (selectButton) {
      state.selectedId = trimText(selectButton.dataset.erdpSelectRequest);
      renderDashboard();
      return;
    }

    if (statusButton) {
      await updateRequestStatus(statusButton);
      return;
    }

    if (refreshButton) {
      refreshButton.disabled = true;
      await loadRequests().finally(() => {
        refreshButton.disabled = false;
      });
      return;
    }

    if (signOutButton && authClient) {
      await authClient.auth.signOut();
      authSession = null;
      authUser = null;
      renderAccount();
      renderAuthGate();
      setStatus("Kilépve.");
      return;
    }

    if (magicButton) {
      await handleMagicLink(magicButton);
    }
  });

  document.addEventListener("submit", async (event) => {
    if (event.target.matches("[data-erdp-auth-form]")) {
      await handleAuthSubmit(event);
    }
  });

  boot();
}());
