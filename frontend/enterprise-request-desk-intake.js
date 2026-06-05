(function initEnterpriseRequestDeskIntake() {
  const root = document.getElementById("erdp-intake-root");
  const statusRoot = document.getElementById("erdp-intake-status");
  const FIXTURE_STORAGE_KEY = "VONZA_ENTERPRISE_REQUEST_DESK_FIXTURE_REQUESTS";
  const DEFAULT_LANES = Object.freeze([
    { key: "security_guarding", labelHu: "Őrzés-védelem" },
    { key: "reception_object_protection", labelHu: "Portaszolgálat / objektumvédelem" },
    { key: "facility_management", labelHu: "Facility management" },
    { key: "security_technology", labelHu: "Biztonságtechnika" },
    { key: "audit_compliance", labelHu: "Audit / compliance" },
    { key: "mixed_enterprise_request", labelHu: "Vegyes vállalati megkeresés" },
    { key: "general_enquiry", labelHu: "Általános érdeklődés" },
  ]);
  const MISSING_FIELD_LABELS = Object.freeze({
    service_need: "szolgáltatási igény",
    location_or_site: "helyszín vagy objektum",
    urgency_or_timing: "időzítés vagy sürgősség",
    contact_need: "biztonságos kapcsolati adat",
  });
  const SAMPLE_FIXTURE = Object.freeze({
    business: {
      businessName: "ESG Holding Zrt.",
      serviceArea: "országos, Budapest központtal",
      serviceTypes: [
        "őrzés-védelem",
        "portaszolgálat / objektumvédelem",
        "facility management",
        "biztonságtechnika",
        "audit / compliance",
      ],
    },
    lanes: DEFAULT_LANES,
  });

  let context = null;
  let submitting = false;

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

  function getAgentKey() {
    const params = new URLSearchParams(window.location.search);
    return trimText(params.get("agent_key") || params.get("agentKey") || params.get("k"));
  }

  function getApiPrefix() {
    return window.location.pathname.startsWith("/esg-request-desk")
      ? "/esg-request-desk"
      : "/enterprise-request-desk";
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(data?.error || "A kérés nem sikerült.");
      error.code = data?.code || "";
      throw error;
    }

    return data;
  }

  function normalizeSearch(value = "") {
    return trimText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function detectFixtureLane(text = "") {
    const search = normalizeSearch(text);
    const matches = [];

    if (/\b(orzes|vagyonor|guard|jaror)\b/.test(search)) matches.push("security_guarding");
    if (/\b(porta|recepcio|beleptetes|objektum|reception|gatehouse)\b/.test(search)) matches.push("reception_object_protection");
    if (/\b(facility|letesitmeny|karbantartas|takaritas|uzemeltetes|fm)\b/.test(search)) matches.push("facility_management");
    if (/\b(kamera|cctv|belepteto|riaszto|access control|biztonsagtechnika)\b/.test(search)) matches.push("security_technology");
    if (/\b(audit|compliance|megfeleloseg|szabalyzat|risk)\b/.test(search)) matches.push("audit_compliance");

    const key = matches.length > 1 ? "mixed_enterprise_request" : matches[0] || "general_enquiry";
    return DEFAULT_LANES.find((lane) => lane.key === key) || DEFAULT_LANES.at(-1);
  }

  function getMissingFields(payload = {}) {
    const missing = [];

    if (!trimText(payload.service_need)) missing.push("service_need");
    if (!trimText(payload.location_text) && !trimText(payload.site_or_object)) missing.push("location_or_site");
    if (!trimText(payload.timing_text) && !trimText(payload.urgency)) missing.push("urgency_or_timing");
    if (!trimText(payload.contact_email) && !trimText(payload.contact_phone)) missing.push("contact_need");

    return missing;
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

  function buildFixtureRecord(payload = {}) {
    const lane = detectFixtureLane(`${payload.request_text} ${payload.service_need}`);
    const missingFields = getMissingFields(payload);
    const now = new Date().toISOString();
    const contactNeed = payload.contact_email || payload.contact_phone
      ? "Biztonságos elérhetőség megadva a visszajelzéshez."
      : "Kapcsolati adat hiányzik a visszajelzéshez.";

    return {
      id: `erd-fixture-${Date.now()}`,
      lane: lane.key,
      laneLabel: lane.labelHu,
      confidence: lane.key === "general_enquiry" ? "low" : "medium",
      requestText: trimText(payload.request_text),
      siteOrObject: trimText(payload.site_or_object),
      locationText: trimText(payload.location_text),
      serviceNeed: trimText(payload.service_need) || lane.labelHu,
      timingText: trimText(payload.timing_text) || trimText(payload.urgency),
      urgency: trimText(payload.urgency),
      contactName: trimText(payload.contact_name),
      contactEmail: trimText(payload.contact_email).toLowerCase(),
      contactPhone: trimText(payload.contact_phone),
      missingFields,
      structuredBrief: {
        lane: lane.key,
        laneLabelHu: lane.labelHu,
        confidence: lane.key === "general_enquiry" ? "low" : "medium",
        serviceNeed: trimText(payload.service_need) || lane.labelHu,
        locationOrSite: trimText(payload.location_text) || trimText(payload.site_or_object),
        urgencyOrTiming: trimText(payload.timing_text) || trimText(payload.urgency),
        contactNeed,
        contactName: trimText(payload.contact_name),
        contactEmail: trimText(payload.contact_email).toLowerCase(),
        contactPhone: trimText(payload.contact_phone),
        missingFields,
        readyForOwnerReview: missingFields.length === 0,
        staffSummaryHu: `Belső brief: ${lane.labelHu}. Igény: ${trimText(payload.service_need) || lane.labelHu}. Helyszín/objektum: ${trimText(payload.location_text) || trimText(payload.site_or_object) || "nincs megadva"}.`,
      },
      status: missingFields.length ? "needs_info" : "request_received",
      statusReason: "Local fixture request received for staff review only.",
      staffNotes: "",
      createdAt: now,
      updatedAt: now,
    };
  }

  async function submitFixture(payload) {
    const record = buildFixtureRecord(payload);
    writeFixtureRows([record, ...readFixtureRows()]);

    return {
      ok: true,
      created: true,
      laneLabel: record.laneLabel,
      missingFields: record.missingFields,
      missingFieldLabels: record.missingFields.map((field) => MISSING_FIELD_LABELS[field]).filter(Boolean),
      message: "A local fixture megkeresést rögzítettük. Nyissa meg a dashboard fixture oldalt a review felülethez.",
    };
  }

  function renderUnavailable(message = "") {
    root.innerHTML = `
      <section class="erdp-empty" aria-label="ESG Request Desk link nem elérhető">
        <div>
          <h2>Ez az intake link nem használható</h2>
          <p>${escapeHtml(message || "A link hiányzik vagy már nem aktív. Kérjen friss ESG Request Desk linket.")}</p>
        </div>
      </section>
    `;
  }

  function renderSuccess(payload = {}) {
    const labels = Array.isArray(payload.missingFieldLabels) ? payload.missingFieldLabels : [];

    return `
      <div class="erdp-success" aria-label="Megkeresés rögzítve">
        <strong>${escapeHtml(payload.created === false ? "A megkeresés már rögzítve volt." : "Megkeresés rögzítve.")}</strong>
        <p>${escapeHtml(payload.message || "A megkeresés staff review-ra került.")}</p>
        <div class="erdp-missing-list">
          <span>Lane: ${escapeHtml(payload.laneLabel || "Általános érdeklődés")}</span>
          ${labels.length ? labels.map((label) => `<span>Hiányzik: ${escapeHtml(label)}</span>`).join("") : "<span>Minimális adatok megvannak</span>"}
        </div>
        ${window.VONZA_LOCAL_ENTERPRISE_INTAKE_FIXTURE === true ? `
          <a class="erdp-button erdp-button-primary" href="/enterprise-request-desk/dashboard-fixture">Dashboard fixture</a>
        ` : ""}
      </div>
    `;
  }

  function renderForm(successPayload = null) {
    const business = context?.business || SAMPLE_FIXTURE.business;
    const lanes = Array.isArray(context?.lanes) && context.lanes.length ? context.lanes : DEFAULT_LANES;
    const businessName = trimText(business.businessName) || "ESG Request Desk";
    const serviceArea = trimText(business.serviceArea) || "egyeztetett vállalati helyszínek";

    root.innerHTML = `
      <div class="erdp-intake-layout">
        <section class="erdp-intake-copy">
          <div>
            <h1>Vállalati security, FM vagy compliance igény beküldése.</h1>
            <p>${escapeHtml(businessName)} staff review-ra kapja meg a strukturált megkeresést. A csapat külön ellenőrzi a vállalhatóságot és a következő lépést.</p>
          </div>
          <div class="erdp-lane-strip" aria-label="ESG Request Desk lane-ek">
            ${lanes.map((lane) => `<span>${escapeHtml(lane.labelHu)}</span>`).join("")}
          </div>
          <p>Terület: ${escapeHtml(serviceArea)}</p>
        </section>

        <section class="erdp-intake-card" aria-label="Enterprise Request Desk intake form">
          <div class="erdp-card-header">
            <div>
              <h2>Megkeresés adatai</h2>
              <p>Elég a lényeggel kezdeni; a hiányzó mezőket külön jelöljük a csapatnak.</p>
            </div>
          </div>
          <form class="erdp-form" data-erdp-intake-form novalidate>
            <label class="erdp-field erdp-field-wide">
              Rövid leírás
              <textarea name="request_text" rows="7" maxlength="2200" required>Portaszolgálat kell egy irodaházhoz Budapest XI. kerületben, jövő héten. Kovács Anna vagyok, anna@client.hu.</textarea>
            </label>
            <div class="erdp-field-grid">
              <label class="erdp-field">
                Objektum / site
                <input name="site_or_object" autocomplete="off" value="irodaház">
              </label>
              <label class="erdp-field">
                Helyszín
                <input name="location_text" autocomplete="off" value="Budapest XI. kerület">
              </label>
              <label class="erdp-field">
                Szolgáltatási igény
                <input name="service_need" autocomplete="off" value="Portaszolgálat és beléptetés">
              </label>
              <label class="erdp-field">
                Időzítés
                <input name="timing_text" autocomplete="off" value="jövő héttől">
              </label>
              <label class="erdp-field">
                Sürgősség
                <input name="urgency" autocomplete="off" value="staff review után egyeztethető">
              </label>
              <label class="erdp-field">
                Kapcsolattartó
                <input name="contact_name" autocomplete="name" value="Kovács Anna">
              </label>
              <label class="erdp-field">
                Email
                <input name="contact_email" type="email" autocomplete="email" value="anna@client.hu">
              </label>
              <label class="erdp-field">
                Telefon
                <input name="contact_phone" autocomplete="tel">
              </label>
            </div>
            <label class="erdp-check">
              <input name="consent_acknowledged" type="checkbox" checked>
              <span>Tudomásul veszem, hogy ez request-only beküldés. A csapat külön ellenőrzi a vállalhatóságot és a következő lépést.</span>
            </label>
            <div class="erdp-form-actions">
              <button class="erdp-button erdp-button-primary" type="submit" ${submitting ? "disabled" : ""}>
                Megkeresés beküldése
              </button>
              <span class="erdp-submit-note">A beküldés intake rekordot hoz létre staff review-hoz.</span>
            </div>
          </form>
          ${successPayload ? renderSuccess(successPayload) : ""}
        </section>
      </div>
    `;
  }

  async function handleSubmit(event) {
    const form = event.target.closest("[data-erdp-intake-form]");
    if (!form) {
      return;
    }

    event.preventDefault();
    if (submitting) {
      return;
    }

    const formData = new FormData(form);
    const payload = {
      agent_key: getAgentKey() || "local-enterprise-fixture-agent",
      request_text: trimText(formData.get("request_text")),
      site_or_object: trimText(formData.get("site_or_object")),
      location_text: trimText(formData.get("location_text")),
      service_need: trimText(formData.get("service_need")),
      timing_text: trimText(formData.get("timing_text")),
      urgency: trimText(formData.get("urgency")),
      contact_name: trimText(formData.get("contact_name")),
      contact_email: trimText(formData.get("contact_email")),
      contact_phone: trimText(formData.get("contact_phone")),
      consent_acknowledged: formData.get("consent_acknowledged") === "on",
    };

    if (!payload.request_text) {
      setStatus("Írja le röviden a vállalati megkeresést.");
      return;
    }

    submitting = true;
    setStatus("Megkeresés rögzítése...");
    renderForm();

    try {
      const result = window.VONZA_LOCAL_ENTERPRISE_INTAKE_FIXTURE === true
        ? await submitFixture(payload)
        : await fetchJson(`${getApiPrefix()}/intake-requests`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

      setStatus("Megkeresés rögzítve.");
      renderForm(result);
    } catch (error) {
      setStatus(error.message || "Nem sikerült rögzíteni a megkeresést.");
      renderForm();
    } finally {
      submitting = false;
    }
  }

  async function boot() {
    if (window.VONZA_LOCAL_ENTERPRISE_INTAKE_FIXTURE === true) {
      context = SAMPLE_FIXTURE;
      setStatus("Local-only Enterprise Request Desk fixture. Production API gates are not bypassed.");
      renderForm();
      return;
    }

    const agentKey = getAgentKey();
    if (!agentKey) {
      renderUnavailable("Az intake linkből hiányzik az agent_key.");
      setStatus("Hiányzó agent_key.");
      return;
    }

    try {
      context = await fetchJson(`${getApiPrefix()}/intake-context?agent_key=${encodeURIComponent(agentKey)}`);
      setStatus("Intake link aktív.");
      renderForm();
    } catch (error) {
      renderUnavailable(error.message);
      setStatus(error.message || "Az intake link nem használható.");
    }
  }

  document.addEventListener("submit", handleSubmit);
  boot();
}());
