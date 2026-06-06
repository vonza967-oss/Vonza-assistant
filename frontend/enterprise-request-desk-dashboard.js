(function initEnterpriseRequestDeskDashboard() {
  const root = document.getElementById("erdp-dashboard-root");
  const accountRoot = document.getElementById("erdp-account");
  const statusRoot = document.getElementById("erdp-dashboard-status");
  const profileApi = window.VonzaEnterpriseRequestDeskProfiles;
  const profile = profileApi?.getProfile ? profileApi.getProfile() : null;
  if (profileApi?.applyDocumentProfile && profile) {
    profileApi.applyDocumentProfile(profile);
    document.title = profile.dashboard?.title || profile.productName;
    const productLabel = document.querySelector("[data-erdp-dashboard-product-label]");
    if (productLabel) {
      productLabel.textContent = profile.dashboard?.productLabel || profile.productName;
    }
    const heading = document.querySelector("[data-erdp-dashboard-heading]");
    if (heading) {
      heading.textContent = profile.dashboard?.heading || heading.textContent;
    }
    const intro = document.querySelector("[data-erdp-dashboard-intro]");
    if (intro) {
      intro.textContent = profile.dashboard?.intro || intro.textContent;
    }
    const sideTitle = document.querySelector("[data-erdp-dashboard-side-title]");
    if (sideTitle) {
      sideTitle.textContent = profile.dashboard?.sideTitle || sideTitle.textContent;
    }
    const sideBody = document.querySelector("[data-erdp-dashboard-side-body]");
    if (sideBody) {
      sideBody.textContent = profile.dashboard?.sideBody || sideBody.textContent;
    }
  }
  const FIXTURE_STORAGE_KEY = "VONZA_ENTERPRISE_REQUEST_DESK_FIXTURE_REQUESTS";
  const REVIEW_ACTIONS = Object.freeze([
    ["needs_info", "Hiányzó adat"],
    ["needs_staff_review", "Belső ellenőrzés"],
    ["routed", "Továbbítva"],
    ["declined", "Elutasítva"],
    ["archived", "Archiválva"],
  ]);
  const REVIEW_ACTION_SET = new Set(REVIEW_ACTIONS.map(([status]) => status));
  const REVIEW_STATUS_LABELS = Object.freeze(Object.fromEntries(REVIEW_ACTIONS));
  const SERVICE_WORKSPACE_DEFINITIONS = Object.freeze([
    { id: "overview", hash: "overview", type: "overview", labelKey: "overview" },
    { id: "requests", hash: "requests", type: "queue", labelKey: "requests" },
    {
      id: "security-guarding",
      hash: "security-guarding",
      type: "service",
      labelKey: "security_guarding",
      laneKey: "security_guarding",
    },
    {
      id: "reception-object-protection",
      hash: "reception-object-protection",
      type: "service",
      labelKey: "reception_object_protection",
      laneKey: "reception_object_protection",
    },
    {
      id: "facility-management",
      hash: "facility-management",
      type: "service",
      labelKey: "facility_management",
      laneKey: "facility_management",
    },
    {
      id: "security-technology",
      hash: "security-technology",
      type: "service",
      labelKey: "security_technology",
      laneKey: "security_technology",
    },
    {
      id: "audit-compliance",
      hash: "audit-compliance",
      type: "service",
      labelKey: "audit_compliance",
      laneKey: "audit_compliance",
    },
    {
      id: "mixed",
      hash: "mixed",
      type: "service",
      labelKey: "mixed_enterprise_request",
      laneKey: "mixed_enterprise_request",
    },
    { id: "settings", hash: "settings", type: "settings", labelKey: "settings" },
  ]);
  const WORKSPACE_HASH_ALIASES = Object.freeze({
    queue: "requests",
    detail: "requests",
    guarding: "security-guarding",
    reception: "reception-object-protection",
    "object-protection": "reception-object-protection",
    fm: "facility-management",
    "security-tech": "security-technology",
    audit: "audit-compliance",
  });
  const STATUS_ORDER = Object.freeze([
    "request_received",
    "needs_info",
    "needs_staff_review",
    "routed",
    "declined",
    "archived",
  ]);
  const LANE_NEXT_QUESTIONS = Object.freeze({
    security_guarding: "Milyen objektumot kell őrizni, milyen lefedési idővel és mikori kezdéssel?",
    reception_object_protection: "Milyen recepciós, beléptetési vagy portaszolgálati folyamatot kell lefedni?",
    facility_management: "Milyen hiba vagy üzemeltetési igény érintett, és mennyire sürgős?",
    security_technology: "Melyik rendszer érintett: kamera, beléptetés, riasztó, tűzjelző vagy meglévő rendszer?",
    audit_compliance: "Milyen hatósági, audit vagy beszerzési ügyhöz kapcsolódik az igény, és van-e határidő?",
    mixed_enterprise_request: "Mely szolgáltatási területeket kell szétválasztani belső feldolgozásra?",
    general_enquiry: "Melyik szolgáltatási területhez kapcsolódik a megkeresés?",
  });
  const RECOMMENDED_ROUTES = Object.freeze({
    security_guarding: "Őrzés-védelem koordinátor belső ellenőrzésre",
    reception_object_protection: "Portaszolgálat / objektumvédelem belső koordinátor",
    facility_management: "Facility Management belső koordinátor",
    security_technology: "Biztonságtechnikai felmérésre kijelölt belső csapat",
    audit_compliance: "Hatósági / audit belső szakmai ellenőrzés",
    mixed_enterprise_request: "Belső szétválasztás szolgáltatási területekre",
    general_enquiry: "Első szűrés és belső ellenőrzés",
  });
  const LANE_BRIEF_TEMPLATES = Object.freeze({
    security_guarding: [
      { label: "Objektum típusa", keys: ["siteType", "site_type"], fallback: (record) => record.siteOrObject },
      { label: "Helyszín", keys: ["locationOrSite", "location_or_site"], fallback: (record) => record.locationText },
      { label: "Lefedési idő", keys: ["coverageTime", "coverage_time", "urgencyOrTiming", "urgency_or_timing"], fallback: (record) => record.timingText || record.urgency },
      { label: "Kezdés", keys: ["startDate", "start_date", "start", "urgencyOrTiming", "urgency_or_timing"], fallback: (record) => record.timingText },
      { label: "Létszám / kockázat", keys: ["headcount", "guardCount", "guard_count", "riskLevel", "risk_level", "risk"] },
    ],
    reception_object_protection: [
      { label: "Recepció", keys: ["reception", "serviceNeed", "service_need"], fallback: (record) => record.serviceNeed },
      { label: "Beléptetés", keys: ["accessControl", "access_control", "entryProcess", "entry_process"] },
      { label: "Nyitvatartás", keys: ["openingHours", "opening_hours", "urgencyOrTiming", "urgency_or_timing"], fallback: (record) => record.timingText || record.urgency },
      { label: "Látogatói forgalom", keys: ["visitorTraffic", "visitor_traffic", "traffic"] },
    ],
    facility_management: [
      { label: "Hiba / üzemeltetési igény", keys: ["issue", "operationNeed", "operation_need", "serviceNeed", "service_need"], fallback: (record) => record.serviceNeed },
      { label: "Helyszín", keys: ["locationOrSite", "location_or_site"], fallback: (record) => record.locationText || record.siteOrObject },
      { label: "Sürgősség", keys: ["urgency", "urgencyOrTiming", "urgency_or_timing"], fallback: (record) => record.urgency || record.timingText },
      { label: "Érintett rendszer / terület", keys: ["affectedSystem", "affected_system", "affectedArea", "affected_area", "siteType", "site_type"], fallback: (record) => record.siteOrObject },
    ],
    security_technology: [
      { label: "Kamera", keys: ["camera", "cctv", "cameraSystem", "camera_system"] },
      { label: "Beléptetés", keys: ["accessControl", "access_control", "entrySystem", "entry_system"] },
      { label: "Riasztó", keys: ["alarm", "alarmSystem", "alarm_system"] },
      { label: "Tűzjelző", keys: ["fireAlarm", "fire_alarm"] },
      { label: "Meglévő rendszer", keys: ["existingSystem", "existing_system", "currentSystem", "current_system"] },
      { label: "Telephely", keys: ["locationOrSite", "location_or_site"], fallback: (record) => record.locationText || record.siteOrObject },
    ],
    audit_compliance: [
      { label: "Ügy típusa", keys: ["caseType", "case_type", "serviceNeed", "service_need"], fallback: (record) => record.serviceNeed },
      { label: "Dokumentum", keys: ["document", "documents", "documentNeed", "document_need"] },
      { label: "Határidő", keys: ["deadline", "urgencyOrTiming", "urgency_or_timing"], fallback: (record) => record.timingText || record.urgency },
      { label: "Audit / beszerzési kontextus", keys: ["auditContext", "audit_context", "procurementContext", "procurement_context", "notes"], fallback: (record) => record.structuredBrief?.notes },
    ],
    mixed_enterprise_request: [
      { label: "Több szolgáltatási terület", keys: ["serviceAreas", "service_areas", "matchedLaneLabels", "matched_lane_labels", "serviceNeed", "service_need"], fallback: (record) => record.serviceNeed || record.laneLabel },
      { label: "Szétválasztandó igények", keys: ["splitNeeds", "split_needs", "notes"], fallback: (record) => record.requestText },
    ],
    general_enquiry: [
      { label: "Szolgáltatási igény", keys: ["serviceNeed", "service_need"], fallback: (record) => record.serviceNeed },
      { label: "Helyszín", keys: ["locationOrSite", "location_or_site"], fallback: (record) => record.locationText || record.siteOrObject },
      { label: "Időzítés", keys: ["urgencyOrTiming", "urgency_or_timing"], fallback: (record) => record.timingText || record.urgency },
    ],
  });

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
    activeView: "overview",
    requestError: null,
  };

  if (!root) {
    return;
  }

  updateActiveViewFromHash();
  renderSidebarNav();

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

  function normalizeHashValue(value = "") {
    const normalized = trimText(String(value).replace(/^#/, "")).toLowerCase();
    const aliased = WORKSPACE_HASH_ALIASES[normalized] || normalized;
    return SERVICE_WORKSPACE_DEFINITIONS.some((workspace) => workspace.id === aliased)
      ? aliased
      : "overview";
  }

  function updateActiveViewFromHash() {
    state.activeView = normalizeHashValue(window.location.hash || "#overview");
  }

  function workspaceLabel(labelKey, fallback = "") {
    return trimText(profile?.dashboard?.workspaceLabels?.[labelKey])
      || profile?.lanes?.find?.((lane) => lane.key === labelKey)?.labelHu
      || fallback
      || labelKey;
  }

  function workspaceDescription(labelKey, fallback = "") {
    return trimText(profile?.dashboard?.workspaceDescriptions?.[labelKey]) || fallback;
  }

  function workspaceEmptyState(labelKey, fallback = "") {
    return trimText(profile?.dashboard?.workspaceEmptyStates?.[labelKey]) || fallback;
  }

  function getWorkspaceDefinitions() {
    return SERVICE_WORKSPACE_DEFINITIONS.map((workspace) => ({
      ...workspace,
      label: workspaceLabel(workspace.labelKey, workspace.labelKey),
      description: workspaceDescription(workspace.labelKey, ""),
      emptyState: workspaceEmptyState(workspace.labelKey, profile?.dashboard?.emptyQueue || ""),
    }));
  }

  function getWorkspaceDefinition(viewId = state.activeView) {
    return getWorkspaceDefinitions().find((workspace) => workspace.id === viewId)
      || getWorkspaceDefinitions()[0];
  }

  function renderSidebarNav() {
    const nav = document.querySelector("[data-erdp-dashboard-nav]");
    if (!nav) {
      return;
    }

    nav.setAttribute("aria-label", profile?.dashboard?.navLabel || "Dashboard navigáció");
    nav.innerHTML = getWorkspaceDefinitions().map((workspace) => `
      <a
        href="#${escapeHtml(workspace.hash)}"
        aria-current="${workspace.id === state.activeView ? "page" : "false"}"
        data-erdp-workspace-nav="${escapeHtml(workspace.id)}"
      >${escapeHtml(workspace.label)}</a>
    `).join("");
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
        laneLabel: "Facility Management",
        confidence: "medium",
        requestText: "Facility Management támogatás kell egy budapesti telephelyre, karbantartás és takarítás egyeztetéssel, jövő héten. Telefon: +36 30 123 4567.",
        siteOrObject: "telephely",
        locationText: "Budapest",
        serviceNeed: "Facility Management támogatás",
        timingText: "jövő héten",
        urgency: "egyeztethető",
        contactName: "",
        contactEmail: "",
        contactPhone: "+36 30 123 4567",
        missingFields: [],
        structuredBrief: {
          lane: "facility_management",
          laneLabelHu: "Facility Management",
          serviceNeed: "Facility Management támogatás",
          locationOrSite: "Budapest telephely",
          urgencyOrTiming: "jövő héten",
          contactNeed: "Biztonságos elérhetőség megadva a visszajelzéshez.",
          staffSummaryHu: "Belső összefoglaló: Facility Management. Igény: karbantartás és takarítás egyeztetés. Helyszín/objektum: budapesti telephely.",
        },
        status: "request_received",
        statusReason: "",
        staffNotes: "Helyi minta megkeresés.",
        createdAt: "2026-06-05T09:00:00.000Z",
        updatedAt: "2026-06-05T09:00:00.000Z",
      },
      {
        id: "erd-fixture-seed-2",
        lane: "security_guarding",
        laneLabel: "Őrzés-védelem",
        confidence: "high",
        requestText: "Őrzés-védelem kell egy ipari telephelyre Győr mellett, hétköznap éjszakai lefedéssel. Kapcsolat: operations@example.test.",
        siteOrObject: "ipari telephely",
        locationText: "Győr térsége",
        serviceNeed: "Élőerős őrzés-védelem",
        timingText: "hétköznap éjszaka",
        urgency: "jövő hónaptól",
        contactName: "Minta Operátor",
        contactEmail: "operations@example.test",
        contactPhone: "",
        missingFields: ["urgency_or_timing"],
        structuredBrief: {
          lane: "security_guarding",
          laneLabelHu: "Őrzés-védelem",
          serviceNeed: "Élőerős őrzés-védelem",
          locationOrSite: "Győr térsége, ipari telephely",
          urgencyOrTiming: "hétköznap éjszaka",
          contactNeed: "Biztonságos elérhetőség megadva a visszajelzéshez.",
          siteType: "ipari telephely",
          riskLevel: "",
          staffSummaryHu: "Belső összefoglaló: őrzés-védelem. Igény: éjszakai lefedés ipari telephelyen.",
        },
        status: "needs_info",
        statusReason: "Kezdés és pontos létszám még tisztázandó.",
        staffNotes: "Helyi minta megkeresés.",
        createdAt: "2026-06-05T10:00:00.000Z",
        updatedAt: "2026-06-05T10:00:00.000Z",
      },
      {
        id: "erd-fixture-seed-3",
        lane: "reception_object_protection",
        laneLabel: "Portaszolgálat / objektumvédelem",
        confidence: "high",
        requestText: "Irodaház portaszolgálatára lenne szükség Budapesten, recepciós beléptetéssel 8-18 óra között.",
        siteOrObject: "irodaház",
        locationText: "Budapest",
        serviceNeed: "Portaszolgálat és recepciós beléptetés",
        timingText: "hétköznap 8-18",
        urgency: "egyeztethető",
        contactName: "",
        contactEmail: "",
        contactPhone: "",
        missingFields: ["contact_need"],
        structuredBrief: {
          lane: "reception_object_protection",
          laneLabelHu: "Portaszolgálat / objektumvédelem",
          serviceNeed: "Portaszolgálat és recepciós beléptetés",
          locationOrSite: "Budapest, irodaház",
          urgencyOrTiming: "hétköznap 8-18",
          contactNeed: "Kapcsolati adat hiányzik a visszajelzéshez.",
          openingHours: "hétköznap 8-18",
          staffSummaryHu: "Belső összefoglaló: portaszolgálat. Igény: recepciós beléptetés irodaházban.",
        },
        status: "request_received",
        statusReason: "",
        staffNotes: "Helyi minta megkeresés.",
        createdAt: "2026-06-05T11:00:00.000Z",
        updatedAt: "2026-06-05T11:00:00.000Z",
      },
      {
        id: "erd-fixture-seed-4",
        lane: "security_technology",
        laneLabel: "Biztonságtechnika",
        confidence: "high",
        requestText: "CCTV kamerarendszer és beléptető bővítés kell egy telephelyen, meglévő riasztóval.",
        siteOrObject: "telephely",
        locationText: "Székesfehérvár",
        serviceNeed: "CCTV és beléptető bővítés",
        timingText: "felmérés két héten belül",
        urgency: "közepes",
        contactName: "Technikai kapcsolattartó",
        contactEmail: "tech@example.test",
        contactPhone: "",
        missingFields: [],
        structuredBrief: {
          lane: "security_technology",
          laneLabelHu: "Biztonságtechnika",
          serviceNeed: "CCTV és beléptető bővítés",
          locationOrSite: "Székesfehérvár telephely",
          urgencyOrTiming: "felmérés két héten belül",
          contactNeed: "Biztonságos elérhetőség megadva a visszajelzéshez.",
          camera: "CCTV kamerarendszer",
          accessControl: "beléptető bővítés",
          alarm: "meglévő riasztó",
          staffSummaryHu: "Belső összefoglaló: biztonságtechnika. Igény: CCTV és beléptető bővítés.",
        },
        status: "needs_staff_review",
        statusReason: "",
        staffNotes: "Helyi minta megkeresés.",
        createdAt: "2026-06-05T12:00:00.000Z",
        updatedAt: "2026-06-05T12:00:00.000Z",
      },
      {
        id: "erd-fixture-seed-5",
        lane: "audit_compliance",
        laneLabel: "Hatósági / audit támogatás",
        confidence: "medium",
        requestText: "Beszerzési auditanyaghoz kérnénk támogatást vagyonvédelmi és FM szolgáltatási keretre, határidő június vége.",
        siteOrObject: "több telephely",
        locationText: "országos",
        serviceNeed: "Beszerzési audit támogatás",
        timingText: "június vége",
        urgency: "határidős",
        contactName: "Audit kapcsolattartó",
        contactEmail: "audit@example.test",
        contactPhone: "",
        missingFields: [],
        structuredBrief: {
          lane: "audit_compliance",
          laneLabelHu: "Hatósági / audit támogatás",
          serviceNeed: "Beszerzési audit támogatás",
          locationOrSite: "országos, több telephely",
          urgencyOrTiming: "június vége",
          contactNeed: "Biztonságos elérhetőség megadva a visszajelzéshez.",
          documentNeed: "beszerzési auditanyag",
          procurementContext: "vagyonvédelmi és FM szolgáltatási keret",
          staffSummaryHu: "Belső összefoglaló: hatósági/audit támogatás. Igény: beszerzési auditanyag.",
        },
        status: "routed",
        statusReason: "Belső szakmai ellenőrzésre továbbítva.",
        staffNotes: "Helyi minta megkeresés.",
        createdAt: "2026-06-05T13:00:00.000Z",
        updatedAt: "2026-06-05T13:00:00.000Z",
      },
      {
        id: "erd-fixture-seed-6",
        lane: "mixed_enterprise_request",
        laneLabel: "Vegyes vállalati megkeresés",
        confidence: "high",
        requestText: "Őrzés-védelem, FM karbantartás és kamerarendszer felmérés együtt kell három telephelyen.",
        siteOrObject: "három telephely",
        locationText: "Budapest, Debrecen, Pécs",
        serviceNeed: "Őrzés-védelem, FM és biztonságtechnika együtt",
        timingText: "ütemezés egyeztetendő",
        urgency: "szétválasztandó",
        contactName: "Programvezető",
        contactEmail: "program@example.test",
        contactPhone: "",
        missingFields: ["urgency_or_timing"],
        structuredBrief: {
          lane: "mixed_enterprise_request",
          laneLabelHu: "Vegyes vállalati megkeresés",
          serviceNeed: "Őrzés-védelem, FM és biztonságtechnika együtt",
          locationOrSite: "Budapest, Debrecen, Pécs",
          urgencyOrTiming: "ütemezés egyeztetendő",
          contactNeed: "Biztonságos elérhetőség megadva a visszajelzéshez.",
          serviceAreas: "őrzés-védelem, Facility Management, biztonságtechnika",
          splitNeeds: "három telephely és három szolgáltatási terület belső szétválasztása",
          staffSummaryHu: "Belső összefoglaló: vegyes megkeresés. Igény: több szolgáltatási terület szétválasztása.",
        },
        status: "needs_staff_review",
        statusReason: "Belső szétválasztás szükséges.",
        staffNotes: "Helyi minta megkeresés.",
        createdAt: "2026-06-05T14:00:00.000Z",
        updatedAt: "2026-06-05T14:00:00.000Z",
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
        return REVIEW_STATUS_LABELS.needs_info;
      case "needs_staff_review":
        return REVIEW_STATUS_LABELS.needs_staff_review;
      case "routed":
        return REVIEW_STATUS_LABELS.routed;
      case "declined":
        return REVIEW_STATUS_LABELS.declined;
      case "archived":
        return REVIEW_STATUS_LABELS.archived;
      default:
        return REVIEW_STATUS_LABELS.needs_staff_review;
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
      laneLabel: trimText(record.laneLabel || record.lane_label || brief.laneLabelHu || brief.lane_label_hu)
        || workspaceLabel(trimText(record.lane), "Általános érdeklődés"),
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

  function getSelectedRecord(records = state.records) {
    if (!records.length) {
      return null;
    }

    return records.find((record) => record.id === state.selectedId) || records[0];
  }

  function renderAccount() {
    if (!accountRoot) {
      return;
    }

    if (window.VONZA_LOCAL_ENTERPRISE_DASHBOARD_FIXTURE === true) {
      accountRoot.innerHTML = `<span class="erdp-account-email">Helyi minta</span>`;
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
      <section class="erdp-auth-card" aria-label="${escapeHtml(profile?.productName || "Enterprise Request Desk")} belépés">
        <div>
          <h2>Belépés szükséges</h2>
          <p>A ${escapeHtml(profile?.productNameHu || profile?.productName || "Enterprise Request Desk")} tulajdonosi session alatt érhető el. Jelentkezz be, hozz létre fiókot, vagy kérj varázslinket.</p>
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
          <p>A feldolgozási felület betöltött, de az élő megkereséslistához auth konfiguráció szükséges.</p>
        </div>
      </section>
    `;
  }

  function filterRecordsForView(records, workspace = getWorkspaceDefinition()) {
    if (workspace.type !== "service" || !workspace.laneKey) {
      return records;
    }

    return records.filter((record) => trimText(record.lane).toLowerCase() === workspace.laneKey);
  }

  function countRecords(records, predicate) {
    return records.filter(predicate).length;
  }

  function buildLaneCounts(records) {
    const serviceWorkspaces = getWorkspaceDefinitions().filter((workspace) => workspace.type === "service");
    const counts = serviceWorkspaces.map((workspace) => ({
      ...workspace,
      count: countRecords(records, (record) => trimText(record.lane).toLowerCase() === workspace.laneKey),
    }));
    const generalCount = countRecords(records, (record) => trimText(record.lane).toLowerCase() === "general_enquiry");

    if (generalCount) {
      counts.push({
        id: "general-enquiry",
        hash: "requests",
        type: "queue",
        labelKey: "general_enquiry",
        laneKey: "general_enquiry",
        label: workspaceLabel("general_enquiry", "Általános érdeklődés"),
        description: "Általános vagy még nem besorolt megkeresések a közös queue-ban.",
        emptyState: "",
        count: generalCount,
      });
    }

    return counts;
  }

  function buildStatusCounts(records) {
    return STATUS_ORDER.map((status) => ({
      status,
      label: statusLabel(status),
      count: countRecords(records, (record) => trimText(record.status).toLowerCase() === status),
    }));
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

  function renderQueue(records, selectedRecord, workspace = getWorkspaceDefinition()) {
    const title = workspace.type === "service" ? workspace.label : "Megkeresések";
    const description = workspace.description
      || "Beérkező vállalati igények előszűrt összefoglalóval, hiányzó adattal és feldolgozási állapottal.";
    const emptyText = workspace.type === "service"
      ? (workspace.emptyState || "Ebben a szolgáltatási nézetben még nincs megkeresés.")
      : (profile?.dashboard?.emptyQueue || "Még nincs beérkezett megkeresés.");

    return `
      <section class="erdp-panel erdp-queue-panel" id="queue" aria-label="${escapeHtml(title)}" data-erdp-filter-lane="${escapeHtml(workspace.laneKey || "all")}">
        <div class="erdp-panel-header">
          <div>
            <h2>${escapeHtml(title)}</h2>
            <p>${escapeHtml(description)}</p>
          </div>
          <button class="erdp-button" type="button" data-erdp-refresh>Frissítés</button>
        </div>
        <div class="erdp-panel-body">
          <div class="erdp-request-list">
            ${records.length
              ? records.map((record) => renderRequestRow(record, record.id === selectedRecord?.id)).join("")
              : `<div class="erdp-empty"><p>${escapeHtml(emptyText)}</p><p>${escapeHtml(profile?.dashboard?.emptyHint || "Nyissa meg az intake linket, és küldjön be egy tesztmegkeresést.")}</p></div>`}
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

  function snakeToCamel(value) {
    return trimText(value).replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
  }

  function camelToSnake(value) {
    return trimText(value).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  function normalizeBriefValue(value) {
    if (Array.isArray(value)) {
      return value.map(trimText).filter(Boolean).join(", ");
    }

    if (value && typeof value === "object") {
      return "";
    }

    return trimText(value);
  }

  function readBriefCandidate(record, key) {
    const variants = [...new Set([key, snakeToCamel(key), camelToSnake(key)])];
    const brief = record.structuredBrief || {};

    for (const variant of variants) {
      const briefValue = normalizeBriefValue(brief[variant]);
      if (briefValue) {
        return briefValue;
      }

      const recordValue = normalizeBriefValue(record[variant]);
      if (recordValue) {
        return recordValue;
      }
    }

    return "";
  }

  function readTemplateValue(record, templateItem) {
    for (const key of templateItem.keys || []) {
      const value = readBriefCandidate(record, key);
      if (value) {
        return value;
      }
    }

    if (typeof templateItem.fallback === "function") {
      return normalizeBriefValue(templateItem.fallback(record));
    }

    return "";
  }

  function getLaneBriefItems(record) {
    const lane = trimText(record?.lane).toLowerCase() || "general_enquiry";
    const template = LANE_BRIEF_TEMPLATES[lane] || LANE_BRIEF_TEMPLATES.general_enquiry;

    return template.map((item) => {
      const value = readTemplateValue(record, item);
      return {
        label: item.label,
        value,
        missing: !value,
      };
    });
  }

  function getMissingBriefLabels(record) {
    return getLaneBriefItems(record)
      .filter((item) => item.missing)
      .map((item) => item.label);
  }

  function renderLaneBriefChecklist(record) {
    const items = getLaneBriefItems(record);

    return `
      <section class="erdp-lane-brief" aria-label="Lane-specifikus brief" data-erdp-lane-brief="${escapeHtml(record.lane || "general_enquiry")}">
        <div class="erdp-section-heading">
          <h4>Lane-specifikus brief</h4>
          <p>A mezők a meglévő strukturált briefből és a rögzített megkeresésből töltődnek.</p>
        </div>
        <dl class="erdp-lane-brief-list">
          ${items.map((item) => `
            <div class="${item.missing ? "is-missing" : ""}">
              <dt>${escapeHtml(item.label)}</dt>
              <dd>${escapeHtml(item.value || "tisztázandó")}</dd>
            </div>
          `).join("")}
        </dl>
      </section>
    `;
  }

  function nextQuestionForMissingField(field) {
    switch (trimText(field)) {
      case "service_need":
        return "Pontosan melyik szolgáltatási igényt kell belső feldolgozásra előkészíteni?";
      case "location_or_site":
        return "Melyik helyszínhez, objektumhoz vagy telephelyhez kapcsolódik a megkeresés?";
      case "urgency_or_timing":
        return "Mikor indulna az igény, van-e határidő vagy sürgősségi szint?";
      case "contact_need":
        return "Milyen biztonságos kapcsolati csatornán kérhető visszajelzés?";
      default:
        return "";
    }
  }

  function getSuggestedNextQuestion(record) {
    const missingQuestion = record.missingFields
      .map(nextQuestionForMissingField)
      .find(Boolean);

    if (missingQuestion) {
      return missingQuestion;
    }

    const missingBriefLabel = getMissingBriefLabels(record)[0];
    if (missingBriefLabel) {
      return `Pontosítsuk ezt: ${missingBriefLabel.toLowerCase()}?`;
    }

    return LANE_NEXT_QUESTIONS[trimText(record.lane).toLowerCase()]
      || "Nincs kötelező következő kérdés. Belső ellenőrzés után dönthető el a következő válasz.";
  }

  function getRecommendedRoute(record) {
    return RECOMMENDED_ROUTES[trimText(record?.lane).toLowerCase()]
      || RECOMMENDED_ROUTES.general_enquiry;
  }

  function renderMissingInfo(record) {
    const requiredMissing = record.missingFields.map(missingFieldLabel);
    const briefMissing = getMissingBriefLabels(record);
    const merged = [...new Set([...requiredMissing, ...briefMissing])];

    return `
      <div>
        <span class="erdp-submit-note">Hiányzó / tisztázandó adatok</span>
        <div class="erdp-missing-list">
          ${merged.length
            ? merged.map((field) => `<span>${escapeHtml(field)}</span>`).join("")
            : "<span>nincs hiányzó minimális adat</span>"}
        </div>
      </div>
    `;
  }

  function renderBrief(record) {
    if (!record) {
      return `
        <section class="erdp-panel erdp-brief-workspace-panel" id="brief" aria-label="Kiválasztott megkeresés brief">
          <div class="erdp-panel-header">
            <div>
              <h2>Kiválasztott brief</h2>
              <p>Válassz ki egy megkeresést a részletekhez.</p>
            </div>
          </div>
          <div class="erdp-panel-body">
            <div class="erdp-empty"><p>Az ügyféligény, ismert adatok és lane-specifikus checklist itt jelenik meg.</p></div>
          </div>
        </section>
      `;
    }

    const staffSummary = trimText(record.structuredBrief?.staffSummaryHu || record.structuredBrief?.staff_summary_hu)
      .replace(/^Belső brief:/i, "Belső összefoglaló:");

    return `
      <section class="erdp-panel erdp-brief-workspace-panel" id="brief" aria-label="Kiválasztott megkeresés brief">
        <div class="erdp-panel-header">
          <div>
            <h2>Kiválasztott brief</h2>
            <p>Amit az ügyfél kér, ami ismert, és mi maradt tisztázandó.</p>
          </div>
        </div>
        <div class="erdp-panel-body">
          <div class="erdp-detail-title">
            <h3>${escapeHtml(valueOrEmpty(record.serviceNeed || record.laneLabel))}</h3>
            <span class="erdp-badge ${escapeHtml(statusBadgeClass(record.status))}">${escapeHtml(statusLabel(record.status))}</span>
          </div>
          <div class="erdp-request-need">
            <span>Ügyféligény</span>
            <p>${escapeHtml(valueOrEmpty(record.requestText || record.serviceNeed))}</p>
          </div>
          <div class="erdp-detail-grid">
            ${detailItem("Szolgáltatási terület", record.laneLabel)}
            ${detailItem("Besorolási jelzés", record.confidence)}
            ${detailItem("Objektum / helyszín", record.siteOrObject)}
            ${detailItem("Helyszín", record.locationText)}
            ${detailItem("Szolgáltatási igény", record.serviceNeed)}
            ${detailItem("Időzítés", record.timingText || record.urgency)}
            ${detailItem("Kapcsolati állapot", getContactNeeded(record))}
            ${detailItem("Kapcsolattartó", record.contactName)}
            ${detailItem("Email", record.contactEmail)}
            ${detailItem("Telefon", record.contactPhone)}
            ${detailItem("Beérkezett", formatDateTime(record.createdAt))}
            ${staffSummary ? detailItem("Belső összefoglaló", staffSummary) : ""}
          </div>
          ${renderLaneBriefChecklist(record)}
        </div>
      </section>
    `;
  }

  function renderActionPanel(record) {
    if (!record) {
      return `
        <section class="erdp-panel erdp-action-panel" id="actions" aria-label="Műveletek és routing">
          <div class="erdp-panel-header">
            <div>
              <h2>Feldolgozás</h2>
              <p>Válassz ki egy megkeresést a hiányzó adatokhoz és státuszhoz.</p>
            </div>
          </div>
          <div class="erdp-panel-body">
            <div class="erdp-empty"><p>A következő kérdés, belső útvonal, státusz és jegyzet mezők itt jelennek meg.</p></div>
          </div>
        </section>
      `;
    }

    const saveStatus = REVIEW_ACTION_SET.has(record.status) ? record.status : "needs_staff_review";

    return `
      <section class="erdp-panel erdp-action-panel" id="actions" aria-label="Műveletek és routing" data-erdp-safe-review-statuses="needs_info needs_staff_review routed declined archived">
        <div class="erdp-panel-header">
          <div>
            <h2>Feldolgozás</h2>
            <p>Hiányzó adat, következő kérdés, belső útvonal és biztonságos review státusz.</p>
          </div>
        </div>
        <div class="erdp-panel-body">
          ${renderMissingInfo(record)}
          <div class="erdp-routing-card">
            <span>Következő kérdés</span>
            <strong>${escapeHtml(getSuggestedNextQuestion(record))}</strong>
          </div>
          <div class="erdp-routing-card">
            <span>Javasolt belső útvonal</span>
            <strong>${escapeHtml(getRecommendedRoute(record))}</strong>
          </div>
          <label class="erdp-field">
            Státusz oka
            <textarea data-erdp-status-reason>${escapeHtml(record.statusReason)}</textarea>
          </label>
          <label class="erdp-field">
            Megjegyzés
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
      <section class="erdp-panel" aria-label="Legutóbbi megkeresések">
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
        <code>${escapeHtml(getApiPrefix())}/intake?agent_key=&lt;public_agent_key&gt;</code>
      </section>
    `;
  }

  function renderSetupRequired() {
    root.innerHTML = `
      <section class="erdp-auth-card" aria-label="${escapeHtml(profile?.productName || "Enterprise Request Desk")} setup szükséges">
        <div>
          <h2>Setup szükséges</h2>
          <p>Bejelentkezve: ${escapeHtml(authUser?.email || "tulajdonosi fiók")}</p>
          <p>A megkereséslista megnyitása előtt add meg a szervezet nevét, szolgáltatási területét, szolgáltatási vonalait és a belső továbbítási módot.</p>
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
      <section class="erdp-empty" aria-label="${escapeHtml(profile?.productName || "Enterprise Request Desk")} setup állapot hiba">
        <h2>Setup állapot nem érhető el</h2>
        <p>${escapeHtml(message || "A setup tábla vagy az auth állapot nem tölthető be.")}</p>
      </section>
    `;
  }

  function renderSafetyStrip() {
    return `
      <section class="erdp-safety-strip" aria-label="${escapeHtml(profile?.productName || "Enterprise Request Desk")} határok">
        <div>
          <strong>${escapeHtml(profile?.dashboard?.safetyTitle || "Setup teljes. A beérkező megkeresések belső feldolgozásra kerülnek.")}</strong>
          <p>${escapeHtml(profile?.dashboard?.safetyBody || "Különálló megkereséskezelő felület előszűréshez, összefoglalóhoz és belső továbbításhoz.")}</p>
        </div>
        <span>${escapeHtml(profile?.dashboard?.setupActive || "Setup aktív")}</span>
      </section>
    `;
  }

  function renderRequestError() {
    if (!state.requestError) {
      return "";
    }

    return `
      <section class="erdp-error-strip" aria-label="${escapeHtml(profile?.productName || "Enterprise Request Desk")} betöltési hiba">
        <strong>A megkeresések listája nem tölthető be.</strong>
        <p>${escapeHtml(state.requestError.message)}</p>
      </section>
    `;
  }

  function renderOverview(records) {
    const laneCounts = buildLaneCounts(records);
    const statusCounts = buildStatusCounts(records);

    return `
      <section class="erdp-view-heading" aria-label="Áttekintés">
        <div>
          <h2>${escapeHtml(workspaceLabel("overview", "Áttekintés"))}</h2>
          <p>${escapeHtml(workspaceDescription("overview", "Közös intake queue állapota szolgáltatási terület és feldolgozási státusz szerint."))}</p>
        </div>
      </section>
      ${renderIntakeAccess()}
      ${!records.length ? `
        <section class="erdp-empty erdp-empty-wide" aria-label="Üres dashboard áttekintés">
          <h2>Még nincs beérkezett megkeresés</h2>
          <p>Nyisd meg az intake linket, küldj be egy tesztmegkeresést, majd térj vissza ide. A kérés a közös queue-ban és a besorolt szolgáltatási workspace-ben is megjelenik.</p>
        </section>
      ` : ""}
      <div class="erdp-overview-grid">
        <section class="erdp-panel" aria-label="Megkeresések szolgáltatási terület szerint" data-erdp-overview-lane-counts>
          <div class="erdp-panel-header">
            <div>
              <h2>Szolgáltatási területek</h2>
              <p>Ugyanaz a megkereséslista, lane szerinti munkanézetekre szűrve.</p>
            </div>
          </div>
          <div class="erdp-panel-body erdp-lane-count-list">
            ${laneCounts.map((lane) => `
              <a class="erdp-lane-count-row" href="#${escapeHtml(lane.hash)}" data-erdp-lane-count="${escapeHtml(lane.laneKey || "all")}">
                <span>
                  <strong>${escapeHtml(lane.label)}</strong>
                  <em>${escapeHtml(lane.description || "Szolgáltatási workspace")}</em>
                </span>
                <b>${escapeHtml(lane.count)}</b>
              </a>
            `).join("")}
          </div>
        </section>
        <section class="erdp-panel" aria-label="Megkeresések státusz szerint" data-erdp-overview-status-counts>
          <div class="erdp-panel-header">
            <div>
              <h2>Feldolgozási státuszok</h2>
              <p>Csak biztonságos review státuszok és a beérkezett állapot szerepel.</p>
            </div>
          </div>
          <div class="erdp-panel-body erdp-status-count-list">
            ${statusCounts.map((entry) => `
              <div class="erdp-status-count-row" data-erdp-status-count="${escapeHtml(entry.status)}">
                <span>${escapeHtml(entry.label)}</span>
                <strong>${escapeHtml(entry.count)}</strong>
              </div>
            `).join("")}
          </div>
        </section>
      </div>
      ${renderRecent(records)}
    `;
  }

  function renderWorkspacePage(records, workspace) {
    const filteredRecords = filterRecordsForView(records, workspace);
    const selectedRecord = getSelectedRecord(filteredRecords);

    return `
      <section class="erdp-view-heading" aria-label="${escapeHtml(workspace.label)} workspace">
        <div>
          <h2>${escapeHtml(workspace.label)}</h2>
          <p>${escapeHtml(workspace.description || "Közös intake queue szűrt munkanézete.")}</p>
        </div>
        <span>${escapeHtml(filteredRecords.length)} / ${escapeHtml(records.length)} megkeresés</span>
      </section>
      <div class="erdp-workspace erdp-workspace-three" data-erdp-workspace-columns data-erdp-active-lane="${escapeHtml(workspace.laneKey || "all")}">
        ${renderQueue(filteredRecords, selectedRecord, workspace)}
        ${renderBrief(selectedRecord)}
        ${renderActionPanel(selectedRecord)}
      </div>
    `;
  }

  function renderSettings() {
    const setup = state.setup || {};
    const serviceLines = Array.isArray(setup.serviceLines)
      ? setup.serviceLines
      : (profile?.fixtureBusiness?.serviceTypes || profile?.lanes?.map((lane) => lane.labelHu) || []);
    const boundaries = [
      "Közös intake queue, szolgáltatási terület szerinti munkanézetekkel.",
      "Csak hiányzó adat, belső ellenőrzés, továbbítva, elutasítva és archiválva státusz használható.",
      "Végleges ár, szerződés, műszakterv és helyszíni riport nem készül ezen a felületen.",
      "A belső döntést és választ a csapat kezeli.",
    ];

    return `
      <section class="erdp-view-heading" aria-label="Beállítások">
        <div>
          <h2>${escapeHtml(workspaceLabel("settings", "Beállítások"))}</h2>
          <p>${escapeHtml(workspaceDescription("settings", "Setup állapot, intake link, szolgáltatási vonalak és termékhatárok."))}</p>
        </div>
      </section>
      <div class="erdp-settings-grid">
        <section class="erdp-panel" aria-label="Setup állapot">
          <div class="erdp-panel-header">
            <div>
              <h2>Setup állapot</h2>
              <p>A dashboard csak setup után tölti a tulajdonosi queue-t.</p>
            </div>
          </div>
          <div class="erdp-panel-body">
            ${detailItem("Állapot", state.setupComplete ? "Setup aktív" : "Setup szükséges")}
            ${detailItem("Szervezet", setup.organizationName || profile?.fixtureBusiness?.businessName)}
            ${detailItem("Szolgáltatási terület", setup.serviceArea || profile?.fixtureBusiness?.serviceArea)}
            ${detailItem("Belső továbbítás", setup.routingPreference || "internal_handoff")}
          </div>
        </section>
        ${renderIntakeAccess()}
        <section class="erdp-panel" aria-label="Szolgáltatási vonalak">
          <div class="erdp-panel-header">
            <div>
              <h2>Szolgáltatási vonalak</h2>
              <p>A workspace szűrés a request lane kulcsát használja, külön adattár nélkül.</p>
            </div>
          </div>
          <div class="erdp-panel-body">
            <div class="erdp-missing-list">
              ${serviceLines.map((serviceLine) => `<span>${escapeHtml(serviceLine)}</span>`).join("")}
            </div>
          </div>
        </section>
        <section class="erdp-panel" aria-label="Termékhatárok">
          <div class="erdp-panel-header">
            <div>
              <h2>Határok</h2>
              <p>Phase 8 célja a kérésfeldolgozó workspace, nem operatív irányítás.</p>
            </div>
          </div>
          <div class="erdp-panel-body erdp-boundary-stack">
            ${boundaries.map((boundary) => `<span>${escapeHtml(boundary)}</span>`).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function renderDashboard() {
    updateActiveViewFromHash();
    renderSidebarNav();

    const records = state.records;
    const workspace = getWorkspaceDefinition();
    const viewHtml = workspace.type === "overview"
      ? renderOverview(records)
      : workspace.type === "settings"
        ? renderSettings()
        : renderWorkspacePage(records, workspace);

    root.innerHTML = `
      <div class="erdp-dashboard" data-erdp-active-view="${escapeHtml(workspace.id)}">
        ${renderSafetyStrip()}
        ${renderRequestError()}
        ${viewHtml}
      </div>
    `;
  }

  async function loadRequests() {
    if (window.VONZA_LOCAL_ENTERPRISE_DASHBOARD_FIXTURE === true) {
      const records = seedFixtureRowsIfNeeded().map(normalizeRecord);
      state = {
        ...state,
        setup: {
          organizationName: profile?.fixtureBusiness?.businessName || "Helyi minta",
          serviceArea: "Budapest",
          serviceLines: profile?.fixtureBusiness?.serviceTypes || ["őrzés-védelem", "Facility Management"],
          routingPreference: "internal_handoff",
        },
        setupComplete: true,
        customerIntake: {
          available: true,
          path: `${getApiPrefix()}/intake-fixture`,
          aliasPath: getApiPrefix() === "/esg-request-desk"
            ? "/enterprise-request-desk/intake-fixture"
            : "/esg-request-desk/intake-fixture",
          guidanceHu: "Helyi minta link böngészős ellenőrzéshez.",
        },
        records,
        summary: buildSummary(records),
        selectedId: state.selectedId || records[0]?.id || "",
        requestError: null,
      };
      renderAccount();
      setStatus(records.length ? "Helyi minta megkeresések betöltve." : "Nincs helyi minta megkeresés.");
      renderDashboard();
      return;
    }

    setStatus(`${profile?.productName || "Enterprise Request Desk"} megkeresések betöltése...`);
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
      setStatus(records.length ? "Megkeresések betöltve." : "Még nincs beérkezett megkeresés.");
    } catch (error) {
      state = {
        ...state,
        records: [],
        summary: buildSummary([]),
        requestError: {
          code: error.code || "",
          message: error.message || "A megkeresések listája nem tölthető be.",
        },
      };
      setStatus(state.requestError.message);
    }
    renderDashboard();
  }

  async function loadSetupStateThenRequests() {
    setStatus(`${profile?.productName || "Enterprise Request Desk"} setup állapot betöltése...`);

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
        setStatus("Setup szükséges a megkereséslista megnyitásához.");
        return;
      }

      await loadRequests();
    } catch (error) {
      if (error.code === "enterprise_request_desk_setup_table_missing") {
        renderSetupUnavailable(error.message);
        setStatus("Setup tábla hiányzik.");
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
        setStatus("Helyi minta: setup szükséges.");
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
        setStatus(`Jelentkezz be a ${profile?.productNameHu || profile?.productName || "megkereséskezelő"} felülethez.`);
        return;
      }

      await loadSetupStateThenRequests();
    } catch (error) {
      renderAuthGate(error.message || "");
      setStatus(error.message || "A megkereséskezelő felület nem tölthető be.");
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

  window.addEventListener("hashchange", () => {
    updateActiveViewFromHash();
    renderSidebarNav();
    if (state.setupComplete || window.VONZA_LOCAL_ENTERPRISE_DASHBOARD_FIXTURE === true) {
      renderDashboard();
    }
  });

  boot();
}());
