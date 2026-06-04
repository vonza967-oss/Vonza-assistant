(() => {
  const root = document.getElementById("qdh-intake-root");
  const statusRoot = document.getElementById("qdh-intake-status");

  const REQUIRED_FIELDS = [
    ["requestedService", "Kért szolgáltatás"],
    ["projectDetails", "Projekt részletei"],
    ["locationText", "Város / helyszín"],
    ["urgency", "Sürgősség"],
    ["customerName", "Név"],
    ["customerContact", "Email vagy telefon"],
  ];

  const FIELD_LABELS = {
    requested_service: "kért szolgáltatás",
    project_details: "projekt részletei",
    location_text: "város vagy helyszín",
    urgency: "sürgősség",
    customer_name: "név",
    customer_contact: "email vagy telefon",
  };
  const AI_SOURCE_CHANNEL = ["qdh", "ai", "intake"].join("_");

  let context = null;
  let agentKey = "";
  let submitting = false;
  let assistantBusy = false;
  let manualOpen = false;
  let consentAcknowledged = false;
  let fields = normalizeFields();
  let missingFields = [
    "requested_service",
    "project_details",
    "location_text",
    "urgency",
    "customer_name",
    "customer_contact",
  ];
  let readyToSubmit = false;
  let safetyFlags = {};
  let messages = [];

  const FIXTURE_CONTEXT = Object.freeze({
    business: {
      businessName: "Minta Szolgáltató Kft.",
      serviceType: "helyi szolgáltatás",
      serviceArea: "Budapest és Pest megye",
      servicesOffered: ["Tetőjavítás", "Klíma karbantartás", "Weboldal átalakítás"],
    },
    intake: {
      sourceChannel: "qdh_public_intake",
      requestOnly: true,
    },
  });

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

  function getAgentKeyFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return trimText(params.get("agent_key") || params.get("agentKey") || params.get("k"));
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

  function normalizeFields(input = {}) {
    return {
      requestedService: trimText(input.requestedService || input.requested_service),
      projectDetails: trimText(input.projectDetails || input.project_details),
      locationText: trimText(input.locationText || input.location_text || input.city || input.location),
      urgency: trimText(input.urgency),
      budgetText: trimText(input.budgetText || input.budget_text),
      customerName: trimText(input.customerName || input.customer_name),
      customerEmail: trimText(input.customerEmail || input.customer_email || input.email).toLowerCase(),
      customerPhone: trimText(input.customerPhone || input.customer_phone || input.phone),
    };
  }

  function mergeFields(current = {}, incoming = {}) {
    const normalizedCurrent = normalizeFields(current);
    const normalizedIncoming = normalizeFields(incoming);

    Object.entries(normalizedIncoming).forEach(([key, value]) => {
      if (value) {
        normalizedCurrent[key] = value;
      }
    });

    return normalizedCurrent;
  }

  function getLocalMissing(nextFields = fields) {
    const normalized = normalizeFields(nextFields);
    const missing = [];

    if (!normalized.requestedService) missing.push("requested_service");
    if (!normalized.projectDetails) missing.push("project_details");
    if (!normalized.locationText) missing.push("location_text");
    if (!normalized.urgency) missing.push("urgency");
    if (!normalized.customerName) missing.push("customer_name");
    if (!normalized.customerEmail && !normalized.customerPhone) missing.push("customer_contact");

    return missing;
  }

  function updateReadiness(nextMissing = missingFields) {
    missingFields = Array.isArray(nextMissing) ? nextMissing : getLocalMissing(fields);
    readyToSubmit = missingFields.length === 0
      && safetyFlags.emergency !== true
      && safetyFlags.secretLikeInput !== true;
  }

  function getBusiness() {
    return context?.business || {};
  }

  function getNextMissingLabel(nextMissing = missingFields) {
    const firstMissing = Array.isArray(nextMissing) ? nextMissing[0] : "";
    return FIELD_LABELS[firstMissing] || "";
  }

  function buildNextStepText(nextMissing = missingFields) {
    const label = getNextMissingLabel(nextMissing);
    return label
      ? `Következőként ezt érdemes megadni: ${label}.`
      : "Minden fontos részlet megvan a továbbításhoz.";
  }

  function buildWelcomeMessage() {
    const businessName = trimText(getBusiness().businessName) || "a vállalkozás";
    return {
      role: "assistant",
      content: `Üdvözlöm. Miben segíthetünk ajánlatot adni? Írja le röviden, mire lenne szüksége, és összeszedem a fontos részleteket ${businessName} számára.`,
    };
  }

  function renderUnavailable(message) {
    root.innerHTML = `
      <section class="qdh-intake-empty" aria-label="Ajánlatkérő link nem elérhető">
        <h2>Ez az ajánlatkérő link nem használható</h2>
        <p>${escapeHtml(message || "A link hiányzik vagy már nem aktív. Kérjen friss ajánlatkérő linket a vállalkozástól.")}</p>
        <div class="qdh-intake-empty-note">
          <strong>Mit tehet most?</strong>
          <span>Lépjen vissza a vállalkozás weboldalára, vagy kérje el újra az ajánlatkérő linket.</span>
        </div>
      </section>
    `;
  }

  function serviceOptions(services = []) {
    const safeServices = services.map((item) => trimText(item)).filter(Boolean);
    if (!safeServices.length) {
      return "";
    }

    return `
      <datalist id="qdh-intake-services">
        ${safeServices.map((service) => `<option value="${escapeHtml(service)}"></option>`).join("")}
      </datalist>
    `;
  }

  function valueOrEmpty(value) {
    return trimText(value) || "Nincs megadva";
  }

  function renderBusinessCard() {
    const business = getBusiness();
    const businessName = trimText(business.businessName) || "a vállalkozás";
    const serviceArea = trimText(business.serviceArea);
    const serviceType = trimText(business.serviceType);

    return `
      <div class="qdh-intake-business">
        <span>Ajánlatot ad</span>
        <strong>${escapeHtml(businessName)}</strong>
        <small>${escapeHtml([serviceType, serviceArea].filter(Boolean).join(" · ") || "Magyarországi szolgáltatás")}</small>
      </div>
    `;
  }

  function renderMessages() {
    return `
      <div class="qdh-ai-messages" data-qdh-ai-messages aria-label="Ajánlatkérési beszélgetés">
        ${messages.map((message) => `
          <article class="qdh-ai-message qdh-ai-message-${message.role === "user" ? "user" : "assistant"}">
            <span>${message.role === "user" ? "Ön" : "Asszisztens"}</span>
            <p>${escapeHtml(message.content)}</p>
          </article>
        `).join("")}
        ${assistantBusy ? `
          <article class="qdh-ai-message qdh-ai-message-assistant qdh-ai-message-pending">
            <span>Asszisztens</span>
            <p>Átnézem, mit tudunk már az ajánlatkérésről.</p>
          </article>
        ` : ""}
      </div>
    `;
  }

  function renderChatPanel() {
    return `
      <section class="qdh-ai-chat-panel" aria-label="Ajánlatkérési asszisztens">
        <div class="qdh-ai-panel-header">
          <div>
            <h2>Ajánlatkérő asszisztens</h2>
            <p>Írjon természetesen, akár egy üzenetben. Ha valami fontos hiányzik, egyesével kérdezek rá.</p>
          </div>
          <span>Beszélgetés</span>
        </div>
        ${renderMessages()}
        <form class="qdh-ai-input" data-qdh-chat-form>
          <label for="qdh-ai-message">Üzenet</label>
          <textarea
            id="qdh-ai-message"
            name="message"
            rows="4"
            placeholder="pl. Tetőjavításra kérek ajánlatot Budapesten. Beázik a tető a kémény mellett, ezen a héten lenne sürgős. Kovács Anna, anna@example.hu."
            ${assistantBusy || submitting ? "disabled" : ""}
          ></textarea>
          <div class="qdh-ai-input-actions">
            <button class="qdh-button qdh-button-primary" type="submit" ${assistantBusy || submitting ? "disabled" : ""}>
              Küldés
            </button>
            <button class="qdh-button" type="button" data-qdh-toggle-manual>
              ${manualOpen ? "Részletek elrejtése" : "Részletek szerkesztése"}
            </button>
          </div>
        </form>
      </section>
    `;
  }

  function detailValueFor(key) {
    if (key === "customerContact") {
      return [fields.customerEmail, fields.customerPhone].filter(Boolean).join(" · ");
    }

    return fields[key];
  }

  function renderCapturedDetails() {
    const missingSet = new Set(missingFields);
    const fieldKeyToMissingKey = {
      requestedService: "requested_service",
      projectDetails: "project_details",
      locationText: "location_text",
      urgency: "urgency",
      customerName: "customer_name",
      customerContact: "customer_contact",
    };

    return `
      <aside class="qdh-ai-details-panel" aria-label="Rögzített ajánlatkérési adatok">
        <div class="qdh-ai-panel-header">
          <div>
            <h2>Összegyűjtött részletek</h2>
            <p>${readyToSubmit ? "Ellenőrizze, majd továbbíthatja a kérést." : "Ahogy beszélgetünk, itt frissülnek a fontos adatok."}</p>
          </div>
          <span class="${readyToSubmit ? "is-ready" : ""}">${readyToSubmit ? "Beküldhető" : "Folyamatban"}</span>
        </div>
        <div class="qdh-ai-detail-list">
          ${REQUIRED_FIELDS.map(([key, label]) => {
            const missing = missingSet.has(fieldKeyToMissingKey[key]);
            return `
              <div class="qdh-ai-detail-row ${missing ? "is-pending" : "is-filled"}">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(valueOrEmpty(detailValueFor(key)))}</strong>
                <em>${missing ? "Később" : "Megvan"}</em>
              </div>
            `;
          }).join("")}
          <div class="qdh-ai-detail-row">
            <span>Körülbelüli keret</span>
            <strong>${escapeHtml(valueOrEmpty(fields.budgetText))}</strong>
            <em>Opcionális</em>
          </div>
        </div>
        ${readyToSubmit ? `
          <label class="qdh-intake-check qdh-ai-consent">
            <input
              name="consent_acknowledged"
              type="checkbox"
              data-qdh-ai-consent
              ${consentAcknowledged ? "checked" : ""}
            >
            <span>Tudomásul veszem, hogy a pontos árat a vállalkozás erősíti meg.</span>
          </label>
          <button
            class="qdh-button qdh-button-primary qdh-ai-submit"
            type="button"
            data-qdh-confirm-submit
            ${consentAcknowledged && !assistantBusy && !submitting ? "" : "disabled"}
          >
            Ajánlatkérés továbbítása
          </button>
        ` : `
          <p class="qdh-ai-next-step">${escapeHtml(buildNextStepText())}</p>
        `}
        <p class="qdh-ai-safe-note">
          A pontos árat és a vállalhatóságot a vállalkozás erősíti meg.
        </p>
        ${safetyFlags.pricingGuaranteeRequested ? `
          <p class="qdh-ai-warning">Pontos vagy garantált árat ezen az oldalon nem adunk. A vállalkozás a részletek alapján tud visszajelezni.</p>
        ` : ""}
        ${safetyFlags.outOfScope ? `
          <p class="qdh-ai-warning">A megadott szolgáltatást a vállalkozás ellenőrzi, hogy vállalható-e.</p>
        ` : ""}
      </aside>
    `;
  }

  function renderManualForm() {
    const business = getBusiness();
    const services = Array.isArray(business.servicesOffered) ? business.servicesOffered : [];

    return `
      <section class="qdh-manual-panel ${manualOpen ? "is-open" : ""}" aria-label="Manuális ajánlatkérési űrlap">
        <div class="qdh-manual-header">
          <div>
            <h2>Részletek szerkesztése</h2>
            <p>Ha mezőnként kényelmesebb, itt pontosíthatja az ajánlatkérés adatait.</p>
          </div>
          <button class="qdh-button" type="button" data-qdh-toggle-manual>${manualOpen ? "Bezárás" : "Megnyitás"}</button>
        </div>
        ${manualOpen ? `
          <form class="qdh-intake-form" data-qdh-intake-form novalidate>
            ${serviceOptions(services)}
            <div class="qdh-form-grid">
              <label class="qdh-field">
                Kért szolgáltatás
                <input name="requested_service" list="qdh-intake-services" autocomplete="off" value="${escapeHtml(fields.requestedService)}" required>
              </label>
              <label class="qdh-field">
                Város / helyszín
                <input name="location_text" autocomplete="address-level2" placeholder="pl. Budapest XI." value="${escapeHtml(fields.locationText)}" required>
              </label>
              <label class="qdh-field">
                Sürgősség
                <select name="urgency" required>
                  ${["", "Nem sürgős", "Ezen a héten", "1-2 héten belül", "Sürgős, de nem vészhelyzet"].map((option) => `
                    <option value="${escapeHtml(option)}" ${fields.urgency === option ? "selected" : ""}>${escapeHtml(option || "Válassz")}</option>
                  `).join("")}
                </select>
              </label>
              <label class="qdh-field">
                Körülbelüli keret (opcionális)
                <input name="budget_text" autocomplete="off" placeholder="pl. még nincs keret vagy 300-500 ezer Ft" value="${escapeHtml(fields.budgetText)}">
              </label>
              <label class="qdh-field qdh-field-wide">
                Projekt részletei
                <textarea name="project_details" placeholder="Írja le röviden a feladatot, mennyiséget, határidőt és minden fontos körülményt." required>${escapeHtml(fields.projectDetails)}</textarea>
                <small>Ne adjon meg jelszót, kulcsot, titkos belső adatot vagy vészhelyzeti bejelentést.</small>
              </label>
              <label class="qdh-field">
                Név
                <input name="customer_name" autocomplete="name" value="${escapeHtml(fields.customerName)}" required>
              </label>
              <label class="qdh-field">
                Email
                <input name="customer_email" type="email" autocomplete="email" placeholder="email vagy telefon szükséges" value="${escapeHtml(fields.customerEmail)}">
              </label>
              <label class="qdh-field">
                Telefon
                <input name="customer_phone" type="tel" autocomplete="tel" placeholder="email vagy telefon szükséges" value="${escapeHtml(fields.customerPhone)}">
              </label>
              <label class="qdh-intake-check qdh-field-wide">
                <input name="consent_acknowledged" type="checkbox" required>
                <span>Tudomásul veszem, hogy a pontos árat a vállalkozás erősíti meg.</span>
              </label>
            </div>
            <div class="qdh-form-actions">
              <button class="qdh-button qdh-button-primary" type="submit">Ajánlatkérés továbbítása</button>
              <span class="qdh-intake-form-note">A pontos árat a vállalkozás erősíti meg.</span>
            </div>
          </form>
        ` : ""}
      </section>
    `;
  }

  function renderApp() {
    root.innerHTML = `
      ${renderBusinessCard()}
      <div class="qdh-ai-workspace">
        ${renderChatPanel()}
        ${renderCapturedDetails()}
      </div>
      ${renderManualForm()}
    `;

    window.setTimeout(() => {
      const messagesRoot = root.querySelector("[data-qdh-ai-messages]");
      if (messagesRoot) {
        messagesRoot.scrollTop = messagesRoot.scrollHeight;
      }
    }, 0);
  }

  function readForm(form) {
    const formData = new FormData(form);
    return {
      agent_key: agentKey,
      requested_service: trimText(formData.get("requested_service")),
      project_details: trimText(formData.get("project_details")),
      location_text: trimText(formData.get("location_text")),
      urgency: trimText(formData.get("urgency")),
      budget_text: trimText(formData.get("budget_text")),
      customer_name: trimText(formData.get("customer_name")),
      customer_email: trimText(formData.get("customer_email")),
      customer_phone: trimText(formData.get("customer_phone")),
      consent_acknowledged: formData.get("consent_acknowledged") === "on",
      language: "hu",
    };
  }

  function validateClientSide(payload) {
    if (!payload.requested_service || !payload.project_details || !payload.location_text || !payload.urgency) {
      return "Töltse ki a szolgáltatás, projekt, helyszín és sürgősség mezőket.";
    }

    if (!payload.customer_name) {
      return "Adja meg a nevét.";
    }

    if (!payload.customer_email && !payload.customer_phone) {
      return "Adjon meg emailt vagy telefonszámot, hogy a vállalkozás vissza tudjon jelezni.";
    }

    if (!payload.consent_acknowledged) {
      return "A továbbításhoz erősítse meg, hogy a pontos árat a vállalkozás adja meg.";
    }

    return "";
  }

  function renderSuccess() {
    const businessName = trimText(getBusiness().businessName) || "a vállalkozás";

    root.innerHTML = `
      <section class="qdh-intake-success" aria-label="Ajánlatkérés sikeresen rögzítve">
        <span class="qdh-intake-success-mark" aria-hidden="true"></span>
        <h2>Köszönjük, továbbítottuk az ajánlatkérést.</h2>
        <p>${escapeHtml(businessName)} áttekinti a részleteket, és a megadott elérhetőségen tud visszajelezni. A pontos árat a vállalkozás erősíti meg.</p>
        <div class="qdh-intake-success-next">
          <strong>Mi történik ezután?</strong>
          <span>A vállalkozás ellenőrzi a leírást, szükség esetén pontosítást kér, majd külön jelzi a következő lépést.</span>
        </div>
      </section>
    `;
    setStatus("Ajánlatkérés továbbítva.");
  }

  function extractFixtureFields(message, currentFields = {}) {
    const text = trimText(message);
    const nextFields = normalizeFields(currentFields);
    const services = getBusiness().servicesOffered || [];
    const matchedService = services.find((service) => text.toLowerCase().includes(service.toLowerCase().split(" ")[0]));
    const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
    const phone = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0] || "";
    const city = text.match(/\b(Budapest(?:\s?[IVXLCDM]+\.?)?|Szeged|Debrecen|Pécs|Győr|Pest megye)(?:en|on|ban|ben)?\b/i)?.[1] || "";
    const name = text.match(/\b(?:nevem|a nevem|én vagyok)\s+([^.,!?;]{2,70})/i)?.[1]
      || text.match(/\b([A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+\s+[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+)\s+vagyok\b/)?.[1]
      || text.match(/\b([A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű-]+(?:\s+[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű-]+){1,3})\s*(?:[,;:-]\s*)?(?:[Ee]-?mail|telefon|Telefonszám|elérhetőség|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\+?\d[\d\s().-]{7,}\d)/)?.[1]
      || "";

    if (!nextFields.requestedService) nextFields.requestedService = matchedService || (text.match(/\b([a-záéíóöőúüű-]{3,40}\s?(?:javítás|karbantartás|átalakítás|szerelés))\b/i)?.[0] || "");
    if (!nextFields.projectDetails && text.length > 32) nextFields.projectDetails = text;
    if (!nextFields.locationText) nextFields.locationText = city;
    if (!nextFields.urgency && /ezen a héten|holnap|sürgős|minél hamarabb/i.test(text)) nextFields.urgency = /sürgős|holnap|minél hamarabb/i.test(text) ? "Sürgős, de nem vészhelyzet" : "Ezen a héten";
    if (!nextFields.customerName) nextFields.customerName = trimText(name);
    if (!nextFields.customerEmail) nextFields.customerEmail = email.toLowerCase();
    if (!nextFields.customerPhone) nextFields.customerPhone = phone;
    if (!nextFields.budgetText) nextFields.budgetText = text.match(/\b\d+\s?[-–]\s?\d+\s?(?:ezer|millió|m)\s?(?:ft|forint)?\b/i)?.[0] || "";

    return nextFields;
  }

  async function submitAssistantFixture(payload) {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 250);
    });

    const nextFields = extractFixtureFields(payload.message, payload.fields);
    const nextMissing = getLocalMissing(nextFields);
    const priceBoundary = /pontos|garantált|végleges|fix ár|mennyibe kerül/i.test(payload.message || "");
    const reply = priceBoundary
      ? "Pontos vagy garantált árat itt nem adok. A vállalkozás munkatársa a részletek alapján erősíti meg az ajánlatot."
      : nextMissing.length
        ? `Rögzítettem, amit megadott. Kérem, adja meg még ezt: ${FIELD_LABELS[nextMissing[0]] || "a következő fontos részlet"}.`
        : "Minden szükséges adat megvan. Ellenőrizze a részleteket, majd továbbíthatja az ajánlatkérést.";

    return {
      ok: true,
      product: "quote_desk_hu",
      phase: "ai_customer_intake_request_only",
      assistant: { reply },
      extractedFields: nextFields,
      missingFields: nextMissing,
      readyToSubmit: nextMissing.length === 0,
      safetyFlags: {
        pricingGuaranteeRequested: priceBoundary,
      },
      request: payload.confirm_submit && nextMissing.length === 0
        ? {
            status: "request_received",
            sourceChannel: AI_SOURCE_CHANNEL,
            receivedForStaffReview: true,
          }
        : null,
    };
  }

  async function submitFixture() {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 250);
    });
    return {
      request: {
        status: "request_received",
        sourceChannel: "qdh_public_intake",
      },
    };
  }

  function applyAssistantResponse(data = {}) {
    fields = mergeFields(fields, data.extractedFields || {});
    missingFields = Array.isArray(data.missingFields) ? data.missingFields : getLocalMissing(fields);
    safetyFlags = data.safetyFlags || {};
    updateReadiness(missingFields);

    const reply = trimText(data.assistant?.reply);
    if (reply) {
      messages.push({ role: "assistant", content: reply });
    }

    if (data.request?.receivedForStaffReview) {
      renderSuccess(data);
      return;
    }

    renderApp();
    setStatus(readyToSubmit ? "Az ajánlatkérés továbbítható." : buildNextStepText());
  }

  async function submitAssistantTurn({ message = "", confirmSubmit = false } = {}) {
    const cleanMessage = trimText(message);
    if (!cleanMessage && !confirmSubmit) {
      setStatus("Írjon üzenetet az asszisztensnek.");
      return;
    }

    if (assistantBusy || submitting) {
      return;
    }

    if (confirmSubmit && (!readyToSubmit || !consentAcknowledged)) {
      setStatus("A továbbításhoz minden fontos adat és a pontos árra vonatkozó tudomásulvétel szükséges.");
      return;
    }

    if (cleanMessage) {
      messages.push({ role: "user", content: cleanMessage });
    }
    assistantBusy = true;
    setStatus(confirmSubmit ? "Ajánlatkérés rögzítése..." : "Asszisztens válaszának előkészítése...");
    renderApp();

    try {
      const payload = {
        agent_key: agentKey,
        message: cleanMessage || "Kérem az ajánlatkérés továbbítását a vállalkozásnak.",
        conversation: messages.slice(-8),
        fields,
        confirm_submit: confirmSubmit,
        consent_acknowledged: consentAcknowledged,
        language: "hu",
      };
      const data = window.VONZA_LOCAL_QDH_INTAKE_FIXTURE === true
        ? await submitAssistantFixture(payload)
        : await fetchJson("/quote-desk-hu/intake-assistant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      assistantBusy = false;
      applyAssistantResponse(data);
    } catch (error) {
      assistantBusy = false;
      messages.push({
        role: "assistant",
        content: error.message || "Nem sikerült feldolgozni az üzenetet. A manuális részletek panel továbbra is használható.",
      });
      setStatus(error.message || "Nem sikerült feldolgozni az üzenetet.");
      renderApp();
    }
  }

  async function handleChatSubmit(event) {
    const form = event.target.closest("[data-qdh-chat-form]");
    if (!form) {
      return;
    }

    event.preventDefault();
    const formData = new FormData(form);
    await submitAssistantTurn({ message: formData.get("message") });
  }

  async function handleManualSubmit(event) {
    const form = event.target.closest("[data-qdh-intake-form]");
    if (!form) {
      return;
    }

    event.preventDefault();
    if (submitting) {
      return;
    }

    const payload = readForm(form);
    const validationMessage = validateClientSide(payload);
    if (validationMessage) {
      setStatus(validationMessage);
      return;
    }

    const button = event.submitter || form.querySelector("button[type='submit']");
    submitting = true;
    if (button) {
      button.disabled = true;
      button.textContent = "Beküldés...";
    }
    setStatus("Ajánlatkérés rögzítése...");

    try {
      const data = window.VONZA_LOCAL_QDH_INTAKE_FIXTURE === true
        ? await submitFixture()
        : await fetchJson("/quote-desk-hu/intake-requests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      renderSuccess(data);
    } catch (error) {
      setStatus(error.message || "Nem sikerült rögzíteni az ajánlatkérést.");
      if (button) {
        button.disabled = false;
        button.textContent = "Ajánlatkérés továbbítása";
      }
      submitting = false;
    }
  }

  async function init() {
    if (!root) {
      return;
    }

    agentKey = getAgentKeyFromUrl();
    if (window.VONZA_LOCAL_QDH_INTAKE_FIXTURE === true) {
      agentKey = agentKey || "local-qdh-fixture";
      context = FIXTURE_CONTEXT;
      messages = [buildWelcomeMessage()];
      updateReadiness(getLocalMissing(fields));
      renderApp();
      setStatus("Helyi ajánlatkérő minta készen áll. Nem ír éles adatbázisba.");
      return;
    }

    if (!agentKey) {
      renderUnavailable("A linkből hiányzik az ajánlatkérő azonosító. Kérjen friss linket a vállalkozástól.");
      setStatus("Hiányzó ajánlatkérő link.");
      return;
    }

    try {
      setStatus("Ajánlatkérő link ellenőrzése...");
      context = await fetchJson(`/quote-desk-hu/intake-context?agent_key=${encodeURIComponent(agentKey)}`);
      messages = [buildWelcomeMessage()];
      updateReadiness(getLocalMissing(fields));
      renderApp();
      setStatus("Ajánlatkérő készen áll.");
    } catch (error) {
      renderUnavailable(error.message || "Ez az ajánlatkérő link nem használható.");
      setStatus("Ajánlatkérő link nem használható.");
    }
  }

  document.addEventListener("submit", (event) => {
    handleChatSubmit(event);
    handleManualSubmit(event);
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-qdh-toggle-manual]")) {
      manualOpen = !manualOpen;
      renderApp();
    }

    if (event.target.closest("[data-qdh-confirm-submit]")) {
      submitAssistantTurn({ confirmSubmit: true });
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.closest("[data-qdh-ai-consent]")) {
      consentAcknowledged = event.target.checked === true;
      renderApp();
      setStatus(consentAcknowledged ? "Tudomásulvétel rögzítve." : "A továbbításhoz szükséges a pontos árra vonatkozó tudomásulvétel.");
    }
  });

  init();
})();
