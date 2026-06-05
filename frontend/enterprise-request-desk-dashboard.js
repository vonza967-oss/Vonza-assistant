(function initEnterpriseRequestDeskDashboard() {
  const root = document.getElementById("erdp-dashboard-root");
  const accountRoot = document.getElementById("erdp-account");
  const statusRoot = document.getElementById("erdp-dashboard-status");
  const FIXTURE_STORAGE_KEY = "VONZA_ENTERPRISE_REQUEST_DESK_FIXTURE_REQUESTS";
  const REVIEW_ACTIONS = Object.freeze([
    ["needs_info", "Hiányzó adat"],
    ["needs_staff_review", "Belső ellenőrzés"],
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
    setup: null,
    setupComplete: false,
    customerIntake: null,
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
        return "Belső ellenőrzés";
      case "routed":
        return "Belső továbbítás";
      case "declined":
        return "Elutasítva";
      case "archived":
        return "Archivált";
      default:
        return "Belső ellenőrzés";
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
      <span class="erdp-account-email">Bejelentkezve: ${escapeHtml(authUser.email)}</span>
      <button class="erdp-button" type="button" data-erdp-sign-out>Kilépés</button>
    `;
  }

  function renderAuthGate(message = "") {
    root.innerHTML = `
      <section class="erdp-auth-card" aria-label="ESG Request Desk belépés">
        <div>
          <h2>Belépés szükséges</h2>
          <p>Az Enterprise Request Desk dashboard tulajdonosi session alatt érhető el. Jelentkezz be, hozz létre fiókot, vagy kérj varázslinket.</p>
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
            <button class="erdp-button" type="submit" data-erdp-auth-mode="signup">Fiók létrehozása</button>
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
        ${metric("Belső ellenőrzés", summary.needsStaffReview || 0)}
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
      <section class="erdp-panel" id="queue" aria-label="Megkeresések">
        <div class="erdp-panel-header">
          <div>
            <h2>Megkeresések</h2>
            <p>Beérkező vállalati igények előszűrt összefoglalóval, hiányzó adattal és feldolgozási állapottal.</p>
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
        <section class="erdp-panel" id="detail" aria-label="Összefoglaló">
          <div class="erdp-panel-header">
            <div>
              <h2>Összefoglaló</h2>
              <p>Válassz ki egy megkeresést a részletekhez.</p>
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
        <section class="erdp-panel" id="detail" aria-label="Összefoglaló">
        <div class="erdp-panel-header">
          <div>
            <h2>Összefoglaló</h2>
            <p>Szolgáltatási terület, hiányzó adatok, kapcsolat és belső jegyzet a feldolgozáshoz.</p>
          </div>
        </div>
        <div class="erdp-panel-body">
          <div class="erdp-detail-title">
            <h3>${escapeHtml(valueOrEmpty(record.serviceNeed || record.laneLabel))}</h3>
            <span class="erdp-badge ${escapeHtml(statusBadgeClass(record.status))}">${escapeHtml(statusLabel(record.status))}</span>
          </div>
          <div class="erdp-detail-grid">
            ${detailItem("Szolgáltatási terület", record.laneLabel)}
            ${detailItem("Bizonyosság", record.confidence)}
            ${detailItem("Objektum / helyszín", record.siteOrObject)}
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
            Belső jegyzet
            <textarea data-erdp-staff-notes>${escapeHtml(record.staffNotes)}</textarea>
          </label>
          <div class="erdp-actions" aria-label="Biztonságos feldolgozási státuszok">
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
            <h2>Legutóbbi megkeresések</h2>
            <p>A feldolgozási lista ténylegesen rögzített vállalati megkeresésekből épül.</p>
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

  function renderIntakeAccess() {
    const intake = state.customerIntake || {};
    const path = trimText(intake.path);
    const aliasPath = trimText(intake.aliasPath);

    if (intake.available && path) {
      return `
        <section class="erdp-customer-link" aria-label="Ügyféloldali intake link">
          <strong>Ügyféloldali intake link</strong>
          <p>${escapeHtml(intake.guidanceHu || "Ezt a linket add meg a vállalati megkeresések belépési pontjaként.")}</p>
          <code>${escapeHtml(path)}</code>
          <div class="erdp-link-actions">
            <a class="erdp-button" href="${escapeHtml(path)}" target="_blank" rel="noreferrer">Megnyitás</a>
            <button class="erdp-button" type="button" data-erdp-copy-intake-link="${escapeHtml(path)}">Másolás</button>
          </div>
          ${aliasPath ? `<small>Alias: ${escapeHtml(aliasPath)}</small>` : ""}
        </section>
      `;
    }

    return `
      <section class="erdp-customer-link erdp-customer-link-muted" aria-label="Ügyféloldali intake link előfeltétel">
        <strong>Ügyféloldali intake link</strong>
        <p>${escapeHtml(intake.guidanceHu || "Aktív public agent kulcs szükséges, mielőtt az ügyféloldali intake link használható.")}</p>
        <code>/enterprise-request-desk/intake?agent_key=&lt;public_agent_key&gt;</code>
      </section>
    `;
  }

  function renderSetupRequired() {
    root.innerHTML = `
      <section class="erdp-auth-card" aria-label="Enterprise Request Desk setup szükséges">
        <div>
          <h2>Setup szükséges</h2>
          <p>Bejelentkezve: ${escapeHtml(authUser?.email || "tulajdonosi fiók")}</p>
          <p>A dashboard megnyitása előtt add meg a szervezet nevét, szolgáltatási területét, szolgáltatási vonalait és a belső továbbítási módot.</p>
        </div>
        <div class="erdp-auth-actions">
          <a class="erdp-button erdp-button-primary" href="${escapeHtml(getApiPrefix())}/setup">Setup megnyitása</a>
          <button class="erdp-button" type="button" data-erdp-sign-out>Kilépés</button>
        </div>
      </section>
    `;
  }

  function renderSetupUnavailable(message = "") {
    root.innerHTML = `
      <section class="erdp-empty" aria-label="Enterprise Request Desk setup állapot hiba">
        <h2>Setup állapot nem érhető el</h2>
        <p>${escapeHtml(message || "A setup tábla vagy az auth állapot nem tölthető be.")}</p>
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
            <strong>Setup teljes. A beérkező megkeresések belső feldolgozásra kerülnek.</strong>
            <p>Különálló Enterprise Request Desk felület előszűréshez, összefoglalóhoz és belső továbbításhoz.</p>
          </div>
          <span>Enterprise setup aktív</span>
        </section>
        ${renderIntakeAccess()}
        ${state.requestError ? `
          <section class="erdp-error-strip" aria-label="Enterprise Request Desk betöltési hiba">
            <strong>A megkeresések listája nem tölthető be.</strong>
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
        setup: {
          organizationName: "Local fixture",
          serviceArea: "Budapest",
          serviceLines: ["őrzés-védelem", "facility management"],
          routingPreference: "internal_handoff",
        },
        setupComplete: true,
        customerIntake: {
          available: true,
          path: "/enterprise-request-desk/intake-fixture",
          aliasPath: "/esg-request-desk/intake-fixture",
          guidanceHu: "Local fixture link böngészős ellenőrzéshez.",
        },
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

  async function loadSetupStateThenRequests() {
    setStatus("Enterprise Request Desk setup állapot betöltése...");

    try {
      const data = await fetchJson(`${getApiPrefix()}/setup-state`);
      state = {
        ...state,
        setup: data.setup || null,
        setupComplete: data.setupComplete === true,
        customerIntake: data.customerIntake || null,
      };

      if (!state.setupComplete) {
        renderSetupRequired();
        setStatus("Setup szükséges a dashboard megnyitásához.");
        return;
      }

      await loadRequests();
    } catch (error) {
      if (error.code === "enterprise_request_desk_setup_table_missing") {
        renderSetupUnavailable(error.message);
        setStatus("Enterprise setup tábla hiányzik.");
        return;
      }
      renderAuthGate(error.message || "");
      setStatus(error.message || "Setup állapot nem tölthető be.");
    }
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
    setStatus("Feldolgozási állapot mentése...");

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

      setStatus("Feldolgozási állapot mentve.");
      renderDashboard();
    } catch (error) {
      setStatus(error.message || "Nem sikerült menteni az állapotot.");
      button.disabled = false;
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    const form = event.target.closest("[data-erdp-auth-form]");
    if (!form) {
      return;
    }
    const email = trimText(new FormData(form).get("email"));
    const password = String(new FormData(form).get("password") || "");
    const submitter = event.submitter;
    const mode = submitter?.dataset.erdpAuthMode || "password";

    if (!email) {
      setStatus("Email szükséges a hozzáféréshez.");
      return;
    }

    if (!password) {
      setStatus("Jelszó szükséges ehhez a művelethez, vagy használj varázslinket.");
      return;
    }

    setStatus(mode === "signup" ? "Fiók létrehozása..." : "Belépés...");
    const authCall = mode === "signup"
      ? authClient.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${getApiPrefix()}/dashboard`,
          },
        })
      : authClient.auth.signInWithPassword({ email, password });
    const { data, error } = await authCall;
    if (error) {
      setStatus(error.message || "Auth hiba.");
      return;
    }

    authSession = data.session || null;
    authUser = data.user || authSession?.user || null;
    if (!authSession && mode === "signup") {
      setStatus("Fiók létrehozva. Ha email megerősítés szükséges, nyisd meg a megerősítő linket.");
      return;
    }
    renderAccount();
    await loadSetupStateThenRequests();
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
          emailRedirectTo: `${window.location.origin}${getApiPrefix()}/dashboard`,
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

  async function copyIntakeLink(button) {
    const path = trimText(button.dataset.erdpCopyIntakeLink);
    if (!path) {
      return;
    }

    const absoluteUrl = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setStatus("Ügyféloldali intake link másolva.");
    } catch {
      setStatus(absoluteUrl);
    }
  }

  async function boot() {
    if (window.VONZA_LOCAL_ENTERPRISE_DASHBOARD_FIXTURE === true) {
      if (window.VONZA_LOCAL_ENTERPRISE_DASHBOARD_FIXTURE_MODE === "setup_missing") {
        authUser = { email: "fixture-owner@example.test" };
        renderAccount();
        renderSetupRequired();
        setStatus("Local fixture: setup szükséges.");
        return;
      }
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
        setStatus("Jelentkezz be az Enterprise Request Desk dashboardhoz.");
        return;
      }

      await loadSetupStateThenRequests();
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
    const copyIntakeButton = target.closest?.("[data-erdp-copy-intake-link]");

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
      state.setup = null;
      state.setupComplete = false;
      state.customerIntake = null;
      renderAccount();
      renderAuthGate();
      setStatus("Kilépve.");
      return;
    }

    if (magicButton) {
      await handleMagicLink(magicButton);
      return;
    }

    if (copyIntakeButton) {
      await copyIntakeLink(copyIntakeButton);
    }
  });

  document.addEventListener("submit", async (event) => {
    if (event.target.matches("[data-erdp-auth-form]")) {
      await handleAuthSubmit(event);
    }
  });

  boot();
}());
