(function initEnterpriseRequestDeskIntake() {
  const root = document.getElementById("erdp-intake-root");
  const statusRoot = document.getElementById("erdp-intake-status");
  const profileApi = window.VonzaEnterpriseRequestDeskProfiles;
  const profile = profileApi?.getProfile ? profileApi.getProfile() : null;
  if (profileApi?.applyDocumentProfile && profile) {
    profileApi.applyDocumentProfile(profile);
    document.title = profile.intake?.title || profile.productName;
  }
  const FIXTURE_STORAGE_KEY = "VONZA_ENTERPRISE_REQUEST_DESK_FIXTURE_REQUESTS";
  const DEFAULT_LANES = Object.freeze(profile?.lanes || [
    { key: "security_guarding", labelHu: "Őrzés-védelem" },
    { key: "reception_object_protection", labelHu: "Portaszolgálat / objektumvédelem" },
    { key: "facility_management", labelHu: "Facility Management" },
    { key: "security_technology", labelHu: "Biztonságtechnika" },
    { key: "audit_compliance", labelHu: "Hatósági / audit támogatás" },
    { key: "mixed_enterprise_request", labelHu: "Vegyes vállalati megkeresés" },
    { key: "general_enquiry", labelHu: "Általános érdeklődés" },
  ]);
  const MISSING_FIELD_LABELS = Object.freeze(profile?.missingFieldLabels || {
    service_need: "szolgáltatási igény",
    location_or_site: "helyszín vagy objektum",
    urgency_or_timing: "időzítés vagy sürgősség",
    contact_need: "biztonságos kapcsolati adat",
  });
  const DETAIL_LABELS = Object.freeze(profile?.detailLabels || {
    organizationName: "Szervezet",
    serviceNeed: "Igény",
    locationOrSite: "Helyszín",
    urgencyOrTiming: "Időzítés",
    contactName: "Kapcsolattartó",
    contactEmail: "Email",
    contactPhone: "Telefon",
    siteType: "Objektum",
  });
  const SAMPLE_FIXTURE = Object.freeze({
    business: profile?.fixtureBusiness || {
      businessName: "ESG Holding Zrt.",
      serviceArea: "egyeztetett ESG vállalati helyszínek",
      serviceTypes: [
        "Őrzés-védelem",
        "Portaszolgálat / objektumvédelem",
        "Facility Management",
        "Biztonságtechnika",
        "Hatósági / audit támogatás",
      ],
    },
    lanes: DEFAULT_LANES,
  });
  const OPENING_MESSAGE = profile?.intake?.openingMessage
    || "Üdvözlöm. Írja le természetes mondatban a vállalati objektumvédelmi, FM, biztonságtechnikai vagy audit jellegű igényt, és összerakom a belső feldolgozáshoz szükséges rövid összefoglalót.";

  let context = null;
  let assistantBusy = false;
  let manualOpen = false;
  let draftMessage = "";
  let messages = [{ role: "assistant", content: OPENING_MESSAGE }];
  let lane = { key: "general_enquiry", label: "Általános érdeklődés" };
  let fields = normalizeFields();
  let missingFields = ["service_need", "location_or_site", "urgency_or_timing", "contact_need"];
  let briefPreview = {};
  let nextQuestion = "Melyik szolgáltatási területhez kapcsolódik az igény?";
  let readyToCreate = false;
  let needsConfirmation = false;
  let successPayload = null;
  let lastError = "";

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

  function normalizeSearch(value = "") {
    return trimText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function normalizeFields(source = {}) {
    return {
      organizationName: trimText(source.organizationName || source.organization_name),
      serviceNeed: trimText(source.serviceNeed || source.service_need),
      locationOrSite: trimText(source.locationOrSite || source.location_or_site || source.locationText || source.location_text),
      urgencyOrTiming: trimText(source.urgencyOrTiming || source.urgency_or_timing || source.timingText || source.timing_text || source.urgency),
      contactName: trimText(source.contactName || source.contact_name),
      contactEmail: trimText(source.contactEmail || source.contact_email).toLowerCase(),
      contactPhone: trimText(source.contactPhone || source.contact_phone),
      contactPreference: trimText(source.contactPreference || source.contact_preference),
      siteType: trimText(source.siteType || source.site_type || source.siteOrObject || source.site_or_object),
      notes: trimText(source.notes || source.requestText || source.request_text),
    };
  }

  function mergeFields(...fieldSets) {
    return fieldSets.reduce((merged, fieldSet) => {
      const normalized = normalizeFields(fieldSet);
      Object.entries(normalized).forEach(([key, value]) => {
        if (!merged[key] && value) {
          merged[key] = value;
        }
      });
      return merged;
    }, normalizeFields());
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

  function detectFixtureLane(text = "") {
    const search = normalizeSearch(text);
    const matches = [];
    const hasSecurityTechnology = /\b(kamera\w*|cctv|belepteto\w*|beleptetes\w*|riaszto\w*|tuzjelzo\w*|sorompo\w*|access control|biztonsagtechnika\w*|halozat\w*)\b/.test(search);
    const hasReceptionObjectProtection = /\b(porta\w*|portaszolgalat\w*|recepcio\w*|objektumvedelem\w*|objektumor\w*|reception|gatehouse)\b/.test(search)
      || (/\bbeleptetes\w*\b/.test(search) && /\b(porta\w*|recepcio\w*|objektum\w*)\b/.test(search) && !hasSecurityTechnology);

    if (/\b(orzes\w*|vagyonor\w*|guard|jaror\w*|eloeros)\b/.test(search)) matches.push("security_guarding");
    if (hasReceptionObjectProtection) matches.push("reception_object_protection");
    if (/\b(facility|letesitmeny\w*|epuletuzemeltetes\w*|karbantartas\w*|takaritas\w*|uzemeltetes\w*|soft fm|fm|hibabejelentes\w*)\b/.test(search)) matches.push("facility_management");
    if (hasSecurityTechnology) matches.push("security_technology");
    if (/\b(audit\w*|compliance|hatosagi\w*|engedely\w*|kulkereskedelmi\w*|nato\w*|beszerzes\w*|kepzes\w*|megfeleloseg\w*|szabalyzat\w*|risk|kockazat\w*)\b/.test(search)) matches.push("audit_compliance");

    const key = matches.length > 1 ? "mixed_enterprise_request" : matches[0] || "general_enquiry";
    return DEFAULT_LANES.find((item) => item.key === key) || DEFAULT_LANES.at(-1);
  }

  function detectServiceQuestion(message = "") {
    return /\b(milyen szolg[aá]ltat[aá]s(?:ok|okra|okat)?|mit v[aá]llal|mire haszn[aá]lhat[oó]|mivel foglalkoz|what services|services)\b/i.test(message);
  }

  function detectPricingBoundary(message = "") {
    return /\b(garant[aá]lt|v[eé]gleges|pontos|fix|biztos)\b.{0,80}\b([aá]r|[aá]raj[aá]nlat|aj[aá]nlat|kalkul[aá]ci[oó])\b/i.test(message)
      || /\b(mennyibe ker[uü]l|mennyi lenne|mennyi lesz|how much|exact price|final price)\b/i.test(message);
  }

  function detectPromptBoundary(message = "") {
    return /\b(ignore|override|bypass|reveal|system prompt|developer message|prompt injection|hagyd figyelmen k[ií]v[uü]l|rendszerutas[ií]t[aá]s|promptot)\b/i.test(message);
  }

  function extractFixtureFields(message = "", laneKey = "general_enquiry") {
    const text = trimText(message);
    const search = normalizeSearch(text);
    const foundLane = DEFAULT_LANES.find((item) => item.key === laneKey) || DEFAULT_LANES.at(-1);
    const email = (text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) || [])[0] || "";
    const phone = (text.match(/\+?\d[\d\s().-]{7,}\d/) || [])[0] || "";
    const contactName = trimText((
      text.match(/\b(?:a nevem|nevem|kapcsolattart[oó]|[eé]n vagyok)\s+([^.,!?;]{2,80})/i)
      || text.match(/\b([A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű-]+(?:\s+[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű-]+){1,3})\s+vagyok\b/)
      || []
    )[1] || "")
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "")
      .replace(/\b(?:Kft\.?|Zrt\.?|Nyrt\.?|Bt\.?).*$/i, "");
    const organizationName = (
      text.match(/\b(?:c[eé]g|v[aá]llalat|szervezet)\s*[:-]?\s*([^.,!?;]{2,100})/i)
      || text.match(/\b([^.,!?;]{2,100}?\s(?:Kft\.?|Zrt\.?|Nyrt\.?|Bt\.?))\b/i)
      || []
    )[1] || "";
    const knownLocation = (
      text.match(/\b(Budapest(?:\s?(?:[IVXLCDM]+\.?|\d{1,2}\.?\s?ker(?:ület)?))?|Debrecen|Szeged|Miskolc|Pécs|Győr|Pest megye|országos|orsz[aá]gos)(?:en|on|ban|ben|i|an|re|ra|hoz|hez|höz)?\b/i)
      || []
    )[1] || "";
    const explicitLocation = (
      text.match(/\b(?:helysz[ií]n|telephely|objektum|site|location)\s*[:-]\s*([^.,!?;]{2,100})/i)
      || []
    )[1] || "";
    const siteType = (
      text.match(/\b(irodah[aá]z|iroda|rakt[aá]r|gy[aá]r|telephely|ipari park|logisztikai k[oö]zpont|kiskereskedelmi helysz[ií]n|sz[aá]lloda|sportl[eé]tes[ií]tm[eé]ny|oktat[aá]si int[eé]zm[eé]ny|[aá]llom[aá]s|facility|warehouse|office building)\b/i)
      || []
    )[1] || "";
    let urgency = "";

    if (/\b(ma|holnap|azonnal|minel hamarabb|surgos|asap)\b/.test(search)) urgency = "minél hamarabb";
    else if (/\b(jovo het\w*|hetfo\w*|kedd\w*|szerda\w*|csutortok\w*|pentek\w*|next week)\b/.test(search)) urgency = "jövő héten";
    else if (/\b(1\s?[-–]\s?2 het|egy-ket het|1\s?[-–]\s?2 weeks?)\b/.test(search)) urgency = "1-2 héten belül";
    else if (/\b(jovo honap\w*|next month|negyedev vegeig)\b/.test(search)) urgency = "következő időszakban";
    else if (/\b(folyamatos|rendszeres|hosszu tavu)\b/.test(search)) urgency = "folyamatos igény";

    return normalizeFields({
      organizationName,
      serviceNeed: laneKey && laneKey !== "general_enquiry"
        ? foundLane.labelHu
        : trimText((text.match(/\b(?:sz[uü]ks[eé]g(?:[uü]nk)? van|kellene|szeretn[eé]nk)\s+([^.,!?;]{3,120})/i) || [])[1] || ""),
      locationOrSite: explicitLocation || knownLocation,
      urgencyOrTiming: urgency,
      contactName,
      contactEmail: email,
      contactPhone: phone,
      siteType,
      notes: text.length >= 24 ? text : "",
    });
  }

  function getMissingFieldsFromValues(values = fields) {
    const normalized = normalizeFields(values);
    const missing = [];

    if (!normalized.serviceNeed) missing.push("service_need");
    if (!normalized.locationOrSite) missing.push("location_or_site");
    if (!normalized.urgencyOrTiming) missing.push("urgency_or_timing");
    if (!normalized.contactEmail && !normalized.contactPhone && !normalized.contactPreference) missing.push("contact_need");

    return missing;
  }

  function buildNextQuestion(currentLaneKey, missing = []) {
    const firstMissing = missing[0];
    const currentLane = DEFAULT_LANES.find((item) => item.key === currentLaneKey);

    if (firstMissing === "service_need") {
      return currentLane?.key === "general_enquiry"
        ? profile?.intake?.nextQuestionDefault || "Melyik szolgáltatási terület érdekli: őrzés-védelem, porta, FM, biztonságtechnika vagy hatósági/audit támogatás?"
        : "Milyen konkrét feladatot kell lefedni az adott szolgáltatási területen?";
    }

    if (firstMissing === "location_or_site") {
      return "Melyik településen vagy helyszínen lenne a feladat, és milyen típusú objektumról van szó?";
    }

    if (firstMissing === "urgency_or_timing") {
      return "Mikor indulna a feladat, meddig kell visszajelzést kapniuk, és milyen lefedettségi időszak érintett?";
    }

    if (firstMissing === "contact_need") {
      return "Milyen biztonságos elérhetőségen kérhetnek visszajelzést?";
    }

    return "Rögzíthető a megkeresés belső feldolgozásra?";
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

  function buildFixtureRecord() {
    const currentLane = DEFAULT_LANES.find((item) => item.key === lane.key) || DEFAULT_LANES.at(-1);
    const now = new Date().toISOString();
    const contactNeed = fields.contactEmail || fields.contactPhone
      ? "Biztonságos elérhetőség megadva a visszajelzéshez."
      : fields.contactPreference || "Kapcsolati adat hiányzik a visszajelzéshez.";

    return {
      id: `erd-fixture-${Date.now()}`,
      lane: currentLane.key,
      laneLabel: currentLane.labelHu,
      confidence: currentLane.key === "general_enquiry" ? "low" : "medium",
      requestText: fields.notes || messages.filter((entry) => entry.role === "user").map((entry) => entry.content).join("\n").slice(0, 2200),
      siteOrObject: fields.siteType,
      locationText: fields.locationOrSite,
      serviceNeed: fields.serviceNeed || currentLane.labelHu,
      timingText: fields.urgencyOrTiming,
      urgency: fields.urgencyOrTiming,
      contactName: fields.contactName,
      contactEmail: fields.contactEmail,
      contactPhone: fields.contactPhone,
      missingFields: [],
      structuredBrief: {
        lane: currentLane.key,
        laneLabelHu: currentLane.labelHu,
        confidence: currentLane.key === "general_enquiry" ? "low" : "medium",
        serviceNeed: fields.serviceNeed || currentLane.labelHu,
        locationOrSite: fields.locationOrSite,
        urgencyOrTiming: fields.urgencyOrTiming,
        contactNeed,
        contactName: fields.contactName,
        contactEmail: fields.contactEmail,
        contactPhone: fields.contactPhone,
        organizationName: fields.organizationName,
        siteType: fields.siteType,
        notes: fields.notes,
        missingFields: [],
        readyForOwnerReview: true,
        staffSummaryHu: `Belső összefoglaló: ${currentLane.labelHu}. Igény: ${fields.serviceNeed || currentLane.labelHu}. Helyszín: ${fields.locationOrSite}.`,
      },
      status: "request_received",
      statusReason: "Local fixture megkeresés rögzítve belső feldolgozáshoz.",
      staffNotes: "",
      createdAt: now,
      updatedAt: now,
    };
  }

  async function runFixtureAssistantTurn({ message = "", conversation = [], confirmSubmit = false } = {}) {
    const combinedUserText = [
      ...conversation.filter((entry) => entry.role === "user").map((entry) => entry.content),
      message,
      fields.serviceNeed,
      fields.notes,
    ].filter(Boolean).join("\n");
    const currentLane = detectFixtureLane(combinedUserText);
    const extracted = extractFixtureFields(combinedUserText, currentLane.key);
    const mergedFields = mergeFields(fields, extracted);
    const missing = getMissingFieldsFromValues(mergedFields);
    const pricingBoundary = detectPricingBoundary(combinedUserText);
    const promptBoundary = detectPromptBoundary(combinedUserText);
    const serviceQuestion = detectServiceQuestion(message)
      && currentLane.key === "general_enquiry"
      && !/\b(kell|kellene|sz[uü]ks[eé]g|szeretn[eé]nk|hibabejelent|need|looking for|required)\b/i.test(message);
    const services = context?.business?.serviceTypes || SAMPLE_FIXTURE.business.serviceTypes;
    let reply;
    let request = null;

    if (serviceQuestion) {
      reply = `Használható ezekre a vállalati megkeresésekre: ${services.join(", ")}. A konkrét vállalhatóságot a csapat a helyszín és az igény részletei alapján tudja visszajelezni.\n\n${buildNextQuestion("general_enquiry", ["service_need"])}`;
    } else if (promptBoundary) {
      reply = `Az igény pontosításában tudok segíteni. ${buildNextQuestion(currentLane.key, missing)}`;
    } else if (pricingBoundary) {
      reply = `Pontos vagy garantált árat itt nem adok. A csapat a részletek áttekintése után tud visszajelezni a következő lépésről.\n\n${buildNextQuestion(currentLane.key, missing)}`;
    } else if (missing.length) {
      reply = `Rögzítettem, amit megadott. ${buildNextQuestion(currentLane.key, missing)}`;
    } else if (confirmSubmit) {
      const record = buildFixtureRecord();
      writeFixtureRows([record, ...readFixtureRows()]);
      request = {
        created: true,
        laneLabel: record.laneLabel,
        message: "A megkeresést rögzítettük belső feldolgozásra. A dashboard fixture oldalon megjelenik a sor.",
      };
      reply = request.message;
    } else {
      reply = "Összegyűjtöttem a minimális adatokat. Ellenőrizze a rövid összefoglalót, majd erősítse meg a rögzítést.";
    }

    return {
      ok: true,
      assistant: { reply },
      lane: { key: currentLane.key, label: currentLane.labelHu },
      extractedFields: mergedFields,
      missingFields: missing,
      missingFieldLabels: missing.map((field) => MISSING_FIELD_LABELS[field]).filter(Boolean),
      structuredBriefPreview: {
        laneLabel: currentLane.labelHu,
        serviceNeed: mergedFields.serviceNeed,
        locationOrSite: mergedFields.locationOrSite,
        urgencyOrTiming: mergedFields.urgencyOrTiming,
        contactNeed: mergedFields.contactEmail || mergedFields.contactPhone
          ? "Biztonságos elérhetőség megadva a visszajelzéshez."
          : "Kapcsolati adat hiányzik a visszajelzéshez.",
        contactName: mergedFields.contactName,
        organizationName: mergedFields.organizationName,
        siteType: mergedFields.siteType,
        notes: promptBoundary ? "" : mergedFields.notes,
      },
      nextQuestion: buildNextQuestion(currentLane.key, missing),
      readyToCreate: missing.length === 0,
      needsConfirmation: missing.length === 0 && !request,
      request,
    };
  }

  function renderUnavailable(message = "") {
    root.innerHTML = `
      <section class="erdp-empty" aria-label="${escapeHtml(profile?.intake?.unavailableLabel || "Enterprise Request Desk link nem elérhető")}">
        <div>
          <h2>Ez az intake link nem használható</h2>
          <p>${escapeHtml(message || `A link hiányzik vagy már nem aktív. Kérjen friss ${profile?.productName || "Enterprise Request Desk"} linket.`)}</p>
        </div>
      </section>
    `;
  }

  function getProgressItems() {
    return [
      { key: "service", label: "Igény", done: Boolean(fields.serviceNeed) },
      { key: "location", label: "Helyszín", done: Boolean(fields.locationOrSite) },
      { key: "timing", label: "Időzítés", done: Boolean(fields.urgencyOrTiming) },
      { key: "contact", label: "Elérhetőség", done: Boolean(fields.contactEmail || fields.contactPhone || fields.contactPreference) },
    ];
  }

  function renderProgress() {
    return `
      <div class="erdp-intake-progress" aria-label="Felismert részletek">
        ${getProgressItems().map((item) => `
          <span class="${item.done ? "is-done" : ""}">${escapeHtml(item.label)}</span>
        `).join("")}
      </div>
    `;
  }

  function renderLaneStrip() {
    const lanes = Array.isArray(context?.lanes) && context.lanes.length ? context.lanes : DEFAULT_LANES;

    return `
      <div class="erdp-lane-strip" aria-label="${escapeHtml(profile?.productName || "Enterprise Request Desk")} szolgáltatási területek">
        ${lanes.map((item) => `<span>${escapeHtml(item.labelHu)}</span>`).join("")}
      </div>
    `;
  }

  function renderMessages() {
    return `
      <div class="erdp-chat-log" aria-label="Beszélgetés">
        ${messages.map((entry) => `
          <article class="erdp-message ${entry.role === "user" ? "is-user" : "is-assistant"}">
            <div>${escapeHtml(entry.content).replace(/\n/g, "<br>")}</div>
          </article>
        `).join("")}
        ${assistantBusy ? `
          <article class="erdp-message is-assistant is-thinking">
            <span class="erdp-loader" aria-hidden="true"></span>
            <div>Rövid összefoglaló frissítése...</div>
          </article>
        ` : ""}
      </div>
    `;
  }

  function renderDraftRecognition() {
    const text = draftMessage;
    const live = mergeFields(fields, extractFixtureFields(text, lane.key));
    const items = [
      { label: "igény", value: live.serviceNeed && live.serviceNeed !== fields.serviceNeed },
      { label: "helyszín", value: live.locationOrSite && live.locationOrSite !== fields.locationOrSite },
      { label: "időzítés", value: live.urgencyOrTiming && live.urgencyOrTiming !== fields.urgencyOrTiming },
      { label: "elérhetőség", value: (live.contactEmail || live.contactPhone) && (live.contactEmail !== fields.contactEmail || live.contactPhone !== fields.contactPhone) },
    ].filter((item) => item.value);

    if (!items.length) {
      return '<span>Írhat kérdést vagy konkrét megkeresést is.</span>';
    }

    return items.map((item) => `<span class="is-live">${escapeHtml(item.label)} észlelve</span>`).join("");
  }

  function renderChatComposer() {
    return `
      <form class="erdp-chat-form" data-erdp-chat-form>
        <label class="erdp-chat-input-label" for="erdp-intake-message">Üzenet</label>
        <textarea
          id="erdp-intake-message"
          name="message"
          rows="3"
          maxlength="2200"
          placeholder="${escapeHtml(profile?.intake?.placeholder || "pl. Portaszolgálatra lenne szükségünk egy irodaházban Budapesten, jövő héttől...")}"
          ${assistantBusy ? "disabled" : ""}
        >${escapeHtml(draftMessage)}</textarea>
        <div class="erdp-chat-tools">
          <div class="erdp-live-recognition" data-erdp-live-recognition>${renderDraftRecognition()}</div>
          <button class="erdp-button erdp-button-primary" type="submit" ${assistantBusy ? "disabled" : ""}>Küldés</button>
        </div>
      </form>
    `;
  }

  function renderBriefPreview() {
    const rows = [
      ["Terület", lane.label || briefPreview.laneLabel || "Általános érdeklődés"],
      [DETAIL_LABELS.serviceNeed, fields.serviceNeed || briefPreview.serviceNeed],
      [DETAIL_LABELS.locationOrSite, fields.locationOrSite || briefPreview.locationOrSite],
      [DETAIL_LABELS.urgencyOrTiming, fields.urgencyOrTiming || briefPreview.urgencyOrTiming],
      [DETAIL_LABELS.siteType, fields.siteType || briefPreview.siteType],
      [DETAIL_LABELS.contactName, fields.contactName || briefPreview.contactName],
      [DETAIL_LABELS.contactEmail, fields.contactEmail],
      [DETAIL_LABELS.contactPhone, fields.contactPhone],
    ].filter(([, value]) => trimText(value));

    return `
      <section class="erdp-brief-panel" aria-label="Rövid összefoglaló">
        <div class="erdp-panel-header">
          <div>
        <h2>Rövid összefoglaló</h2>
            <p>${readyToCreate ? "A minimális adatok megvannak." : "A hiányzó részleteket egyesével kérdezzük vissza."}</p>
          </div>
        </div>
        <div class="erdp-panel-body">
          ${renderProgress()}
          <div class="erdp-detail-grid erdp-brief-grid">
            ${rows.length ? rows.map(([label, value]) => `
              <div class="erdp-detail-item">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
              </div>
            `).join("") : `
              <div class="erdp-detail-item">
                <span>Állapot</span>
                <strong>Még nincs elég adat az összefoglalóhoz.</strong>
              </div>
            `}
          </div>
          <div class="erdp-missing-list">
            ${missingFields.length
              ? missingFields.map((field) => `<span>Hiányzik: ${escapeHtml(MISSING_FIELD_LABELS[field] || field)}</span>`).join("")
              : "<span>Rögzíthető megerősítés után</span>"}
          </div>
          ${nextQuestion && !readyToCreate ? `
            <div class="erdp-next-question">
              <span>Következő kérdés</span>
              <strong>${escapeHtml(nextQuestion)}</strong>
            </div>
          ` : ""}
          ${renderManualEditor()}
          ${renderConfirmation()}
          ${successPayload ? renderSuccess() : ""}
        </div>
      </section>
    `;
  }

  function renderManualEditor() {
    return `
      <section class="erdp-manual-editor ${manualOpen ? "is-open" : ""}" aria-label="Részletek szerkesztése">
        <button class="erdp-link-button" type="button" data-erdp-toggle-details>
          ${manualOpen ? "Részletek elrejtése" : "Részletek szerkesztése"}
        </button>
        ${manualOpen ? `
          <form class="erdp-form erdp-manual-form" data-erdp-manual-form>
            <label class="erdp-field">
              Igény
              <input name="serviceNeed" autocomplete="off" value="${escapeHtml(fields.serviceNeed)}">
            </label>
            <label class="erdp-field">
              Helyszín
              <input name="locationOrSite" autocomplete="off" value="${escapeHtml(fields.locationOrSite)}">
            </label>
            <label class="erdp-field">
              Időzítés
              <input name="urgencyOrTiming" autocomplete="off" value="${escapeHtml(fields.urgencyOrTiming)}">
            </label>
            <label class="erdp-field">
              Objektum
              <input name="siteType" autocomplete="off" value="${escapeHtml(fields.siteType)}">
            </label>
            <label class="erdp-field">
              Kapcsolattartó
              <input name="contactName" autocomplete="name" value="${escapeHtml(fields.contactName)}">
            </label>
            <label class="erdp-field">
              Email
              <input name="contactEmail" type="email" autocomplete="email" value="${escapeHtml(fields.contactEmail)}">
            </label>
            <label class="erdp-field">
              Telefon
              <input name="contactPhone" autocomplete="tel" value="${escapeHtml(fields.contactPhone)}">
            </label>
            <label class="erdp-field erdp-field-wide">
              Megjegyzés
              <textarea name="notes" rows="4" maxlength="1200">${escapeHtml(fields.notes)}</textarea>
            </label>
            <button class="erdp-button" type="submit">Részletek frissítése</button>
          </form>
        ` : ""}
      </section>
    `;
  }

  function renderConfirmation() {
    if (!needsConfirmation || successPayload) {
      return "";
    }

    return `
      <section class="erdp-confirm-box" aria-label="Rögzítés megerősítése">
        <label class="erdp-check">
          <input type="checkbox" data-erdp-ack checked>
          <span>Tudomásul veszem, hogy a csapat a megadott adatok alapján ellenőrzi a vállalhatóságot és a következő lépést.</span>
        </label>
        <button class="erdp-button erdp-button-primary" type="button" data-erdp-confirm ${assistantBusy ? "disabled" : ""}>
          Rögzítés megerősítése
        </button>
      </section>
    `;
  }

  function renderSuccess() {
    const href = window.VONZA_LOCAL_ENTERPRISE_INTAKE_FIXTURE === true
      ? `${getApiPrefix()}/dashboard-fixture`
      : "";

    return `
      <div class="erdp-success" aria-label="Megkeresés rögzítve">
        <strong>${escapeHtml(successPayload.created === false ? "A megkeresés már rögzítve volt." : "Megkeresés rögzítve.")}</strong>
        <p>${escapeHtml(successPayload.message || "A megkeresést rögzítettük belső feldolgozásra.")}</p>
        <div class="erdp-missing-list">
          <span>Terület: ${escapeHtml(successPayload.laneLabel || lane.label || "Általános érdeklődés")}</span>
          <span>Visszajelzés a megadott elérhetőségen</span>
        </div>
        ${href ? `<a class="erdp-button erdp-button-primary" href="${href}">Minta dashboard</a>` : ""}
      </div>
    `;
  }

  function renderQuickStarts() {
    return `
      <div class="erdp-quick-starts" aria-label="Példák">
        ${(profile?.intake?.quickStarts || [
          "Milyen szolgáltatásokra használható ez?",
          "Portaszolgálatra lenne szükségünk egy irodaházban.",
          "Kamerarendszert és beléptetést szeretnénk.",
          "Facility Management hibabejelentést szeretnék.",
          "Hatósági vagy audit támogatáshoz kérnénk segítséget.",
        ]).map((text) => `
          <button type="button" data-erdp-template="${escapeHtml(text)}">${escapeHtml(text)}</button>
        `).join("")}
      </div>
    `;
  }

  function render() {
    const business = context?.business || SAMPLE_FIXTURE.business;
    const businessName = trimText(business.businessName) || "ESG Request Desk";
    const serviceArea = trimText(business.serviceArea) || "egyeztetett vállalati helyszínek";

    root.innerHTML = `
      <div class="erdp-intake-chat-layout">
        <section class="erdp-chat-panel" aria-label="AI vezérelt intake beszélgetés">
          <div class="erdp-chat-hero">
            <div>
              <h1>${escapeHtml(profile?.intake?.heroTitle || "Írja le, mire van szükség. Az asszisztens pontosít.")}</h1>
              <p>${escapeHtml(profile?.intake?.heroBody || `${businessName} strukturált rövid összefoglalót kap a megkeresésből. Terület: ${serviceArea}.`)}</p>
            </div>
            ${renderLaneStrip()}
          </div>
          ${lastError ? `<div class="erdp-error-strip"><span>${escapeHtml(lastError)}</span></div>` : ""}
          ${renderQuickStarts()}
          ${renderMessages()}
          ${renderChatComposer()}
        </section>
        ${renderBriefPreview()}
      </div>
    `;
  }

  function applyAssistantResult(result = {}) {
    lane = {
      key: trimText(result.lane?.key) || lane.key,
      label: trimText(result.lane?.label || result.structuredBriefPreview?.laneLabel) || lane.label,
    };
    fields = normalizeFields(result.extractedFields || fields);
    missingFields = Array.isArray(result.missingFields) ? result.missingFields : getMissingFieldsFromValues(fields);
    briefPreview = result.structuredBriefPreview || {};
    nextQuestion = trimText(result.nextQuestion) || buildNextQuestion(lane.key, missingFields);
    readyToCreate = result.readyToCreate === true;
    needsConfirmation = result.needsConfirmation === true;

    if (result.request) {
      successPayload = result.request;
      readyToCreate = false;
      needsConfirmation = false;
    }
  }

  function toConversationPayload(conversation = messages) {
    return conversation
      .filter((entry) => entry?.role && entry?.content)
      .map((entry) => ({
        role: entry.role === "assistant" ? "assistant" : "user",
        content: trimText(entry.content).slice(0, 1200),
      }))
      .slice(-8);
  }

  async function submitAssistantTurn({ message = "", confirmSubmit = false } = {}) {
    const cleanMessage = trimText(message);
    const priorConversation = toConversationPayload();

    if (!cleanMessage && !confirmSubmit) {
      setStatus("Írjon egy üzenetet vagy válasszon példát.");
      return;
    }

    if (cleanMessage) {
      messages.push({ role: "user", content: cleanMessage });
    }

    assistantBusy = true;
    draftMessage = "";
    lastError = "";
    setStatus(confirmSubmit ? "Megkeresés rögzítése..." : "Asszisztens válasz készítése...");
    render();

    try {
      const result = window.VONZA_LOCAL_ENTERPRISE_INTAKE_FIXTURE === true
        ? await runFixtureAssistantTurn({
          message: cleanMessage,
          conversation: priorConversation,
          confirmSubmit,
        })
        : await fetchJson(`${getApiPrefix()}/intake-assistant`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_key: getAgentKey(),
            message: cleanMessage,
            conversation: priorConversation,
            fields,
            confirm_submit: confirmSubmit,
            consent_acknowledged: root.querySelector("[data-erdp-ack]")?.checked !== false,
          }),
        });
      const assistantReply = trimText(result.request?.message || result.assistant?.reply);

      applyAssistantResult(result);
      if (assistantReply) {
        messages.push({ role: "assistant", content: assistantReply });
      }
      setStatus(result.request ? "Megkeresés rögzítve." : "Rövid összefoglaló frissítve.");
    } catch (error) {
      lastError = error.message || "Nem sikerült feldolgozni az üzenetet.";
      setStatus(lastError);
    } finally {
      assistantBusy = false;
      render();
    }
  }

  function applyManualDetails(form) {
    const formData = new FormData(form);
    fields = mergeFields({
      organizationName: fields.organizationName,
      serviceNeed: trimText(formData.get("serviceNeed")),
      locationOrSite: trimText(formData.get("locationOrSite")),
      urgencyOrTiming: trimText(formData.get("urgencyOrTiming")),
      contactName: trimText(formData.get("contactName")),
      contactEmail: trimText(formData.get("contactEmail")).toLowerCase(),
      contactPhone: trimText(formData.get("contactPhone")),
      siteType: trimText(formData.get("siteType")),
      notes: trimText(formData.get("notes")),
    });
    missingFields = getMissingFieldsFromValues(fields);
    readyToCreate = missingFields.length === 0;
    needsConfirmation = readyToCreate;
    nextQuestion = buildNextQuestion(lane.key, missingFields);
    setStatus("Részletek frissítve.");
    render();
  }

  async function boot() {
    if (window.VONZA_LOCAL_ENTERPRISE_INTAKE_FIXTURE === true) {
      context = SAMPLE_FIXTURE;
      setStatus(`${profile?.productName || "Enterprise Request Desk"} helyi minta. Az éles API kapuk nem kerülnek megkerülésre.`);
      render();
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
      render();
    } catch (error) {
      renderUnavailable(error.message);
      setStatus(error.message || "Az intake link nem használható.");
    }
  }

  document.addEventListener("submit", (event) => {
    const chatForm = event.target.closest("[data-erdp-chat-form]");
    const manualForm = event.target.closest("[data-erdp-manual-form]");

    if (chatForm) {
      event.preventDefault();
      submitAssistantTurn({ message: chatForm.elements.message.value });
      return;
    }

    if (manualForm) {
      event.preventDefault();
      applyManualDetails(manualForm);
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.matches("#erdp-intake-message")) {
      draftMessage = event.target.value;
      const recognitionRoot = root.querySelector("[data-erdp-live-recognition]");
      if (recognitionRoot) {
        recognitionRoot.innerHTML = renderDraftRecognition();
      }
    }
  });

  document.addEventListener("click", (event) => {
    const templateButton = event.target.closest("[data-erdp-template]");
    const toggleButton = event.target.closest("[data-erdp-toggle-details]");
    const confirmButton = event.target.closest("[data-erdp-confirm]");

    if (templateButton) {
      draftMessage = trimText(templateButton.dataset.erdpTemplate);
      render();
      root.querySelector("#erdp-intake-message")?.focus();
      return;
    }

    if (toggleButton) {
      manualOpen = !manualOpen;
      render();
      return;
    }

    if (confirmButton) {
      submitAssistantTurn({ confirmSubmit: true });
    }
  });

  boot();
}());
