(() => {
  const root = document.getElementById("qdh-intake-root");
  const statusRoot = document.getElementById("qdh-intake-status");

  const FIELD_LABELS = {
    requested_service: "kért szolgáltatás",
    project_details: "projekt részletei",
    location_text: "város vagy helyszín",
    urgency: "sürgősség",
    customer_name: "név",
    customer_contact: "email vagy telefon",
  };

  const LIVE_RECOGNITION_ITEMS = Object.freeze([
    {
      key: "request",
      label: "Igény észlelve",
    },
    {
      key: "location",
      label: "Helyszín észlelve",
    },
    {
      key: "timing",
      label: "Időzítés észlelve",
    },
    {
      key: "name",
      label: "Név megvan",
    },
    {
      key: "contact",
      label: "Elérhetőség megvan",
    },
  ]);

  const CATEGORY_COPY = Object.freeze({
    web_creative: {
      categoryLabel: "web / marketing / kreatív stúdió",
      placeholder: "pl. Weboldalt szeretnék készíttetni egy budapesti vállalkozásnak. Fontos a gyors indulás, és szeretném tudni, milyen információkra lesz szükség az ajánlathoz.",
      opening: "Üdvözlöm, írja le röviden a webes vagy marketing feladatot, és összeszedem, milyen információkra lesz szükség {businessName} számára.",
      hint: "Weboldal, webshop, kampány vagy arculati munka esetén a cél, határidő, meglévő anyagok és fontos funkciók segítenek gyorsabban válaszolni.",
      manualDetailsPlaceholder: "Írja le a célt, meglévő weboldalt vagy anyagokat, fontos funkciókat, határidőt és minden lényeges elvárást.",
      missingInfo: {
        requested_service: "milyen webes vagy marketing feladatról van szó",
        project_details: "cél, meglévő anyagok, fontos funkciók vagy határidő",
      },
    },
    cleaning: {
      categoryLabel: "takarítás",
      placeholder: "pl. Nagytakarításra szeretnék ajánlatot kérni Budapesten. Egy 70 m²-es lakásról van szó, lehetőleg jövő héten.",
      opening: "Üdvözlöm, írja le röviden, milyen takarításra van szüksége, hol és mikor lenne aktuális. Összeszedem a fontos részleteket {businessName} számára.",
      hint: "A helyszín, alapterület, helyiségek típusa, kért takarítás és ideális időpont segít gyorsabban pontosítani.",
      manualDetailsPlaceholder: "Írja le az alapterületet, helyiségeket, kért takarítást, hozzáférést, időpontot és minden fontos körülményt.",
      missingInfo: {
        requested_service: "milyen takarításra van szükség",
        project_details: "alapterület, helyiségek, állapot vagy időpont",
      },
    },
    garage_doors: {
      categoryLabel: "garázskapuk / kapuk",
      placeholder: "pl. Garázskapu beépítésre kérek ajánlatot családi házhoz. Kérem, jelezzék, milyen adatok kellenek a pontos egyeztetéshez.",
      opening: "Üdvözlöm, írja le röviden a kapuval vagy garázskapuval kapcsolatos feladatot. Összeszedem, milyen adatokra lesz szüksége {businessName} számára.",
      hint: "Kapu vagy garázskapu esetén a típus, méret, helyszín, meglévő szerkezet és sürgősség segít gyorsabban egyeztetni.",
      manualDetailsPlaceholder: "Írja le a kapu típusát, méretét, meglévő szerkezetet, helyszínt, határidőt és minden fontos körülményt.",
      missingInfo: {
        requested_service: "beépítésről, cseréről, javításról vagy automatizálásról van-e szó",
        project_details: "kaputípus, méret, meglévő szerkezet vagy helyszíni körülmény",
      },
    },
    construction_home: {
      categoryLabel: "építés / felújítás / otthoni szolgáltatás",
      placeholder: "pl. Felújításra vagy javításra szeretnék ajánlatot kérni Budapesten. Röviden leírom a munkát, a helyszínt és mikorra lenne aktuális.",
      opening: "Üdvözlöm, írja le röviden az elvégzendő munkát, a helyszínt és az időzítést. Összeszedem a fontos részleteket {businessName} számára.",
      hint: "A munka típusa, méret vagy mennyiség, helyszín, fotózható állapot és határidő segít gyorsabban pontosítani.",
      manualDetailsPlaceholder: "Írja le a feladatot, méretet vagy mennyiséget, helyszínt, határidőt és minden fontos körülményt.",
      missingInfo: {
        requested_service: "milyen munkára kér ajánlatot",
        project_details: "méret, mennyiség, állapot, anyag vagy határidő",
      },
    },
    health_clinic: {
      categoryLabel: "egészség / klinika",
      placeholder: "pl. Konzultációra szeretnék ajánlatot vagy időpont-egyeztetést kérni. Leírom röviden, milyen szolgáltatás érdekel és mikor lenne megfelelő.",
      opening: "Üdvözlöm, írja le röviden, melyik szolgáltatás érdekli és mikor lenne aktuális. Összeszedem a szükséges egyeztetési adatokat {businessName} számára.",
      hint: "A kért szolgáltatás, preferált időpont, helyszín és elérhetőség segít gyorsabban visszajelezni.",
      manualDetailsPlaceholder: "Írja le a kért szolgáltatást, preferált időpontot, helyszínt és minden fontos egyeztetési körülményt.",
      missingInfo: {
        requested_service: "melyik szolgáltatás érdekli",
        project_details: "preferált időpont vagy fontos egyeztetési részlet",
      },
    },
    beauty_wellness: {
      categoryLabel: "szépség / wellness",
      placeholder: "pl. Időpontot és ajánlatot szeretnék kérni egy kezelésre Budapesten. Leírom, milyen szolgáltatás érdekel és mikor lenne jó.",
      opening: "Üdvözlöm, írja le röviden, melyik kezelés vagy szolgáltatás érdekli, és mikor lenne megfelelő. Összeszedem a részleteket {businessName} számára.",
      hint: "A szolgáltatás típusa, preferált időpont, helyszín és esetleges kérések segítenek gyorsabban egyeztetni.",
      manualDetailsPlaceholder: "Írja le a szolgáltatást, preferált időpontot, helyszínt és minden fontos kérést.",
      missingInfo: {
        requested_service: "melyik kezelés vagy szolgáltatás érdekli",
        project_details: "preferált időpont, alkalom vagy külön kérés",
      },
    },
    repair_service: {
      categoryLabel: "javítás / szerviz",
      placeholder: "pl. Javításra szeretnék ajánlatot kérni. Leírom, mi hibásodott meg, hol lenne a munka, és mennyire sürgős.",
      opening: "Üdvözlöm, írja le röviden, mit kell javítani vagy szervizelni, hol lenne a munka és mennyire sürgős. Összeszedem a részleteket {businessName} számára.",
      hint: "A hiba leírása, eszköz vagy típus, helyszín, sürgősség és fotózható állapot segít gyorsabban válaszolni.",
      manualDetailsPlaceholder: "Írja le a hibát, típust vagy eszközt, helyszínt, sürgősséget és minden fontos körülményt.",
      missingInfo: {
        requested_service: "mit kell javítani vagy szervizelni",
        project_details: "hiba, típus, állapot vagy sürgősség",
      },
    },
    education_consulting: {
      categoryLabel: "oktatás / tanácsadás",
      placeholder: "pl. Tanácsadásra szeretnék ajánlatot kérni. Leírom a témát, a célomat, a helyszínt vagy online formát, és mikor lenne aktuális.",
      opening: "Üdvözlöm, írja le röviden a témát, a célt és az időzítést. Összeszedem a fontos egyeztetési adatokat {businessName} számára.",
      hint: "A téma, cél, résztvevők száma, online vagy személyes forma és időzítés segít gyorsabban pontosítani.",
      manualDetailsPlaceholder: "Írja le a témát, célt, résztvevőket, formát, időzítést és minden fontos körülményt.",
      missingInfo: {
        requested_service: "milyen oktatásról vagy tanácsadásról van szó",
        project_details: "téma, cél, résztvevők, forma vagy időzítés",
      },
    },
    events_hospitality: {
      categoryLabel: "rendezvény / vendéglátás",
      placeholder: "pl. Rendezvényhez szeretnék ajánlatot kérni Budapesten. Leírom a létszámot, időpontot, helyszínt és milyen szolgáltatásra lenne szükség.",
      opening: "Üdvözlöm, írja le röviden a rendezvényt, létszámot, helyszínt és időpontot. Összeszedem a fontos részleteket {businessName} számára.",
      hint: "A létszám, dátum, helyszín, szolgáltatás típusa és külön kérések segítenek gyorsabban válaszolni.",
      manualDetailsPlaceholder: "Írja le a létszámot, dátumot, helyszínt, kért szolgáltatást és minden fontos kérést.",
      missingInfo: {
        requested_service: "milyen rendezvényhez vagy vendéglátási szolgáltatáshoz kér ajánlatot",
        project_details: "létszám, dátum, helyszín vagy külön kérés",
      },
    },
    general: {
      categoryLabel: "általános szolgáltatás",
      placeholder: "pl. Szeretnék ajánlatot kérni a szolgáltatásra. Röviden leírom, mire van szükségem, hol lenne a munka, és mikor lenne aktuális.",
      opening: "Üdvözlöm, miben segíthetünk ajánlatot adni? Írja le röviden, mire lenne szüksége, és összeszedem a fontos részleteket {businessName} számára.",
      hint: "A kért szolgáltatás, helyszín, sürgősség és elérhetőség segít gyorsabban válaszolni.",
      manualDetailsPlaceholder: "Írja le röviden a feladatot, mennyiséget, határidőt és minden fontos körülményt.",
      missingInfo: {},
    },
  });

  const CATEGORY_RULES = Object.freeze([
    ["garage_doors", ["garazskapu", "garazs kapu", "kaputechnika", "kapunyito", "kapu automatika", "sorompo", "gate automation", "garage door"]],
    ["web_creative", ["weboldal", "honlap", "webshop", "landing page", "online marketing", "marketing", "seo", "hirdetes", "arculat", "branding", "design", "grafika", "kreativ", "studio", "studió"]],
    ["cleaning", ["takaritas", "nagytakaritas", "irodatakaritas", "lakas takaritas", "cleaning", "cleaner", "maid"]],
    ["health_clinic", ["klinika", "rendelo", "egeszseg", "orvos", "fogaszat", "dental", "terapia", "gyogytorna", "medical", "clinic"]],
    ["beauty_wellness", ["szepseg", "fodrasz", "kozmetika", "masszazs", "wellness", "spa", "manikur", "pedikur", "barber", "salon"]],
    ["education_consulting", ["oktatas", "tanfolyam", "kepzes", "trening", "tanacsadas", "konzultacio", "consulting", "coach", "konyveles"]],
    ["events_hospitality", ["rendezveny", "eskuvo", "catering", "vendeglatas", "etterem", "hotel", "szallas", "konferencia", "event"]],
    ["construction_home", ["epites", "epitoipar", "felujitas", "burkolas", "festes", "tetofedes", "teto", "badogozas", "villanyszereles", "vizvezetek", "klima", "nyilaszaró", "nyilaszaro", "kert", "home service"]],
    ["repair_service", ["javitas", "szerviz", "karbantartas", "szereles", "hiba", "repair", "service"]],
  ]);

  const FIXTURE_CONTEXTS = Object.freeze({
    webstudio: {
      business: {
        businessName: "Minta Webstúdió Kft.",
        serviceType: "weboldal készítés és online marketing",
        serviceArea: "Budapest és online",
        servicesOffered: ["Weboldal készítés", "Webshop fejlesztés", "Online marketing"],
      },
    },
    cleaning: {
      business: {
        businessName: "Minta Takarítás Kft.",
        serviceType: "lakás és iroda takarítás",
        serviceArea: "Budapest és Pest megye",
        servicesOffered: ["Nagytakarítás", "Irodatakarítás", "Költözés utáni takarítás"],
      },
    },
    garage: {
      business: {
        businessName: "Minta Kaputechnika Kft.",
        serviceType: "garázskapu és kaputechnika",
        serviceArea: "Budapest és Pest megye",
        servicesOffered: ["Garázskapu beépítés", "Kapu automatizálás", "Garázskapu javítás"],
      },
    },
    generic: {
      business: {
        businessName: "Minta Szakértő Kft.",
        serviceType: "egyedi üzleti megoldás",
        serviceArea: "Magyarország",
        servicesOffered: ["Egyedi egyeztetés", "Ügyféligény felmérés"],
      },
    },
  });

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
  let draftMessage = "";
  let draftRecognition = detectLiveRecognition("");
  let recentlyCapturedKeys = new Set();
  let captureAnimationTimer = 0;

  const FIXTURE_CONTEXT = FIXTURE_CONTEXTS.webstudio;

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

  function normalizeSearchText(value) {
    return trimText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function matchesCategoryKeyword(searchText, keyword) {
    const normalizedKeyword = normalizeSearchText(keyword);

    if (!normalizedKeyword) {
      return false;
    }

    if (normalizedKeyword.length <= 4 && !/\s/.test(normalizedKeyword)) {
      return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedKeyword)}($|[^a-z0-9])`).test(searchText);
    }

    return searchText.includes(normalizedKeyword);
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

  function wait(ms = 0) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, Math.max(0, ms));
    });
  }

  async function keepAssistantBusySince(startedAt, minimumMs = 560) {
    const elapsed = Date.now() - startedAt;
    const remaining = minimumMs - elapsed;

    if (remaining > 0) {
      await wait(remaining);
    }
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

  function getCapturedFieldKeys(nextFields = fields) {
    const normalized = normalizeFields(nextFields);
    return new Set(
      Object.entries(normalized)
        .filter(([, value]) => Boolean(value))
        .map(([key]) => key)
    );
  }

  function isRecentlyCaptured(...keys) {
    return keys.some((key) => recentlyCapturedKeys.has(key));
  }

  function isRecentlyCapturedRecognitionCategory(key) {
    if (key === "request") {
      return isRecentlyCaptured("requestedService", "projectDetails");
    }

    if (key === "location") {
      return isRecentlyCaptured("locationText");
    }

    if (key === "timing") {
      return isRecentlyCaptured("urgency");
    }

    if (key === "name") {
      return isRecentlyCaptured("customerName");
    }

    if (key === "contact") {
      return isRecentlyCaptured("customerEmail", "customerPhone");
    }

    return false;
  }

  function getKnownServiceTokens() {
    const services = Array.isArray(getBusiness().servicesOffered) ? getBusiness().servicesOffered : [];
    return services
      .flatMap((service) => normalizeSearchText(service).split(/[^a-z0-9]+/))
      .filter((token) => token.length >= 5);
  }

  function detectLiveRecognition(text = "") {
    const rawText = trimText(text);
    const searchText = normalizeSearchText(rawText);

    if (!rawText) {
      return {
        request: false,
        location: false,
        timing: false,
        name: false,
        contact: false,
      };
    }

    const knownServiceDetected = getKnownServiceTokens().some((token) => searchText.includes(token));
    const requestHints = /\b(ajanlat|ajanlatot|kerek|szeretnek|szukseg|weboldal|honlap|webshop|marketing|takaritas|nagytakaritas|javitas|szereles|szerviz|felujitas|garazskapu|kapu|munka|projekt|rendezveny|konzultacio|kezeles|telepites|csere|kivitelezes)\b/.test(searchText);
    const locationDetected = /\b(Budapest(?:\s?[IVXLCDM]+\.?|\s?\d{1,2}\.?\s?ker(?:ület)?)?|Debrecen|Szeged|Miskolc|Pécs|Győr|Nyíregyháza|Kecskemét|Székesfehérvár|Szombathely|Szolnok|Tatabánya|Kaposvár|Békéscsaba|Érd|Veszprém|Sopron|Eger|Pest megye)(?:en|on|ban|ben)?\b/i.test(rawText)
      || /\b(helysz[ií]n|telep[uü]l[eé]s|v[aá]ros|c[ií]m)\s*[:-]?\s*[^.,!?;]{2,80}/i.test(rawText);
    const timingDetected = /\b(ma|holnap|jovo het|jovo heten|ezen a heten|heten belul|1\s?[-–]\s?2 het|egy-ket het|surgos|minel hamarabb|asap|idoszak|idopont|hatarido|datum)\b/.test(searchText);
    const nameDetected = /\b(?:a nevem|nevem|en vagyok|engem)\s+[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű-]+(?:\s+[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű-]+){0,3}/i.test(rawText)
      || /\b[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű-]+(?:\s+[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű-]+){1,3}\s+(?:vagyok|email|e-mail|telefon|el[eé]rhet[oő]s[eé]g)/i.test(rawText);
    const contactDetected = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(rawText)
      || /(?:\+?\d[\d\s().-]{7,}\d)/.test(rawText);

    return {
      request: rawText.length >= 28 && (requestHints || knownServiceDetected),
      location: locationDetected,
      timing: timingDetected,
      name: nameDetected,
      contact: contactDetected,
    };
  }

  function getBusiness() {
    return context?.business || {};
  }

  function getBusinessSearchText(business = {}) {
    const services = Array.isArray(business.servicesOffered) ? business.servicesOffered : [];
    return normalizeSearchText([
      business.businessName,
      business.serviceType,
      business.serviceArea,
      ...services,
    ].join(" "));
  }

  function detectBusinessCategory(business = {}) {
    const searchText = getBusinessSearchText(business);
    const match = CATEGORY_RULES.find(([, keywords]) =>
      keywords.some((keyword) => matchesCategoryKeyword(searchText, keyword))
    );

    return match?.[0] || "general";
  }

  function formatCopy(template = "", values = {}) {
    return String(template).replace(/\{([a-zA-Z]+)\}/g, (_match, key) =>
      trimText(values[key]) || ""
    );
  }

  function buildBusinessIntakeCopy(business = {}) {
    const businessName = trimText(business.businessName) || "a vállalkozás";
    const serviceArea = trimText(business.serviceArea) || "";
    const category = detectBusinessCategory(business);
    const template = CATEGORY_COPY[category] || CATEGORY_COPY.general;

    return {
      category,
      categoryLabel: template.categoryLabel,
      placeholder: template.placeholder,
      opening: formatCopy(template.opening, { businessName, serviceArea }),
      hint: formatCopy(template.hint, { businessName, serviceArea }),
      manualDetailsPlaceholder: template.manualDetailsPlaceholder,
      missingInfo: {
        ...CATEGORY_COPY.general.missingInfo,
        ...(template.missingInfo || {}),
      },
    };
  }

  function getIntakeCopy() {
    return buildBusinessIntakeCopy(getBusiness());
  }

  function hasStartedIntake(nextFields = fields) {
    const normalized = normalizeFields(nextFields);
    return messages.some((message) => message.role === "user")
      || Object.values(normalized).some(Boolean);
  }

  function getBusinessMeta() {
    const business = getBusiness();
    const serviceType = trimText(business.serviceType);
    const serviceArea = trimText(business.serviceArea);
    return {
      serviceType: serviceType || "szolgáltatás",
      serviceArea: serviceArea || "Magyarország",
    };
  }

  function getBusinessMark() {
    const businessName = trimText(getBusiness().businessName);
    const initials = businessName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();

    return initials || "A";
  }

  function getNextMissingLabel(nextMissing = missingFields) {
    const firstMissing = Array.isArray(nextMissing) ? nextMissing[0] : "";
    const categoryLabel = getIntakeCopy().missingInfo?.[firstMissing];

    if (categoryLabel) {
      return categoryLabel;
    }

    return FIELD_LABELS[firstMissing] || "";
  }

  function buildNextStepText(nextMissing = missingFields) {
    if (!hasStartedIntake()) {
      return "Kezdje egy rövid üzenettel. Nem kell előre minden adatot megadni.";
    }

    const label = getNextMissingLabel(nextMissing);
    return label
      ? `Következőként ezt érdemes pontosítani: ${label}.`
      : "Minden fontos részlet megvan a továbbításhoz.";
  }

  function buildWelcomeMessage() {
    return {
      role: "assistant",
      content: getIntakeCopy().opening,
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

  function renderBusinessIdentity() {
    const business = getBusiness();
    const businessName = trimText(business.businessName) || "a vállalkozás";
    const { serviceType, serviceArea } = getBusinessMeta();

    return `
      <section class="qdh-intake-business" aria-label="Vállalkozás">
        <span class="qdh-intake-business-mark" aria-hidden="true">${escapeHtml(getBusinessMark())}</span>
        <div>
          <h1>${escapeHtml(businessName)}</h1>
          <p>
            <span>${escapeHtml(serviceType)}</span>
            <span>${escapeHtml(serviceArea)}</span>
          </p>
        </div>
      </section>
    `;
  }

  function renderMessages() {
    const assistantName = "Asszisztens";

    return `
      <div class="qdh-ai-messages" data-qdh-ai-messages aria-label="Ajánlatkérési beszélgetés">
        ${messages.map((message) => `
          <article class="qdh-ai-message qdh-ai-message-${message.role === "user" ? "user" : "assistant"} ${message.kind ? `qdh-ai-message-${message.kind}` : ""}">
            <span>${message.role === "user" ? "Ön" : escapeHtml(assistantName)}</span>
            ${message.kind === "follow-up" ? `
              <div class="qdh-ai-followup-card">
                <strong>Következő pontosítás</strong>
                <p>${escapeHtml(message.content)}</p>
              </div>
            ` : `
              <p>${escapeHtml(message.content)}</p>
            `}
          </article>
        `).join("")}
        ${assistantBusy ? `
          <article class="qdh-ai-message qdh-ai-message-assistant qdh-ai-message-pending">
            <span>${escapeHtml(assistantName)}</span>
            <div class="qdh-ai-processing-card">
              <span class="qdh-processing-dots" aria-hidden="true">
                <i></i>
                <i></i>
                <i></i>
              </span>
              <p>Átnézem a részleteket...</p>
            </div>
          </article>
        ` : ""}
      </div>
    `;
  }

  function getProgressItems() {
    const hasRequest = Boolean(fields.requestedService || fields.projectDetails);
    const hasPlaceAndTime = Boolean(fields.locationText && fields.urgency);
    const hasContact = Boolean(fields.customerName && (fields.customerEmail || fields.customerPhone));
    const requestDetected = draftRecognition.request;
    const placeAndTimeDetected = draftRecognition.location && draftRecognition.timing;
    const contactDetected = draftRecognition.name && draftRecognition.contact;

    return [
      {
        key: "request",
        label: "Igény leírása",
        detail: hasRequest ? "Rögzítve" : requestDetected ? "észlelve" : "Írja le pár mondatban",
        complete: hasRequest,
        detected: !hasRequest && requestDetected,
        fresh: isRecentlyCapturedRecognitionCategory("request"),
      },
      {
        key: "place-time",
        label: "Helyszín és idő",
        detail: hasPlaceAndTime ? "Pontosítva" : placeAndTimeDetected ? "észlelve" : "Egy kérdéssel tisztázzuk",
        complete: hasPlaceAndTime,
        detected: !hasPlaceAndTime && placeAndTimeDetected,
        fresh: isRecentlyCapturedRecognitionCategory("location") || isRecentlyCapturedRecognitionCategory("timing"),
      },
      {
        key: "contact",
        label: "Elérhetőség",
        detail: hasContact ? "Megvan" : contactDetected ? "észlelve" : "A visszajelzéshez kell",
        complete: hasContact,
        detected: !hasContact && contactDetected,
        fresh: isRecentlyCapturedRecognitionCategory("name") || isRecentlyCapturedRecognitionCategory("contact"),
      },
      {
        key: "handoff",
        label: "Továbbítás",
        detail: readyToSubmit ? "Beküldhető" : "Elküldés előtt ellenőrzi",
        complete: readyToSubmit,
        detected: false,
        fresh: readyToSubmit && recentlyCapturedKeys.size > 0,
      },
    ];
  }

  function renderProgressItems() {
    const items = getProgressItems();
    const currentIndex = items.findIndex((item) => !item.complete);

    return items.map((item, index) => `
      <li
        class="${item.complete ? "is-complete" : ""} ${item.detected ? "is-detected" : ""} ${item.fresh ? "is-new" : ""} ${index === currentIndex ? "is-current" : ""}"
        data-qdh-progress-item="${escapeHtml(item.key)}"
      >
        <span>${item.complete ? "✓" : item.detected ? "•" : index + 1}</span>
        <strong>${escapeHtml(item.label)}</strong>
        <small>${escapeHtml(item.detail)}</small>
      </li>
    `).join("");
  }

  function renderProgressStrip() {
    return `
      <ol class="qdh-intake-progress" data-qdh-progress-root aria-label="Ajánlatkérés lépései">
        ${renderProgressItems()}
      </ol>
    `;
  }

  function getLiveRecognitionItems() {
    if (!trimText(draftMessage)) {
      return [];
    }

    return LIVE_RECOGNITION_ITEMS.filter((item) => draftRecognition[item.key] === true);
  }

  function hasLiveRecognitionItems() {
    return getLiveRecognitionItems().length > 0;
  }

  function isAssistantInputActive() {
    return Boolean(trimText(draftMessage) || hasLiveRecognitionItems());
  }

  function renderLiveRecognitionContent() {
    const items = getLiveRecognitionItems();
    if (!items.length) {
      return "";
    }

    return `
      ${items.map((item) => `
        <span class="qdh-recognition-chip">
          <i aria-hidden="true"></i>
          ${escapeHtml(item.label)}
        </span>
      `).join("")}
    `;
  }

  function renderLiveRecognitionPreview() {
    const isEmpty = !hasLiveRecognitionItems();
    return `
      <div class="qdh-live-recognition ${isEmpty ? "is-empty" : ""}" data-qdh-recognition-preview aria-live="polite">
        ${renderLiveRecognitionContent()}
      </div>
    `;
  }

  function renderChatPanel() {
    const intakeCopy = getIntakeCopy();
    const inputActive = isAssistantInputActive();

    return `
      <section class="qdh-ai-chat-panel" aria-label="Ajánlatkérési asszisztens">
        <div class="qdh-ai-surface-top">
          <div>
            <h2>Ajánlatkérés</h2>
            <p>${escapeHtml(intakeCopy.hint)}</p>
          </div>
        </div>
        ${renderMessages()}
        <form class="qdh-ai-input ${inputActive ? "is-active" : ""}" data-qdh-chat-form>
          <label for="qdh-ai-message">Írja le, mire lenne szüksége</label>
          <textarea
            id="qdh-ai-message"
            name="message"
            data-qdh-message-input
            rows="5"
            maxlength="2000"
            placeholder="${escapeHtml(intakeCopy.placeholder)}"
            ${assistantBusy || submitting ? "disabled" : ""}
          >${escapeHtml(draftMessage)}</textarea>
          ${renderLiveRecognitionPreview()}
          <div class="qdh-ai-input-actions">
            <button class="qdh-button qdh-button-primary" type="submit" ${assistantBusy || submitting ? "disabled" : ""}>
              Üzenet küldése
            </button>
          </div>
        </form>
        ${renderCapturedDetails()}
        ${renderSubmitControls()}
        ${renderSafetyNotes()}
        ${renderProgressStrip()}
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
    if (!hasStartedIntake()) {
      return "";
    }

    const details = [
      { key: "requestedService", label: "Szolgáltatás", value: fields.requestedService },
      { key: "projectDetails", label: "Részletek", value: fields.projectDetails },
      { key: "locationText", label: "Helyszín", value: fields.locationText },
      { key: "urgency", label: "Sürgősség", value: fields.urgency },
      { key: "customerName", label: "Név", value: fields.customerName },
      { key: "customerContact", label: "Elérhetőség", value: detailValueFor("customerContact") },
      { key: "budgetText", label: "Keret", value: fields.budgetText },
    ].filter(({ value }) => trimText(value));
    const readySummary = "A vállalkozás a leírást, helyszínt, időzítést és elérhetőséget kapja meg. A pontos árat külön erősíti meg.";

    return `
      <div class="qdh-intake-detail-summary ${readyToSubmit ? "is-ready" : ""}" aria-label="Összeszedett részletek">
        <div class="qdh-intake-detail-heading">
          <div>
            <strong>${readyToSubmit ? "Az ajánlatkérés összeállt" : "Összeszedett részletek"}</strong>
            <span>${readyToSubmit ? "Ellenőrizze, majd a gombbal továbbíthatja." : "Beszélgetés közben finoman frissül."}</span>
          </div>
          <em>${readyToSubmit ? "Továbbítható" : "Folyamatban"}</em>
        </div>
        ${details.length ? `
          <div class="qdh-intake-detail-chips">
            ${details.map(({ key, label, value }) => `
              <span class="${isRecentlyCaptured(key) || (key === "customerContact" && isRecentlyCaptured("customerEmail", "customerPhone")) ? "is-new" : ""}">
                <small>${escapeHtml(label)}</small>
                ${escapeHtml(value)}
              </span>
            `).join("")}
          </div>
        ` : `
          <p class="qdh-intake-gentle-note">Elég egy rövid leírással kezdeni; a fontos adatok itt jelennek meg.</p>
        `}
        ${readyToSubmit ? `<p class="qdh-intake-ready-summary">${escapeHtml(readySummary)}</p>` : ""}
        <p class="qdh-ai-next-step">${escapeHtml(buildNextStepText())}</p>
      </div>
    `;
  }

  function renderSubmitControls() {
    if (!readyToSubmit) {
      return "";
    }

    return `
      <div class="qdh-intake-submit-panel">
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
      </div>
    `;
  }

  function renderSafetyNotes() {
    if (!safetyFlags.pricingGuaranteeRequested && !safetyFlags.outOfScope) {
      return "";
    }

    return `
      <div class="qdh-ai-safe-notes">
        ${safetyFlags.pricingGuaranteeRequested ? `
          <p class="qdh-ai-warning">Pontos vagy garantált árat ezen az oldalon nem adunk. A vállalkozás a részletek alapján tud visszajelezni.</p>
        ` : ""}
        ${safetyFlags.outOfScope ? `
          <p class="qdh-ai-warning">A megadott szolgáltatást a vállalkozás ellenőrzi, hogy vállalható-e.</p>
        ` : ""}
      </div>
    `;
  }

  function renderManualForm() {
    const business = getBusiness();
    const services = Array.isArray(business.servicesOffered) ? business.servicesOffered : [];
    const intakeCopy = getIntakeCopy();

    return `
      <section class="qdh-manual-panel ${manualOpen ? "is-open" : ""}" aria-label="Részletek szerkesztése">
        <button class="qdh-manual-summary" type="button" data-qdh-toggle-manual aria-expanded="${manualOpen ? "true" : "false"}">
          <span class="qdh-manual-summary-icon" aria-hidden="true"></span>
          <span>
            <strong>Részletek szerkesztése</strong>
            <small>Kapcsolattartó adatok és további információk megadása</small>
          </span>
          <em aria-hidden="true">${manualOpen ? "−" : "+"}</em>
        </button>
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
                <textarea name="project_details" placeholder="${escapeHtml(intakeCopy.manualDetailsPlaceholder)}" required>${escapeHtml(fields.projectDetails)}</textarea>
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
              <span class="qdh-intake-form-note">A beküldés után a vállalkozás külön jelzi a következő lépést.</span>
            </div>
          </form>
        ` : ""}
      </section>
    `;
  }

  function renderApp() {
    root.innerHTML = `
      ${renderBusinessIdentity()}
      ${renderChatPanel()}
      ${renderManualForm()}
    `;

    window.setTimeout(() => {
      const messagesRoot = root.querySelector("[data-qdh-ai-messages]");
      if (messagesRoot) {
        messagesRoot.scrollTop = messagesRoot.scrollHeight;
      }
    }, 0);
  }

  function refreshLiveInteractionCues() {
    if (!root) {
      return;
    }

    const recognitionRoot = root.querySelector("[data-qdh-recognition-preview]");
    if (recognitionRoot) {
      const recognitionHtml = renderLiveRecognitionContent();
      if (recognitionRoot.innerHTML !== recognitionHtml) {
        recognitionRoot.innerHTML = recognitionHtml;
      }
      recognitionRoot.className = `qdh-live-recognition ${hasLiveRecognitionItems() ? "" : "is-empty"}`.trim();
    }

    const inputForm = root.querySelector("[data-qdh-chat-form]");
    if (inputForm?.classList && typeof inputForm.classList.toggle === "function") {
      inputForm.classList.toggle("is-active", isAssistantInputActive());
    }

    const progressRoot = root.querySelector("[data-qdh-progress-root]");
    if (progressRoot) {
      progressRoot.innerHTML = renderProgressItems();
    }
  }

  function clearCaptureHighlightsLater() {
    if (!recentlyCapturedKeys.size) {
      return;
    }

    if (captureAnimationTimer && typeof window.clearTimeout === "function") {
      window.clearTimeout(captureAnimationTimer);
    }

    captureAnimationTimer = window.setTimeout(() => {
      recentlyCapturedKeys = new Set();
      captureAnimationTimer = 0;
      renderApp();
    }, 1500);
  }

  function getAssistantMessageKind(data = {}) {
    if (Array.isArray(data.missingFields) && data.missingFields.length > 0) {
      return "follow-up";
    }

    if (readyToSubmit) {
      return "ready";
    }

    return "";
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
      ${renderBusinessIdentity()}
      <section class="qdh-intake-success" aria-label="Ajánlatkérés sikeresen rögzítve">
        <span class="qdh-intake-success-mark" aria-hidden="true"></span>
        <h2>Köszönjük, továbbítottuk az ajánlatkérést.</h2>
        <p>${escapeHtml(businessName)} áttekinti a részleteket. A vállalkozás a megadott elérhetőségen jelentkezik. A pontos árat külön erősíti meg.</p>
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
      assistant: { reply },
      extractedFields: nextFields,
      missingFields: nextMissing,
      readyToSubmit: nextMissing.length === 0,
      safetyFlags: {
        pricingGuaranteeRequested: priceBoundary,
      },
      request: payload.confirm_submit && nextMissing.length === 0
        ? { ok: true }
        : null,
    };
  }

  async function submitFixture() {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 250);
    });
    return { request: { ok: true } };
  }

  function applyAssistantResponse(data = {}) {
    const previouslyCapturedKeys = getCapturedFieldKeys(fields);
    fields = mergeFields(fields, data.extractedFields || {});
    recentlyCapturedKeys = new Set(
      [...getCapturedFieldKeys(fields)].filter((key) => !previouslyCapturedKeys.has(key))
    );
    missingFields = Array.isArray(data.missingFields) ? data.missingFields : getLocalMissing(fields);
    safetyFlags = data.safetyFlags || {};
    updateReadiness(missingFields);
    draftMessage = "";
    draftRecognition = detectLiveRecognition("");

    const reply = trimText(data.assistant?.reply);
    if (reply) {
      messages.push({ role: "assistant", content: reply, kind: getAssistantMessageKind(data) });
    }

    if (data.request) {
      renderSuccess(data);
      return;
    }

    renderApp();
    clearCaptureHighlightsLater();
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
      draftMessage = "";
      draftRecognition = detectLiveRecognition("");
    }
    assistantBusy = true;
    setStatus(confirmSubmit ? "Ajánlatkérés rögzítése..." : "Átnézem a részleteket...");
    renderApp();
    const busyStartedAt = Date.now();

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
      await keepAssistantBusySince(busyStartedAt);
      assistantBusy = false;
      applyAssistantResponse(data);
    } catch (error) {
      await keepAssistantBusySince(busyStartedAt);
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

  function handleMessageInput(event) {
    const input = event.target.closest("[data-qdh-message-input]");
    if (!input) {
      return;
    }

    draftMessage = String(input.value || "");
    draftRecognition = detectLiveRecognition(draftMessage);
    refreshLiveInteractionCues();
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
      const params = new URLSearchParams(window.location.search);
      const fixtureKey = normalizeSearchText(params.get("fixture") || params.get("business") || "");
      const externalFixtureContext = window.VONZA_LOCAL_QDH_INTAKE_FIXTURE_CONTEXT;
      context = externalFixtureContext && typeof externalFixtureContext === "object"
        ? externalFixtureContext
        : FIXTURE_CONTEXTS[fixtureKey] || FIXTURE_CONTEXT;
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

  document.addEventListener("input", (event) => {
    handleMessageInput(event);
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
