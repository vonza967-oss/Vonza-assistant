const MOCK_BUSINESS = Object.freeze({
  name: "Smith & Co.",
  domain: "smithco.com",
  assistantName: "Smith & Co. Assistant",
  accent: "#0f8f83",
  quickActions: [
    "What services do you offer?",
    "How much does it cost?",
    "Can I request a quote?",
    "Can I book a time?",
    "How can I contact you?",
  ],
});

const VARIANTS = Object.freeze({
  "business-help": "Business Help Page",
  "quote-booking": "Quote / Booking Assistant",
  "minimal-embedded": "Minimal Embedded Page",
});

const STAGE = document.getElementById("variant-stage");
const VARIANT_LINKS = Array.from(document.querySelectorAll("[data-variant-link]"));

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getInitials(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "S";
}

function quickActionButtons(limit = MOCK_BUSINESS.quickActions.length) {
  return MOCK_BUSINESS.quickActions
    .slice(0, limit)
    .map((action) => `<button class="quick-chip" type="button">${escapeHtml(action)}</button>`)
    .join("");
}

function businessMark(className = "") {
  return `<div class="business-mark ${className}" aria-hidden="true">${escapeHtml(getInitials(MOCK_BUSINESS.name))}</div>`;
}

function statusPill() {
  return `
    <span class="assistant-status">
      <span class="status-dot" aria-hidden="true"></span>
      AI assistant online
    </span>
  `;
}

function chatPanel({ compact = false, framed = true } = {}) {
  const compactClass = compact ? " chat-panel-compact" : "";
  const framedClass = framed ? "" : " chat-panel-flat";

  return `
    <section class="chat-panel${compactClass}${framedClass}" aria-label="${escapeHtml(MOCK_BUSINESS.assistantName)} chat preview">
      <header class="chat-panel-header">
        <div>
          <p>${escapeHtml(MOCK_BUSINESS.assistantName)}</p>
          <h2>Ask a question</h2>
        </div>
        ${statusPill()}
      </header>
      <div class="chat-thread" aria-label="Example conversation">
        <div class="message assistant-message">
          <span>${escapeHtml(MOCK_BUSINESS.assistantName)}</span>
          <p>Hi, I can help with services, pricing, booking details, quotes, or the best way to contact the team.</p>
        </div>
        <div class="message visitor-message">
          <p>I need help choosing the right service.</p>
        </div>
        <div class="message assistant-message">
          <span>${escapeHtml(MOCK_BUSINESS.assistantName)}</span>
          <p>Tell me what you need help with and when you would like it done. I can guide you to the right next step.</p>
        </div>
      </div>
      <form class="assistant-composer">
        <div class="quick-actions" aria-label="Example quick actions">
          ${quickActionButtons(compact ? 4 : 5)}
        </div>
        <div class="composer-row">
          <label class="sr-only" for="assistant-preview-input">Type your question</label>
          <input id="assistant-preview-input" type="text" value="" placeholder="Type your question...">
          <button class="send-button" type="button" aria-label="Send message">
            <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
              <path d="M20.72 4.46a1 1 0 0 0-1.04-.16L4.37 10.72a1 1 0 0 0 .08 1.87l6.03 2.17 2.18 6.02a1 1 0 0 0 .9.66h.06a1 1 0 0 0 .92-.77L20.9 5.35a1 1 0 0 0-.18-.89Zm-7.17 13.01-1.43-3.97a1 1 0 0 0-.6-.6L7.55 11.47l10.48-4.4-4.48 10.4Z"></path>
            </svg>
          </button>
        </div>
      </form>
    </section>
  `;
}

function poweredBy() {
  return `<footer class="powered-by">Powered by Vonza</footer>`;
}

