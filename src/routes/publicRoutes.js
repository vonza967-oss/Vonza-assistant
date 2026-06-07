import express from "express";
import { readFileSync } from "node:fs";
import path from "path";
import {
  getAppVersion,
  getBuildSha,
  getPublicAppUrl,
  getRagConfig,
  getSupabaseAnonKey,
  getSupabasePublicUrl,
  isTodayCopilotEnabled,
  isOperatorWorkspaceV1Enabled,
  isLocalDevBillingRequestAllowed,
} from "../config/env.js";
import {
  BILLING_USAGE_COPY,
  listPublicBillingPlans,
} from "../config/billingPlans.js";
import { getPublicLaunchProfile } from "../config/publicLaunch.js";
import { renderLegalPage } from "../config/legalContent.js";
import {
  createRateLimitMiddleware,
  getDistributedRateLimitReadiness,
} from "../utils/rateLimiter.js";
import { cleanText } from "../utils/text.js";
import { getReadinessStatus } from "../services/operations/readinessService.js";
import { generateEnterpriseRequestDeskAssistantTurn } from "../services/enterprise/enterpriseRequestDeskAssistantService.js";
import { resolveEnterpriseRequestDeskProfile } from "../services/enterprise/enterpriseRequestDeskProfileService.js";

const SETUP_DOCTOR_KEYS = [
  "PUBLIC_APP_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_PRICE_ID_STARTER_MONTHLY",
  "STRIPE_PRICE_ID_GROWTH_MONTHLY",
  "STRIPE_PRICE_ID_PRO_MONTHLY",
  "STRIPE_WEBHOOK_SECRET",
];

function getDashboardAssetVersion() {
  return encodeURIComponent(getBuildSha() || getAppVersion() || "local-dev");
}

function setDashboardNoStoreHeaders(res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  res.setHeader("Pragma", "no-cache");
}

function isLocalDashboardFixtureAllowed(req) {
  if (String(process.env.NODE_ENV || "").trim().toLowerCase() === "production") {
    return false;
  }

  const host = String(req?.hostname || req?.headers?.host || "").split(":")[0].trim().toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1" || host.endsWith(".local");
}

function renderDashboardDocument(rootDir, { localFixture = false } = {}) {
  const version = getDashboardAssetVersion();
  let html = readFileSync(path.join(rootDir, "dashboard.html"), "utf8");

  [
    "/dashboard.css",
    "/dashboard-customers.css",
    "/dashboard-install.css",
    "/dashboard-analytics.css",
    "/dashboard-front-desk.css",
    "/settings/settings.css",
    "/dashboard-glass.css",
    "/public-config.js",
    "/i18n/dashboardI18n.js",
    "/settings/SettingsShell.js",
    "/dashboardHelpers.js",
    "/dashboardState.js",
    "/dashboardLabels.js",
    "/dashboardInstall.js",
    "/dashboardFrontDesk.js",
    "/dashboardCustomers.js",
    "/dashboardAnalytics.js",
    "/dashboardToday.js",
    "/dashboard.js",
  ].forEach((assetPath) => {
    html = html.replaceAll(
      `${assetPath}"`,
      `${assetPath}?v=${version}"`
    );
  });

  if (localFixture) {
    html = html.replace(
      '<script src="/dashboard.js',
      '<script>window.VONZA_LOCAL_DASHBOARD_FIXTURE = true;</script>\n  <script src="/dashboard.js'
    );
  }

  return html;
}

function renderQuoteDeskHuDashboardDocument(rootDir, { localFixture = false } = {}) {
  const version = getDashboardAssetVersion();
  let html = readFileSync(path.join(rootDir, "frontend", "qdh-dashboard.html"), "utf8");

  [
    "/qdh-dashboard.css",
    "/public-config.js",
    "/supabase-auth.js",
    "/qdh-dashboard.js",
  ].forEach((assetPath) => {
    html = html.replaceAll(
      `${assetPath}"`,
      `${assetPath}?v=${version}"`
    );
  });

  if (localFixture) {
    html = html.replace(
      '<script src="/qdh-dashboard.js',
      '<script>window.VONZA_LOCAL_QDH_FIXTURE = true;</script>\n  <script src="/qdh-dashboard.js'
    );
  }

  return html;
}

function renderQuoteDeskHuSetupDocument(rootDir) {
  const version = getDashboardAssetVersion();
  let html = readFileSync(path.join(rootDir, "frontend", "qdh-setup.html"), "utf8");

  [
    "/qdh-product.css",
    "/public-config.js",
    "/supabase-auth.js",
    "/qdh-setup.js",
  ].forEach((assetPath) => {
    html = html.replaceAll(
      `${assetPath}"`,
      `${assetPath}?v=${version}"`
    );
  });

  return html;
}

function renderQuoteDeskHuIntakeDocument(rootDir, { localFixture = false } = {}) {
  const version = getDashboardAssetVersion();
  let html = readFileSync(path.join(rootDir, "frontend", "qdh-intake.html"), "utf8");

  [
    "/qdh-product.css",
    "/qdh-intake.js",
  ].forEach((assetPath) => {
    html = html.replaceAll(
      `${assetPath}"`,
      `${assetPath}?v=${version}"`
    );
  });

  if (localFixture) {
    html = html.replace(
      '<script src="/qdh-intake.js',
      '<script>window.VONZA_LOCAL_QDH_INTAKE_FIXTURE = true;</script>\n  <script src="/qdh-intake.js'
    );
  }

  return html;
}

function renderEnterpriseRequestDeskDemoDocument(rootDir) {
  const version = getDashboardAssetVersion();
  let html = readFileSync(path.join(rootDir, "frontend", "enterprise-request-desk-demo.html"), "utf8");

  [
    "/enterprise-request-desk-demo.css",
    "/enterprise-request-desk-demo.js",
  ].forEach((assetPath) => {
    html = html.replaceAll(
      `${assetPath}"`,
      `${assetPath}?v=${version}"`
    );
  });

  return html;
}

function renderEnterpriseRequestDeskIntakeDocument(rootDir, { localFixture = false } = {}) {
  const version = getDashboardAssetVersion();
  let html = readFileSync(path.join(rootDir, "frontend", "enterprise-request-desk-intake.html"), "utf8");

  [
    "/enterprise-request-desk.css",
    "/enterprise-request-desk-profile.js",
    "/enterprise-request-desk-intake.js",
  ].forEach((assetPath) => {
    html = html.replaceAll(
      `${assetPath}"`,
      `${assetPath}?v=${version}"`
    );
  });

  if (localFixture) {
    html = html.replace(
      '<script src="/enterprise-request-desk-intake.js',
      '<script>window.VONZA_LOCAL_ENTERPRISE_INTAKE_FIXTURE = true;</script>\n  <script src="/enterprise-request-desk-intake.js'
    );
  }

  return html;
}

function renderEnterpriseRequestDeskDashboardDocument(rootDir, { localFixture = false, localFixtureMode = "" } = {}) {
  const version = getDashboardAssetVersion();
  let html = readFileSync(path.join(rootDir, "frontend", "enterprise-request-desk-dashboard.html"), "utf8");

  [
    "/enterprise-request-desk.css",
    "/enterprise-request-desk-profile.js",
    "/public-config.js",
    "/supabase-auth.js",
    "/enterprise-request-desk-dashboard.js",
  ].forEach((assetPath) => {
    html = html.replaceAll(
      `${assetPath}"`,
      `${assetPath}?v=${version}"`
    );
  });

  if (localFixture) {
    const fixtureModeScript = localFixtureMode
      ? `\n  <script>window.VONZA_LOCAL_ENTERPRISE_DASHBOARD_FIXTURE_MODE = ${JSON.stringify(localFixtureMode)};</script>`
      : "";
    html = html.replace(
      '<script src="/enterprise-request-desk-dashboard.js',
      `<script>window.VONZA_LOCAL_ENTERPRISE_DASHBOARD_FIXTURE = true;</script>${fixtureModeScript}\n  <script src="/enterprise-request-desk-dashboard.js`
    );
  }

  return html;
}

function renderEnterpriseRequestDeskSetupDocument(rootDir) {
  const version = getDashboardAssetVersion();
  let html = readFileSync(path.join(rootDir, "frontend", "enterprise-request-desk-setup.html"), "utf8");

  [
    "/enterprise-request-desk.css",
    "/enterprise-request-desk-profile.js",
    "/public-config.js",
    "/supabase-auth.js",
    "/enterprise-request-desk-setup.js",
  ].forEach((assetPath) => {
    html = html.replaceAll(
      `${assetPath}"`,
      `${assetPath}?v=${version}"`
    );
  });

  return html;
}

function applyEnterpriseRequestDeskDocumentProfile(html, profile) {
  if (profile?.key !== "esg") {
    return html;
  }

  return html
    .replaceAll("Enterprise Request Desk", "ESG Request Desk")
    .replaceAll("Enterprise Megkereséskezelő", "ESG Megkereséskezelő")
    .replaceAll("Vállalati intake pult", "Objektumvédelem, FM, biztonságtechnika")
    .replaceAll("Vállalati megkeresések feldolgozási felülete", "ESG megkeresések feldolgozási felülete")
    .replaceAll("Setup vállalati objektumvédelmi, FM és biztonságtechnikai megkeresésekhez.", "ESG intake pult beállítása objektumvédelmi, FM és biztonságtechnikai megkeresésekhez.")
    .replaceAll("Beérkező security, FM és compliance jellegű kérések", "Beérkező objektumvédelmi, FM, biztonságtechnikai és hatósági/audit jellegű megkeresések")
    .replaceAll("Vállalati biztonsági, facility management és compliance megkeresések", "ESG objektumvédelmi, Facility Management, biztonságtechnikai és hatósági/audit megkeresések")
    .replaceAll("Megkeresés előszűrése belső feldolgozáshoz.", "ESG megkeresés pontosítása strukturált áttekintéshez.")
    .replaceAll('href="/enterprise-request-desk', 'href="/esg-request-desk')
    .replaceAll('href="/esg-request-desk.css', 'href="/enterprise-request-desk.css')
    .replaceAll('content="Enterprise Request Desk', 'content="ESG Request Desk')
    .replaceAll('aria-label="Enterprise Request Desk', 'aria-label="ESG Request Desk');
}

const ENTERPRISE_REQUEST_DESK_DEMO_CONTEXT = Object.freeze({
  businessName: "ESG Holding Zrt.",
  serviceArea: "országos, Budapest központtal",
  serviceTypes: Object.freeze([
    "őrzés-védelem",
    "portaszolgálat / objektumvédelem",
    "facility management",
    "biztonságtechnika",
    "audit / compliance",
  ]),
});

const ENTERPRISE_REQUEST_DESK_DEMO_MESSAGE_LIMIT = 1800;
const ENTERPRISE_REQUEST_DESK_DEMO_MISSING_FIELD_LABELS_HU = Object.freeze({
  service_need: "szolgáltatási igény",
  location_or_site: "helyszín vagy objektum",
  urgency_or_timing: "időzítés vagy sürgősség",
  contact_need: "biztonságos kapcsolati adat",
});
const ENTERPRISE_REQUEST_DESK_DEMO_CONFIDENCE_LABELS_HU = Object.freeze({
  high: "magas",
  medium: "közepes",
  low: "alacsony",
});
const limitEnterpriseRequestDeskDemo = createRateLimitMiddleware("public_enterprise_request_desk_demo", {
  windowMs: 60_000,
  max: 10,
});

function labelEnterpriseRequestDeskMissingFields(fields = []) {
  return fields
    .map((field) => ENTERPRISE_REQUEST_DESK_DEMO_MISSING_FIELD_LABELS_HU[field] || "")
    .filter(Boolean);
}

function extractEnterpriseRequestDeskDemoQuestion(reply = "") {
  const normalized = cleanText(reply);
  const question = normalized.match(/(?:^|[.!?\n]\s*)([^.!?\n][^?\n]{8,220}\?)/u)?.[1];

  return cleanText(question || "");
}

function buildEnterpriseRequestDeskDemoFallbackQuestion(missingFields = []) {
  const firstMissing = missingFields[0];

  if (firstMissing === "service_need") {
    return "Melyik szolgáltatási területhez kapcsolódik a megkeresés?";
  }

  if (firstMissing === "location_or_site") {
    return "Melyik településen vagy helyszínen lenne a feladat, és milyen típusú objektumról van szó?";
  }

  if (firstMissing === "urgency_or_timing") {
    return "Mikor indulna a feladat, vagy meddig kell visszajelzést kapniuk?";
  }

  if (firstMissing === "contact_need") {
    return "Milyen biztonságos elérhetőségen kérhetnek visszajelzést?";
  }

  return "Van még olyan helyszíni vagy szervezeti részlet, amit a belső csapatnak látnia kell?";
}

