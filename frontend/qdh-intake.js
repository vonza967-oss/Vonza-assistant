(() => {
  const root = document.getElementById("qdh-intake-root");
  const statusRoot = document.getElementById("qdh-intake-status");

  let context = null;
  let agentKey = "";
  let submitting = false;

  const FIXTURE_CONTEXT = Object.freeze({
    business: {
      businessName: "QDH Fixture Kft.",
      serviceType: "helyi szolgáltatás",
      serviceArea: "Budapest és Pest megye",
      servicesOffered: ["Tetőjavítás", "Klíma karbantartás", "Weboldal átalakítás"],
    },
    intake: {
      sourceChannel: "qdh_public_intake",
      requestOnly: true,
      staffReviewOnly: true,
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

  function renderUnavailable(message) {
    root.innerHTML = `
      <section class="qdh-intake-empty" aria-label="QDH ügyfél link nem elérhető">
        <h2>Ez az ajánlatkérő link nem használható</h2>
        <p>${escapeHtml(message || "A QDH ügyfél link hiányzik vagy nem aktív. Kérd a vállalkozástól a friss 'Kérjen ajánlatot' linket.")}</p>
        <div class="qdh-intake-empty-note">
          <strong>Biztonsági határ</strong>
          <span>Az ajánlatkérés csak érvényes nyilvános QDH agent kulccsal rögzíthető, tulajdonosi azonosító nélkül.</span>
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

  function renderForm() {
    const business = context?.business || {};
    const services = Array.isArray(business.servicesOffered) ? business.servicesOffered : [];
    const businessName = trimText(business.businessName) || "a vállalkozás";
    const serviceArea = trimText(business.serviceArea);
    const serviceType = trimText(business.serviceType);

    root.innerHTML = `
      <div class="qdh-intake-business">
        <span>Ajánlatkérés címzettje</span>
        <strong>${escapeHtml(businessName)}</strong>
        <small>${escapeHtml([serviceType, serviceArea].filter(Boolean).join(" · ") || "Magyarországi szolgáltatás")}</small>
      </div>
      <form class="qdh-intake-form" data-qdh-intake-form novalidate>
        ${serviceOptions(services)}
        <div class="qdh-form-grid">
          <label class="qdh-field">
            Kért szolgáltatás
            <input name="requested_service" list="qdh-intake-services" autocomplete="off" required>
          </label>
          <label class="qdh-field">
            Város / helyszín
            <input name="location_text" autocomplete="address-level2" placeholder="pl. Budapest XI." required>
          </label>
          <label class="qdh-field">
            Sürgősség
            <select name="urgency" required>
              <option value="">Válassz</option>
              <option value="Nem sürgős">Nem sürgős</option>
              <option value="Ezen a héten">Ezen a héten</option>
              <option value="1-2 héten belül">1-2 héten belül</option>
              <option value="Sürgős, de nem vészhelyzet">Sürgős, de nem vészhelyzet</option>
            </select>
          </label>
          <label class="qdh-field">
            Körülbelüli keret (opcionális)
            <input name="budget_text" autocomplete="off" placeholder="pl. még nincs keret vagy 300-500 ezer Ft">
          </label>
          <label class="qdh-field qdh-field-wide">
            Projekt részletei
            <textarea name="project_details" placeholder="Írd le röviden a feladatot, mennyiséget, határidőt és minden fontos körülményt." required></textarea>
            <small>Ne adj meg jelszót, kulcsot, titkos belső adatot vagy vészhelyzeti bejelentést.</small>
          </label>
          <label class="qdh-field">
            Név
            <input name="customer_name" autocomplete="name" required>
          </label>
          <label class="qdh-field">
            Email
            <input name="customer_email" type="email" autocomplete="email" placeholder="email vagy telefon szükséges">
          </label>
          <label class="qdh-field">
            Telefon
            <input name="customer_phone" type="tel" autocomplete="tel" placeholder="email vagy telefon szükséges">
          </label>
          <label class="qdh-intake-check qdh-field-wide">
            <input name="consent_acknowledged" type="checkbox" required>
            <span>Tudomásul veszem, hogy ez ajánlatkérés staff review-ra, nem végleges vagy garantált árajánlat.</span>
          </label>
        </div>
        <div class="qdh-form-actions">
          <button class="qdh-button qdh-button-primary" type="submit">Ajánlatkérés beküldése</button>
          <span class="qdh-intake-form-note">Nincs árkalkuláció, nincs automatikus külső küldés.</span>
        </div>
      </form>
    `;
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
      return "Töltsd ki a szolgáltatás, projekt, helyszín és sürgősség mezőket.";
    }

    if (!payload.customer_name) {
      return "Add meg a neved.";
    }

    if (!payload.customer_email && !payload.customer_phone) {
      return "Adj meg emailt vagy telefonszámot, hogy a vállalkozás vissza tudjon jelezni.";
    }

    if (!payload.consent_acknowledged) {
      return "A request-only tudomásulvétel szükséges a beküldéshez.";
    }

    return "";
  }

  function renderSuccess(data = {}) {
    const status = trimText(data.request?.status) || "request_received";
    const sourceChannel = trimText(data.request?.sourceChannel) || "qdh_public_intake";

    root.innerHTML = `
      <section class="qdh-intake-success" aria-label="Ajánlatkérés sikeresen rögzítve">
        <span class="qdh-intake-success-mark" aria-hidden="true"></span>
        <h2>Megkaptuk az ajánlatkérésedet.</h2>
        <p>A kérés a vállalkozás staff review folyamatába került. A pontos árat vagy végleges ajánlatot a vállalkozás munkatársa erősíti meg.</p>
        <dl>
          <div>
            <dt>Állapot</dt>
            <dd>${escapeHtml(status === "request_received" ? "Új ajánlatkérés" : status)}</dd>
          </div>
          <div>
            <dt>Forrás</dt>
            <dd>${escapeHtml(sourceChannel)}</dd>
          </div>
        </dl>
      </section>
    `;
    setStatus("Ajánlatkérés rögzítve staff review-ra.");
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

  async function handleSubmit(event) {
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
        button.textContent = "Ajánlatkérés beküldése";
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
      renderForm();
      setStatus("Local-only QDH intake fixture. Nem ír éles adatbázisba.");
      return;
    }

    if (!agentKey) {
      renderUnavailable("A linkből hiányzik a nyilvános QDH agent kulcs. A vállalkozás dashboardjából másold ki az ügyféloldali intake linket.");
      setStatus("Hiányzó QDH ügyfél link.");
      return;
    }

    try {
      setStatus("QDH ügyfél link ellenőrzése...");
      context = await fetchJson(`/quote-desk-hu/intake-context?agent_key=${encodeURIComponent(agentKey)}`);
      renderForm();
      setStatus("Ajánlatkérő készen áll.");
    } catch (error) {
      renderUnavailable(error.message || "A QDH ügyfél link nem használható.");
      setStatus("QDH ügyfél link nem használható.");
    }
  }

  document.addEventListener("submit", (event) => {
    handleSubmit(event);
  });

  init();
})();
