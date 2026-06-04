import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

import express from "express";

import { createApp as createFullApp } from "../src/app/createApp.js";
import { createQuoteDeskHuRouter } from "../src/routes/quoteDeskHuRoutes.js";
import { generateQuoteDeskHuAssistantTurn } from "../src/services/quotes/quoteDeskHuIntakeAssistantService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function createApiApp(deps = {}) {
  const app = express();
  app.use(express.json());
  app.use(createQuoteDeskHuRouter({
    getSupabaseClient: () => ({}),
    getAuthenticatedUser: async () => ({ id: "owner-1", email: "owner@example.com" }),
    requireActiveAgentAccess: async (_supabase, options) => {
      if (options.agentId === "agent-2") {
        const error = new Error("Forbidden");
        error.statusCode = 403;
        throw error;
      }
      return {
        id: options.agentId || "agent-1",
        ownerUserId: options.ownerUserId,
      };
    },
    createAgentQuoteRequest: async (_supabase, options) => ({
      status: options.status || "request_received",
      sourceChannel: options.sourceChannel || "qdh_public_intake",
    }),
    getOpenAIClient: () => null,
    getQuoteDeskHuSetup: async () => ({
      ownerUserId: "owner-1",
      businessName: "Példa Kft.",
      websiteUrl: "https://pelda.hu",
      serviceType: "tetőfedés",
      serviceArea: "Budapest",
      handlingPreference: "staff_review",
      ownerContactEmail: "owner@example.hu",
      servicesOffered: ["Tetőjavítás", "Bádogozás"],
      setupStatus: "ready_for_review",
    }),
    getQuoteDeskHuPublicAgentForOwner: async () => null,
    resolveQuoteDeskHuPublicAgent: async (_supabase, options) => {
      if (!options.agentKey) {
        const error = new Error("agent_key is required for Quote Desk HU public intake.");
        error.statusCode = 400;
        error.code = "qdh_intake_agent_key_required";
        throw error;
      }
      if (options.agentKey !== "valid-qdh-key") {
        const error = new Error("Quote Desk HU public intake link is not available.");
        error.statusCode = 404;
        error.code = "qdh_intake_link_unavailable";
        throw error;
      }
      return {
        id: "agent-1",
        ownerUserId: "owner-1",
        businessId: "business-1",
        publicAgentKey: "valid-qdh-key",
        accessStatus: "active",
      };
    },
    listAgentQuoteRequests: async () => [],
    updateAgentQuoteRequestStatus: async (_supabase, options) => ({
      id: options.requestId,
      ownerUserId: options.ownerUserId,
      status: options.status,
      statusReason: options.statusReason || null,
      staffNotes: options.staffNotes || null,
    }),
    limitQdhIntakeAssistant: (_req, _res, next) => next(),
    ...deps,
  }));
  return app;
}

async function startServer(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function requestJson(baseUrl, pathname, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.auth === false ? {} : { Authorization: "Bearer owner-token" }),
    ...(options.headers || {}),
  };
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers,
  });
  const text = await response.text();

  return {
    status: response.status,
    json: text && response.headers.get("content-type")?.includes("application/json")
      ? JSON.parse(text)
      : null,
    text,
  };
}

function buildValidQdhIntakePayload(overrides = {}) {
  return {
    agent_key: "valid-qdh-key",
    requested_service: "Tetőjavítás",
    project_details: "Beázás a kémény mellett, helyszíni felmérés szükséges.",
    location_text: "Budapest XI.",
    urgency: "Ezen a héten",
    budget_text: "Rugalmas",
    customer_name: "Kovács Anna",
    customer_email: "anna@example.hu",
    customer_phone: "",
    consent_acknowledged: true,
    ...overrides,
  };
}

function buildCompleteQdhAiPayload(overrides = {}) {
  return {
    agent_key: "valid-qdh-key",
    message: "Tetőjavításra kérek ajánlatot. Beázik a tető a kémény mellett Budapesten, ezen a héten lenne sürgős. A nevem Kovács Anna, email anna@customer.hu.",
    fields: {},
    conversation: [],
    confirm_submit: false,
    consent_acknowledged: false,
    language: "hu",
    ...overrides,
  };
}

function createQdhIntakeFixtureVm(contextOrFixture = "webstudio") {
  const intakeSource = readFileSync(path.join(repoRoot, "frontend", "qdh-intake.js"), "utf8");
  const eventHandlers = {};
  const queriedNodes = new Map();
  const fetchCalls = [];
  const rootElement = {
    innerHTML: "",
    querySelector: (selector) => {
      if (!queriedNodes.has(selector)) {
        queriedNodes.set(selector, {
          innerHTML: "",
          scrollTop: 0,
          scrollHeight: 0,
        });
      }
      return queriedNodes.get(selector);
    },
  };
  const statusElement = { textContent: "" };
  const fixtureContext = typeof contextOrFixture === "string" ? null : contextOrFixture;
  const fixtureQuery = typeof contextOrFixture === "string" ? `?fixture=${contextOrFixture}` : "";
  const windowObject = {
    location: { search: fixtureQuery },
    setTimeout: (callback) => {
      callback();
      return 0;
    },
    VONZA_LOCAL_QDH_INTAKE_FIXTURE: true,
    VONZA_LOCAL_QDH_INTAKE_FIXTURE_CONTEXT: fixtureContext,
  };
  const documentObject = {
    getElementById: (id) => {
      if (id === "qdh-intake-root") return rootElement;
      if (id === "qdh-intake-status") return statusElement;
      return null;
    },
    addEventListener: (eventName, handler) => {
      eventHandlers[eventName] = handler;
    },
  };
  class FixtureFormData {
    constructor(form) {
      this.form = form || {};
    }

    get(name) {
      return this.form.fields?.[name] || "";
    }
  }
  const context = vm.createContext({
    window: windowObject,
    document: documentObject,
    URLSearchParams,
    FormData: FixtureFormData,
    fetch: async (...args) => {
      fetchCalls.push(args);
      throw new Error("fixture render should not fetch");
    },
  });

  vm.runInContext(intakeSource, context);
  return {
    rootElement,
    statusElement,
    eventHandlers,
    queriedNodes,
    fetchCalls,
  };
}

function renderQdhIntakeFixtureHtml(contextOrFixture = "webstudio") {
  return createQdhIntakeFixtureVm(contextOrFixture).rootElement.innerHTML;
}

