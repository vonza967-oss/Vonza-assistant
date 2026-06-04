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
    setup: null,
    customerIntake: null,
    setupLoaded: false,
    setupError: null,
    requestError: null,
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
      const error = new Error(data?.error || "A kérés nem sikerült.");
      error.code = data?.code || "";
      throw error;
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

  function sourceLabel(sourceChannel) {
    switch (trimText(sourceChannel)) {
      case "qdh_public_intake":
        return "QDH ügyfél link";
      case "qdh_ai_intake":
        return "AI-assisted QDH intake";
      case "chat_quote_request":
      case "public_chat":
        return "Publikus chat";
      case "full_page_assistant":
        return "Front Desk oldal";
      default:
        return valueOrEmpty(sourceChannel);
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
        sourceChannel: "qdh_ai_intake",
        status: "request_received",
        statusReason: "",
        staffNotes: "Visszakérdezni a tető típusára és a fotókra.",
        evidence: {
          qdh_ai_intake: {
            staff_summary_hu: "AI intake összefoglaló: Kovács Anna tetőjavítási ajánlatkérést adott le Budapest XI. kerületre, ezen a hétre kért visszajelzéssel.",
          },
        },
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
    const evidence = record.evidence && typeof record.evidence === "object" ? record.evidence : {};
    const aiSummary = evidence.qdh_ai_intake && typeof evidence.qdh_ai_intake === "object"
      ? trimText(evidence.qdh_ai_intake.staff_summary_hu)
      : "";

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
      staffSummary: trimText(record.staffSummary || record.staff_summary || aiSummary),
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
        setup: {
          businessName: "Local QDH Fixture Kft.",
          websiteUrl: "https://qdh-fixture.example",
          serviceType: "helyi szolgáltatás",
          serviceArea: "Budapest",
          handlingPreference: "staff_review",
          ownerContactEmail: "owner@example.invalid",
          servicesOffered: ["Tetőjavítás", "Klíma karbantartás"],
          setupStatus: "ready_for_review",
        },
        customerIntake: {
          available: true,
          path: "/qdh/intake?agent_key=local-public-agent",
          aliasPath: "/quote-desk-hu/intake?agent_key=local-public-agent",
          sourceChannel: "qdh_public_intake",
          guidanceHu: "Ezt a linket tedd a weboldal 'Kérjen ajánlatot' gombja mögé.",
        },
        setupLoaded: true,
        setupError: null,
        requestError: null,
      };
      setStatus("Local-only QDH fixture. Production API gates are not bypassed.");
      renderDashboard();
      return;
    }

    setStatus("Ajánlatkérések betöltése...");
    const [setupResult, requestResult] = await Promise.allSettled([
      fetchJson("/quote-desk-hu/setup-state"),
      fetchJson("/quote-desk-hu/requests?limit=100"),
    ]);

    let setup;
    let customerIntake = null;
    let setupLoaded;
    let setupError = null;
    if (setupResult.status === "fulfilled") {
      setup = setupResult.value.setup || null;
      customerIntake = setupResult.value.customerIntake || null;
      setupLoaded = true;
    } else {
      setupLoaded = false;
      setupError = {
        code: setupResult.reason?.code || "",
        message: setupResult.reason?.message || "QDH setup állapot nem tölthető be.",
      };
    }

    let records;
    let summary;
    let requestError = null;
    if (requestResult.status === "fulfilled") {
      records = Array.isArray(requestResult.value.records)
        ? requestResult.value.records.map(normalizeRecord)
        : [];
      summary = requestResult.value.summary || buildSummary(records);
    } else {
      records = [];
      summary = buildSummary(records);
      requestError = {
        code: requestResult.reason?.code || "",
        message: requestResult.reason?.message || "Ajánlatkérések nem tölthetők be.",
      };
    }

    state = {
      ...state,
      records,
      summary,
      selectedId: state.selectedId || records[0]?.id || "",
      loading: false,
      setup,
      customerIntake,
      setupLoaded,
      setupError,
      requestError,
    };
    if (requestError) {
      setStatus(requestError.message);
    } else if (setupError) {
      setStatus(setupError.message);
    } else {
      setStatus(records.length ? "Ajánlatkérések betöltve." : "Még nincs beérkezett ajánlatkérés.");
    }
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
        <em>${escapeHtml(statusLabel(record.status))} · ${escapeHtml(sourceLabel(record.sourceChannel))}</em>
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
            ${detailItem("Forrás megnevezése", sourceLabel(record.sourceChannel))}
            ${record.staffSummary ? detailItem("AI staff összefoglaló", record.staffSummary) : ""}
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
    if (state.setupError?.code === "qdh_setup_table_missing") {
      return `
        <section class="qdh-panel" id="setup" aria-label="QDH setup migráció">
          <div class="qdh-panel-header">
            <div>
              <h2>Setup migráció szükséges</h2>
              <p>${escapeHtml(state.setupError.message)}</p>
            </div>
            <a class="qdh-button" href="/qdh/setup">Setup oldal</a>
          </div>
          <div class="qdh-checklist">
            <div class="qdh-check-row qdh-check-row-warning">
              <span class="qdh-check-dot" aria-hidden="true"></span>
              <span>qdh_owner_setups tábla</span>
              <small>Hiányzik</small>
            </div>
          </div>
        </section>
      `;
    }

    if (!state.setup) {
      return `
        <section class="qdh-panel" id="setup" aria-label="QDH setup hiányzik">
          <div class="qdh-panel-header">
            <div>
              <h2>Setup incomplete</h2>
              <p>A QDH önkiszolgáló beállítás még nincs mentve ehhez a tulajdonoshoz.</p>
            </div>
            <a class="qdh-button qdh-button-primary" href="/qdh/setup">QDH setup</a>
          </div>
          <div class="qdh-checklist">
            ${SETUP_ITEMS.map((item) => `
              <div class="qdh-check-row">
                <span class="qdh-check-dot" aria-hidden="true"></span>
                <span>${escapeHtml(item)}</span>
                <small>Hiányzik</small>
              </div>
            `).join("")}
          </div>
        </section>
      `;
    }

    const setupRows = [
      ["Vállalkozás", state.setup.businessName],
      ["Weboldal", state.setup.websiteUrl],
      ["Szolgáltatás típus", state.setup.serviceType],
      ["Terület", state.setup.serviceArea],
      ["Kezelési mód", state.setup.handlingPreference],
      ["Tulajdonosi email", state.setup.ownerContactEmail],
      ["Szolgáltatások", (state.setup.servicesOffered || []).join(", ")],
    ];
    const intake = state.customerIntake || {};
    const intakePath = trimText(intake.path);
    const intakeAliasPath = trimText(intake.aliasPath);

    return `
      <section class="qdh-panel" id="setup" aria-label="QDH beállítási készenlét">
        <div class="qdh-panel-header">
          <div>
            <h2>Setup / readiness</h2>
            <p>Owner-scoped QDH setup rekord. Nem automatikus minősítés és nem árképzési szabály.</p>
          </div>
          <a class="qdh-button" href="/qdh/setup">Szerkesztés</a>
        </div>
        <div class="qdh-checklist">
          ${setupRows.map(([label, value]) => `
            <div class="qdh-check-row qdh-check-row-complete">
              <span class="qdh-check-dot" aria-hidden="true"></span>
              <span><strong>${escapeHtml(label)}:</strong> ${escapeHtml(valueOrEmpty(value))}</span>
              <small>Mentve</small>
            </div>
          `).join("")}
        </div>
        <div class="qdh-customer-link" aria-label="QDH ügyféloldali intake link">
          <div>
            <strong>Weboldali “Kérjen ajánlatot” link</strong>
            <p>${escapeHtml(intake.guidanceHu || "Az ügyféloldali QDH intake link aktív public agent kulcsot igényel.")}</p>
          </div>
          ${intake.available && intakePath ? `
            <div class="qdh-customer-link-box">
              <code>${escapeHtml(intakePath)}</code>
              <div>
                <a class="qdh-button" href="${escapeHtml(intakePath)}" target="_blank" rel="noreferrer">Megnyitás</a>
                <button class="qdh-button" type="button" data-qdh-copy-intake-link="${escapeHtml(intakePath)}">Másolás</button>
              </div>
              ${intakeAliasPath ? `<small>Alias: ${escapeHtml(intakeAliasPath)}</small>` : ""}
            </div>
          ` : `
            <div class="qdh-customer-link-box qdh-customer-link-box-muted">
              <code>/qdh/intake?agent_key=&lt;public_agent_key&gt;</code>
              <small>Aktív public agent kulcs nélkül a public create API nem fogad be kérést.</small>
            </div>
          `}
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
                <span>${escapeHtml(statusLabel(record.status))} · ${escapeHtml(sourceLabel(record.sourceChannel))} · ${escapeHtml(valueOrEmpty(record.locationText))}</span>
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
        ${state.requestError ? `
          <section class="qdh-error-strip" aria-label="QDH ajánlatkérés betöltési hiba">
            <strong>Ajánlatkérések nem tölthetők be.</strong>
            <p>${escapeHtml(state.requestError.message)}</p>
          </section>
        ` : ""}
        ${state.setupError && state.setupError.code !== "qdh_setup_table_missing" ? `
          <section class="qdh-error-strip" aria-label="QDH setup betöltési hiba">
            <strong>Setup állapot nem tölthető be.</strong>
            <p>${escapeHtml(state.setupError.message)}</p>
          </section>
        ` : ""}
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

  async function copyIntakeLink(button) {
    const path = trimText(button.dataset.qdhCopyIntakeLink);
    if (!path) {
      return;
    }

    const absoluteUrl = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setStatus("QDH ügyfél link másolva.");
    } catch {
      setStatus(absoluteUrl);
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
    const copyIntakeButton = target.closest?.("[data-qdh-copy-intake-link]");

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

    if (copyIntakeButton) {
      await copyIntakeLink(copyIntakeButton);
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