function renderBusinessHelp() {
  return `
    <article class="variant-page business-help-page" data-variant="business-help">
      <header class="business-topbar">
        <div class="business-identity">
          ${businessMark()}
          <div>
            <p>${escapeHtml(MOCK_BUSINESS.domain)}</p>
            <h1>${escapeHtml(MOCK_BUSINESS.name)}</h1>
          </div>
        </div>
        ${statusPill()}
      </header>

      <section class="help-hero">
        <div>
          <h2>Front Desk</h2>
          <p>Ask about services, pricing, quotes, or contact details.</p>
        </div>
      </section>

      <section class="business-help-grid">
        ${chatPanel()}
        <aside class="support-stack" aria-label="Helpful context">
          <section class="support-card">
            <h3>Popular questions</h3>
            <ul>
              <li>Which service is right for me?</li>
              <li>How do quotes and bookings work?</li>
              <li>What should I prepare before we talk?</li>
            </ul>
          </section>
          <section class="support-card contact-card">
            <h3>Leave your details</h3>
            <p>If the assistant cannot finish the request, it can help collect your name, email, and notes for follow-up.</p>
          </section>
          <section class="reply-card">
            <strong>Typically replies instantly</strong>
            <span>Business-specific support for ${escapeHtml(MOCK_BUSINESS.name)}</span>
          </section>
        </aside>
      </section>

      ${poweredBy()}
    </article>
  `;
}

function renderQuoteBooking() {
  const actionCards = [
    ["Request a quote", "Share what you need and the assistant will gather the right details."],
    ["Book a time", "Find the best next step for appointments, calls, or visits."],
    ["Ask about pricing", "Get guidance on typical costs, scope, and what affects price."],
  ];

  return `
    <article class="variant-page quote-booking-page" data-variant="quote-booking">
      <section class="quote-layout">
        <div class="quote-copy">
          <header class="business-identity quote-identity">
            ${businessMark()}
            <div>
              <p>${escapeHtml(MOCK_BUSINESS.domain)}</p>
              <h1>${escapeHtml(MOCK_BUSINESS.name)}</h1>
            </div>
          </header>
          <div class="quote-headline">
            <h2>Get help choosing, pricing, or booking the right service.</h2>
            <p>Ask a question, request a quote, or leave the details the team needs to follow up with a clear next step.</p>
          </div>
          <div class="action-card-grid">
            ${actionCards.map(([title, copy]) => `
              <button class="action-card" type="button">
                <span>${escapeHtml(title)}</span>
                <p>${escapeHtml(copy)}</p>
              </button>
            `).join("")}
          </div>
        </div>

        ${chatPanel()}
      </section>

      <section class="trust-row" aria-label="Assistant trust points">
        <span>Instant answers</span>
        <span>Contact details captured if needed</span>
        <span>Business-specific support</span>
      </section>

      ${poweredBy()}
    </article>
  `;
}

function renderMinimalEmbedded() {
  return `
    <article class="variant-page minimal-embedded-page" data-variant="minimal-embedded">
      <section class="embedded-panel">
        <header class="embedded-header">
          <div class="business-identity">
            ${businessMark("business-mark-small")}
            <div>
              <p>${escapeHtml(MOCK_BUSINESS.domain)}</p>
              <h1>${escapeHtml(MOCK_BUSINESS.name)} Help</h1>
            </div>
          </div>
          ${statusPill()}
        </header>

        ${chatPanel({ compact: true, framed: false })}
      </section>

      ${poweredBy()}
    </article>
  `;
}

function getActiveVariant() {
  const candidate = window.location.hash.replace("#", "");
  return Object.hasOwn(VARIANTS, candidate) ? candidate : "business-help";
}

function renderVariant() {
  const activeVariant = getActiveVariant();

  document.documentElement.style.setProperty("--business-accent", MOCK_BUSINESS.accent);
  document.title = `${VARIANTS[activeVariant]} | Full-page Assistant V2 Preview`;

  VARIANT_LINKS.forEach((link) => {
    const isActive = link.dataset.variantLink === activeVariant;
    link.classList.toggle("is-active", isActive);
    link.setAttribute("aria-current", isActive ? "page" : "false");
  });

  if (activeVariant === "quote-booking") {
    STAGE.innerHTML = renderQuoteBooking();
    return;
  }

  if (activeVariant === "minimal-embedded") {
    STAGE.innerHTML = renderMinimalEmbedded();
    return;
  }

  STAGE.innerHTML = renderBusinessHelp();
}

window.addEventListener("hashchange", renderVariant);
renderVariant();
