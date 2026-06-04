(() => {
  const root = document.getElementById("qdh-root");
  const accountRoot = document.getElementById("qdh-account");
  const statusRoot = document.getElementById("qdh-status");

  let authClient = null;
  let authSession = null;
  let authUser = null;
  let state = {
    records: [],
    summary: null,
    selectedId: "",
    loading: true,
  };

  const SAFE_STATUS_ACTIONS = [
    ["needs_info", "Hiányzó adat"],
    ["needs_staff_review", "Ellenőrzés alatt"],
    ["declined", "Elutasítva"],
    ["archived", "Archiválás"],
  ];
  const SAFE_STATUS_ACTION_SET = new Set(SAFE_STATUS_ACTIONS.map(([status]) => status));

  const PIPELINE_COLUMNS = [
    {
      key: "new",
      title: "Új",
      statuses: ["request_received"],
      empty: "Nincs új ajánlatkérés.",
    },
    {
      key: "needs-info",
      title: "Hiányzó adat",
      statuses: ["needs_info"],
      empty: "Nincs hiányos adatú kérés.",
    },
    {
      key: "reviewing",
      title: "Ellenőrzés alatt",
      statuses: ["needs_staff_review"],
      empty: "Nincs ellenőrzés alatt álló kérés.",
    },
    {
      key: "closed",
      title: "Elutasítva / Archivált",
      statuses: ["declined", "archived"],
      empty: "Nincs lezárt kérés ebben a listában.",
    },
  ];

  const SETUP_ITEMS = [
    "szolgáltatások",
    "szolgáltatási terület",
    "ajánlatkérési folyamat",
    "válaszidő",
    "árképzési szabály",
    "sürgős megkeresések kezelése",
    "kapcsolatfelvételi szabályok",
  ];

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
      throw new Error(data?.error || "A kérés nem sikerült.");
    }

    return data;
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
        return "Ellenőrzés alatt";
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
      case "declined":
      case "archived":
        return "closed";
      default:
        return "";
    }
  }

  function getSelectedRecord() {
    if (!state.records.length) {
      return null;
    }

    return state.records.find((record) => record.id === state.selectedId) || state.records[0];
  }

  function buildLocalFixture() {
    const records = [
      {
        id: "qdh-local-1",
        requestedService: "Tetőjavítás",
        projectDetails: "Beázás a kémény mellett, helyszíni felmérés szükséges.",
        locationText: "Budapest XI.",
        urgency: "Ezen a héten",
        budgetText: "Még nincs keret megadva",
        customerName: "Kovács Anna",
        customerEmail: "anna@example.hu",
        customerPhone: "+36 30 000 0000",
        language: "hu",
        sourceChannel: "full_page_assistant",
        status: "request_received",
        statusReason: "",
        staffNotes: "Visszakérdezni a tető típusára és a fotókra.",
        createdAt: "2026-06-04T08:30:00.000Z",
      },
      {
        id: "qdh-local-2",
        requestedService: "Klíma karbantartás",
        projectDetails: "Három beltéri egység tisztítása családi házban.",
        locationText: "Szeged",
        urgency: "Jövő hét",
        budgetText: "Rugalmas",
        customerName: "Nagy Péter",
        customerEmail: "peter@example.invalid",
        customerPhone: "",
        language: "hu",
        sourceChannel: "chat_quote_request",
        status: "needs_info",
        statusReason: "Hiányzik a készülék típusa.",
        staffNotes: "",
        createdAt: "2026-06-03T15:12:00.000Z",
      },
    ];

    return {
      ok: true,
      product: "quote_desk_hu",
      phase: "request_intake_review",
      records,
      summary: buildSummary(records),
    };
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
      declined: count(["declined"]),
      archived: count(["archived"]),
      closed: count(["declined", "archived"]),
      responseTime: {
        available: false,
        label: "Nincs adat",
      },
    };
  }

  function normalizeRecord(record = {}) {
    return {
      id: trimText(record.id),
      requestedService: trimText(record.requestedService || record.requested_service),
      projectDetails: trimText(record.projectDetails || record.project_details),
      locationText: trimText(record.locationText || record.location_text),
      urgency: trimText(record.urgency),
      budgetText: trimText(record.budgetText || record.budget_text),
      customerName: trimText(record.customerName || record.customer_name),
      customerEmail: trimText(record.customerEmail || record.customer_email),
      customerPhone: trimText(record.customerPhone || record.customer_phone),
      language: trimText(record.language),
      sourceChannel: trimText(record.sourceChannel || record.source_channel),
      status: trimText(record.status || "request_received"),
      statusReason: trimText(record.statusReason || record.status_reason),
      staffNotes: trimText(record.staffNotes || record.staff_notes),
      createdAt: record.createdAt || record.created_at || null,
    };
  }

  async function loadRequests() {
    if (window.VONZA_LOCAL_QDH_FIXTURE === true) {
      const fixture = buildLocalFixture();
      state = {
        ...state,
        records: fixture.records.map(normalizeRecord),
        summary: fixture.summary,
        selectedId: fixture.records[0]?.id || "",
        loading: false,
      };
      setStatus("Local-only QDH fixture. Production API gates are not bypassed.");
      renderDashboard();
      return;
    }

    setStatus("Ajánlatkérések betöltése...");
    const data = await fetchJson("/quote-desk-hu/requests?limit=100");
    const records = Array.isArray(data.records) ? data.records.map(normalizeRecord) : [];
    state = {
      ...state,
      records,
      summary: data.summary || buildSummary(records),
      selectedId: state.selectedId || records[0]?.id || "",
      loading: false,
    };
    setStatus(records.length ? "Ajánlatkérések betöltve." : "Még nincs beérkezett ajánlatkérés.");
    renderDashboard();
  }

  function renderAccount() {
    if (!accountRoot) {
      return;
    }

    if (!authUser?.email) {
      accountRoot.innerHTML = "";
      return;
    }

    accountRoot.innerHTML = `
      <span class="qdh-account-email">${escapeHtml(authUser.email)}</span>
      <button class="qdh-button" type="button" data-qdh-sign-out>Kilépés</button>
    `;
  }

  function renderAuthGate(message = "") {
    root.innerHTML = `
      <section class="qdh-auth-card" aria-label="QDH belépés">
        <div>
          <h2>Belépés szükséges</h2>
          <p>A Quote Desk HU tulajdonosi munkaterület csak bejelentkezett felhasználóknak érhető el.</p>
          ${message ? `<p>${escapeHtml(message)}</p>` : ""}
        </div>
        <form class="qdh-auth-form" data-qdh-auth-form>
          <label>
            Email
            <input type="email" name="email" autocomplete="email" required>
          </label>
          <label>
            Jelszó
            <input type="password" name="password" autocomplete="current-password">
          </label>
          <div class="qdh-auth-actions">
            <button class="qdh-button qdh-button-primary" type="submit" data-qdh-auth-mode="password">Belépés</button>
            <button class="qdh-button" type="button" data-qdh-auth-mode="magic">Varázslink küldése</button>
          </div>
        </form>
      </section>
    `;
  }

  function renderAuthUnavailable() {
    root.innerHTML = `
      <section class="qdh-empty-state">
        <div>
          <h2>A Supabase Auth nincs beállítva</h2>
          <p>A QDH dashboard HTML külön betöltött, de az élő ajánlatkérésekhez auth konfiguráció szükséges.</p>
        </div>
      </section>
    `;
  }

  function metric(label, value) {
    return `
      <article class="qdh-metric">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </article>
    `;
  }

  function renderMetrics(summary) {
    return `
      <section class="qdh-metrics" id="overview" aria-label="QDH áttekintő mutatók">
        ${metric("Összes ajánlatkérés", summary.total || 0)}
        ${metric("Új", summary.requestReceived || 0)}
        ${metric("Hiányzó adat", summary.needsInfo || 0)}
        ${metric("Ellenőrzés alatt", summary.needsStaffReview || 0)}
        ${metric("Elutasítva / archivált", summary.closed || 0)}
        ${metric("Válaszidő", summary.responseTime?.label || "Nincs adat")}
      </section>
    `;
  }

  function renderRequestRow(record, selected) {
    return `
      <button
        class="qdh-request-row ${selected ? "is-active" : ""}"
        type="button"
        data-qdh-select-request="${escapeHtml(record.id)}"
      >
        <strong>${escapeHtml(valueOrEmpty(record.requestedService))}</strong>
        <span>${escapeHtml(valueOrEmpty(record.locationText))} · ${escapeHtml(formatDateTime(record.createdAt))}</span>
        <span>${escapeHtml(valueOrEmpty(record.projectDetails))}</span>
        <em>${escapeHtml(statusLabel(record.status))}</em>
      </button>
    `;
  }

  function renderPipeline(records, selectedRecord) {
    return `
      <section class="qdh-panel" id="pipeline" aria-label="Ajánlatkérési pipeline">
        <div class="qdh-panel-header">
          <div>
            <h2>Quote pipeline</h2>
            <p>Csak biztonságos review állapotok. Nincs automatikus árküldés vagy végleges ajánlat gomb.</p>
          </div>
          <button class="qdh-button qdh-refresh" type="button" data-qdh-refresh>Frissítés</button>
        </div>
        <div class="qdh-pipeline">
          ${PIPELINE_COLUMNS.map((column) => {
            const columnRecords = records.filter((record) =>
              column.statuses.includes(trimText(record.status).toLowerCase())
            );
            return `
              <section class="qdh-column" aria-label="${escapeHtml(column.title)}">
                <div class="qdh-column-header">
                  <span>${escapeHtml(column.title)}</span>
                  <span>${escapeHtml(columnRecords.length)}</span>
                </div>
                <div class="qdh-request-list">
                  ${columnRecords.length
                    ? columnRecords.map((record) => renderRequestRow(record, record.id === selectedRecord?.id)).join("")
                    : `<p class="qdh-column-empty">${escapeHtml(column.empty)}</p>`}
                </div>
              </section>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function detailItem(label, value) {
    return `
      <div class="qdh-detail-item">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(valueOrEmpty(value))}</strong>
      </div>
    `;
  }

  function renderDetail(record) {
    if (!record) {
      return `
        <section class="qdh-panel" aria-label="Ajánlatkérés részletei">
          <div class="qdh-panel-header">
            <div>
              <h2>Részletek</h2>
              <p>Válassz egy ajánlatkérést a részletekhez.</p>
            </div>
          </div>
          <div class="qdh-detail-body">
            <div class="qdh-empty-state">
              <div>
                <h2>Még nincs kiválasztott kérés</h2>
                <p>Amint érkezik ajánlatkérés, itt látható a szolgáltatás, projektleírás, kapcsolat és staff jegyzet.</p>
              </div>
            </div>
          </div>
        </section>
      `;
    }

    return `
      <section class="qdh-panel" aria-label="Ajánlatkérés részletei">
        <div class="qdh-panel-header">
          <div>
            <h2>Részletek</h2>
            <p>Staff review, jegyzetelés és biztonságos állapotváltás.</p>
          </div>
        </div>
        <div class="qdh-detail-body">
          <div class="qdh-detail-title">
            <h3>${escapeHtml(valueOrEmpty(record.requestedService))}</h3>
            <span class="qdh-badge ${escapeHtml(statusBadgeClass(record.status))}">${escapeHtml(statusLabel(record.status))}</span>
          </div>
          <div class="qdh-detail-grid">
            ${detailItem("Projekt részletei", record.projectDetails)}
            ${detailItem("Helyszín", record.locationText)}
            ${detailItem("Sürgősség", record.urgency)}
            ${detailItem("Keret / budget", record.budgetText)}
            ${detailItem("Ügyfél neve", record.customerName)}
            ${detailItem("Email", record.customerEmail)}
            ${detailItem("Telefon", record.customerPhone)}
            ${detailItem("Nyelv", record.language)}
            ${detailItem("Forrás csatorna", record.sourceChannel)}
            ${detailItem("Létrehozva", formatDateTime(record.createdAt))}
          </div>
          <label class="qdh-field">
            Státusz oka
            <textarea data-qdh-status-reason>${escapeHtml(record.statusReason)}</textarea>
          </label>
          <label class="qdh-field">
            Staff jegyzet
            <textarea data-qdh-staff-notes>${escapeHtml(record.staffNotes)}</textarea>
          </label>
          <div class="qdh-actions" aria-label="Biztonságos staff műveletek">
            ${SAFE_STATUS_ACTIONS.map(([status, label]) => `
              <button
                class="qdh-button ${status === "declined" ? "qdh-button-danger" : ""}"
                type="button"
                data-qdh-status-action="${escapeHtml(status)}"
                data-qdh-request-id="${escapeHtml(record.id)}"
              >${escapeHtml(label)}</button>
            `).join("")}
            <button
              class="qdh-button qdh-button-primary"
              type="button"
              data-qdh-status-action="${escapeHtml(SAFE_STATUS_ACTION_SET.has(record.status) ? record.status : "needs_staff_review")}"
              data-qdh-request-id="${escapeHtml(record.id)}"
            >${escapeHtml(SAFE_STATUS_ACTION_SET.has(record.status) ? "Jegyzet mentése" : "Jegyzet mentése és review")}</button>
          </div>
        </div>
      </section>
    `;
  }

  function renderSetupPanel() {
    return `
      <section class="qdh-panel" id="setup" aria-label="QDH beállítási készenlét">
        <div class="qdh-panel-header">
          <div>
            <h2>Setup / readiness</h2>
            <p>Ezeket a vállalkozás szabályai alapján kell ellenőrizni, nem automatikus minősítés.</p>
          </div>
        </div>
        <div class="qdh-checklist">
          ${SETUP_ITEMS.map((item) => `
            <div class="qdh-check-row">
              <span class="qdh-check-dot" aria-hidden="true"></span>
              <span>${escapeHtml(item)}</span>
              <small>Ellenőrizendő</small>
            </div>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderRecent(records) {
    const recent = records.slice(0, 5);
    return `
      <section class="qdh-panel" aria-label="Legutóbbi ajánlatkérések">
        <div class="qdh-panel-header">
          <div>
            <h2>Legutóbbi kérések</h2>
            <p>Csak ténylegesen beérkezett rekordokból épül.</p>
          </div>
        </div>
        <div class="qdh-recent">
          ${recent.length ? recent.map((record) => `
            <div class="qdh-recent-row">
              <div>
                <strong>${escapeHtml(valueOrEmpty(record.requestedService))}</strong>
                <span>${escapeHtml(statusLabel(record.status))} · ${escapeHtml(valueOrEmpty(record.locationText))}</span>
              </div>
              <time>${escapeHtml(formatDateTime(record.createdAt))}</time>
            </div>
          `).join("") : `
            <div class="qdh-column-empty">Nincs megjeleníthető ajánlatkérés.</div>
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
      <div class="qdh-dashboard">
        <section class="qdh-safety-strip" aria-label="QDH biztonsági állítás">
          <div>
            <strong>A QDH ajánlatkéréseket gyűjt és review munkafolyamatot ad.</strong>
            <p>A végső árakat a vállalkozás erősíti meg. A rendszer ebben a fázisban nem készít automatikus garantált ajánlatot.</p>
          </div>
          <span>Request intake / review</span>
        </section>
        ${renderMetrics(summary)}
        <div class="qdh-workspace">
          ${renderPipeline(records, selectedRecord)}
          ${renderDetail(selectedRecord)}
        </div>
        <div class="qdh-lower-grid">
          ${renderSetupPanel()}
          ${renderRecent(records)}
        </div>
      </div>
    `;
  }

  async function updateRequestStatus(button) {
    const requestId = trimText(button.dataset.qdhRequestId);
    const status = trimText(button.dataset.qdhStatusAction);
    const statusReason = root.querySelector("[data-qdh-status-reason]")?.value || "";
    const staffNotes = root.querySelector("[data-qdh-staff-notes]")?.value || "";

    if (!requestId || !status) {
      return;
    }

    button.disabled = true;
    setStatus("Állapot mentése...");

    try {
      const data = await fetchJson("/quote-desk-hu/requests/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      setStatus("QDH állapot mentve.");
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
    if (!root) {
      return;
    }

    if (window.VONZA_LOCAL_QDH_FIXTURE === true) {
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
        setStatus("Jelentkezz be a QDH munkaterülethez.");
        return;
      }

      await loadRequests();
    } catch (error) {
      renderAuthGate(error.message || "");
      setStatus(error.message || "QDH munkaterület nem tölthető be.");
    }
  }

  document.addEventListener("click", async (event) => {
    const target = event.target;
    const selectButton = target.closest?.("[data-qdh-select-request]");
    const statusButton = target.closest?.("[data-qdh-status-action]");
    const refreshButton = target.closest?.("[data-qdh-refresh]");
    const signOutButton = target.closest?.("[data-qdh-sign-out]");
    const magicButton = target.closest?.('[data-qdh-auth-mode="magic"]');

    if (selectButton) {
      state.selectedId = trimText(selectButton.dataset.qdhSelectRequest);
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
    if (event.target.matches("[data-qdh-auth-form]")) {
      await handleAuthSubmit(event);
    }
  });

  boot();
})();
