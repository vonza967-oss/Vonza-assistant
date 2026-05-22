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
import { getDistributedRateLimitReadiness } from "../utils/rateLimiter.js";

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
    "/settings/settings.css",
    "/public-config.js",
    "/i18n/dashboardI18n.js",
    "/settings/SettingsShell.js",
    "/dashboardHelpers.js",
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

function renderAppImage({
  src,
  alt,
  caption = "",
  className = "",
  loading = "lazy",
}) {
  return `
    <figure class="app-frame ${className}">
      <div class="app-frame-bar" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
      <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="${escapeHtml(loading)}" width="1440" height="980">
      ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}
    </figure>
  `;
}

function renderValueStrip() {
  return `
    <section class="value-strip" aria-label="Vonza value">
      ${[
        "Prioritize customer replies",
        "Spot warm leads",
        "Reduce missed messages",
        "No AI knowledge needed",
      ].map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
    </section>
  `;
}

function renderFinalCta() {
  return `
    <section class="final-cta" data-reveal>
      <div>
        <h2>Open a sharper front desk for every customer question.</h2>
        <p>Set up Vonza, install the widget, and keep the customer work moving from one focused dashboard.</p>
      </div>
      <div class="final-cta-actions">
        <a class="button button-primary" data-app-link href="/dashboard?from=site">Open dashboard</a>
        <a class="button button-secondary" href="/features">View features</a>
      </div>
    </section>
  `;
}

function renderMarketingHomePage() {
  return `
    <section class="hero">
      <div class="hero-copy" data-reveal>
        <h1>An AI front desk for your customer questions.</h1>
        <p class="hero-text">Vonza answers common questions, captures customer details, and keeps conversations organized so teams can respond faster and lose fewer customers.</p>
        <div class="hero-actions">
          <a class="button button-primary" data-app-link href="/dashboard?from=site">Start your front desk</a>
          <a class="button button-secondary" href="/product">See product tour</a>
        </div>
      </div>
      <div class="hero-media" data-reveal style="--reveal-delay: 100ms;">
        ${renderAppImage({
          src: "/assets/product/dashboard-home.png",
          alt: "Vonza dashboard home showing daily customer priorities and service metrics",
          caption: "Home highlights customer priorities, wins, and service quality in one operational view.",
          className: "app-frame-hero",
          loading: "eager",
        })}
      </div>
    </section>

    ${renderValueStrip()}

    <section class="section">
      <div class="section-heading-row" data-reveal>
        <div>
          <h2>Built for the customer work after the first question.</h2>
          <p>Vonza keeps the dashboard compact and operational, so owners and teams can see who needs attention without sorting through noisy tools.</p>
        </div>
        <a class="text-arrow" href="/features">Explore all features</a>
      </div>
      <div class="feature-preview-grid">
        <article class="feature-preview-card" data-reveal>
          ${renderAppImage({
            src: "/assets/product/customers-list.png",
            alt: "Vonza customers page showing customer rows and statuses",
          })}
          <h3>Customer record rows</h3>
          <p>See recent messages, reply state, lead context, and clean status pills in one compact list.</p>
        </article>
        <article class="feature-preview-card" data-reveal style="--reveal-delay: 80ms;">
          ${renderAppImage({
            src: "/assets/product/front-desk-inbox.png",
            alt: "Vonza Front Desk page showing preview and readiness panels",
          })}
          <h3>Front Desk readiness</h3>
          <p>Test the customer-facing assistant, review business grounding, and move into install when ready.</p>
        </article>
        <article class="feature-preview-card" data-reveal style="--reveal-delay: 160ms;">
          ${renderAppImage({
            src: "/assets/product/analytics-overview.png",
            alt: "Vonza analytics overview showing customer service KPIs and trend chart",
          })}
          <h3>Customer-service analytics</h3>
          <p>Track conversations, captured leads, weak-answer areas, and the customer questions that repeat.</p>
        </article>
      </div>
    </section>

    <section class="section product-story">
      <div class="story-copy" data-reveal>
        <h2>One path from install to faster replies.</h2>
        <p>Install the widget, let Vonza capture customer questions, review priority replies, and use analytics to tighten the answers customers rely on.</p>
        <a class="button button-secondary" href="/product">How it works</a>
      </div>
      ${renderAppImage({
        src: "/assets/product/settings-install.png",
        alt: "Vonza install and settings view with setup status and configuration controls",
        caption: "Settings and Install stay separate from the main dashboard so setup work never clutters daily operations.",
        className: "story-frame",
      })}
    </section>

    <section class="section use-cases">
      <div class="section-intro" data-reveal>
        <h2>For teams that cannot afford missed customer intent.</h2>
      </div>
      <div class="use-case-grid">
        ${[
          ["Service businesses", "Capture quote, booking, and callback intent while the team is busy."],
          ["Ecommerce teams", "Answer product and order questions before they become abandoned carts."],
          ["Creators and experts", "Route warm questions into a clearer follow-up process."],
          ["Support teams", "Keep common questions answered and urgent replies visible."],
        ].map(([title, copy]) => `
          <article data-reveal>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(copy)}</p>
          </article>
        `).join("")}
      </div>
    </section>

    ${renderMarketingPricingSection()}

    <section class="section connected-section">
      <div class="connected-note" data-reveal>
        <h2>Email, calendar, and automation connections are planned for later.</h2>
        <p>Today, Vonza focuses on your website front desk and customer conversations.</p>
        <span>Coming soon</span>
      </div>
    </section>

    ${renderFinalCta()}
  `;
}

