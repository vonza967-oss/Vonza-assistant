import express from "express";
import { readFileSync } from "node:fs";
import path from "path";
import {
  getAppVersion,
  getBuildSha,
  getPublicAppUrl,
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

const SETUP_DOCTOR_KEYS = [
  "PUBLIC_APP_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "ADMIN_TOKEN",
  "STRIPE_SECRET_KEY",
  "STRIPE_PRICE_ID_STARTER_MONTHLY",
  "STRIPE_PRICE_ID_GROWTH_MONTHLY",
  "STRIPE_PRICE_ID_PRO_MONTHLY",
  "STRIPE_WEBHOOK_SECRET",
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderMarketingPricingSection() {
  const plans = listPublicBillingPlans();

  return `
      <section id="pricing" class="section pricing-section">
        <div class="section-intro" data-reveal>
          <p class="eyebrow">${escapeHtml(BILLING_USAGE_COPY.sectionEyebrow)}</p>
          <h2>${escapeHtml(BILLING_USAGE_COPY.sectionHeadline)}</h2>
          <p class="section-copy">${escapeHtml(BILLING_USAGE_COPY.sectionNote)}</p>
        </div>

        <div class="pricing-grid">
          ${plans.map((plan) => `
            <article class="pricing-plan${plan.recommended ? " pricing-plan-featured" : ""}" data-reveal>
              ${plan.recommended ? '<span class="pricing-plan-badge">Most popular</span>' : ""}
              <div class="pricing-plan-header">
                <div>
                  <h3>${escapeHtml(plan.displayName)}</h3>
                  <p class="pricing-plan-audience">${escapeHtml(plan.marketing.audience)}</p>
                </div>
                <div class="pricing-plan-price">
                  <strong>${escapeHtml(plan.monthlyPriceLabel)}</strong>
                  <span>Monthly plan</span>
                </div>
              </div>
              <p class="pricing-plan-summary">${escapeHtml(plan.marketing.summary)}</p>
              <p class="pricing-plan-detail">${escapeHtml(plan.marketing.detail)}</p>
              <ul class="pricing-plan-features" aria-label="${escapeHtml(plan.displayName)} plan features">
                ${plan.sharedFeatures.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}
                <li>${escapeHtml(plan.marketing.capacityLabel)}</li>
              </ul>
              <a
                class="button ${plan.recommended ? "button-primary" : "button-secondary"}"
                data-app-link
                data-plan-key="${escapeHtml(plan.key)}"
                href="/dashboard?from=site&amp;plan=${escapeHtml(plan.key)}"
              >${escapeHtml(plan.checkoutLabel)}</a>
            </article>
          `).join("")}
        </div>
      </section>
  `;
}

function renderMarketingIndex(rootDir) {
  const template = readFileSync(path.join(rootDir, "frontend", "index.html"), "utf8");
  return template.replace(
    "<!-- VONZA_MARKETING_PRICING_SECTION -->",
    renderMarketingPricingSection()
  );
}

export function createPublicRouter({ rootDir }) {
  const router = express.Router();

  router.get("/", (_req, res) => {
    res.type("html").send(renderMarketingIndex(rootDir));
  });

  router.get("/widget", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    res.sendFile(path.join(rootDir, "frontend", "widget.html"));
  });

  router.get("/embed.js", (_req, res) => {
    res.type("application/javascript");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(path.join(rootDir, "embed.js"));
  });

  router.get("/embed-lite.js", (_req, res) => {
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(path.join(rootDir, "embed-lite.js"));
  });

  router.get("/generator", (_req, res) => {
    res.redirect("/dashboard");
  });

  router.get("/dashboard", (_req, res) => {
    res.sendFile(path.join(rootDir, "dashboard.html"));
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
    res.send(`
window.VONZA_PUBLIC_APP_URL = ${JSON.stringify(getPublicAppUrl())};
window.VONZA_SUPABASE_URL = ${JSON.stringify(getSupabasePublicUrl())};
window.VONZA_SUPABASE_ANON_KEY = ${JSON.stringify(getSupabaseAnonKey())};
window.VONZA_DEV_FAKE_BILLING = ${JSON.stringify(isLocalDevBillingRequestAllowed(req))};
window.VONZA_OPERATOR_WORKSPACE_V1_ENABLED = ${JSON.stringify(operatorWorkspaceEnabled)};
window.VONZA_OPERATOR_WORKSPACE_V1 = window.VONZA_OPERATOR_WORKSPACE_V1_ENABLED;
window.VONZA_TODAY_COPILOT_V1_ENABLED = ${JSON.stringify(todayCopilotEnabled)};
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