function buildEnterpriseRequestDeskDemoHandoffNote(result = {}) {
  const brief = result.structuredBrief || {};

  if (brief.readyForOwnerReview) {
    return "A minimális intake adatok megvannak; a belső csapat ellenőrizheti a vállalhatóságot és a következő lépést.";
  }

  if (brief.safetyFlags?.pricingGuaranteeRequested) {
    return "Ár- vagy garanciakérés szerepel a megkeresésben; ezt csak belső ellenőrzés után szabad kezelni.";
  }

  if (brief.safetyFlags?.deferredOperationsRequested) {
    return "A demó nem indít operatív műveletet; előbb a megkeresés pontosítása szükséges.";
  }

  return "Előszűrt belső brief; a hiányzó adatok tisztázása után adható tovább feldolgozásra.";
}

function buildEnterpriseRequestDeskDemoPayload(result = {}) {
  const brief = result.structuredBrief || {};
  const missingFields = Array.isArray(result.missingFields) ? result.missingFields : [];
  const missingFieldLabels = labelEnterpriseRequestDeskMissingFields(missingFields);
  const recommendedQuestion =
    extractEnterpriseRequestDeskDemoQuestion(result.assistantReply)
    || buildEnterpriseRequestDeskDemoFallbackQuestion(missingFields);

  return {
    surface: "ESG Request Desk demo",
    pilotScope: "belső demo intake",
    lane: {
      labelHu: cleanText(brief.laneLabelHu) || "Általános érdeklődés",
      confidenceHu: ENTERPRISE_REQUEST_DESK_DEMO_CONFIDENCE_LABELS_HU[brief.confidence] || "alacsony",
    },
    missingFields: missingFieldLabels,
    readyForInternalReview: brief.readyForOwnerReview === true,
    brief: {
      lane: cleanText(brief.laneLabelHu) || "Általános érdeklődés",
      siteLocation: cleanText(brief.locationOrSite) || "Nincs megadva",
      serviceNeed: cleanText(brief.serviceNeed) || "Nincs megadva",
      timingUrgency: cleanText(brief.urgencyOrTiming) || "Nincs megadva",
      contactNeeded: cleanText(brief.contactNeed) || "Kapcsolati adat hiányzik a visszajelzéshez.",
      missingFields: missingFieldLabels,
      recommendedNextQuestion: recommendedQuestion,
      handoffNote: buildEnterpriseRequestDeskDemoHandoffNote(result),
    },
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderMarketingPricingSection(locale = "en") {
  const plans = listPublicBillingPlans();
  const isHu = locale === "hu";

  return `
      <section id="pricing" class="section pricing-section">
        <div class="section-intro" data-reveal>
          <p class="eyebrow">${escapeHtml(isHu ? "Beta hozzáférés" : BILLING_USAGE_COPY.sectionEyebrow)}</p>
          <h2>${escapeHtml(isHu ? "Egyszerű havi csomagok a Front Desk indulásához." : BILLING_USAGE_COPY.sectionHeadline)}</h2>
          <p class="section-copy">${escapeHtml(isHu ? "Válaszd ki azt a havi kapacitást, amely elég a magyar beta induláshoz. A csomagok a dashboardból kezelhetők." : BILLING_USAGE_COPY.sectionNote)}</p>
        </div>

        <div class="pricing-grid">
          ${plans.map((plan) => `
            <article class="pricing-plan${plan.recommended ? " pricing-plan-featured" : ""}" data-reveal>
              ${plan.recommended ? `<span class="pricing-plan-badge">${escapeHtml(isHu ? "Legnépszerűbb" : "Most popular")}</span>` : ""}
              <div class="pricing-plan-header">
                <div>
                  <h3>${escapeHtml(plan.displayName)}</h3>
                  <p class="pricing-plan-audience">${escapeHtml(plan.marketing.audience)}</p>
                </div>
                <div class="pricing-plan-price">
                  <strong>${escapeHtml(plan.monthlyPriceLabel)}</strong>
                  <span>${escapeHtml(isHu ? "Havi csomag" : "Monthly plan")}</span>
                </div>
              </div>
              <p class="pricing-plan-summary">${escapeHtml(isHu ? `${plan.displayName} csomag kisvállalkozásoknak, amelyek AI Front Desk oldalt indítanak.` : plan.marketing.summary)}</p>
              <p class="pricing-plan-detail">${escapeHtml(isHu ? "Tartalmazza a Front Desk oldalt, telepítési útmutatót, beszélgetéseket, javítási kört és alap elemzéseket." : plan.marketing.detail)}</p>
              <ul class="pricing-plan-features" aria-label="${escapeHtml(plan.displayName)} plan features">
                ${(isHu
                  ? [
                    "Publikus AI Front Desk oldal",
                    "WordPress, QR, link vagy beágyazás",
                    "Dashboard ügyfelekhez és beszélgetésekhez",
                    "Jóváhagyott válaszok és javítási kör",
                  ]
                  : plan.sharedFeatures
                ).map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}
                <li>${escapeHtml(isHu ? plan.marketing.capacityLabel.replace("included AI messages", "AI üzenet havonta") : plan.marketing.capacityLabel)}</li>
              </ul>
              <a
                class="button ${plan.recommended ? "button-primary" : "button-secondary"}"
                data-app-link
                data-plan-key="${escapeHtml(plan.key)}"
                href="/dashboard?from=site&amp;plan=${escapeHtml(plan.key)}"
              >${escapeHtml(isHu ? "Indítás ezzel a csomaggal" : plan.checkoutLabel)}</a>
            </article>
          `).join("")}
        </div>
      </section>
  `;
}

function renderQuoteDeskHuAcquisitionPage() {
  return `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quote Desk HU | Ajánlatkérési pult magyar vállalkozásoknak</title>
  <meta name="description" content="Quote Desk HU strukturált ajánlatkérési intake és review felület magyar vállalkozásoknak.">
  <link rel="stylesheet" href="/qdh-product.css">
</head>
<body>
  <main class="qdh-site">
    <header class="qdh-site-header">
      <a class="qdh-site-brand" href="/qdh" aria-label="Quote Desk HU">
        <span class="qdh-site-mark" aria-hidden="true">Q</span>
        <span>
          <strong>Quote Desk HU</strong>
          <span>Ajánlatkérési pult</span>
        </span>
      </a>
      <nav class="qdh-site-nav" aria-label="Quote Desk HU hozzáférés">
        <a class="qdh-link" href="/qdh/dashboard">Belépés QDH fiókkal</a>
        <a class="qdh-button qdh-button-primary" href="/qdh/setup">QDH indítása</a>
      </nav>
    </header>

    <section class="qdh-hero">
      <div class="qdh-hero-copy">
        <h1>Ajánlatkérés, amit a csapatod tényleg fel tud dolgozni.</h1>
        <p class="qdh-hero-text">A Quote Desk HU a statikus “Kérjen ajánlatot” űrlap helyett strukturált ügyféladatokat, hiányzó információs jelzéseket és külön tulajdonosi review dashboardot ad magyar vállalkozásoknak.</p>
        <div class="qdh-hero-actions">
          <a class="qdh-button qdh-button-primary" href="/qdh/setup">QDH indítása</a>
          <a class="qdh-button" href="/qdh/dashboard">Belépés QDH fiókkal</a>
        </div>
        <div class="qdh-scope-note">
          <strong>Request intake és review fázis.</strong>
          <span>A QDH nem ígér automatikus végső árat, nem küld ajánlatot az ügyfélnek, és nem hív külső szolgáltatókat. A végső döntést a vállalkozás hozza meg.</span>
        </div>
      </div>
      <div class="qdh-hero-panel" aria-label="Quote Desk HU működési előnézet">
        <div class="qdh-panel-top">
          <div class="qdh-panel-title">
            <strong>QDH dashboard előnézet</strong>
            <span>Beérkező ajánlatkérések review állapotban</span>
          </div>
          <span class="qdh-status-pill">Request-only</span>
        </div>
        <div class="qdh-request-preview">
          ${[
            ["Tetőjavítás", "Budapest XI. · beázás a kémény mellett, helyszíni felmérés szükséges", "Új"],
            ["Klíma karbantartás", "Szeged · három beltéri egység, készüléktípus hiányzik", "Hiányzó adat"],
            ["Weboldal átalakítás", "Pécs · szolgáltatási kör és határidő staff review alatt", "Ellenőrzés alatt"],
          ].map(([title, copy, status]) => `
            <div class="qdh-preview-row">
              <div>
                <strong>${escapeHtml(title)}</strong>
                <span>${escapeHtml(copy)}</span>
              </div>
              <em>${escapeHtml(status)}</em>
            </div>
          `).join("")}
        </div>
        <div class="qdh-panel-footer" aria-label="QDH határok">
          <span>Nincs végső árképzés</span>
          <span>Nincs külső küldés</span>
          <span>Owner-scoped review</span>
        </div>
      </div>
    </section>

    <div class="qdh-content">
      <section class="qdh-section">
        <div>
          <h2>Mi változik a régi ajánlatkérő űrlaphoz képest?</h2>
          <p>A QDH a beérkező kéréseket nem egyetlen szabad szöveges mezőként kezeli. A tulajdonos olyan adatokat kap, amelyekből el lehet dönteni, mire kell visszakérdezni és mikor készülhet emberi ajánlat.</p>
        </div>
        <ul class="qdh-step-list">
          ${[
            ["Strukturált intake", "Szolgáltatás, helyszín, sürgősség, keret, kapcsolat és projektleírás külön mezőben."],
            ["Biztonságos review állapotok", "Új, hiányzó adat, ellenőrzés alatt, elutasított vagy archivált kérés."],
            ["Külön QDH dashboard", "A QDH nem a generikus Vonza dashboard egyik kártyája, hanem önálló termékfelület."],
          ].map(([title, copy]) => `
            <li><strong>${escapeHtml(title)}</strong><span>${escapeHtml(copy)}</span></li>
          `).join("")}
        </ul>
      </section>

      <section class="qdh-section">
        <div>
          <h2>Hogyan indul az önkiszolgáló hozzáférés?</h2>
          <p>A setup a minimális üzleti konfigurációt menti tulajdonosi auth alatt. Ez előkészíti a QDH dashboardot, miközben az éles assistant telepítés és üzleti összekötés külön kontrollált lépés marad.</p>
        </div>
        <ul class="qdh-step-list">
          ${[
            ["1. QDH hozzáférés", "Bejelentkezés, fiók indítása vagy varázslink a meglévő Supabase auth folyamaton keresztül."],
            ["2. Setup adatok", "Vállalkozás neve, weboldal, szolgáltatási típus, terület, kezelési mód, email és szolgáltatások."],
            ["3. Ügyféloldali link", "A dashboard megmutatja a /qdh/intake?agent_key=... mintájú linket, amit a weboldali “Kérjen ajánlatot” gomb mögé lehet tenni."],
            ["4. QDH dashboard", "A tulajdonos a külön /qdh/dashboard felületre érkezik, ahol a kérések és setup állapot látszik."],
          ].map(([title, copy]) => `
            <li><strong>${escapeHtml(title)}</strong><span>${escapeHtml(copy)}</span></li>
          `).join("")}
        </ul>
      </section>

      <section class="qdh-section">
        <div>
          <h2>Jelenlegi termékhatárok.</h2>
          <p>A copy és a vezérlők nem állítanak olyat, amit a rendszer nem csinál. A QDH ebben a fázisban ajánlatkérést gyűjt és előkészít.</p>
        </div>
        <ul class="qdh-boundary-list">
          ${[
            ["Nem automatikus ajánlatképző", "Nem számol garantált végső árat és nem állítja, hogy ajánlatot küldött."],
            ["Nem külső küldő rendszer", "Nincs email, WhatsApp vagy provider call a QDH önkiszolgáló setupban."],
            ["Nem widget-függő", "A weboldali widget továbbra is másodlagos Vonza felület; a QDH külön útvonalon fut."],
          ].map(([title, copy]) => `
            <li><strong>${escapeHtml(title)}</strong><span>${escapeHtml(copy)}</span></li>
          `).join("")}
        </ul>
      </section>

      <section class="qdh-final">
        <div>
          <h2>Indíts QDH setupot a saját vállalkozásodra.</h2>
          <p>A hozzáférés a meglévő auth rendszert használja, a setup pedig owner-scoped rekordként mentődik. A dashboard külön QDH termékfelület marad.</p>
        </div>
        <div class="qdh-final-actions">
          <a class="qdh-button qdh-button-primary" href="/qdh/setup">QDH indítása</a>
          <a class="qdh-button" href="/qdh/dashboard">Dashboard</a>
        </div>
      </section>
    </div>
  </main>
</body>
</html>`;
}

function renderEnterpriseRequestDeskAcquisitionPage() {
  return `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enterprise Request Desk | Vállalati megkeresési pult</title>
  <meta name="description" content="Enterprise Request Desk vállalati objektumvédelmi, facility management és biztonságtechnikai megkeresések előszűréséhez és strukturált belső továbbításához.">
  <link rel="stylesheet" href="/enterprise-request-desk.css">
</head>
<body>
  <main class="erdp-site">
    <header class="erdp-site-header">
      <a class="erdp-public-brand" href="/enterprise-request-desk" aria-label="Enterprise Request Desk">
        <span class="erdp-mark" aria-hidden="true">E</span>
        <span>
          <strong>Enterprise Request Desk</strong>
          <small>Vállalati intake pult</small>
        </span>
      </a>
      <nav class="erdp-site-nav" aria-label="Enterprise Request Desk hozzáférés">
        <a class="erdp-button" href="/enterprise-request-desk/dashboard">Dashboard</a>
        <a class="erdp-button erdp-button-primary" href="/enterprise-request-desk/setup">Setup indítása</a>
      </nav>
    </header>

    <section class="erdp-site-stage">
      <div class="erdp-hero-copy">
        <h1>Enterprise Request Desk.</h1>
        <p class="erdp-hero-text">Vállalati objektumvédelmi, Facility Management, biztonságtechnikai és hatósági/audit megkeresések előszűrése egy külön termékfelületen. Nem generikus chatbot: strukturált adatokból készít belső összefoglalót a feldolgozáshoz.</p>
        <div class="erdp-site-actions">
          <a class="erdp-button erdp-button-primary" href="/enterprise-request-desk/setup">Setup indítása</a>
          <a class="erdp-button" href="/enterprise-request-desk/dashboard">Belépés dashboardra</a>
        </div>
        <div class="erdp-scope-note">
          <strong>Kontrollált intake és belső feldolgozás.</strong>
          <span>Az Enterprise Request Desk nem készít végleges árat, szerződést, hatósági/audit anyagot vagy operatív ticketet. A végső döntést és választ a belső csapat kezeli.</span>
        </div>
      </div>

      <div class="erdp-product-panel" aria-label="Enterprise Request Desk működési előnézet">
        <div class="erdp-product-panel-top">
          <div>
            <strong>Megkeresések előszűrése</strong>
            <span>Őrzés-védelem, portaszolgálat, objektumvédelem, FM, biztonságtechnika és hatósági/audit jellegű igények.</span>
          </div>
          <span class="erdp-product-status">Setup után aktív</span>
        </div>
        <div class="erdp-preview-list">
          ${[
            ["Portaszolgálat", "Budapest XI. · irodaház beléptetés és recepciós jelenlét", "Összefoglaló kész"],
            ["Facility Management", "Több telephely · karbantartás és takarítás egyeztetése", "Kapcsolat tisztázva"],
            ["Biztonságtechnika", "Kamera és beléptető felmérés · indulási időzítés hiányzik", "Visszakérdezés"],
          ].map(([title, copy, status]) => `
            <div class="erdp-preview-row">
              <div>
                <strong>${escapeHtml(title)}</strong>
                <span>${escapeHtml(copy)}</span>
              </div>
              <em>${escapeHtml(status)}</em>
            </div>
          `).join("")}
        </div>
        <div class="erdp-product-panel-footer" aria-label="Enterprise Request Desk határok">
          <span>Előszűrés</span>
          <span>Összefoglaló</span>
          <span>Belső továbbítás</span>
        </div>
      </div>
    </section>

    <div class="erdp-site-content">
      <section class="erdp-site-section">
        <div>
          <h2>Mire való?</h2>
          <p>Olyan szervezeteknek készült, ahol a beérkező vállalati megkeresésből előbb biztonságos, áttekinthető összefoglaló kell a csapatnak.</p>
        </div>
        <ul class="erdp-step-list">
          ${[
            ["Minősített intake", "Szolgáltatási igény, helyszín vagy objektum, sürgősség és kapcsolati út külön értelmezve."],
            ["Strukturált belső továbbítás", "A dashboard összefoglalót, hiányzó adatot és belső feldolgozási állapotot mutat."],
            ["Külön termékfelület", "A setup, intake link és dashboard önálló Enterprise Request Desk útvonalakon fut."],
          ].map(([title, copy]) => `
            <li><strong>${escapeHtml(title)}</strong><span>${escapeHtml(copy)}</span></li>
          `).join("")}
        </ul>
      </section>

      <section class="erdp-site-section">
        <div>
          <h2>Tulajdonosi út.</h2>
          <p>A bejelentkezés és a setup állapot minden lépésben látható, így nincs rejtett vagy meglepő automatikus belépés.</p>
        </div>
        <ul class="erdp-step-list">
          ${[
            ["1. Setup vagy belépés", "/enterprise-request-desk/setup és /esg-request-desk/setup kezeli az auth és setup állapotot."],
            ["2. Szervezet beállítása", "Szervezet neve, weboldal, szolgáltatási terület, szolgáltatási vonalak és belső továbbítás."],
            ["3. Ügyféloldali intake link", "/enterprise-request-desk/intake?agent_key=... vagy /esg-request-desk/intake?agent_key=... setup után jelenik meg."],
            ["4. Belső dashboard", "/enterprise-request-desk/dashboard és /esg-request-desk/dashboard mutatja a feldolgozási nézetet."],
          ].map(([title, copy]) => `
            <li><strong>${escapeHtml(title)}</strong><span>${escapeHtml(copy)}</span></li>
          `).join("")}
        </ul>
      </section>

      <section class="erdp-site-section">
        <div>
          <h2>Mi marad kívül?</h2>
          <p>A termék jelenlegi fázisa a megkeresések előkészítése. Nem bővül teljes operációs irányítófelületté ebben a körben.</p>
        </div>
        <ul class="erdp-boundary-list">
          ${[
            ["Nincs végleges árgarancia", "A felület nem ad végső árat és nem állít ki ajánlatot."],
            ["Nincs QR, SLA vagy hatósági/audit dokumentumgenerálás", "A jelentések, SLA órák és dokumentumgenerálás későbbi, külön döntést igényel."],
            ["Nincs widget vagy embed módosítás", "Az Enterprise Request Desk a full-page termékútvonalakon fut."],
          ].map(([title, copy]) => `
            <li><strong>${escapeHtml(title)}</strong><span>${escapeHtml(copy)}</span></li>
          `).join("")}
        </ul>
      </section>

      <section class="erdp-final">
        <div>
          <h2>Indíts önálló Enterprise Request Desk setupot.</h2>
          <p>A meglévő auth rendszert használja, külön setup táblába ment, és setup után a dashboard mutatja az ügyféloldali intake linket.</p>
        </div>
        <div class="erdp-final-actions">
          <a class="erdp-button erdp-button-primary" href="/enterprise-request-desk/setup">Setup indítása</a>
          <a class="erdp-button" href="/esg-request-desk/setup">ESG alias</a>
        </div>
      </section>
    </div>
  </main>
</body>
</html>`;
}

function renderAppImage({
  src,
  alt,
  caption = "",
  className = "",
  loading = "lazy",
  width = 1440,
  height = 980,
}) {
  return `
    <figure class="app-frame ${className}">
      <div class="app-frame-bar" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
      <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="${escapeHtml(loading)}" width="${escapeHtml(width)}" height="${escapeHtml(height)}">
      ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}
    </figure>
  `;
}

const PRODUCT_IMAGES = Object.freeze({
  frontDeskPage: "/assets/product/front-desk-page-desktop.webp",
  frontDeskAnswer: "/assets/product/front-desk-answer-state.webp",
  wordpressPage: "/assets/product/wordpress-page-takeover-assistant.webp",
  frontDeskMobile: "/assets/product/front-desk-page-mobile.webp",
  dashboardHome: "/assets/product/dashboard-home-current.webp",
  dashboardFrontDesk: "/assets/product/dashboard-front-desk-practice.webp",
  dashboardCustomers: "/assets/product/dashboard-customers.webp",
  dashboardInstall: "/assets/product/dashboard-install-front-desk.webp",
  dashboardAnalytics: "/assets/product/dashboard-analytics.webp",
  dashboardSettings: "/assets/product/dashboard-settings-front-desk.webp",
});

function renderValueStrip() {
  return `
    <section class="value-strip" aria-label="Vonza value">
      ${[
        "Dedicated Front Desk page",
        "WordPress, QR, embed, or link",
        "Train with approved answers",
        "Optional website widget",
      ].map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
    </section>
  `;
}

function renderProductRouteLinks() {
  return `
    <section class="section product-route-section" aria-label="Vonza products">
      <div class="section-heading-row" data-reveal>
        <div>
          <h2>Vonza is one company with three products.</h2>
          <p>Front Desk is the recommended primary product. Website Widget and Voice Agent are separate Vonza products that share the same workspace and should be added only where they fit.</p>
        </div>
      </div>
      <div class="product-route-grid">
        ${[
          ["/front-desk", "Front Desk", "Recommended", "A dedicated AI Front Desk page for customer questions, quote intent, bookings, and follow-up details."],
          ["/website-widget", "Website Widget", "Embedded assistant", "A compact on-site assistant for existing websites that need a small launcher or embedded assistant surface."],
          ["/voice-agent", "Voice Agent", "Configured web voice", "A web voice assistant for browser-based voice conversations where voice is enabled in the workspace."],
        ].map(([href, title, label, copy]) => `
          <a class="product-route-card" href="${escapeHtml(href)}" data-reveal>
            <span>${escapeHtml(label)}</span>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(copy)}</p>
          </a>
        `).join("")}
      </div>
    </section>
  `;
}

function renderHungarianValueStrip() {
  return `
    <section class="value-strip" aria-label="Vonza érték">
      ${[
        "Önálló Front Desk oldal",
        "WordPress, QR, beágyazás vagy link",
        "Betanítás jóváhagyott válaszokkal",
        "Opcionális weboldali widget",
      ].map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
    </section>
  `;
}

function renderFinalCta(locale = "en") {
  if (locale === "hu") {
    return `
      <section class="final-cta" data-reveal>
        <div>
          <h2>Indíts AI Front Desk oldalt, amit az ügyfelek tényleg használni tudnak.</h2>
          <p>Tedd közzé dedikált oldalként, oszd meg QR-kóddal vagy linkkel, telepítsd WordPressben vagy beágyazással, és javítsd a válaszokat a dashboardból.</p>
        </div>
        <div class="final-cta-actions">
          <a class="button button-primary" data-app-link href="/dashboard?from=site">Front Desk létrehozása</a>
          <a class="button button-secondary" href="/hu#product">Termék áttekintése</a>
        </div>
      </section>
    `;
  }

  return `
    <section class="final-cta" data-reveal>
      <div>
        <h2>Create the AI Front Desk customers can actually use.</h2>
        <p>Publish a dedicated Front Desk page, share it by QR or link, install it with WordPress or smart embed, and keep improving answers from the dashboard.</p>
      </div>
      <div class="final-cta-actions">
        <a class="button button-primary" data-app-link href="/dashboard?from=site">Create your Front Desk</a>
        <a class="button button-secondary" href="/product">View product</a>
      </div>
    </section>
  `;
}

function renderMarketingHomePage() {
  return `
    <section class="hero">
      <div class="hero-copy" data-reveal>
        <h1>Your AI Front Desk for customer questions, quotes, bookings, and follow-ups.</h1>
        <p class="hero-text">Vonza is a product family for customer conversations. Front Desk gives customers a dedicated page where they can ask questions, request quotes, leave details, and get grounded next steps. Add Website Widget or Voice Agent as separate products when your workspace needs them.</p>
        <div class="hero-actions">
          <a class="button button-primary" data-app-link href="/dashboard?from=site">Create your Front Desk</a>
          <a class="button button-secondary" href="/product">See how it works</a>
        </div>
      </div>
      <div class="hero-media" data-reveal style="--reveal-delay: 100ms;">
        ${renderAppImage({
          src: PRODUCT_IMAGES.frontDeskPage,
          alt: "Vonza public Front Desk page where a customer can ask questions and review suggested next steps",
          caption: "The public Front Desk page gives customers a focused place to ask, share details, and continue.",
          className: "app-frame-hero",
          loading: "eager",
        })}
      </div>
    </section>

    ${renderValueStrip()}
    ${renderProductRouteLinks()}

    <section class="section front-desk-first">
      <div class="section-heading-row" data-reveal>
        <div>
          <h2>More than a website widget.</h2>
          <p>The widget bubble is optional. Vonza starts with a full-page AI Front Desk you can publish, share, embed, or connect to WordPress.</p>
        </div>
        <a class="text-arrow" href="/features">Explore all features</a>
      </div>
      <div class="channel-grid">
        ${[
          ["Dedicated Front Desk page", "A hosted customer-facing assistant page for questions, quotes, bookings, and contact capture."],
          ["WordPress Front Desk page", "Use the plugin or page embed when the assistant should feel like a full page on your site."],
          ["Smart embed", "Place the Front Desk inside part of an existing page without making the widget the main experience."],
          ["QR / direct link", "Share the same Front Desk from flyers, invoices, menus, emails, or social profiles."],
          ["Optional widget bubble", "Add the compact website bubble only when a normal page needs a small launcher."],
        ].map(([title, copy]) => `
          <article data-reveal>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(copy)}</p>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="section how-it-works">
      <div class="section-intro" data-reveal>
        <h2>How the Front Desk goes live.</h2>
        <p>Start with your website and business details, then publish the customer-facing page and improve it from real conversations.</p>
      </div>
      <div class="step-grid">
        ${[
          ["Connect your business website", "Import the pages and business context Vonza should use for grounded answers."],
          ["Customize your Front Desk", "Set the welcome, voice, page style, suggested questions, and customer next steps."],
          ["Publish by page, QR, embed, or widget", "Use the recommended Front Desk page first, then add WordPress, smart embed, or the optional bubble."],
          ["Review and improve answers", "Use conversations, feedback, and approved answers to make the next response stronger."],
        ].map(([title, copy], index) => `
          <article data-reveal style="--reveal-delay:${index * 70}ms;">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(copy)}</p>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="section product-screenshot-section">
      <div class="section-heading-row" data-reveal>
        <div>
          <h2>The customer page and the owner dashboard stay connected.</h2>
          <p>Customers get a clear Front Desk. Owners get conversations, training, install guidance, analytics, and settings in one dashboard.</p>
        </div>
      </div>
      <div class="feature-preview-grid product-shot-grid">
        <article class="feature-preview-card" data-reveal>
          ${renderAppImage({
            src: PRODUCT_IMAGES.dashboardFrontDesk,
            alt: "Vonza Front Desk dashboard practice screen for testing and improving answers",
          })}
          <h3>Practice and training</h3>
          <p>Try customer questions, inspect weak areas, and keep approved answers close to the Front Desk workspace.</p>
        </article>
        <article class="feature-preview-card" data-reveal style="--reveal-delay: 80ms;">
          ${renderAppImage({
            src: PRODUCT_IMAGES.dashboardInstall,
            alt: "Vonza Install dashboard showing Front Desk page, QR or direct link, smart embed, and optional widget choices",
          })}
          <h3>Install flow</h3>
          <p>Publish the Front Desk page first, then add WordPress, smart embed, QR/direct link, or the optional website bubble.</p>
        </article>
        <article class="feature-preview-card" data-reveal style="--reveal-delay: 160ms;">
          ${renderAppImage({
            src: PRODUCT_IMAGES.dashboardAnalytics,
            alt: "Vonza Analytics dashboard with conversation totals, Front Desk page activity, and source breakdown",
          })}
          <h3>Source analytics</h3>
          <p>See conversations, messages, captured leads, and which entry points are producing customer questions.</p>
        </article>
      </div>
    </section>

    <section class="section product-story">
      <div class="story-copy" data-reveal>
        <h2>Train it from real conversations.</h2>
        <p>When a reply is thin or a visitor marks an answer as not helpful, Vonza turns that into a training moment. Owners can approve better answers and keep future replies grounded in verified business facts.</p>
        <a class="button button-secondary" href="/product">See the feedback loop</a>
      </div>
      ${renderAppImage({
        src: PRODUCT_IMAGES.frontDeskAnswer,
        alt: "Vonza Front Desk answer state showing a customer question and assistant response",
        caption: "The Front Desk can answer first, then owner feedback and approved answers improve the next response.",
        className: "story-frame",
      })}
    </section>

    <section class="section use-cases">
      <div class="section-intro" data-reveal>
        <h2>Built for small businesses that need a better front door.</h2>
        <p>Vonza keeps the language general because each business decides what its Front Desk should know and what it should never invent.</p>
      </div>
      <div class="use-case-grid">
        ${[
          ["Salons and clinics", "Answer common questions and collect details for a human follow-up when needed."],
          ["Agencies and studios", "Explain services, quote inputs, timelines, and next steps without inventing prices."],
          ["Restaurants and venues", "Share practical answers from approved business information and direct visitors to the right next step."],
          ["Local services", "Capture quote, booking, and callback intent while the team is working."],
        ].map(([title, copy]) => `
          <article data-reveal>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(copy)}</p>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="section install-options-section">
      <div class="section-heading-row" data-reveal>
        <div>
          <h2>Install options match how customers find you.</h2>
          <p>Use one Front Desk across the channels you already use. The website widget remains available, but it is no longer the whole product.</p>
        </div>
      </div>
      <div class="install-option-layout">
        ${renderAppImage({
          src: PRODUCT_IMAGES.wordpressPage,
          alt: "Vonza Front Desk embedded as a page-style assistant on a website",
        })}
        <div class="install-option-list">
          ${[
            ["WordPress plugin", "Create a dedicated Front Desk page inside WordPress."],
            ["Smart embed", "Place the assistant as a full-page or section experience."],
            ["Hosted page / QR", "Share the same page by link or QR code."],
            ["Optional widget", "Keep the compact website bubble as a secondary entry point."],
          ].map(([title, copy]) => `
            <article data-reveal>
              <h3>${escapeHtml(title)}</h3>
              <p>${escapeHtml(copy)}</p>
            </article>
          `).join("")}
        </div>
      </div>
    </section>

    <section class="section trust-section">
      <div class="section-intro" data-reveal>
        <h2>Built to stay honest when the answer is not known.</h2>
      </div>
      <div class="trust-grid">
        ${[
          ["No invented prices or policies", "If exact details are not in the business context, the Front Desk should say so and guide the visitor to a quote or contact path."],
          ["Owner-approved answers", "Useful corrections can become approved answers for future customer questions."],
          ["Customer details handled intentionally", "The assistant can collect contact details for follow-up without pretending to replace your contact tools."],
          ["Public endpoints are guarded", "Public assistant routes stay rate-limited and scoped to the right customer-facing experience."],
        ].map(([title, copy]) => `
          <article data-reveal>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(copy)}</p>
          </article>
        `).join("")}
      </div>
    </section>

    ${renderFinalCta()}
  `;
}

function renderHungarianMarketingHomePage() {
  return `
    <section class="hero">
      <div class="hero-copy" data-reveal>
        <h1>AI Front Desk magyar ügyfélkérdésekhez, ajánlatkéréshez, foglaláshoz és utánkövetéshez.</h1>
        <p class="hero-text">Adj az ügyfeleknek egy önálló oldalt, ahol kérdezhetnek, ajánlatot kérhetnek, megadhatják az elérhetőségüket, és a vállalkozásod adataira épülő választ kapnak.</p>
        <div class="hero-actions">
          <a class="button button-primary" data-app-link href="/dashboard?from=site">Front Desk létrehozása</a>
          <a class="button button-secondary" href="/hu#product">Hogyan működik</a>
        </div>
      </div>
      <div class="hero-media" data-reveal style="--reveal-delay: 100ms;">
        ${renderAppImage({
          src: PRODUCT_IMAGES.frontDeskPage,
          alt: "Vonza publikus Front Desk oldal ügyfélkérdésekhez és következő lépésekhez",
          caption: "A publikus Front Desk oldal fókuszált helyet ad a kérdéseknek, elérhetőségeknek és következő lépéseknek.",
          className: "app-frame-hero",
          loading: "eager",
        })}
      </div>
    </section>

    ${renderHungarianValueStrip()}

    <section id="product" class="section front-desk-first">
      <div class="section-heading-row" data-reveal>
        <div>
          <h2>Több mint weboldali chatbuborék.</h2>
          <p>A Vonza elsődleges felülete a teljes oldalas AI Front Desk. A widget csak másodlagos belépési pont, ha egy meglévő oldalra is kell egy kis indító.</p>
        </div>
        <a class="text-arrow" href="/dashboard?from=site" data-app-link>Beta hozzáférés megnyitása</a>
      </div>
      <div class="channel-grid">
        ${[
          ["Dedikált Front Desk oldal", "Ügyféloldali asszisztensoldal kérdésekhez, ajánlatkéréshez, foglaláshoz és kapcsolatfelvételhez."],
          ["WordPress Front Desk oldal", "Plugin vagy oldalbeágyazás, amikor az asszisztens teljes oldalként jelenjen meg a weboldalon."],
          ["Okos beágyazás", "Helyezd a Front Desket egy meglévő oldal fontos részébe, nem csak chatbuborékként."],
          ["QR-kód és közvetlen link", "Ugyanaz a Front Desk megosztható szórólapon, számlán, étlapon, emailben vagy közösségi profilon."],
        ].map(([title, copy]) => `
          <article data-reveal>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(copy)}</p>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="section how-it-works">
      <div class="section-intro" data-reveal>
        <h2>Így indul élesben.</h2>
        <p>Kapcsold össze a weboldalad és az üzleti adatokat, majd publikáld az ügyféloldali Front Desk oldalt és javítsd valós beszélgetésekből.</p>
      </div>
      <div class="step-grid">
        ${[
          ["Weboldal és üzleti adatok", "Importáld azokat az oldalakat és üzleti tényeket, amelyekből a Vonza válaszolhat."],
          ["Front Desk testreszabása", "Állítsd be az üdvözlést, hangot, oldalkinézetet, javasolt kérdéseket és következő lépéseket."],
          ["Publikálás oldalként, QR-rel vagy beágyazással", "Elsőként a Front Desk oldalt indítsd, majd jöhet a WordPress, az okos beágyazás vagy az opcionális widget."],
          ["Válaszok javítása", "A beszélgetések, visszajelzések és jóváhagyott válaszok alapján erősítheted a következő választ."],
        ].map(([title, copy], index) => `
          <article data-reveal style="--reveal-delay:${index * 70}ms;">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(copy)}</p>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="section product-screenshot-section">
      <div class="section-heading-row" data-reveal>
        <div>
          <h2>Dashboard a napi ügyfélmunkához.</h2>
          <p>Home, Customers, Front Desk, Analytics, Install és Settings nézetek segítenek látni, mi működik, mit kell javítani, és hol kell emberi döntés.</p>
        </div>
      </div>
      <div class="feature-preview-grid product-shot-grid">
        ${[
          [PRODUCT_IMAGES.dashboardHome, "Vonza dashboard kezdőlap napi áttekintéssel"],
          [PRODUCT_IMAGES.dashboardCustomers, "Ügyfelek és utánkövetések listája"],
          [PRODUCT_IMAGES.dashboardAnalytics, "Elemzések és ügyfélkérdés trendek"],
        ].map(([src, alt]) => renderAppImage({ src, alt })).join("")}
      </div>
    </section>

    ${renderMarketingPricingSection("hu")}
    ${renderFinalCta("hu")}
  `;
}

function renderFeaturesPage() {
  const features = [
    {
      title: "AI Front Desk page",
      copy: "A dedicated customer-facing assistant page for questions, quotes, bookings, and contact capture.",
      src: PRODUCT_IMAGES.frontDeskPage,
      alt: "Vonza public Front Desk page with customer question and assistant answer",
    },
    {
      title: "WordPress Front Desk page",
      copy: "Use the WordPress plugin or page embed when the assistant should feel like a full customer help page.",
      src: PRODUCT_IMAGES.wordpressPage,
      alt: "Vonza page-style assistant embedded on a website",
    },
    {
      title: "Smart embed / QR / hosted link",
      copy: "Publish by hosted page, QR/direct link, smart embed, dedicated page embed, or the optional website bubble.",
      src: PRODUCT_IMAGES.dashboardInstall,
      alt: "Vonza Install screen with Front Desk page and distribution options",
    },
    {
      title: "Customer conversations",
      copy: "Review guests, identified customers, conversation context, and the next owner action from the dashboard.",
      src: PRODUCT_IMAGES.dashboardCustomers,
      alt: "Vonza Customers dashboard with conversation list and customer detail",
    },
    {
      title: "Feedback and training",
      copy: "Turn not-helpful feedback, repeated questions, and owner corrections into approved answers for better future replies.",
      src: PRODUCT_IMAGES.dashboardFrontDesk,
      alt: "Vonza Front Desk dashboard practice and training workspace",
    },
    {
      title: "Analytics and source breakdown",
      copy: "Track conversations, messages, leads, Front Desk page activity, and the mix of page, embed, and widget entry points.",
      src: PRODUCT_IMAGES.dashboardAnalytics,
      alt: "Vonza Analytics dashboard with source breakdown",
    },
  ];

  return `
    <section class="page-hero page-hero-split">
      <div data-reveal>
        <h1>Features for a real AI Front Desk, not just a chat bubble.</h1>
        <p>Vonza combines a dedicated customer page, install options, conversations, training, approved answers, analytics, and optional widget support.</p>
      </div>
      ${renderAppImage({
        src: PRODUCT_IMAGES.frontDeskPage,
        alt: "Vonza public Front Desk page with a customer-facing assistant",
        className: "page-hero-frame",
        loading: "eager",
      })}
    </section>

    <section class="section feature-detail-list">
      ${features.map((feature, index) => `
        <article class="feature-detail ${index % 2 ? "feature-detail-reverse" : ""}" data-reveal>
          <div class="feature-detail-copy">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <h2>${escapeHtml(feature.title)}</h2>
            <p>${escapeHtml(feature.copy)}</p>
          </div>
          ${renderAppImage({
            src: feature.src,
            alt: feature.alt,
          })}
        </article>
      `).join("")}
    </section>

    <section class="section trust-section">
      <div class="section-intro" data-reveal>
        <h2>Also included where configured.</h2>
        <p>Vonza supports contact capture, semantic knowledge retrieval, voice input and spoken replies when enabled, approved answers, and the website widget bubble as a secondary channel.</p>
      </div>
    </section>

    ${renderFinalCta()}
  `;
}

function renderProductPage() {
  const steps = [
    ["Front Desk page", "The recommended Vonza product gives customers a hosted AI Front Desk where they can ask questions, request quotes, leave details, and get grounded first answers.", PRODUCT_IMAGES.frontDeskPage, "Vonza public Front Desk page"],
    ["Dashboard", "Use Home, Customers, Front Desk, Analytics, Install, and Settings to run the assistant from one owner workspace.", PRODUCT_IMAGES.dashboardHome, "Vonza dashboard Home screen"],
    ["Training and feedback loop", "Practice questions, review weak answers, and turn approved corrections into better answers for next time.", PRODUCT_IMAGES.dashboardFrontDesk, "Vonza Front Desk practice and training workspace"],
    ["Customers and conversations", "Review guest or identified customer conversations, follow-up context, and recent customer details without claiming a full contact-management suite.", PRODUCT_IMAGES.dashboardCustomers, "Vonza Customers dashboard with conversation detail"],
    ["Analytics", "Measure conversations, messages, captured leads, source breakdown, and repeated customer questions.", PRODUCT_IMAGES.dashboardAnalytics, "Vonza Analytics dashboard source breakdown"],
    ["Website Widget", "Use the separate Website Widget product when an existing site needs a compact launcher or embedded assistant surface.", PRODUCT_IMAGES.dashboardInstall, "Vonza Install screen with Front Desk page choices"],
    ["Settings and customization", "Adjust Front Desk identity, welcome copy, page content, design, business context, and configured voice options. Voice Agent remains a separate Vonza product for browser-based voice input and spoken replies, not unsupported phone or telephony promises.", PRODUCT_IMAGES.dashboardSettings, "Vonza Settings screen for Front Desk customization"],
  ];

  return `
    <section class="page-hero page-hero-split">
      <div data-reveal>
        <h1>Vonza is a product family for customer conversations.</h1>
        <p>Front Desk is the recommended primary product. Website Widget and Voice Agent are separate products that use the same owner workspace when they are enabled.</p>
      </div>
      ${renderAppImage({
        src: PRODUCT_IMAGES.frontDeskAnswer,
        alt: "Vonza Front Desk showing a customer answer state",
        className: "page-hero-frame",
        loading: "eager",
      })}
    </section>

    <section class="section walkthrough">
      ${steps.map(([title, copy, src, alt], index) => `
        <article class="walkthrough-step" data-reveal>
          <div class="walkthrough-number">${String(index + 1).padStart(2, "0")}</div>
          <div class="walkthrough-copy">
            <h2>${escapeHtml(title)}</h2>
            <p>${escapeHtml(copy)}</p>
          </div>
          ${renderAppImage({ src, alt })}
        </article>
      `).join("")}
    </section>

    <section class="section connected-section">
      <div class="connected-note" data-reveal>
        <h2>One workspace, separate product surfaces.</h2>
        <p>Front Desk, Website Widget, and Voice Agent are presented as separate Vonza products. Current account setup and billing still run through the shared dashboard workspace.</p>
        <span>Current product scope</span>
      </div>
    </section>

    ${renderProductRouteLinks()}
    ${renderFinalCta()}
  `;
}

function renderFrontDeskPage() {
  return `
    <section class="page-hero page-hero-split">
      <div data-reveal>
        <h1>Front Desk is the recommended Vonza product.</h1>
        <p>Give customers a dedicated AI Front Desk page for questions, quote requests, booking intent, contact details, and grounded next steps.</p>
        <div class="hero-actions">
          <a class="button button-primary" href="/dashboard/front-desk?from=site">Create your Front Desk</a>
          <a class="button button-secondary" href="/product">See the full product</a>
        </div>
      </div>
      ${renderAppImage({
        src: PRODUCT_IMAGES.frontDeskPage,
        alt: "Vonza public Front Desk page for customer questions and next steps",
        className: "page-hero-frame",
        loading: "eager",
      })}
    </section>

    <section class="section how-it-works">
      <div class="section-intro" data-reveal>
        <h2>A full customer-facing page, not just a launcher.</h2>
        <p>Use the Front Desk when customers need a clear place to ask, share details, and continue without hunting through a website.</p>
      </div>
      <div class="step-grid">
        ${[
          ["Publish a focused page", "Share the hosted Front Desk by link, QR code, WordPress page, or smart embed."],
          ["Answer from business context", "Ground replies in imported website content, business details, and approved answers."],
          ["Capture useful details", "Collect contact and follow-up context when a customer needs a quote, booking, or human response."],
          ["Improve from the dashboard", "Review conversations, practice questions, and approve better answers for future visitors."],
        ].map(([title, copy], index) => `
          <article data-reveal style="--reveal-delay:${index * 70}ms;">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(copy)}</p>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="section product-story">
      <div class="story-copy" data-reveal>
        <h2>Built for the primary customer path.</h2>
        <p>The Front Desk is the product to lead with when a business wants one public assistant page for questions, quote intent, booking context, and follow-up.</p>
        <a class="button button-primary" href="/dashboard/front-desk?from=site">Open Front Desk setup</a>
      </div>
      ${renderAppImage({
        src: PRODUCT_IMAGES.dashboardFrontDesk,
        alt: "Vonza Front Desk dashboard for practicing and improving answers",
        className: "story-frame",
      })}
    </section>

    ${renderProductRouteLinks()}
  `;
}

function renderWebsiteWidgetPage() {
  return `
    <section class="page-hero page-hero-split">
      <div data-reveal>
        <h1>Website Widget adds Vonza to an existing site.</h1>
        <p>Use the on-site embedded assistant when a business wants a compact website launcher or embedded assistant surface alongside its existing pages.</p>
        <div class="hero-actions">
          <a class="button button-primary" href="/website-widget/dashboard?from=site">Set up Website Widget</a>
          <a class="button button-secondary" href="/front-desk">Compare with Front Desk</a>
        </div>
      </div>
      ${renderAppImage({
        src: PRODUCT_IMAGES.wordpressPage,
        alt: "Vonza assistant embedded into an existing website page",
        className: "page-hero-frame",
        loading: "eager",
      })}
    </section>

    <section class="section how-it-works">
      <div class="section-intro" data-reveal>
        <h2>For websites that need an assistant in place.</h2>
        <p>The widget is secondary to the Front Desk, but it remains useful when an existing website needs a small entry point for customer questions.</p>
      </div>
      <div class="channel-grid product-channel-grid">
        ${[
          ["Compact launcher", "Add a website bubble when visitors should stay on the current page."],
          ["Page embed", "Place the assistant into a section of an existing website page."],
          ["Same workspace", "Use the same Vonza dashboard for conversations, training, install guidance, and analytics."],
          ["Grounded replies", "Keep answers tied to business context and approved owner corrections."],
        ].map(([title, copy]) => `
          <article data-reveal>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(copy)}</p>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="section product-story">
      <div class="story-copy" data-reveal>
        <h2>Best as a supporting website channel.</h2>
        <p>Use Website Widget when an existing website already works and needs an assistant entry point. Use Front Desk when the assistant should be the main public destination.</p>
        <a class="button button-primary" href="/website-widget/dashboard?from=site">Open Widget setup</a>
      </div>
      ${renderAppImage({
        src: PRODUCT_IMAGES.dashboardInstall,
        alt: "Vonza Install dashboard showing website widget and embed setup choices",
        className: "story-frame",
      })}
    </section>

    ${renderProductRouteLinks()}
  `;
}

function renderVoiceAgentPage() {
  return `
    <section class="page-hero page-hero-split">
      <div data-reveal>
        <h1>Voice Agent supports configured web voice conversations.</h1>
        <p>Use Voice Agent for browser-based voice input and spoken replies where voice is enabled. It is not positioned as a phone-line or telephony replacement.</p>
        <div class="hero-actions">
          <a class="button button-primary" href="/dashboard/voice?from=site">Set up Voice Agent</a>
          <a class="button button-secondary" href="/front-desk">Start with Front Desk</a>
        </div>
      </div>
      ${renderAppImage({
        src: PRODUCT_IMAGES.dashboardSettings,
        alt: "Vonza dashboard settings for configuring Front Desk and voice options",
        className: "page-hero-frame",
        loading: "eager",
      })}
    </section>

    <section class="section how-it-works">
      <div class="section-intro" data-reveal>
        <h2>Voice where the workspace is configured for it.</h2>
        <p>Voice Agent gives customers a web voice path when enabled, while the same Vonza workspace keeps conversations and improvements connected.</p>
      </div>
      <div class="channel-grid product-channel-grid">
        ${[
          ["Web voice path", "Support browser-based voice conversations where voice features are configured."],
          ["Spoken replies", "Use voice input and spoken assistant responses when the current workspace supports them."],
          ["Front Desk connection", "Keep the customer-facing Front Desk as the primary public surface."],
          ["Clear limits", "Avoid claims about phone numbers, call routing, or telephony unless those are separately configured."],
        ].map(([title, copy]) => `
          <article data-reveal>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(copy)}</p>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="section product-story">
      <div class="story-copy" data-reveal>
        <h2>Use voice as an enabled assistant mode.</h2>
        <p>Voice Agent should be sold as a configured web voice assistant under Vonza, not as unsupported phone infrastructure.</p>
        <a class="button button-primary" href="/dashboard/voice?from=site">Open Voice setup</a>
      </div>
      ${renderAppImage({
        src: PRODUCT_IMAGES.dashboardAnalytics,
        alt: "Vonza Analytics dashboard showing customer activity and source breakdown",
        className: "story-frame",
      })}
    </section>

    ${renderProductRouteLinks()}
  `;
}

function renderPricingPage() {
  return `
    <section class="page-hero">
      <div data-reveal>
        <h1>Simple workspace plans for Vonza.</h1>
        <p>Pricing follows the current billing setup: Starter, Growth, and Pro are account-capacity plans for the shared Vonza workspace. They are not separate product checkouts for Front Desk, Website Widget, or Voice Agent.</p>
      </div>
    </section>
    ${renderMarketingPricingSection()}
    <section class="section faq-section">
      <div class="section-intro" data-reveal>
        <h2>Pricing FAQ</h2>
      </div>
      <div class="faq-grid">
        ${[
          ["What is included in each plan?", "Current plans cover workspace/account capacity for the Vonza product family. Front Desk remains the recommended product to launch first."],
          ["Can I start without a technical setup?", "Yes. The hosted Front Desk page can be shared directly, and Install guides WordPress, smart embed, QR/direct link, and optional widget setup."],
          ["Can I change plans later?", "Yes. Plan movement is handled from the dashboard billing experience when billing is configured."],
          ["Do products have separate checkout links?", "No. The public pricing page still sends Starter, Growth, and Pro to the existing account-plan checkout paths."],
          ["Is the widget required?", "No. Website Widget is a separate Vonza product for existing sites. Front Desk remains the primary recommended product."],
          ["Is this replacing my team?", "No. Vonza answers common first questions and keeps human follow-up work visible."],
        ].map(([title, copy]) => `
          <article data-reveal>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(copy)}</p>
          </article>
        `).join("")}
      </div>
    </section>
    ${renderFinalCta()}
  `;
}

function renderAboutPage() {
  return `
    <section class="page-hero page-hero-split">
      <div data-reveal>
        <h1>Vonza is building an AI Front Desk for small businesses.</h1>
        <p>The goal is practical: help owners answer common customer questions, capture useful lead details, review conversations, and improve replies without pretending the assistant knows facts it has not been taught.</p>
        <div class="hero-actions">
          <a class="button button-primary" data-app-link href="/dashboard?from=site">Create your Front Desk</a>
          <a class="button button-secondary" href="mailto:support@vonza.app">Contact</a>
        </div>
      </div>
      ${renderAppImage({
        src: PRODUCT_IMAGES.dashboardCustomers,
        alt: "Vonza dashboard showing customer conversations and follow-up context",
        className: "page-hero-frame",
        loading: "eager",
      })}
    </section>

    <section class="section about-grid">
      <article data-reveal>
        <h2>Product principle</h2>
        <p>Answer what can be answered, say when details are missing, capture useful context, and make the next human action obvious.</p>
      </article>
      <article data-reveal style="--reveal-delay: 80ms;">
        <h2>Who it serves</h2>
        <p>Small businesses that need a better customer-facing page for questions, quote requests, booking intent, and follow-up details.</p>
      </article>
      <article data-reveal style="--reveal-delay: 160ms;">
        <h2>Contact</h2>
        <p>For support, product questions, or partnership conversations, contact the Vonza team from the dashboard or by email.</p>
        <a class="text-arrow" href="mailto:support@vonza.app">support@vonza.app</a>
      </article>
    </section>

    ${renderFinalCta()}
  `;
}

function normalizeMacDmgUrl(value) {
  const rawUrl = String(value || "").trim();
  if (!rawUrl) {
    return "";
  }

  try {
    const parsedUrl = new URL(rawUrl);
    return parsedUrl.protocol === "https:" ? parsedUrl.toString() : "";
  } catch {
    return "";
  }
}

function normalizeMacDmgChecksum(value) {
  const checksum = String(value || "").trim().replace(/\s+/g, "").toLowerCase();
  return /^[a-f0-9]{64}$/.test(checksum) ? checksum : "";
}

function isMacDmgMarkedSignedAndNotarized(value) {
  return ["1", "true", "yes"].includes(String(value || "").trim().toLowerCase());
}

function renderMacDownloadPage() {
  const downloadUrl = normalizeMacDmgUrl(process.env.VONZA_MAC_DMG_URL);
  const checksum = normalizeMacDmgChecksum(process.env.VONZA_MAC_DMG_SHA256);
  const releaseDate = String(process.env.VONZA_MAC_RELEASE_DATE || "").trim();
  const version = String(process.env.VONZA_MAC_VERSION || getAppVersion() || "1.0.0").trim();
  const isSignedAndNotarized = isMacDmgMarkedSignedAndNotarized(process.env.VONZA_MAC_DMG_SIGNED_NOTARIZED);
  const isReleaseReady = Boolean(downloadUrl && isSignedAndNotarized);

  return `
    <section class="page-hero page-hero-split">
      <div data-reveal>
        <h1>Vonza for Mac</h1>
        <p>Open the Vonza AI Front Desk dashboard from a native macOS app window. The desktop app uses the same hosted dashboard, auth, customers, analytics, settings, Front Desk, and install flows as the browser version.</p>
        <div class="hero-actions">
          ${isReleaseReady
            ? `<a class="button button-primary" href="${escapeHtml(downloadUrl)}">Download for Mac</a>`
            : `<span class="button button-secondary" aria-disabled="true">Mac app coming soon</span>`}
          <a class="button button-secondary" href="/dashboard?from=site" data-app-link>Open dashboard</a>
        </div>
      </div>
      ${renderAppImage({
        src: PRODUCT_IMAGES.dashboardHome,
        alt: "Vonza dashboard opened for owner workspace management",
        className: "page-hero-frame",
        loading: "eager",
      })}
    </section>

    <section class="section trust-section">
      <div class="section-intro" data-reveal>
        <h2>Mac download details</h2>
        <p>${escapeHtml(isReleaseReady
          ? "This macOS download is signed and notarized for direct installation outside the Mac App Store."
          : "Private test build only. The public DMG is not shown as production-ready until a signed and notarized release URL is configured.")}</p>
      </div>
      <div class="trust-grid">
        ${[
          ["File type", ".dmg"],
          ["Supported systems", "macOS on Apple Silicon and Intel Macs, subject to release build availability."],
          ["Version", version],
          ["Release date", releaseDate || "Pending signed release"],
          ["SHA-256 checksum", checksum || "Pending signed release"],
          ["Install", "Open the DMG, then drag Vonza to Applications."],
        ].map(([title, copy]) => `
          <article data-reveal>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(copy)}</p>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="section faq-section">
      <div class="section-intro" data-reveal>
        <h2>Before public release</h2>
      </div>
      <div class="faq-grid">
        ${[
          ["Signing", "A public Mac download requires an Apple Developer ID Application certificate."],
          ["Notarization", "The DMG must be notarized with Apple and stapled where applicable."],
          ["Dashboard behavior", "The desktop app loads the hosted dashboard and does not replace the browser app."],
          ["Google connection", "Google OAuth is opened in the system browser when needed because embedded WebViews may be blocked."],
        ].map(([title, copy]) => `
          <article data-reveal>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(copy)}</p>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

const MARKETING_PAGES = {
  home: {
    title: "Vonza | AI Front Desk page for small businesses",
    description: "Vonza gives small businesses an AI Front Desk page for customer questions, quote requests, details, and follow-up.",
    body: renderMarketingHomePage,
  },
  features: {
    title: "Vonza Features | AI Front Desk page, training, install, and analytics",
    description: "Explore Vonza features for the AI Front Desk page, WordPress, smart embed, QR links, conversations, approved answers, training, analytics, and optional widget.",
    body: renderFeaturesPage,
  },
  product: {
    title: "Vonza Product | How the AI Front Desk works",
    description: "See how Vonza connects the public Front Desk page, dashboard, conversations, training, install options, analytics, and customization.",
    body: renderProductPage,
  },
  frontDesk: {
    title: "Vonza Front Desk | Dedicated AI Front Desk page",
    description: "Launch Vonza Front Desk, the recommended dedicated AI front desk page for customer questions, quote requests, booking intent, and follow-up.",
    body: renderFrontDeskPage,
  },
  websiteWidget: {
    title: "Vonza Website Widget | Embedded assistant for existing websites",
    description: "Add Vonza Website Widget to an existing website as a compact embedded assistant for customer questions.",
    body: renderWebsiteWidgetPage,
  },
  voiceAgent: {
    title: "Vonza Voice Agent | Configured web voice assistant",
    description: "Use Vonza Voice Agent for configured web voice conversations, browser voice input, and spoken replies where enabled.",
    body: renderVoiceAgentPage,
  },
  pricing: {
    title: "Vonza Pricing | Plans for an AI Front Desk",
    description: "Review Vonza pricing plans for launching an AI Front Desk page and organizing customer questions.",
    body: renderPricingPage,
  },
  about: {
    title: "About Vonza | AI Front Desk for small businesses",
    description: "Learn about Vonza, the AI Front Desk built for small businesses that need clearer customer answers and follow-up.",
    body: renderAboutPage,
  },
  mac: {
    title: "Vonza for Mac | Desktop AI Front Desk dashboard",
    description: "Download Vonza for Mac, a native macOS desktop wrapper for the hosted Vonza AI Front Desk dashboard.",
    body: renderMacDownloadPage,
  },
};

const MARKETING_CHROME = Object.freeze({
  en: Object.freeze({
    lang: "en",
    homeHref: "/",
    brandLabel: "Vonza home",
    menuLabel: "Open navigation",
    navLabel: "Primary",
    navHome: "Home",
    navFeatures: "Features",
    navProduct: "Product",
    navFrontDesk: "Front Desk",
    navWebsiteWidget: "Website Widget",
    navVoiceAgent: "Voice Agent",
    navPricing: "Pricing",
    navAbout: "About",
    dashboard: "Dashboard",
    signIn: "Sign in",
    primaryCta: "Create Front Desk",
    footerCopy: "An AI Front Desk page for customer questions, quote requests, details, and better follow-up.",
    terms: "Terms",
    privacy: "Privacy",
    cookies: "Cookies",
    pathPrefix: "",
  }),
  hu: Object.freeze({
    lang: "hu",
    homeHref: "/hu",
    brandLabel: "Vonza kezdőlap",
    menuLabel: "Navigáció megnyitása",
    navLabel: "Fő navigáció",
    navHome: "Kezdőlap",
    navFeatures: "Funkciók",
    navProduct: "Termék",
    navFrontDesk: "Front Desk",
    navWebsiteWidget: "Website Widget",
    navVoiceAgent: "Voice Agent",
    navPricing: "Árak",
    navAbout: "Rólunk",
    dashboard: "Dashboard",
    signIn: "Bejelentkezés",
    primaryCta: "Front Desk létrehozása",
    footerCopy: "AI Front Desk oldal ügyfélkérdésekhez, ajánlatkéréshez, elérhetőségekhez és jobb utánkövetéshez.",
    terms: "ÁSZF",
    privacy: "Adatvédelem",
    cookies: "Cookie-k",
    pathPrefix: "/hu",
  }),
});

function getMarketingChrome(locale = "en") {
  return MARKETING_CHROME[locale] || MARKETING_CHROME.en;
}

function renderMarketingPage(rootDir, pageKey = "home", locale = "en") {
  const isHu = locale === "hu";
  const page = MARKETING_PAGES[pageKey] || MARKETING_PAGES.home;
  const chrome = getMarketingChrome(locale);
  const title = isHu
    ? "Vonza | AI Front Desk magyar beta vállalkozásoknak"
    : page.title;
  const description = isHu
    ? "Vonza AI Front Desk oldal magyar ügyfélkérdésekhez, ajánlatkéréshez, foglaláshoz, kapcsolatfelvételhez és utánkövetéshez."
    : page.description;
  const body = isHu ? renderHungarianMarketingHomePage() : page.body();
  const template = readFileSync(path.join(rootDir, "frontend", "index.html"), "utf8");
  return template
    .replace("<!-- VONZA_MARKETING_LANG -->", escapeHtml(chrome.lang))
    .replace("<!-- VONZA_MARKETING_TITLE -->", escapeHtml(title))
    .replace("<!-- VONZA_MARKETING_DESCRIPTION -->", escapeHtml(description))
    .replace("<!-- VONZA_MARKETING_PAGE_KEY -->", escapeHtml(pageKey))
    .replaceAll("<!-- VONZA_MARKETING_HOME_HREF -->", escapeHtml(chrome.homeHref))
    .replace("<!-- VONZA_MARKETING_BRAND_LABEL -->", escapeHtml(chrome.brandLabel))
    .replace("<!-- VONZA_MARKETING_MENU_LABEL -->", escapeHtml(chrome.menuLabel))
    .replace("<!-- VONZA_MARKETING_NAV_LABEL -->", escapeHtml(chrome.navLabel))
    .replaceAll("<!-- VONZA_MARKETING_FEATURES_HREF -->", escapeHtml(`${chrome.pathPrefix || ""}/features`))
    .replaceAll("<!-- VONZA_MARKETING_PRODUCT_HREF -->", escapeHtml(`${chrome.pathPrefix || ""}/product`))
    .replaceAll("<!-- VONZA_MARKETING_FRONT_DESK_HREF -->", "/front-desk")
    .replaceAll("<!-- VONZA_MARKETING_WEBSITE_WIDGET_HREF -->", "/website-widget")
    .replaceAll("<!-- VONZA_MARKETING_VOICE_AGENT_HREF -->", "/voice-agent")
    .replaceAll("<!-- VONZA_MARKETING_PRICING_HREF -->", escapeHtml(`${chrome.pathPrefix || ""}/pricing`))
    .replaceAll("<!-- VONZA_MARKETING_ABOUT_HREF -->", escapeHtml(`${chrome.pathPrefix || ""}/about`))
    .replaceAll("<!-- VONZA_MARKETING_NAV_HOME -->", escapeHtml(chrome.navHome))
    .replaceAll("<!-- VONZA_MARKETING_NAV_FEATURES -->", escapeHtml(chrome.navFeatures))
    .replaceAll("<!-- VONZA_MARKETING_NAV_PRODUCT -->", escapeHtml(chrome.navProduct))
    .replaceAll("<!-- VONZA_MARKETING_NAV_FRONT_DESK -->", escapeHtml(chrome.navFrontDesk))
    .replaceAll("<!-- VONZA_MARKETING_NAV_WEBSITE_WIDGET -->", escapeHtml(chrome.navWebsiteWidget))
    .replaceAll("<!-- VONZA_MARKETING_NAV_VOICE_AGENT -->", escapeHtml(chrome.navVoiceAgent))
    .replaceAll("<!-- VONZA_MARKETING_NAV_PRICING -->", escapeHtml(chrome.navPricing))
    .replaceAll("<!-- VONZA_MARKETING_NAV_ABOUT -->", escapeHtml(chrome.navAbout))
    .replace("<!-- VONZA_MARKETING_SIGN_IN -->", escapeHtml(chrome.signIn))
    .replace("<!-- VONZA_MARKETING_PRIMARY_CTA -->", escapeHtml(chrome.primaryCta))
    .replace("<!-- VONZA_MARKETING_FOOTER_COPY -->", escapeHtml(chrome.footerCopy))
    .replace("<!-- VONZA_MARKETING_DASHBOARD -->", escapeHtml(chrome.dashboard))
    .replace("<!-- VONZA_MARKETING_TERMS -->", escapeHtml(chrome.terms))
    .replace("<!-- VONZA_MARKETING_PRIVACY -->", escapeHtml(chrome.privacy))
    .replace("<!-- VONZA_MARKETING_COOKIES -->", escapeHtml(chrome.cookies))
    .replace("<!-- VONZA_MARKETING_PAGE_BODY -->", body);
}

function renderAssistantEmbedMatrixPage(options = {}) {
  const requestedAgentId = String(options.agentId || "").trim();
  const mockAgentId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedAgentId)
    ? requestedAgentId
    : "00000000-0000-0000-0000-000000000001";
  const mockBackgroundScript = options.mockBackground === true
    ? `
  <script>
    const vonzaMatrixRealFetch = window.fetch.bind(window);
    window.fetch = (url, options) => String(url).includes("/widget/bootstrap")
      ? Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          widgetConfig: {
            full_page_config: {
              design: {
                background_type: "gradient",
                background_color: "#111827",
                background_gradient_to: "#2563eb",
                background_overlay_color: "#020617",
                background_overlay_opacity: 0.15
              }
            }
          }
        })
      })
      : vonzaMatrixRealFetch(url, options);
  </script>`
    : "";
  const smartSection = `
    <div
      data-vonza-assistant
      data-agent-id="${mockAgentId}"
      data-layout="section"
      data-title="Matrix section assistant"
    ></div>
  `;
  const smartFullPage = `
    <div
      data-vonza-assistant
      data-agent-id="${mockAgentId}"
      data-layout="full-page"
      data-surface="flat"
      data-background-scope="section"
      data-title="Matrix full-page assistant"
    ></div>
  `;
  const smartFullPageHeight = `
    <div
      data-vonza-assistant
      data-agent-id="${mockAgentId}"
      data-layout="full-page"
      data-surface="flat"
      data-background-scope="section"
      data-height="full-page"
      data-title="Matrix full-page height assistant"
    ></div>
  `;
  const smartPageTakeover = `
    <div
      data-vonza-assistant
      data-agent-id="${mockAgentId}"
      data-layout="page-takeover"
      data-surface="flat"
      data-background-scope="viewport"
      data-title="Matrix dedicated page assistant"
    ></div>
  `;
  const smartTruePageTakeover = `
    <div
      data-vonza-assistant
      data-agent-id="${mockAgentId}"
      data-layout="page-takeover"
      data-surface="flat"
      data-background-scope="page"
      data-page-reset="true"
      data-hide-page-footer="true"
      data-hide-page-title="true"
      data-title="Matrix true page takeover assistant"
    ></div>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Vonza assistant embed matrix</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #17202a;
      background: #f5f7fb;
    }
    header {
      padding: 24px clamp(16px, 4vw, 48px);
      border-bottom: 1px solid #d9e0ea;
      background: #ffffff;
    }
    h1, h2, p { margin-top: 0; }
    h1 { margin-bottom: 6px; font-size: clamp(1.4rem, 3vw, 2.1rem); }
    h2 { margin-bottom: 10px; font-size: 1.05rem; }
    p { color: #5c6878; line-height: 1.55; }
    .matrix-grid {
      display: grid;
      gap: 28px;
      padding: 28px clamp(16px, 4vw, 48px) 48px;
    }
    .matrix-case {
      min-width: 0;
      padding: 18px;
      border: 1px solid #dbe2ec;
      border-radius: 8px;
      background: #ffffff;
    }
    .narrow-page { max-width: 760px; margin: 0 auto; }
    .landing-page { width: 100%; }
    .sticky-shell { padding-top: 72px; }
    .sticky-bar {
      position: sticky;
      top: 0;
      z-index: 2;
      height: 64px;
      display: flex;
      align-items: center;
      padding: 0 18px;
      border: 1px solid #cfd8e3;
      border-radius: 8px;
      background: #ffffff;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
    }
    .dark-page {
      border-color: #263241;
      background: #111827;
      color: #f8fafc;
    }
    .dark-page p { color: #cbd5e1; }
    .footer-close {
      display: grid;
      gap: 14px;
    }
    .test-footer {
      min-height: 96px;
      display: grid;
      place-items: center;
      border-radius: 8px;
      background: #e8edf5;
      color: #536070;
      font-weight: 700;
    }
    .mobile-frame {
      max-width: 390px;
      margin: 0 auto;
      padding: 12px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #f8fafc;
    }
    .wp-site-blocks {
      max-width: 860px;
      margin: 0 auto;
      padding: 36px 28px;
      background: #ffffff;
    }
  </style>
</head>
<body>
  <header>
    <h1>Vonza assistant embed matrix</h1>
    <p>Local-only layout matrix for the smart assistant embed. The mock agent id is only used on this test route.</p>
  </header>
  <main class="matrix-grid">
    <section class="matrix-case narrow-page">
      <h2>Narrow centered content page</h2>
      <p>Section embed inside a constrained article-style page.</p>
      ${smartSection}
    </section>
    <section class="matrix-case landing-page">
      <h2>Full-width landing page</h2>
      <p>Front Desk page as the primary page content.</p>
      ${smartFullPage}
    </section>
    <section class="matrix-case landing-page footer-close">
      <h2>Full-page height mode with footer</h2>
      <p>Full-page smart embed fills the visible page area below where it is inserted.</p>
      ${smartFullPageHeight}
      <div class="test-footer">Customer website footer</div>
    </section>
    <section class="matrix-case landing-page footer-close">
      <h2>Dedicated page takeover</h2>
      <p>Page takeover smart embed fills the visible page area below the website header.</p>
      ${smartPageTakeover}
      <div class="test-footer">Customer website footer</div>
    </section>
    <section class="matrix-case landing-page footer-close">
      <h2>True page takeover with fake WordPress title and footer</h2>
      <p>Advanced opt-in mode resets the nearest WordPress-like content wrapper and can hide scoped page chrome.</p>
      <div class="wp-site-blocks">
        <h1 class="wp-block-post-title">Book with our front desk</h1>
        <div class="entry-content">
          ${smartTruePageTakeover}
        </div>
      </div>
      <footer class="site-footer test-footer">Customer website footer</footer>
    </section>
    <section class="matrix-case sticky-shell">
      <div class="sticky-bar">Sticky customer website header</div>
      <h2>Sticky header page</h2>
      <p>Full-page smart embed with an explicit header offset.</p>
      <div
        data-vonza-assistant
        data-agent-id="${mockAgentId}"
        data-layout="full-page"
        data-surface="flat"
        data-header-offset="72"
        data-title="Matrix sticky header assistant"
      ></div>
    </section>
    <section class="matrix-case dark-page">
      <h2>Dark background page</h2>
      <p>Section embed with transparent surface requested by the host layout.</p>
      <div
        data-vonza-assistant
        data-agent-id="${mockAgentId}"
        data-layout="section"
        data-surface="transparent"
        data-title="Matrix transparent assistant"
      ></div>
    </section>
    <section class="matrix-case footer-close">
      <h2>Page with footer close below</h2>
      <p>Section embed followed immediately by footer content.</p>
      ${smartSection}
      <div class="test-footer">Customer website footer</div>
    </section>
    <section class="matrix-case">
      <div class="mobile-frame">
        <h2>Mobile-like narrow container</h2>
        <p>Section embed inside a phone-width website builder column.</p>
        ${smartSection}
      </div>
    </section>
  </main>
  ${mockBackgroundScript}
  <script async src="/assistant-embed.js?matrix=4"></script>
</body>
</html>`;
}

export function createPublicRouter({ rootDir }) {
  const router = express.Router();

  router.get("/", (_req, res) => {
    res.type("html").send(renderMarketingPage(rootDir, "home"));
  });

  router.get("/hu", (_req, res) => {
    res.type("html").send(renderMarketingPage(rootDir, "home", "hu"));
  });

  router.get(["/hu/features", "/hu/product", "/hu/pricing", "/hu/about"], (_req, res) => {
    res.type("html").send(renderMarketingPage(rootDir, "home", "hu"));
  });

  router.get("/features", (_req, res) => {
    res.type("html").send(renderMarketingPage(rootDir, "features"));
  });

  router.get("/product", (_req, res) => {
    res.type("html").send(renderMarketingPage(rootDir, "product"));
  });

  router.get("/front-desk", (_req, res) => {
    res.type("html").send(renderMarketingPage(rootDir, "frontDesk"));
  });

  router.get("/website-widget", (_req, res) => {
    res.type("html").send(renderMarketingPage(rootDir, "websiteWidget"));
  });

  router.get("/voice-agent", (_req, res) => {
    res.type("html").send(renderMarketingPage(rootDir, "voiceAgent"));
  });

  router.get(["/qdh", "/quote-desk-hu"], (_req, res) => {
    res.type("html").send(renderQuoteDeskHuAcquisitionPage());
  });

  router.get(["/enterprise-request-desk", "/esg-request-desk"], (req, res) => {
    res.type("html").send(applyEnterpriseRequestDeskDocumentProfile(
      renderEnterpriseRequestDeskAcquisitionPage(),
      resolveEnterpriseRequestDeskProfile(req.path)
    ));
  });

  router.get(["/qdh/intake", "/quote-desk-hu/intake"], (_req, res) => {
    setDashboardNoStoreHeaders(res);
    res.type("html").send(renderQuoteDeskHuIntakeDocument(rootDir));
  });

  router.get(["/enterprise-request-desk/intake", "/esg-request-desk/intake"], (req, res) => {
    setDashboardNoStoreHeaders(res);
    res.type("html").send(applyEnterpriseRequestDeskDocumentProfile(
      renderEnterpriseRequestDeskIntakeDocument(rootDir),
      resolveEnterpriseRequestDeskProfile(req.path)
    ));
  });

  router.get(["/enterprise-request-desk/demo", "/esg-request-desk/demo"], (_req, res) => {
    setDashboardNoStoreHeaders(res);
    res.type("html").send(renderEnterpriseRequestDeskDemoDocument(rootDir));
  });

  router.post(
    ["/enterprise-request-desk/demo/analyze", "/esg-request-desk/demo/analyze"],
    limitEnterpriseRequestDeskDemo,
    async (req, res, next) => {
      try {
        const message = cleanText(req.body?.message || "");

        setDashboardNoStoreHeaders(res);

        if (!message) {
          res.status(400).json({ error: "Írjon be egy vállalati megkeresést a demo elemzéshez." });
          return;
        }

        if (message.length > ENTERPRISE_REQUEST_DESK_DEMO_MESSAGE_LIMIT) {
          res.status(400).json({
            error: `A demo megkeresés legfeljebb ${ENTERPRISE_REQUEST_DESK_DEMO_MESSAGE_LIMIT} karakter lehet.`,
          });
          return;
        }

        const result = await generateEnterpriseRequestDeskAssistantTurn({
          message,
          businessContext: ENTERPRISE_REQUEST_DESK_DEMO_CONTEXT,
        });

        res.json(buildEnterpriseRequestDeskDemoPayload(result));
      } catch (error) {
        next(error);
      }
    }
  );

  router.get("/how-it-works", (_req, res) => {
    res.redirect(302, "/product");
  });

  router.get("/pricing", (_req, res) => {
    res.type("html").send(renderMarketingPage(rootDir, "pricing"));
  });

  router.get("/about", (_req, res) => {
    res.type("html").send(renderMarketingPage(rootDir, "about"));
  });

  router.get("/contact", (_req, res) => {
    res.redirect(302, "/about");
  });

  router.get("/desktop", (_req, res) => {
    res.redirect(302, "/download/mac");
  });

  router.get("/download/mac", (_req, res) => {
    res.type("html").send(renderMarketingPage(rootDir, "mac"));
  });

  router.get("/widget", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    res.sendFile(path.join(rootDir, "frontend", "widget.html"));
  });

  router.get(["/a/:agentSlug", "/assistant/:agentSlug"], (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    res.sendFile(path.join(rootDir, "frontend", "widget.html"));
  });

  router.get(["/embed.js", "/embed-v1.js"], (_req, res) => {
    res.type("application/javascript");
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
    res.sendFile(path.join(rootDir, "embed.js"));
  });

  router.get("/embed-lite.js", (_req, res) => {
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
    res.sendFile(path.join(rootDir, "embed-lite.js"));
  });

  router.get("/assistant-embed.js", (_req, res) => {
    res.type("application/javascript");
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
    res.sendFile(path.join(rootDir, "assistant-embed.js"));
  });

  router.get("/favicon.ico", (_req, res) => {
    res.status(204).end();
  });

  router.get("/generator", (_req, res) => {
    res.redirect("/dashboard");
  });

  router.get([
    "/dashboard",
    "/dashboard/front-desk",
    "/dashboard/widget",
    "/dashboard/voice",
    "/website-widget/dashboard",
    "/widget/dashboard",
  ], (_req, res) => {
    setDashboardNoStoreHeaders(res);
    res.type("html").send(renderDashboardDocument(rootDir));
  });

  router.get(["/qdh/dashboard", "/quote-desk-hu/dashboard"], (_req, res) => {
    setDashboardNoStoreHeaders(res);
    res.type("html").send(renderQuoteDeskHuDashboardDocument(rootDir));
  });

  router.get(["/enterprise-request-desk/dashboard", "/esg-request-desk/dashboard"], (req, res) => {
    setDashboardNoStoreHeaders(res);
    res.type("html").send(applyEnterpriseRequestDeskDocumentProfile(
      renderEnterpriseRequestDeskDashboardDocument(rootDir),
      resolveEnterpriseRequestDeskProfile(req.path)
    ));
  });

  router.get(["/qdh/setup", "/quote-desk-hu/setup"], (_req, res) => {
    setDashboardNoStoreHeaders(res);
    res.type("html").send(renderQuoteDeskHuSetupDocument(rootDir));
  });

  router.get(["/enterprise-request-desk/setup", "/esg-request-desk/setup"], (req, res) => {
    setDashboardNoStoreHeaders(res);
    res.type("html").send(applyEnterpriseRequestDeskDocumentProfile(
      renderEnterpriseRequestDeskSetupDocument(rootDir),
      resolveEnterpriseRequestDeskProfile(req.path)
    ));
  });

  router.get(["/qdh/intake-fixture", "/quote-desk-hu/intake-fixture"], (req, res) => {
    if (!isLocalDashboardFixtureAllowed(req)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    setDashboardNoStoreHeaders(res);
    res.type("html").send(renderQuoteDeskHuIntakeDocument(rootDir, { localFixture: true }));
  });

  router.get(["/qdh/dashboard-fixture", "/quote-desk-hu/dashboard-fixture"], (req, res) => {
    if (!isLocalDashboardFixtureAllowed(req)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    setDashboardNoStoreHeaders(res);
    res.type("html").send(renderQuoteDeskHuDashboardDocument(rootDir, { localFixture: true }));
  });

  router.get(["/enterprise-request-desk/intake-fixture", "/esg-request-desk/intake-fixture"], (req, res) => {
    if (!isLocalDashboardFixtureAllowed(req)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    setDashboardNoStoreHeaders(res);
    res.type("html").send(applyEnterpriseRequestDeskDocumentProfile(
      renderEnterpriseRequestDeskIntakeDocument(rootDir, { localFixture: true }),
      resolveEnterpriseRequestDeskProfile(req.path)
    ));
  });

  router.get(["/enterprise-request-desk/dashboard-fixture", "/esg-request-desk/dashboard-fixture"], (req, res) => {
    if (!isLocalDashboardFixtureAllowed(req)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    setDashboardNoStoreHeaders(res);
    const localFixtureMode = req.query.state === "setup-missing" ? "setup_missing" : "";
    res.type("html").send(applyEnterpriseRequestDeskDocumentProfile(
      renderEnterpriseRequestDeskDashboardDocument(rootDir, {
        localFixture: true,
        localFixtureMode,
      }),
      resolveEnterpriseRequestDeskProfile(req.path)
    ));
  });

  router.get("/dashboard-v2-fixture", (req, res) => {
    if (!isLocalDashboardFixtureAllowed(req)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    setDashboardNoStoreHeaders(res);
    res.type("html").send(renderDashboardDocument(rootDir, { localFixture: true }));
  });

  router.get("/dashboard-v2-preview", (req, res) => {
    if (!isLocalDashboardFixtureAllowed(req)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.sendFile(path.join(rootDir, "frontend", "dashboard-v2-preview.html"));
  });

  router.get("/full-page-assistant-v2-preview", (req, res) => {
    if (!isLocalDashboardFixtureAllowed(req)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.sendFile(path.join(rootDir, "frontend", "full-page-assistant-v2-preview.html"));
  });

  router.get("/assistant-embed-matrix", (req, res) => {
    if (!isLocalDashboardFixtureAllowed(req)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.type("html").send(renderAssistantEmbedMatrixPage({
      agentId: req.query.agent_id,
      mockBackground: req.query.mock_background === "1",
    }));
  });

  router.get("/aszf", (_req, res) => {
    res.type("html");
    res.send(renderLegalPage("terms"));
  });

  router.get("/impresszum", (_req, res) => {
    res.type("html");
    res.send(renderLegalPage("imprint"));
  });

  router.get("/adatkezelesi-tajekoztato", (_req, res) => {
    res.type("html");
    res.send(renderLegalPage("privacy"));
  });

  router.get("/cookie-tajekoztato", (_req, res) => {
    res.type("html");
    res.send(renderLegalPage("cookies"));
  });

  router.get("/terms", (_req, res) => {
    res.redirect(302, "/aszf");
  });

  router.get("/privacy", (_req, res) => {
    res.redirect(302, "/adatkezelesi-tajekoztato");
  });

  router.get("/cookies", (_req, res) => {
    res.redirect(302, "/cookie-tajekoztato");
  });

  router.get("/imprint", (_req, res) => {
    res.redirect(302, "/impresszum");
  });

  router.get("/public-config.js", (req, res) => {
    const operatorWorkspaceEnabled = isOperatorWorkspaceV1Enabled();
    const todayCopilotEnabled = isTodayCopilotEnabled();
    const launchProfile = getPublicLaunchProfile({
      operatorWorkspaceEnabled,
    });
    res.type("application/javascript");
    setDashboardNoStoreHeaders(res);
    res.send(`
window.VONZA_PUBLIC_APP_URL = ${JSON.stringify(getPublicAppUrl())};
window.VONZA_SUPABASE_URL = ${JSON.stringify(getSupabasePublicUrl())};
window.VONZA_SUPABASE_ANON_KEY = ${JSON.stringify(getSupabaseAnonKey())};
window.VONZA_DEV_FAKE_BILLING = ${JSON.stringify(isLocalDevBillingRequestAllowed(req))};
window.VONZA_OPERATOR_WORKSPACE_V1_ENABLED = ${JSON.stringify(operatorWorkspaceEnabled)};
window.VONZA_OPERATOR_WORKSPACE_V1 = window.VONZA_OPERATOR_WORKSPACE_V1_ENABLED;
window.VONZA_TODAY_COPILOT_V1_ENABLED = ${JSON.stringify(todayCopilotEnabled)};
window.VONZA_DASHBOARD_V2_ENABLED = true;
window.VONZA_APP_VERSION = ${JSON.stringify(getAppVersion())};
window.VONZA_BUILD_SHA = ${JSON.stringify(getBuildSha())};
window.VONZA_LAUNCH_PROFILE = ${JSON.stringify(launchProfile)};
window.VONZA_BILLING_PLANS = ${JSON.stringify(listPublicBillingPlans())};
`.trim());
  });

  router.get("/setup-doctor", (req, res) => {
    if (!isLocalDevBillingRequestAllowed(req)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const checks = SETUP_DOCTOR_KEYS.map((key) => ({
      key,
      present: Boolean(String(process.env[key] || "").trim()),
    }));

    res.json({
      ok: checks.every((check) => check.present),
      dev_fake_billing: true,
      checks,
      embeddings: {
        enabled: getRagConfig().embeddingsEnabled,
        openai_api_key_present: Boolean(String(process.env.OPENAI_API_KEY || "").trim()),
        model: getRagConfig().embeddingModel,
        dimensions: getRagConfig().embeddingDimensions,
        max_context_chunks: getRagConfig().maxContextChunks,
        min_similarity: getRagConfig().minSimilarity,
      },
      production: {
        rate_limit: getDistributedRateLimitReadiness({
          ...process.env,
          NODE_ENV: "production",
          VONZA_DEPLOY_ENV: process.env.VONZA_DEPLOY_ENV || "production",
          NODE_TEST_CONTEXT: "",
        }, { productionRequired: true }),
      },
    });
  });

  router.get("/supabase-auth.js", (_req, res) => {
    res.type("application/javascript");
    res.sendFile(
      path.join(rootDir, "node_modules", "@supabase", "supabase-js", "dist", "umd", "supabase.js")
    );
  });

  router.get("/admin", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  router.get("/manifest.json", (_req, res) => {
    res.sendFile(path.join(rootDir, "manifest.json"));
  });

  router.get("/service-worker.js", (_req, res) => {
    res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.sendFile(path.join(rootDir, "service-worker.js"));
  });

  router.get("/icon-192.svg", (_req, res) => {
    res.sendFile(path.join(rootDir, "icon-192.svg"));
  });

  router.get("/icon-512.svg", (_req, res) => {
    res.sendFile(path.join(rootDir, "icon-512.svg"));
  });

  router.get("/health", (_req, res) => {
    const operatorWorkspaceEnabled = isOperatorWorkspaceV1Enabled();
    res.json({
      ok: true,
      version: getAppVersion(),
      buildSha: getBuildSha() || null,
      operatorWorkspaceV1Enabled: operatorWorkspaceEnabled,
      launchMode: getPublicLaunchProfile({ operatorWorkspaceEnabled }).mode,
    });
  });

  router.get("/ready", async (_req, res) => {
    const readiness = await getReadinessStatus();
    res.status(readiness.ok ? 200 : 503).json({
      ok: readiness.ok,
      checks: readiness.checks,
    });
  });

  router.get("/build", (_req, res) => {
    const operatorWorkspaceEnabled = isOperatorWorkspaceV1Enabled();
    res.json({
      ok: true,
      version: getAppVersion(),
      buildSha: getBuildSha() || null,
      operatorWorkspaceV1Enabled: operatorWorkspaceEnabled,
      launchMode: getPublicLaunchProfile({ operatorWorkspaceEnabled }).mode,
    });
  });

  return router;
}