test("QDH dashboard route renders a separate Hungarian product shell", async () => {
  const server = await startServer(createFullApp({ rootDir: repoRoot }));

  try {
    for (const pathname of ["/qdh/dashboard", "/quote-desk-hu/dashboard"]) {
      const response = await fetch(`${server.baseUrl}${pathname}`);
      const html = await response.text();

      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type") || "", /html/);
      assert.match(html, /<html lang="hu">/);
      assert.match(html, /Quote Desk HU/);
      assert.match(html, /Ajánlatkérési munkaterület/);
      assert.match(html, /qdh-dashboard\.css/);
      assert.match(html, /qdh-dashboard\.js/);
      assert.doesNotMatch(html, /src="\/dashboard\.js/);
      assert.doesNotMatch(html, /data-quote-request-review/);
      assert.doesNotMatch(html, /AI Front Desk/i);
    }
  } finally {
    await server.close();
  }
});

test("QDH public acquisition and setup routes are product-specific and separate", async () => {
  const server = await startServer(createFullApp({ rootDir: repoRoot }));

  try {
    const publicResponse = await fetch(`${server.baseUrl}/qdh`);
    const publicHtml = await publicResponse.text();
    const aliasResponse = await fetch(`${server.baseUrl}/quote-desk-hu`);
    const setupResponse = await fetch(`${server.baseUrl}/qdh/setup`);
    const setupHtml = await setupResponse.text();

    assert.equal(publicResponse.status, 200);
    assert.equal(aliasResponse.status, 200);
    assert.equal(setupResponse.status, 200);
    assert.match(publicHtml, /<html lang="hu">/);
    assert.match(publicHtml, /Quote Desk HU/);
    assert.match(publicHtml, /statikus “Kérjen ajánlatot” űrlap helyett/);
    assert.match(publicHtml, /href="\/qdh\/setup"/);
    assert.match(publicHtml, /href="\/qdh\/dashboard"/);
    assert.match(publicHtml, /Request intake és review fázis/);
    assert.match(publicHtml, /nem ígér automatikus végső árat/i);
    assert.match(publicHtml, /nem küld ajánlatot az ügyfélnek/i);
    assert.match(setupHtml, /QDH setup magyar ajánlatkérésekhez/);
    assert.match(setupHtml, /qdh-setup\.js/);
    assert.doesNotMatch(publicHtml, /src="\/dashboard\.js/);
    assert.doesNotMatch(setupHtml, /src="\/dashboard\.js/);
    assert.doesNotMatch(publicHtml, /AI Front Desk magyar ügyfélkérdésekhez/);
    assert.doesNotMatch(setupHtml, /\/dashboard\?from=site/);
  } finally {
    await server.close();
  }
});

test("QDH public intake routes serve standalone customer request UI", async () => {
  const server = await startServer(createFullApp({ rootDir: repoRoot }));

  try {
    for (const pathname of ["/qdh/intake", "/quote-desk-hu/intake"]) {
      const response = await fetch(`${server.baseUrl}${pathname}`);
      const html = await response.text();

      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type") || "", /html/);
      assert.match(html, /<html lang="hu">/);
      assert.match(html, /<title>Ajánlatkérés<\/title>/);
      assert.match(html, /Ajánlatkérő asszisztens/);
      assert.match(html, /A pontos árat a vállalkozás erősíti meg\./);
      assert.doesNotMatch(html, /qdh-intake-copy|qdh-intake-layout|qdh-ai-details-panel/);
      assert.doesNotMatch(html, /Request-only|Staff review|AI-assisted Staff review|Hiányos|qdh_ai_intake|package_key|package|policy|metadata/i);
      assert.match(html, /qdh-product\.css/);
      assert.match(html, /qdh-intake\.js/);
      assert.doesNotMatch(html, /qdh-dashboard\.js/);
      assert.doesNotMatch(html, /qdh-setup\.js/);
      assert.doesNotMatch(html, /src="\/dashboard\.js/);
      assert.doesNotMatch(html, /AI Front Desk magyar ügyfélkérdésekhez/);
      assert.doesNotMatch(html, /\/widget|\/embed\.js|\/embed-lite\.js|assistant-embed/);
    }
  } finally {
    await server.close();
  }
});

test("QDH customer intake source is business-first receptionist UI", () => {
  const intakeHtml = readFileSync(path.join(repoRoot, "frontend", "qdh-intake.html"), "utf8");
  const intakeSource = readFileSync(path.join(repoRoot, "frontend", "qdh-intake.js"), "utf8");
  const productCss = readFileSync(path.join(repoRoot, "frontend", "qdh-product.css"), "utf8");
  const publicCustomerSource = `${intakeHtml}\n${intakeSource}`;

  assert.match(intakeHtml, /qdh-intake-stage/);
  assert.match(intakeSource, /renderBusinessIdentity/);
  assert.match(intakeSource, /Minta Webstúdió Kft\./);
  assert.match(intakeSource, /Budapest és online/);
  assert.match(intakeSource, /Üdvözlöm, miben segíthetünk ajánlatot adni\?/);
  assert.match(intakeSource, /Írja le, mire lenne szüksége/);
  assert.match(intakeSource, /qdh-intake-progress/);
  assert.match(intakeSource, /Elég egy rövid leírással kezdeni/);

  assert.match(intakeSource, /qdh-manual-summary/);
  assert.match(intakeSource, /Részletek szerkesztése/);
  assert.match(intakeSource, /manualOpen \? `/);
  assert.doesNotMatch(intakeHtml, /qdh-intake-form|Kért szolgáltatás|Projekt részletei/);

  assert.doesNotMatch(publicCustomerSource, /qdh_public_intake|qdh_ai_intake|request_received|sourceChannel|source_channel|displayMode/i);
  assert.doesNotMatch(publicCustomerSource, /Request-only|Staff review|AI-assisted Staff review|Hiányos|package_key|package|policy|metadata/i);
  assert.doesNotMatch(publicCustomerSource, /\b(?:owner_user_id|ownerUserId|agent_id|agentId|business_id|businessId|evidence)\b/i);
  assert.doesNotMatch(publicCustomerSource, /Ár kiszámítása|Árajánlat elküldése|send final quote|provider call|garantált árat adok/i);

  assert.doesNotMatch(productCss, /qdh-intake-copy|qdh-intake-layout|qdh-ai-details-panel|qdh-ai-workspace|qdh-ai-detail-row/);
  assert.doesNotMatch(productCss, /orb|bokeh|purple/i);
});

test("QDH intake business copy uses webstudio context without roof or cleaning mismatch", () => {
  const html = renderQdhIntakeFixtureHtml("webstudio");

  assert.match(html, /Minta Webstúdió Kft\./);
  assert.match(html, /Weboldalt szeretnék készíttetni egy budapesti vállalkozásnak/);
  assert.match(html, /webes vagy marketing feladatot/);
  assert.match(html, /Weboldal, webshop, kampány vagy arculati munka/);
  assert.doesNotMatch(html, /Tetőjavításra kérek ajánlatot|Beázik a tető|Nagytakarításra szeretnék/i);
});

test("QDH intake business copy uses cleaning context", () => {
  const html = renderQdhIntakeFixtureHtml("cleaning");

  assert.match(html, /Minta Takarítás Kft\./);
  assert.match(html, /Nagytakarításra szeretnék ajánlatot kérni Budapesten/);
  assert.match(html, /70 m²-es lakásról van szó/);
  assert.match(html, /alapterület, helyiségek típusa, kért takarítás/);
  assert.doesNotMatch(html, /Weboldalt szeretnék készíttetni|Garázskapu beépítésre/i);
});

test("QDH intake business copy uses garage door context", () => {
  const html = renderQdhIntakeFixtureHtml("garage");

  assert.match(html, /Minta Kaputechnika Kft\./);
  assert.match(html, /Garázskapu beépítésre kérek ajánlatot családi házhoz/);
  assert.match(html, /kapuval vagy garázskapuval kapcsolatos feladatot/);
  assert.match(html, /típus, méret, helyszín, meglévő szerkezet/);
  assert.doesNotMatch(html, /Weboldalt szeretnék készíttetni|Nagytakarításra szeretnék/i);
});

test("QDH intake business copy falls back naturally for unknown service type", () => {
  const html = renderQdhIntakeFixtureHtml({
    business: {
      businessName: "Minta Szakértő Kft.",
      serviceType: "egyedi üzleti megoldás",
      serviceArea: "Magyarország",
      servicesOffered: ["Egyedi egyeztetés", "Ügyféligény felmérés"],
    },
  });

  assert.match(html, /Minta Szakértő Kft\./);
  assert.match(html, /Szeretnék ajánlatot kérni a szolgáltatásra/);
  assert.match(html, /mire van szükségem, hol lenne a munka, és mikor lenne aktuális/);
  assert.doesNotMatch(html, /Weboldalt szeretnék készíttetni|Nagytakarításra szeretnék|Garázskapu beépítésre/i);
});

test("QDH intake initial UI has one safety line, natural progress wording, and secondary manual editor", () => {
  const intakeHtml = readFileSync(path.join(repoRoot, "frontend", "qdh-intake.html"), "utf8");
  const intakeSource = readFileSync(path.join(repoRoot, "frontend", "qdh-intake.js"), "utf8");
  const productCss = readFileSync(path.join(repoRoot, "frontend", "qdh-product.css"), "utf8");
  const rendered = renderQdhIntakeFixtureHtml("webstudio");
  const initialUi = `${intakeHtml}\n${rendered}`;
  const safetyLineMatches = initialUi.match(/A pontos árat a vállalkozás erősíti meg\./g) || [];

  assert.equal(safetyLineMatches.length, 1);
  assert.match(rendered, /Elküldés előtt ellenőrzi/);
  assert.doesNotMatch(rendered, /A végén ellenőrzi/);
  assert.doesNotMatch(intakeSource, /A végén ellenőrzi/);
  assert.match(rendered, />Asszisztens</);
  assert.doesNotMatch(rendered, /Minta Webstúdió Kft\.<\/span>\s*<p>Üdvözlöm/);
  assert.ok(rendered.indexOf("qdh-ai-chat-panel") < rendered.indexOf("qdh-manual-panel"));
  assert.doesNotMatch(rendered, /qdh-intake-form|Kért szolgáltatás|Projekt részletei/);
  assert.doesNotMatch(rendered, /Felismert részletek|várja|Csak egyértelmű jel esetén változik/);
  assert.doesNotMatch(rendered, /qdh-recognition-chip/);
  assert.match(productCss, /\.qdh-ai-chat-panel \{[\s\S]*border-bottom-right-radius: 0;/);
  assert.match(productCss, /\.qdh-manual-panel \{[\s\S]*margin-top: -1px;/);
});

test("QDH intake live recognition chips are hidden until useful and expose only customer-safe cues", () => {
  const fixture = createQdhIntakeFixtureVm("webstudio");
  const target = {
    value: "Szia",
    closest: (selector) => (selector === "[data-qdh-message-input]" ? target : null),
  };

  assert.doesNotMatch(fixture.rootElement.innerHTML, /Felismert részletek|várja|Csak egyértelmű jel esetén változik/);
  assert.doesNotMatch(fixture.rootElement.innerHTML, /qdh-recognition-chip/);

  fixture.eventHandlers.input({ target });
  const quietRecognitionHtml = fixture.queriedNodes.get("[data-qdh-recognition-preview]").innerHTML;

  assert.equal(quietRecognitionHtml.trim(), "");

  target.value = "Weboldalt szeretnék Budapesten jövő héten. Kovács Anna vagyok, anna@example.hu.";
  fixture.eventHandlers.input({ target });

  const recognitionHtml = fixture.queriedNodes.get("[data-qdh-recognition-preview]").innerHTML;
  const progressHtml = fixture.queriedNodes.get("[data-qdh-progress-root]").innerHTML;

  assert.equal(fixture.fetchCalls.length, 0);
  assert.match(recognitionHtml, /qdh-recognition-chip/);
  assert.match(recognitionHtml, /Igény észlelve/);
  assert.match(recognitionHtml, /Helyszín észlelve/);
  assert.match(recognitionHtml, /Időzítés észlelve/);
  assert.match(recognitionHtml, /Név megvan/);
  assert.match(recognitionHtml, /Elérhetőség megvan/);
  assert.match(progressHtml, /észlelve/);
  assert.doesNotMatch(recognitionHtml, /Felismert részletek|várja|Csak egyértelmű jel esetén változik/);
  assert.doesNotMatch(recognitionHtml, /requested_service|project_details|location_text|urgency|customer_name|customer_contact|data-state|data-recognition-key|field|source|status/i);
  assert.doesNotMatch(`${recognitionHtml}\n${progressHtml}`, /qdh_public_intake|qdh_ai_intake|request_received|sourceChannel|source_channel|displayMode/i);
  assert.doesNotMatch(`${recognitionHtml}\n${progressHtml}`, /Request-only|Staff review|AI-assisted|package|policy|metadata|model|system prompt|owner|agent|business_id/i);
});

test("QDH intake processing, follow-up, ready, success, and motion copy stay request-only", () => {
  const intakeSource = readFileSync(path.join(repoRoot, "frontend", "qdh-intake.js"), "utf8");
  const productCss = readFileSync(path.join(repoRoot, "frontend", "qdh-product.css"), "utf8");
  const fixture = createQdhIntakeFixtureVm("webstudio");
  const form = {
    fields: {
      message: "Weboldalt szeretnék készíttetni Budapesten.",
    },
    closest: (selector) => (selector === "[data-qdh-chat-form]" ? form : null),
    querySelector: () => null,
  };

  fixture.eventHandlers.submit({
    target: form,
    preventDefault: () => {},
  });

  assert.equal(fixture.fetchCalls.length, 0);
  assert.match(fixture.rootElement.innerHTML, /qdh-ai-processing-card/);
  assert.match(fixture.rootElement.innerHTML, /Átnézem a részleteket\.\.\./);
  assert.match(intakeSource, /qdh-ai-followup-card/);
  assert.match(intakeSource, /Következő pontosítás/);
  assert.match(intakeSource, /Az ajánlatkérés összeállt/);
  assert.match(intakeSource, /A vállalkozás a leírást, helyszínt, időzítést és elérhetőséget kapja meg/);
  assert.match(intakeSource, /Köszönjük, továbbítottuk az ajánlatkérést\./);
  assert.match(intakeSource, /A vállalkozás a megadott elérhetőségen jelentkezik/);
  assert.match(productCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(productCss, /qdh-processing-dot/);
  assert.match(productCss, /qdh-recognition-check/);
  assert.match(productCss, /qdh-captured-field/);
  assert.doesNotMatch(intakeSource, /Az ajánlat elkészült|Végleges ajánlat|garantált árat adunk|pontos árat adunk|Ár kiszámítása|Árajánlat elküldése|send final quote|provider call/i);
});

test("QDH frontend stays request-review only and avoids generic dashboard/widget dependencies", () => {
  const html = readFileSync(path.join(repoRoot, "frontend", "qdh-dashboard.html"), "utf8");
  const source = readFileSync(path.join(repoRoot, "frontend", "qdh-dashboard.js"), "utf8");
  const css = readFileSync(path.join(repoRoot, "frontend", "qdh-dashboard.css"), "utf8");
  const setupSource = readFileSync(path.join(repoRoot, "frontend", "qdh-setup.js"), "utf8");
  const productCss = readFileSync(path.join(repoRoot, "frontend", "qdh-product.css"), "utf8");
  const intakeHtml = readFileSync(path.join(repoRoot, "frontend", "qdh-intake.html"), "utf8");
  const intakeSource = readFileSync(path.join(repoRoot, "frontend", "qdh-intake.js"), "utf8");

  assert.match(html, /Quote Desk HU/);
  assert.match(source, /\/quote-desk-hu\/requests/);
  assert.match(source, /\/quote-desk-hu\/setup-state/);
  assert.match(setupSource, /\/quote-desk-hu\/setup/);
  assert.match(setupSource, /\/qdh\/intake\?agent_key=/);
  assert.match(intakeHtml, /qdh-intake-stage/);
  assert.match(intakeSource, /Üdvözlöm, miben segíthetünk ajánlatot adni\?/);
  assert.match(intakeSource, /\/quote-desk-hu\/intake-context/);
  assert.match(intakeSource, /\/quote-desk-hu\/intake-assistant/);
  assert.match(intakeSource, /\/quote-desk-hu\/intake-requests/);
  assert.match(intakeSource, /Részletek szerkesztése/);
  assert.match(intakeSource, /qdh-intake-progress/);
  assert.match(intakeSource, /a pontos árat a vállalkozás erősíti meg/i);
  assert.match(setupSource, /signInWithPassword/);
  assert.match(setupSource, /signInWithOtp/);
  assert.match(setupSource, /signUp/);
  assert.match(source, /Új/);
  assert.match(source, /Hiányzó adat/);
  assert.match(source, /Ellenőrzés alatt/);
  assert.match(source, /Elutasítva \/ Archivált/);
  assert.match(source, /végső árakat a vállalkozás erősíti meg/i);
  assert.match(source, /nem készít automatikus garantált ajánlatot/i);
  assert.match(source, /AI-assisted QDH intake/);
  assert.match(source, /AI staff összefoglaló/);

  assert.doesNotMatch(source, /\/agents\/quote-requests/);
  assert.doesNotMatch(source, /buildQuoteRequestReviewCard|data-quote-request-review/);
  assert.doesNotMatch(source, /data-qdh-status-action="\$\{escapeHtml\(record\.status\)\}"/);
  assert.doesNotMatch(source, /data-qdh-status-action="request_received"/);
  assert.doesNotMatch(source, /quoted_externally|accepted_externally/);
  assert.doesNotMatch(source, /Árajánlat elküldve|Elfogadva|accepted quote|send final quote/i);
  assert.doesNotMatch(source, /\/widget|\/embed\.js|\/embed-lite\.js|assistant-embed/);
  assert.doesNotMatch(source, /whatsapp|google|external provider/i);
  assert.doesNotMatch(intakeSource, /quoted_externally|accepted_externally/);
  assert.doesNotMatch(intakeSource, /Ár kiszámítása|Árajánlat elküldése|send final quote|provider call/i);
  assert.doesNotMatch(intakeSource, /\/widget|\/embed\.js|\/embed-lite\.js|assistant-embed/);
  assert.doesNotMatch(`${intakeHtml}\n${intakeSource}`, /Request-only|Staff review|AI-assisted Staff review|Hiányos|qdh_public_intake|qdh_ai_intake|request_received|sourceChannel|source_channel|package_key|package|policy|metadata/i);
  assert.doesNotMatch(intakeHtml, /\b(?:owner_user_id|ownerUserId|agent_id|agentId|business_id|businessId|metadata|evidence|package_key|policy)\b/i);
  assert.doesNotMatch(intakeSource, /\b(?:owner_user_id|ownerUserId|agent_id|agentId|business_id|businessId|package_key|policy|evidence)\b/i);
  assert.doesNotMatch(css, /orb|bokeh|hero/i);
  assert.doesNotMatch(setupSource, /service_role|SUPABASE_SERVICE_ROLE|OPENAI_API_KEY|STRIPE_SECRET/i);
  assert.doesNotMatch(intakeSource, /service_role|SUPABASE_SERVICE_ROLE|OPENAI_API_KEY|STRIPE_SECRET/i);
  assert.doesNotMatch(productCss, /orb|bokeh|purple/i);
});

test("QDH setup APIs require auth and persist owner-scoped setup readiness", async () => {
  const authError = new Error("Unauthorized");
  authError.statusCode = 401;
  const setupCalls = [];
  const server = await startServer(createApiApp({
    getAuthenticatedUser: async (_supabase, req) => {
      if (!req.headers.authorization) {
        throw authError;
      }
      return { id: "owner-1", email: "owner@example.hu" };
    },
    getQuoteDeskHuSetup: async (_supabase, options) => {
      setupCalls.push(["get", options]);
      return null;
    },
    saveQuoteDeskHuSetup: async (_supabase, options) => {
      setupCalls.push(["save", options]);
      return {
        ownerUserId: options.ownerUserId,
        businessName: options.businessName,
        websiteUrl: "https://pelda.hu",
        serviceType: options.serviceType,
        serviceArea: options.serviceArea,
        handlingPreference: options.handlingPreference,
        ownerContactEmail: options.ownerContactEmail,
        servicesOffered: options.servicesOffered,
        setupStatus: "ready_for_review",
      };
    },
  }));

  try {
    const unauthenticatedGet = await requestJson(server.baseUrl, "/quote-desk-hu/setup-state", {
      auth: false,
    });
    const authenticatedGet = await requestJson(server.baseUrl, "/quote-desk-hu/setup-state");
    const unauthenticatedPost = await requestJson(server.baseUrl, "/quote-desk-hu/setup", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ business_name: "Példa Kft." }),
    });
    const authenticatedPost = await requestJson(server.baseUrl, "/quote-desk-hu/setup", {
      method: "POST",
      body: JSON.stringify({
        business_name: "Példa Kft.",
        website_url: "https://pelda.hu",
        service_type: "tetőfedés",
        service_area: "Budapest",
        handling_preference: "staff_review",
        owner_contact_email: "owner@example.hu",
        services_offered: ["Tetőjavítás", "Bádogozás"],
      }),
    });

    assert.equal(unauthenticatedGet.status, 401);
    assert.equal(authenticatedGet.status, 200);
    assert.equal(authenticatedGet.json.product, "quote_desk_hu");
    assert.equal(authenticatedGet.json.setupComplete, false);
    assert.equal(authenticatedGet.json.nextUrl, "/qdh/setup");
    assert.equal(unauthenticatedPost.status, 401);
    assert.equal(authenticatedPost.status, 200);
    assert.equal(authenticatedPost.json.product, "quote_desk_hu");
    assert.equal(authenticatedPost.json.setupComplete, true);
    assert.equal(authenticatedPost.json.nextUrl, "/qdh/dashboard");
    assert.equal(authenticatedPost.json.setup.ownerUserId, "owner-1");
    assert.deepEqual(setupCalls, [
      ["get", { ownerUserId: "owner-1" }],
      ["save", {
        ownerUserId: "owner-1",
        businessName: "Példa Kft.",
        websiteUrl: "https://pelda.hu",
        serviceType: "tetőfedés",
        serviceArea: "Budapest",
        handlingPreference: "staff_review",
        ownerContactEmail: "owner@example.hu",
        servicesOffered: ["Tetőjavítás", "Bádogozás"],
      }],
    ]);
  } finally {
    await server.close();
  }
});

test("QDH setup missing-table error is product-specific and safe", async () => {
  const missingTableError = new Error("Quote Desk HU setup storage is not available.");
  missingTableError.statusCode = 503;
  missingTableError.code = "qdh_setup_table_missing";
  const server = await startServer(createApiApp({
    getQuoteDeskHuSetup: async () => {
      throw missingTableError;
    },
  }));

  try {
    const response = await requestJson(server.baseUrl, "/quote-desk-hu/setup-state");

    assert.equal(response.status, 503);
    assert.equal(response.json.code, "qdh_setup_table_missing");
    assert.equal(response.json.error, "This service is temporarily unavailable. Please try again shortly.");
  } finally {
    await server.close();
  }
});

test("QDH public intake context rejects missing or invalid routing context", async () => {
  let setupCalled = false;
  const server = await startServer(createApiApp({
    getQuoteDeskHuSetup: async () => {
      setupCalled = true;
      return null;
    },
  }));

  try {
    const missing = await requestJson(server.baseUrl, "/quote-desk-hu/intake-context", {
      method: "GET",
      auth: false,
    });
    const invalid = await requestJson(server.baseUrl, "/quote-desk-hu/intake-context?agent_key=bad-key", {
      method: "GET",
      auth: false,
    });

    assert.equal(missing.status, 400);
    assert.equal(missing.json.code, "qdh_intake_agent_key_required");
    assert.equal(invalid.status, 404);
    assert.equal(invalid.json.code, "qdh_intake_link_unavailable");
    assert.equal(setupCalled, false);
  } finally {
    await server.close();
  }
});

test("QDH public intake create validates required fields and rejects unsafe public body fields", async () => {
  let createCalled = false;
  const server = await startServer(createApiApp({
    createAgentQuoteRequest: async () => {
      createCalled = true;
      return {};
    },
  }));

  try {
    const missingService = await requestJson(server.baseUrl, "/quote-desk-hu/intake-requests", {
      method: "POST",
      auth: false,
      body: JSON.stringify(buildValidQdhIntakePayload({ requested_service: "" })),
    });
    const missingContact = await requestJson(server.baseUrl, "/quote-desk-hu/intake-requests", {
      method: "POST",
      auth: false,
      body: JSON.stringify(buildValidQdhIntakePayload({
        customer_email: "",
        customer_phone: "",
      })),
    });
    const missingAcknowledgement = await requestJson(server.baseUrl, "/quote-desk-hu/intake-requests", {
      method: "POST",
      auth: false,
      body: JSON.stringify(buildValidQdhIntakePayload({ consent_acknowledged: false })),
    });
    const unsafeField = await requestJson(server.baseUrl, "/quote-desk-hu/intake-requests", {
      method: "POST",
      auth: false,
      body: JSON.stringify({
        ...buildValidQdhIntakePayload(),
        owner_user_id: "owner-1",
      }),
    });
    const unsafeValue = await requestJson(server.baseUrl, "/quote-desk-hu/intake-requests", {
      method: "POST",
      auth: false,
      body: JSON.stringify(buildValidQdhIntakePayload({
        project_details: "OPENAI_API_KEY=sk-secretsecretsecretsecret",
      })),
    });

    assert.equal(missingService.status, 400);
    assert.equal(missingService.json.code, "qdh_requested_service_required");
    assert.equal(missingContact.status, 400);
    assert.equal(missingContact.json.code, "qdh_customer_contact_required");
    assert.equal(missingAcknowledgement.status, 400);
    assert.equal(missingAcknowledgement.json.code, "qdh_intake_acknowledgement_required");
    assert.equal(unsafeField.status, 400);
    assert.equal(unsafeField.json.code, "qdh_intake_field_not_allowed");
    assert.equal(unsafeValue.status, 400);
    assert.equal(unsafeValue.json.code, "qdh_intake_unsafe_value_rejected");
    assert.equal(createCalled, false);
  } finally {
    await server.close();
  }
});

test("QDH public intake create requires setup and creates request-only records safely", async () => {
  let createOptions = null;
  const server = await startServer(createApiApp({
    createAgentQuoteRequest: async (_supabase, options) => {
      createOptions = options;
      return {
        id: "request-1",
        ownerUserId: options.ownerUserId,
        agentId: options.agentId,
        businessId: options.businessId,
        status: options.status,
        sourceChannel: options.sourceChannel,
        metadata: options.metadata,
        evidence: options.evidence,
      };
    },
  }));

  try {
    const missingSetupServer = await startServer(createApiApp({
      getQuoteDeskHuSetup: async () => null,
      createAgentQuoteRequest: async () => {
        throw new Error("create should not be called");
      },
    }));
    try {
      const missingSetup = await requestJson(missingSetupServer.baseUrl, "/quote-desk-hu/intake-requests", {
        method: "POST",
        auth: false,
        body: JSON.stringify(buildValidQdhIntakePayload()),
      });
      assert.equal(missingSetup.status, 404);
      assert.equal(missingSetup.json.code, "qdh_intake_setup_required");
    } finally {
      await missingSetupServer.close();
    }

    const response = await requestJson(server.baseUrl, "/quote-desk-hu/intake-requests", {
      method: "POST",
      auth: false,
      body: JSON.stringify(buildValidQdhIntakePayload()),
    });
    const responseText = JSON.stringify(response.json);

    assert.equal(response.status, 201);
    assert.equal(response.json.product, "quote_desk_hu");
    assert.equal(response.json.phase, "customer_intake_request_only");
    assert.deepEqual(response.json.request, {
      status: "request_received",
      sourceChannel: "qdh_public_intake",
      receivedForStaffReview: true,
    });
    assert.match(response.json.message, /nem végleges vagy garantált árajánlat/i);
    assert.equal(createOptions.ownerUserId, "owner-1");
    assert.equal(createOptions.agentId, "agent-1");
    assert.equal(createOptions.businessId, "business-1");
    assert.equal(createOptions.sourceChannel, "qdh_public_intake");
    assert.equal(createOptions.displayMode, "qdh_public_intake");
    assert.equal(createOptions.status, "request_received");
    assert.equal(createOptions.statusReason, "QDH public intake request received for staff review only.");
    assert.deepEqual(createOptions.evidence, { proof_source_type: "request_only" });
    assert.equal(createOptions.metadata.product, "quote_desk_hu");
    assert.equal(createOptions.metadata.source, "qdh_public_intake");
    assert.equal(createOptions.metadata.request_only, true);
    assert.match(createOptions.idempotencyKey, /^qdh-intake:[a-f0-9]{32}$/);
    assert.doesNotMatch(responseText, /owner-1|agent-1|business-1|request-1/);
    assert.doesNotMatch(responseText, /metadata|evidence|package_key|policy|service_role|SUPABASE_SERVICE_ROLE|OPENAI_API_KEY|STRIPE_SECRET/i);
  } finally {
    await server.close();
  }
});

test("QDH public intake context exposes only safe business fields", async () => {
  const server = await startServer(createApiApp());

  try {
    const response = await requestJson(server.baseUrl, "/quote-desk-hu/intake-context?agent_key=valid-qdh-key", {
      method: "GET",
      auth: false,
    });
    const responseText = JSON.stringify(response.json);

    assert.equal(response.status, 200);
    assert.equal(response.json.product, "quote_desk_hu");
    assert.equal(response.json.phase, "customer_intake_request_only");
    assert.deepEqual(response.json.business, {
      businessName: "Példa Kft.",
      serviceType: "tetőfedés",
      serviceArea: "Budapest",
      servicesOffered: ["Tetőjavítás", "Bádogozás"],
    });
    assert.deepEqual(response.json.intake, {
      sourceChannel: "qdh_public_intake",
      requestOnly: true,
      staffReviewOnly: true,
    });
    assert.doesNotMatch(responseText, /owner-1|agent-1|business-1|valid-qdh-key/);
    assert.doesNotMatch(responseText, /ownerContactEmail|owner_contact_email|websiteUrl|website_url|metadata|evidence|package_key|policy/i);
    assert.doesNotMatch(responseText, /service_role|SUPABASE_SERVICE_ROLE|OPENAI_API_KEY|STRIPE_SECRET/i);
  } finally {
    await server.close();
  }
});

test("QDH AI intake assistant requires valid public routing context and rejects unsafe input", async () => {
  let setupCalled = false;
  const server = await startServer(createApiApp({
    getQuoteDeskHuSetup: async () => {
      setupCalled = true;
      return {
        ownerUserId: "owner-1",
        businessName: "Példa Kft.",
        websiteUrl: "https://pelda.hu",
        serviceType: "tetőfedés",
        serviceArea: "Budapest",
        handlingPreference: "staff_review",
        ownerContactEmail: "owner@example.hu",
        servicesOffered: ["Tetőjavítás", "Bádogozás"],
        setupStatus: "ready_for_review",
      };
    },
  }));

  try {
    const missingContext = await requestJson(server.baseUrl, "/quote-desk-hu/intake-assistant", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ message: "Tetőjavítás érdekel." }),
    });
    const invalidContext = await requestJson(server.baseUrl, "/quote-desk-hu/intake-assistant", {
      method: "POST",
      auth: false,
      body: JSON.stringify(buildCompleteQdhAiPayload({ agent_key: "bad-key" })),
    });
    const unsafeField = await requestJson(server.baseUrl, "/quote-desk-hu/intake-assistant", {
      method: "POST",
      auth: false,
      body: JSON.stringify({
        ...buildCompleteQdhAiPayload(),
        owner_user_id: "owner-1",
      }),
    });
    const unsafeNestedField = await requestJson(server.baseUrl, "/quote-desk-hu/intake-assistant", {
      method: "POST",
      auth: false,
      body: JSON.stringify(buildCompleteQdhAiPayload({
        fields: { owner_user_id: "owner-1" },
      })),
    });
    const unsafeValue = await requestJson(server.baseUrl, "/quote-desk-hu/intake-assistant", {
      method: "POST",
      auth: false,
      body: JSON.stringify(buildCompleteQdhAiPayload({
        message: "OPENAI_API_KEY=sk-secretsecretsecretsecret",
      })),
    });

    assert.equal(missingContext.status, 400);
    assert.equal(missingContext.json.code, "qdh_intake_agent_key_required");
    assert.equal(invalidContext.status, 404);
    assert.equal(invalidContext.json.code, "qdh_intake_link_unavailable");
    assert.equal(unsafeField.status, 400);
    assert.equal(unsafeField.json.code, "qdh_intake_field_not_allowed");
    assert.equal(unsafeNestedField.status, 400);
    assert.equal(unsafeNestedField.json.code, "qdh_intake_field_not_allowed");
    assert.equal(unsafeValue.status, 400);
    assert.equal(unsafeValue.json.code, "qdh_intake_unsafe_value_rejected");
    assert.equal(setupCalled, false);
  } finally {
    await server.close();
  }
});

test("QDH assistant adapter calls shared chat layer with QDH prompt context", async () => {
  let sharedOptions = null;
  const result = await generateQuoteDeskHuAssistantTurn({
    agent: {
      id: "agent-1",
      ownerUserId: "owner-1",
      businessId: "business-1",
      publicAgentKey: "valid-qdh-key",
      accessStatus: "active",
    },
    businessContext: {
      businessName: "Példa Kft.",
      serviceType: "tetőfedés",
      serviceArea: "Budapest",
      servicesOffered: ["Tetőjavítás", "Bádogozás"],
    },
    message: "Milyen szolgáltatásokat vállaltok?",
    conversation: [],
    fields: {},
  }, {
    generateSharedChatAssistantTurn: async (options) => {
      sharedOptions = options;
      return {
        usedSharedEngine: true,
        reply: "Tetőjavítást és bádogozást látok biztosan.\n\nMelyik szolgáltatás érdekel?",
      };
    },
  });

  assert.equal(result.conversationMode, "business_question");
  assert.equal(result.usedSharedChatEngine, true);
  assert.equal(result.fields.locationText, "");
  assert.match(result.assistantReply, /Tetőjavítást és bádogozást/i);
  assert.equal(sharedOptions.conversationSource, "quote_desk_hu_intake");
  assert.equal(sharedOptions.language, "Hungarian");
  assert.equal(sharedOptions.agentPackage.key, "quote_desk_hu");
  assert.match(sharedOptions.agentPackage.promptBlocks, /Quote Desk HU product layer/);
  assert.match(sharedOptions.fallbackWebsiteContent.content, /Felsorolt szolgáltatások: Tetőjavítás, Bádogozás/);
  assert.doesNotMatch(JSON.stringify(result), /owner-1|agent-1|business-1|package|policy|metadata|model|system prompt|developer message/i);
});

test("QDH business questions answer from safe setup context without forcing form completion", async () => {
  let createCalled = false;
  const server = await startServer(createApiApp({
    createAgentQuoteRequest: async () => {
      createCalled = true;
      return {};
    },
  }));

  try {
    const response = await requestJson(server.baseUrl, "/quote-desk-hu/intake-assistant", {
      method: "POST",
      auth: false,
      body: JSON.stringify({
        agent_key: "valid-qdh-key",
        message: "Milyen szolgáltatásokat vállaltok?",
        fields: {},
        conversation: [],
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.readyToSubmit, false);
    assert.equal(response.json.request, null);
    assert.match(response.json.assistant.reply, /Tetőjavítás, Bádogozás/);
    assert.doesNotMatch(response.json.assistant.reply, /add meg még|hiányzik|staff review|request-only|qdh_ai_intake/i);
    assert.equal(createCalled, false);
  } finally {
    await server.close();
  }
});

test("QDH unsupported service-area question stays grounded and asks one practical detail", async () => {
  const result = await generateQuoteDeskHuAssistantTurn({
    businessContext: {
      businessName: "Példa Kft.",
      serviceType: "tetőfedés",
      serviceArea: "Budapest",
      servicesOffered: ["Tetőjavítás", "Bádogozás"],
    },
    message: "Szegeden is vállaltok tetőjavítást?",
    conversation: [],
    fields: {},
  });

  assert.equal(result.conversationMode, "business_question");
  assert.equal(result.readyToSubmit, false);
  assert.match(result.assistantReply, /Budapest/);
  assert.match(result.assistantReply, /vállalkozás tudja megerősíteni|konkrét cím/i);
  assert.doesNotMatch(result.assistantReply, /igen|természetesen|biztosan vállal/i);
});

test("QDH follow-up answers complete quote readiness from bounded conversation history", async () => {
  const result = await generateQuoteDeskHuAssistantTurn({
    businessContext: {
      businessName: "Példa Kft.",
      serviceType: "tetőfedés",
      serviceArea: "Budapest",
      servicesOffered: ["Tetőjavítás", "Bádogozás"],
    },
    message: "Kovács Anna vagyok, anna@customer.hu.",
    conversation: [
      {
        role: "user",
        content: "Tetőjavításra kérek ajánlatot Budapesten. Beázik a tető a kémény mellett, jövő héten lenne jó.",
      },
      {
        role: "assistant",
        content: "Kérem, adja meg a nevét és egy elérhetőséget.",
      },
      {
        role: "user",
        content: "Kovács Anna vagyok, anna@customer.hu.",
      },
    ],
    fields: {},
  });

  assert.equal(result.readyToSubmit, true);
  assert.deepEqual(result.missingFields, []);
  assert.equal(result.fields.requestedService, "Tetőjavítás");
  assert.match(result.fields.projectDetails, /Beázik a tető/i);
  assert.equal(result.fields.locationText, "Budapest");
  assert.equal(result.fields.urgency, "Jövő héten");
  assert.equal(result.fields.customerName, "Kovács Anna");
  assert.equal(result.fields.customerEmail, "anna@customer.hu");
});

test("QDH AI intake assistant extracts Hungarian details without public leaks", async () => {
  let createCalled = false;
  const server = await startServer(createApiApp({
    createAgentQuoteRequest: async () => {
      createCalled = true;
      return {};
    },
  }));

  try {
    const response = await requestJson(server.baseUrl, "/quote-desk-hu/intake-assistant", {
      method: "POST",
      auth: false,
      body: JSON.stringify(buildCompleteQdhAiPayload()),
    });
    const responseText = JSON.stringify(response.json);

    assert.equal(response.status, 200);
    assert.equal(response.json.product, "quote_desk_hu");
    assert.equal(response.json.phase, "ai_customer_intake_request_only");
    assert.match(response.json.assistant.reply, /Minden szükséges adat megvan|staff review/i);
    assert.equal(response.json.extractedFields.requestedService, "Tetőjavítás");
    assert.match(response.json.extractedFields.projectDetails, /Beázik a tető/i);
    assert.equal(response.json.extractedFields.locationText, "Budapest");
    assert.equal(response.json.extractedFields.urgency, "Ezen a héten");
    assert.equal(response.json.extractedFields.customerName, "Kovács Anna");
    assert.equal(response.json.extractedFields.customerEmail, "anna@customer.hu");
    assert.deepEqual(response.json.missingFields, []);
    assert.equal(response.json.readyToSubmit, true);
    assert.equal(response.json.request, null);
    assert.equal(createCalled, false);
    assert.doesNotMatch(responseText, /owner-1|agent-1|business-1|valid-qdh-key|redacted-eval|request-1/);
    assert.doesNotMatch(responseText, /metadata|evidence|package_key|policy|system prompt|developer message|model|OPENAI_API_KEY|STRIPE_SECRET|SUPABASE_SERVICE_ROLE/i);
    assert.doesNotMatch(responseText, /végleges árat adok|garantált árat adok|árajánlat elküldve|whatsapp|provider/i);
  } finally {
    await server.close();
  }
});

test("QDH AI intake assistant recognizes contact-adjacent Hungarian names", async () => {
  const server = await startServer(createApiApp());

  try {
    const response = await requestJson(server.baseUrl, "/quote-desk-hu/intake-assistant", {
      method: "POST",
      auth: false,
      body: JSON.stringify(buildCompleteQdhAiPayload({
        message: "Tetőjavításra kérek ajánlatot. Beázik a tető a kémény mellett Budapesten, ezen a héten lenne sürgős. Kovács Anna, anna@customer.hu.",
      })),
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.extractedFields.customerName, "Kovács Anna");
    assert.equal(response.json.extractedFields.customerEmail, "anna@customer.hu");
    assert.deepEqual(response.json.missingFields, []);
    assert.equal(response.json.readyToSubmit, true);
    assert.equal(response.json.request, null);
  } finally {
    await server.close();
  }
});

test("QDH AI intake assistant asks for missing information instead of creating prematurely", async () => {
  let createCalled = false;
  const server = await startServer(createApiApp({
    createAgentQuoteRequest: async () => {
      createCalled = true;
      return {};
    },
  }));

  try {
    const response = await requestJson(server.baseUrl, "/quote-desk-hu/intake-assistant", {
      method: "POST",
      auth: false,
      body: JSON.stringify(buildCompleteQdhAiPayload({
        message: "Tetőjavításra kérek ajánlatot. Beázik a tető a kémény mellett, a nevem Kovács Anna.",
      })),
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.readyToSubmit, false);
    assert.ok(response.json.missingFields.includes("location_text"));
    assert.ok(response.json.missingFields.includes("urgency"));
    assert.ok(response.json.missingFields.includes("customer_contact"));
    assert.match(response.json.assistant.reply, /add meg|kérlek|kérem|hiányzó/i);
    const mentionedMissingLabels = ["város vagy helyszín", "sürgősség", "email vagy telefon"]
      .filter((label) => response.json.assistant.reply.toLowerCase().includes(label)).length;
    assert.ok(mentionedMissingLabels <= 1);
    assert.doesNotMatch(response.json.assistant.reply, /staff review|request-only|qdh_ai_intake|AI-assisted|Hiányos/i);
    assert.equal(response.json.request, null);
    assert.equal(createCalled, false);
  } finally {
    await server.close();
  }
});

test("QDH AI intake assistant aligns deterministic follow-up wording to webstudio context", async () => {
  const server = await startServer(createApiApp({
    getQuoteDeskHuSetup: async () => ({
      ownerUserId: "owner-1",
      businessName: "Web Műhely Kft.",
      websiteUrl: "https://webmuhely.hu",
      serviceType: "weboldal készítés és online marketing",
      serviceArea: "Budapest és online",
      handlingPreference: "staff_review",
      ownerContactEmail: "owner@example.hu",
      servicesOffered: ["Weboldal készítés", "Webshop fejlesztés", "Online marketing"],
      setupStatus: "ready_for_review",
    }),
  }));

  try {
    const response = await requestJson(server.baseUrl, "/quote-desk-hu/intake-assistant", {
      method: "POST",
      auth: false,
      body: JSON.stringify(buildCompleteQdhAiPayload({
        message: "Szeretnék weboldalt készíttetni.",
      })),
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.readyToSubmit, false);
    assert.ok(response.json.missingFields.includes("project_details"));
    assert.match(response.json.assistant.reply, /cél|meglévő anyagok|fontos funkciók|határidő/i);
    assert.doesNotMatch(response.json.assistant.reply, /tető|takarítás|garázskapu|staff review|request-only|qdh_ai_intake/i);
    assert.equal(response.json.request, null);
  } finally {
    await server.close();
  }
});

test("QDH AI intake assistant falls back safely when model output is invalid", async () => {
  const server = await startServer(createApiApp({
    getOpenAIClient: () => ({
      chat: {
        completions: {
          create: async () => ({
            choices: [
              {
                message: {
                  content: "not-json",
                },
              },
            ],
          }),
        },
      },
    }),
  }));

  try {
    const response = await requestJson(server.baseUrl, "/quote-desk-hu/intake-assistant", {
      method: "POST",
      auth: false,
      body: JSON.stringify(buildCompleteQdhAiPayload()),
    });
    const responseText = JSON.stringify(response.json);

    assert.equal(response.status, 200);
    assert.equal(response.json.readyToSubmit, true);
    assert.equal(response.json.extractedFields.requestedService, "Tetőjavítás");
    assert.match(response.json.assistant.reply, /Minden szükséges adat megvan|staff review/i);
    assert.doesNotMatch(responseText, /not-json|model|metadata|system prompt|developer message/i);
  } finally {
    await server.close();
  }
});

test("QDH AI intake assistant creates request-only records after explicit confirmation", async () => {
  let createOptions = null;
  const server = await startServer(createApiApp({
    createAgentQuoteRequest: async (_supabase, options) => {
      createOptions = options;
      return {
        id: "request-1",
        ownerUserId: options.ownerUserId,
        agentId: options.agentId,
        businessId: options.businessId,
        status: options.status,
        sourceChannel: options.sourceChannel,
      };
    },
  }));

  try {
    const missingConsent = await requestJson(server.baseUrl, "/quote-desk-hu/intake-assistant", {
      method: "POST",
      auth: false,
      body: JSON.stringify(buildCompleteQdhAiPayload({
        confirm_submit: true,
        consent_acknowledged: false,
      })),
    });
    const response = await requestJson(server.baseUrl, "/quote-desk-hu/intake-assistant", {
      method: "POST",
      auth: false,
      body: JSON.stringify(buildCompleteQdhAiPayload({
        confirm_submit: true,
        consent_acknowledged: true,
      })),
    });
    const responseText = JSON.stringify(response.json);

    assert.equal(missingConsent.status, 400);
    assert.equal(missingConsent.json.code, "qdh_intake_acknowledgement_required");
    assert.equal(response.status, 201);
    assert.deepEqual(response.json.request, {
      status: "request_received",
      sourceChannel: "qdh_ai_intake",
      receivedForStaffReview: true,
    });
    assert.equal(createOptions.ownerUserId, "owner-1");
    assert.equal(createOptions.agentId, "agent-1");
    assert.equal(createOptions.businessId, "business-1");
    assert.equal(createOptions.sourceChannel, "qdh_ai_intake");
    assert.equal(createOptions.displayMode, "qdh_ai_intake");
    assert.equal(createOptions.status, "request_received");
    assert.equal(createOptions.statusReason, "QDH AI-assisted intake request received for staff review only.");
    assert.equal(createOptions.evidence.proof_source_type, "request_only");
    assert.match(createOptions.evidence.qdh_ai_intake.staff_summary_hu, /AI intake összefoglaló|Tetőjavítás/i);
    assert.equal(createOptions.metadata.source, "qdh_ai_intake");
    assert.equal(createOptions.metadata.request_only, true);
    assert.match(createOptions.idempotencyKey, /^qdh-ai-intake:[a-f0-9]{32}$/);
    assert.doesNotMatch(JSON.stringify(createOptions.metadata), /final quote|guaranteed price|quote_sent/i);
    assert.doesNotMatch(responseText, /owner-1|agent-1|business-1|request-1|metadata|evidence|package_key|policy/i);
  } finally {
    await server.close();
  }
});

test("QDH request list is authenticated and passes owner scope to the quote service", async () => {
  const authError = new Error("Unauthorized");
  authError.statusCode = 401;
  let listOptions = null;
  const server = await startServer(createApiApp({
    getAuthenticatedUser: async (_supabase, req) => {
      if (!req.headers.authorization) {
        throw authError;
      }
      return { id: "owner-1", email: "owner@example.com" };
    },
    listAgentQuoteRequests: async (_supabase, options) => {
      listOptions = options;
      return [
        {
          id: "request-1",
          ownerUserId: options.ownerUserId,
          agentId: options.agentId,
          requestedService: "Tetőjavítás",
          sourceChannel: "qdh_public_intake",
          status: "request_received",
          createdAt: "2026-06-04T08:00:00.000Z",
        },
        {
          id: "request-final",
          ownerUserId: options.ownerUserId,
          agentId: options.agentId,
          requestedService: "Proof-backed external quote",
          status: "quoted_externally",
          createdAt: "2026-06-04T09:00:00.000Z",
        },
      ];
    },
  }));

  try {
    const unauthenticated = await requestJson(server.baseUrl, "/quote-desk-hu/requests", {
      auth: false,
    });
    const authenticated = await requestJson(
      server.baseUrl,
      "/quote-desk-hu/requests?agent_id=agent-1&status=request_received&limit=20&client_id=client-1"
    );

    assert.equal(unauthenticated.status, 401);
    assert.equal(unauthenticated.json.error, "Unauthorized");
    assert.equal(authenticated.status, 200);
    assert.equal(authenticated.json.product, "quote_desk_hu");
    assert.equal(authenticated.json.phase, "request_intake_review");
    assert.deepEqual(authenticated.json.safeStatuses, [
      "needs_info",
      "needs_staff_review",
      "declined",
      "archived",
    ]);
    assert.deepEqual(authenticated.json.visibleStatuses, [
      "request_received",
      "needs_info",
      "needs_staff_review",
      "declined",
      "archived",
    ]);
    assert.equal(authenticated.json.summary.total, 1);
    assert.deepEqual(authenticated.json.records.map((record) => record.id), ["request-1"]);
    assert.equal(authenticated.json.records[0].sourceChannel, "qdh_public_intake");
    assert.equal(authenticated.json.records[0].status, "request_received");
    assert.deepEqual(listOptions, {
      ownerUserId: "owner-1",
      agentId: "agent-1",
      status: "request_received",
      limit: "20",
    });
  } finally {
    await server.close();
  }
});

test("QDH request list rejects final lifecycle status filters", async () => {
  let listCalled = false;
  const server = await startServer(createApiApp({
    listAgentQuoteRequests: async () => {
      listCalled = true;
      return [];
    },
  }));

  try {
    const response = await requestJson(server.baseUrl, "/quote-desk-hu/requests?status=quoted_externally");

    assert.equal(response.status, 400);
    assert.equal(response.json.code, "qdh_status_not_allowed");
    assert.equal(listCalled, false);
  } finally {
    await server.close();
  }
});

test("QDH request list rejects agent filters outside owner access", async () => {
  let listCalled = false;
  const server = await startServer(createApiApp({
    listAgentQuoteRequests: async () => {
      listCalled = true;
      return [];
    },
  }));

  try {
    const response = await requestJson(server.baseUrl, "/quote-desk-hu/requests?agent_id=agent-2");

    assert.equal(response.status, 403);
    assert.equal(response.json.error, "Forbidden");
    assert.equal(listCalled, false);
  } finally {
    await server.close();
  }
});

test("QDH status route uses quote request service rules but only exposes safe review states", async () => {
  const updateCalls = [];
  const server = await startServer(createApiApp({
    updateAgentQuoteRequestStatus: async (_supabase, options) => {
      updateCalls.push(options);
      return {
        id: options.requestId,
        ownerUserId: options.ownerUserId,
        status: options.status,
        statusReason: options.statusReason || null,
        staffNotes: options.staffNotes || null,
      };
    },
  }));

  try {
    const allowed = await requestJson(server.baseUrl, "/quote-desk-hu/requests/status", {
      method: "POST",
      body: JSON.stringify({
        request_id: "request-1",
        status: "needs_info",
        status_reason: "Hiányzik a pontos helyszín.",
        staff_notes: "Kérjünk fotót.",
      }),
    });
    const finalSent = await requestJson(server.baseUrl, "/quote-desk-hu/requests/status", {
      method: "POST",
      body: JSON.stringify({
        request_id: "request-1",
        status: "quoted_externally",
      }),
    });
    const finalAccepted = await requestJson(server.baseUrl, "/quote-desk-hu/requests/status", {
      method: "POST",
      body: JSON.stringify({
        request_id: "request-1",
        status: "accepted_externally",
      }),
    });
    const requestReceived = await requestJson(server.baseUrl, "/quote-desk-hu/requests/status", {
      method: "POST",
      body: JSON.stringify({
        request_id: "request-1",
        status: "request_received",
      }),
    });

    assert.equal(allowed.status, 200);
    assert.equal(allowed.json.request.status, "needs_info");
    assert.deepEqual(updateCalls, [
      {
        ownerUserId: "owner-1",
        requestId: "request-1",
        status: "needs_info",
        statusReason: "Hiányzik a pontos helyszín.",
        staffNotes: "Kérjünk fotót.",
      },
    ]);
    assert.equal(finalSent.status, 400);
    assert.equal(finalSent.json.code, "qdh_status_not_allowed");
    assert.equal(finalAccepted.status, 400);
    assert.equal(finalAccepted.json.code, "qdh_status_not_allowed");
    assert.equal(requestReceived.status, 400);
    assert.equal(requestReceived.json.code, "qdh_status_not_allowed");
    assert.equal(updateCalls.length, 1);
  } finally {
    await server.close();
  }
});