function renderFeaturesPage() {
  const features = [
    {
      title: "AI customer assistant",
      copy: "Answer common website questions with business-aware guidance, clear next steps, and a tone that matches the company.",
      src: "/assets/product/front-desk-inbox.png",
      alt: "Vonza Front Desk preview for testing an AI customer assistant",
    },
    {
      title: "Customer inbox / front desk",
      copy: "Review conversations, chat availability, customer context, and handoff states without leaving the operational workspace.",
      src: "/assets/product/customers-crm.png",
      alt: "Vonza customer workspace with inbox-style customer rows",
    },
    {
      title: "Lead detection",
      copy: "Surface quote, booking, callback, and high-intent questions so the best follow-up does not get buried.",
      src: "/assets/product/dashboard-home.png",
      alt: "Vonza home page highlighting priority lead and reply tasks",
    },
    {
      title: "Reply prioritization",
      copy: "Give unhappy customers, unanswered questions, and warm leads a cleaner visual priority than ordinary activity.",
      src: "/assets/product/customers-crm.png",
      alt: "Vonza customer list with reply and lead status pills",
    },
    {
      title: "Analytics",
      copy: "Measure conversations, captured leads, weak answers, and frequent questions in a credible customer-service report.",
      src: "/assets/product/analytics-overview.png",
      alt: "Vonza analytics dashboard with KPI cards and chart",
    },
    {
      title: "Settings / installation",
      copy: "Keep business profile, widget behavior, installation, and verification clear without changing the daily dashboard flow.",
      src: "/assets/product/settings-install.png",
      alt: "Vonza settings and install configuration screens",
    },
  ];

  return `
    <section class="page-hero page-hero-split">
      <div data-reveal>
        <h1>Everything the front desk needs to answer, route, and prioritize.</h1>
        <p>Vonza combines customer-facing AI with an admin workspace designed for reply quality, lead visibility, and installation confidence.</p>
      </div>
      ${renderAppImage({
        src: "/assets/product/front-desk-inbox.png",
        alt: "Vonza Front Desk page with readiness and preview states",
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

    ${renderFinalCta()}
  `;
}

function renderProductPage() {
  const steps = [
    ["Install", "Add Vonza to the website and verify the live embed.", "/assets/product/settings-install.png", "Vonza install page with setup steps"],
    ["Connect or configure", "Set the business profile, tone, routing, and the knowledge Vonza should trust.", "/assets/product/settings-install.png", "Vonza settings page with business profile controls"],
    ["Capture customer questions", "Let visitors ask questions and get useful first answers from the front desk.", "/assets/product/front-desk-inbox.png", "Vonza Front Desk preview conversation"],
    ["Prioritize leads and replies", "Review warm leads, unhappy customers, and unresolved questions first.", "/assets/product/customers-crm.png", "Vonza customers page with prioritized customer records"],
    ["Respond faster", "Use the latest context and suggested next step to decide what to do next.", "/assets/product/dashboard-home.png", "Vonza Home page with service priorities"],
    ["Track performance", "See customer question themes, weak-answer areas, and outcomes in Analytics.", "/assets/product/analytics-overview.png", "Vonza analytics overview with chart"],
  ];

  return `
    <section class="page-hero page-hero-split">
      <div data-reveal>
        <h1>How Vonza moves a customer question into a clear next step.</h1>
        <p>From the website widget to the daily dashboard, every part of the product is built around answering faster and losing fewer customer opportunities.</p>
      </div>
      ${renderAppImage({
        src: "/assets/product/dashboard-home.png",
        alt: "Vonza Home page showing customer priorities and service metrics",
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

    ${renderFinalCta()}
  `;
}

function renderPricingPage() {
  return `
    <section class="page-hero">
      <div data-reveal>
        <h1>Simple plans for launching an AI front desk.</h1>
        <p>Choose the plan that matches the amount of customer conversation you want Vonza to help organize and answer.</p>
      </div>
    </section>
    ${renderMarketingPricingSection()}
    <section class="section faq-section">
      <div class="section-intro" data-reveal>
        <h2>Pricing FAQ</h2>
      </div>
      <div class="faq-grid">
        ${[
          ["Can I start without a technical setup?", "Yes. Vonza gives you an install snippet and verification flow so setup stays clear."],
          ["Can I change plans later?", "Yes. Plan movement is handled from the dashboard billing experience when billing is configured."],
          ["What happens if traffic is quiet?", "The dashboard still shows setup readiness, weak areas, and what needs attention as activity grows."],
          ["Is this replacing my team?", "No. Vonza handles common first questions and keeps the human follow-up work visible."],
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
        <h1>Vonza is built for businesses that answer customer questions while doing the work.</h1>
        <p>It gives small teams a sharper front desk: helpful first responses for visitors, a cleaner place for customer follow-up, and visibility into what people keep asking.</p>
        <div class="hero-actions">
          <a class="button button-primary" data-app-link href="/dashboard?from=site">Open dashboard</a>
          <a class="button button-secondary" href="mailto:support@vonza.app">Contact</a>
        </div>
      </div>
      ${renderAppImage({
        src: "/assets/product/dashboard-home.png",
        alt: "Vonza dashboard home for customer-service operations",
        className: "page-hero-frame",
        loading: "eager",
      })}
    </section>

    <section class="section about-grid">
      <article data-reveal>
        <h2>Product principle</h2>
        <p>Vonza stays focused on customer service work: answer what can be answered, capture useful context, and make the next human action obvious.</p>
      </article>
      <article data-reveal style="--reveal-delay: 80ms;">
        <h2>Who it serves</h2>
        <p>Service businesses, ecommerce teams, creators, and support operators that need fewer missed messages and clearer reply priorities.</p>
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

const MARKETING_PAGES = {
  home: {
    title: "Vonza | AI front desk for customer questions",
    description: "Vonza answers customer questions, detects warm leads, and organizes reply priorities in a polished dashboard for small teams.",
    body: renderMarketingHomePage,
  },
  features: {
    title: "Vonza Features | AI customer assistant and front desk",
    description: "Explore Vonza features for AI customer assistance, customer inbox, lead detection, reply prioritization, analytics, settings, and install.",
    body: renderFeaturesPage,
  },
  product: {
    title: "Vonza Product | How the AI front desk works",
    description: "See how Vonza moves from installation to customer question capture, lead prioritization, faster replies, and performance tracking.",
    body: renderProductPage,
  },
  pricing: {
    title: "Vonza Pricing | Plans for an AI front desk",
    description: "Review Vonza pricing plans for launching an AI front desk and organizing customer questions.",
    body: renderPricingPage,
  },
  about: {
    title: "About Vonza | AI front desk for busy teams",
    description: "Learn about Vonza, the AI front desk built for small teams that need faster customer replies and fewer missed messages.",
    body: renderAboutPage,
  },
};

function renderMarketingPage(rootDir, pageKey = "home") {
  const page = MARKETING_PAGES[pageKey] || MARKETING_PAGES.home;
  const template = readFileSync(path.join(rootDir, "frontend", "index.html"), "utf8");
  return template
    .replace("<!-- VONZA_MARKETING_TITLE -->", escapeHtml(page.title))
    .replace("<!-- VONZA_MARKETING_DESCRIPTION -->", escapeHtml(page.description))
    .replace("<!-- VONZA_MARKETING_PAGE_KEY -->", escapeHtml(pageKey))
    .replace("<!-- VONZA_MARKETING_PAGE_BODY -->", page.body());
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
      <p>Full-page assistant as the primary page content.</p>
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

  router.get("/features", (_req, res) => {
    res.type("html").send(renderMarketingPage(rootDir, "features"));
  });

  router.get("/product", (_req, res) => {
    res.type("html").send(renderMarketingPage(rootDir, "product"));
  });

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

  router.get("/widget", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    res.sendFile(path.join(rootDir, "frontend", "widget.html"));
  });

  router.get(["/a/:agentSlug", "/assistant/:agentSlug"], (_req, res) => {
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

  router.get("/assistant-embed.js", (_req, res) => {
    res.type("application/javascript");
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
    res.sendFile(path.join(rootDir, "assistant-embed.js"));
  });

  router.get("/generator", (_req, res) => {
    res.redirect("/dashboard");
  });

  router.get("/dashboard", (_req, res) => {
    setDashboardNoStoreHeaders(res);
    res.type("html").send(renderDashboardDocument(rootDir));
  });

  router.get("/dashboard-v2-fixture", (req, res) => {
    if (!isLocalDashboardFixtureAllowed(req)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    setDashboardNoStoreHeaders(res);
    res.type("html").send(renderDashboardDocument(rootDir, { localFixture: true }));
  });

  router.get("/dashboard-v2-preview", (_req, res) => {
    res.sendFile(path.join(rootDir, "frontend", "dashboard-v2-preview.html"));
  });

  router.get("/full-page-assistant-v2-preview", (_req, res) => {
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
