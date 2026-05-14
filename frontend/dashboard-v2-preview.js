(() => {
  const root = document.getElementById("v2-preview-root");

  const pageMeta = {
    home: {
      title: "Home",
      subtitle: "A clean snapshot of today's customer activity.",
    },
    customers: {
      title: "Customers",
      subtitle: "Track leads, follow-ups, and conversation history.",
    },
    "front-desk": {
      title: "Front Desk",
      subtitle: "Configure, improve, and test your AI front desk.",
    },
    analytics: {
      title: "Analytics",
      subtitle: "Performance insights for your AI front desk.",
    },
    install: {
      title: "Install",
      subtitle: "Add Vonza to your site, full-page assistant, and QR touchpoints.",
    },
    settings: {
      title: "Settings",
      subtitle: "Control branding, team access, billing, and privacy.",
    },
  };

  const navItems = [
    { id: "home", label: "Home", sub: "Today", icon: "home" },
    { id: "customers", label: "Customers", sub: "Follow-ups", icon: "users", badge: "5" },
    { id: "front-desk", label: "Front Desk", sub: "Conversations", icon: "frontDesk", dot: true },
    { id: "analytics", label: "Analytics", sub: "Performance", icon: "analytics", badge: "1" },
    { id: "install", label: "Install", sub: "Embed & QR", icon: "install", section: "Tools" },
    { id: "settings", label: "Settings", sub: "Team & Billing", icon: "settings" },
  ];

  const iconPaths = {
    analytics: [
      '<path d="M4 18 9.5 12.5l3.5 3.5L20 8"></path>',
      '<path d="M15 8h5v5"></path>',
    ],
    arrowDown: ['<path d="M12 5v14"></path>', '<path d="m18 13-6 6-6-6"></path>'],
    arrowUp: ['<path d="M12 19V5"></path>', '<path d="m6 11 6-6 6 6"></path>'],
    bell: [
      '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path>',
      '<path d="M13.7 21a2 2 0 0 1-3.4 0"></path>',
    ],
    calendar: [
      '<rect x="3" y="4" width="18" height="18" rx="2"></rect>',
      '<path d="M16 2v4"></path>',
      '<path d="M8 2v4"></path>',
      '<path d="M3 10h18"></path>',
    ],
    card: [
      '<rect x="3" y="5" width="18" height="14" rx="2"></rect>',
      '<path d="M3 10h18"></path>',
    ],
    chat: [
      '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"></path>',
    ],
    check: ['<path d="m20 6-11 11-5-5"></path>'],
    chevronDown: ['<path d="m6 9 6 6 6-6"></path>'],
    chevronRight: ['<path d="m9 18 6-6-6-6"></path>'],
    clock: ['<circle cx="12" cy="12" r="9"></circle>', '<path d="M12 7v5l3 2"></path>'],
    code: ['<path d="m16 18 6-6-6-6"></path>', '<path d="m8 6-6 6 6 6"></path>'],
    copy: [
      '<rect x="9" y="9" width="13" height="13" rx="2"></rect>',
      '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>',
    ],
    download: ['<path d="M12 3v12"></path>', '<path d="m7 10 5 5 5-5"></path>', '<path d="M5 21h14"></path>'],
    external: ['<path d="M15 3h6v6"></path>', '<path d="M10 14 21 3"></path>', '<path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"></path>'],
    file: ['<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path>', '<path d="M14 2v6h6"></path>'],
    filter: ['<path d="M3 5h18"></path>', '<path d="M7 12h10"></path>', '<path d="M10 19h4"></path>'],
    frontDesk: [
      '<rect x="4" y="4" width="16" height="16" rx="2"></rect>',
      '<path d="M8 9h8"></path>',
      '<path d="M8 13h5"></path>',
      '<path d="M8 17h8"></path>',
    ],
    globe: ['<circle cx="12" cy="12" r="10"></circle>', '<path d="M2 12h20"></path>', '<path d="M12 2a15 15 0 0 1 0 20"></path>', '<path d="M12 2a15 15 0 0 0 0 20"></path>'],
    home: ['<path d="m3 10 9-7 9 7"></path>', '<path d="M5 10v10h14V10"></path>', '<path d="M10 20v-6h4v6"></path>'],
    install: [
      '<rect x="4" y="4" width="6" height="6"></rect>',
      '<rect x="14" y="4" width="6" height="6"></rect>',
      '<rect x="4" y="14" width="6" height="6"></rect>',
      '<path d="M14 14h2"></path>',
      '<path d="M20 14v2"></path>',
      '<path d="M16 20h4v-4"></path>',
    ],
    link: ['<path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.2 1.2"></path>', '<path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.2-1.2"></path>'],
    mail: ['<rect x="3" y="5" width="18" height="14" rx="2"></rect>', '<path d="m3 7 9 6 9-6"></path>'],
    more: ['<circle cx="12" cy="12" r="1"></circle>', '<circle cx="19" cy="12" r="1"></circle>', '<circle cx="5" cy="12" r="1"></circle>'],
    phone: ['<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.7 2.6a2 2 0 0 1-.5 2.1L8 9.7a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.8.3 1.7.6 2.6.7a2 2 0 0 1 2 2.3Z"></path>'],
    qr: [
      '<rect x="3" y="3" width="6" height="6"></rect>',
      '<rect x="15" y="3" width="6" height="6"></rect>',
      '<rect x="3" y="15" width="6" height="6"></rect>',
      '<path d="M15 15h2v2h-2z"></path>',
      '<path d="M19 15h2v6h-6v-2"></path>',
    ],
    search: ['<circle cx="11" cy="11" r="7"></circle>', '<path d="m20 20-3.5-3.5"></path>'],
    send: ['<path d="m22 2-7 20-4-9-9-4Z"></path>', '<path d="M22 2 11 13"></path>'],
    settings: ['<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"></path>', '<path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1a2.1 2.1 0 0 1-3 3l-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1 1.7V22a2.1 2.1 0 0 1-4.2 0v-.2a1.8 1.8 0 0 0-1.1-1.7 1.8 1.8 0 0 0-2 .4l-.1.1a2.1 2.1 0 0 1-3-3l.1-.1a1.8 1.8 0 0 0 .4-2 1.8 1.8 0 0 0-1.7-1H2a2.1 2.1 0 0 1 0-4.2h.2a1.8 1.8 0 0 0 1.7-1.1 1.8 1.8 0 0 0-.4-2l-.1-.1a2.1 2.1 0 0 1 3-3l.1.1a1.8 1.8 0 0 0 2 .4 1.8 1.8 0 0 0 1.1-1.7V2a2.1 2.1 0 0 1 4.2 0v.2a1.8 1.8 0 0 0 1 1.7 1.8 1.8 0 0 0 2-.4l.1-.1a2.1 2.1 0 0 1 3 3l-.1.1a1.8 1.8 0 0 0-.4 2 1.8 1.8 0 0 0 1.7 1.1h.2a2.1 2.1 0 0 1 0 4.2h-.2a1.8 1.8 0 0 0-1.7 1.2Z"></path>'],
    shield: ['<path d="M12 2 20 5v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5Z"></path>', '<path d="m9 12 2 2 4-4"></path>'],
    sparkle: ['<path d="M12 3v5"></path>', '<path d="M12 16v5"></path>', '<path d="M3 12h5"></path>', '<path d="M16 12h5"></path>', '<path d="m5.6 5.6 3.5 3.5"></path>', '<path d="m14.9 14.9 3.5 3.5"></path>', '<path d="m18.4 5.6-3.5 3.5"></path>', '<path d="m9.1 14.9-3.5 3.5"></path>'],
    user: ['<path d="M20 21a8 8 0 0 0-16 0"></path>', '<circle cx="12" cy="7" r="4"></circle>'],
    users: ['<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>', '<circle cx="9" cy="7" r="4"></circle>', '<path d="M22 21v-2a4 4 0 0 0-3-3.9"></path>', '<path d="M16 3.1a4 4 0 0 1 0 7.8"></path>'],
    window: ['<rect x="3" y="4" width="18" height="16" rx="2"></rect>', '<path d="M3 9h18"></path>'],
    x: ['<path d="M18 6 6 18"></path>', '<path d="m6 6 12 12"></path>'],
  };

  const customerRows = [
    {
      initials: "JS",
      name: "Jessica Smith",
      email: "jessica@smithco.com",
      phone: "(555) 123-4567",
      source: "QR code",
      sourceIcon: "qr",
      intent: "Book a demo",
      intentTone: "teal",
      lastMessage: "Do you have any openings this week?",
      lastSeen: "2m ago",
      status: "Warm lead",
      statusTone: "amber",
      dot: "teal",
      selected: true,
    },
    {
      initials: "DL",
      name: "Dylan Lee",
      email: "dylan@modernize.io",
      phone: "(555) 345-9876",
      source: "Full-page",
      sourceIcon: "window",
      intent: "Pricing",
      intentTone: "blue",
      lastMessage: "How much does it cost?",
      lastSeen: "7m ago",
      status: "AI handled",
      statusTone: "green",
    },
    {
      initials: "KH",
      name: "Katherine Hall",
      email: "katherine@innovate.co",
      phone: "(555) 234-1122",
      source: "QR code",
      sourceIcon: "qr",
      intent: "Support",
      intentTone: "purple",
      lastMessage: "I need help with my account",
      lastSeen: "18m ago",
      status: "Follow-up",
      statusTone: "amber",
      dot: "red",
    },
    {
      initials: "MM",
      name: "Michael Miller",
      email: "michael@millerpros.com",
      phone: "(555) 876-5432",
      source: "Website",
      sourceIcon: "globe",
      intent: "General inquiry",
      intentTone: "gray",
      lastMessage: "Tell me more about your services",
      lastSeen: "22m ago",
      status: "AI handled",
      statusTone: "green",
    },
    {
      initials: "SB",
      name: "Sarah Brown",
      email: "sarah@brightpath.com",
      phone: "(555) 654-3210",
      source: "Integrations",
      sourceIcon: "sparkle",
      intent: "Integrations",
      intentTone: "blue",
      lastMessage: "Do you integrate with HubSpot?",
      lastSeen: "35m ago",
      status: "Unanswered",
      statusTone: "red",
      dot: "red",
    },
    {
      initials: "JT",
      name: "James Taylor",
      email: "james@taylorbuild.com",
      phone: "(555) 111-2222",
      source: "Full-page",
      sourceIcon: "window",
      intent: "Book a demo",
      intentTone: "teal",
      lastMessage: "Can we schedule a call next week?",
      lastSeen: "1h ago",
      status: "Warm lead",
      statusTone: "amber",
      avatarTone: "amber",
    },
    {
      initials: "LM",
      name: "Lauren Martinez",
      email: "lauren@creativemco.com",
      phone: "(555) 222-3333",
      source: "QR code",
      sourceIcon: "qr",
      intent: "Pricing",
      intentTone: "blue",
      lastMessage: "Do you offer custom packages?",
      lastSeen: "2h ago",
      status: "Needs reply",
      statusTone: "amber",
      dot: "red",
      avatarTone: "purple",
    },
    {
      initials: "DC",
      name: "David Carter",
      email: "david@carterlaw.com",
      phone: "(555) 909-0909",
      source: "Website",
      sourceIcon: "globe",
      intent: "Support",
      intentTone: "purple",
      lastMessage: "I can't access my account",
      lastSeen: "3h ago",
      status: "Needs reply",
      statusTone: "amber",
    },
  ];

  let frontDeskTab = "overview";
  let installMethod = "widget";
  const notAvailableLabel = "not available yet";

  function icon(name, className = "") {
    const paths = iconPaths[name] || iconPaths.chat;
    return `<svg class="v2-icon ${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths.join("")}</svg>`;
  }

  function pageFromHash() {
    const raw = window.location.hash.replace("#", "").trim();
    if (!raw) return "home";
    return pageMeta[raw] ? raw : "home";
  }

  function pill(label, tone = "gray") {
    return `<span class="v2-pill ${tone}">${label}</span>`;
  }

  function iconBadge(name, tone = "blue") {
    return `<span class="v2-icon-badge ${tone}">${icon(name)}</span>`;
  }

  function button(label, name, variant = "", attrs = "") {
    const variantClass = variant ? ` ${variant}` : "";
    return `<button class="v2-button${variantClass}" type="button" ${attrs}>${name ? icon(name) : ""}${label}</button>`;
  }

  function metricCard(metric) {
    const hasTrend = metric.change && metric.compare;
    const trendIcon = metric.down ? "arrowDown" : "arrowUp";
    const trendClass = metric.down ? "v2-trend-down" : "v2-trend-up";
    return `
      <article class="v2-metric-card">
        <div class="v2-metric-top">
          <div class="v2-metric-label">
            ${iconBadge(metric.icon, metric.tone)}
            <span>${metric.label}</span>
          </div>
          <span class="v2-info-dot">i</span>
        </div>
        <div class="v2-metric-value">${metric.value}</div>
        <div class="v2-metric-change">
          ${hasTrend ? `<span class="${trendClass}">${icon(trendIcon)} ${metric.change}</span><span>${metric.compare}</span>` : `<span>${notAvailableLabel}</span>`}
        </div>
      </article>
    `;
  }

  function renderSidebar(activePage) {
    let insertedTools = false;
    const nav = navItems.map((item) => {
      const section = item.section && !insertedTools ? `<div class="v2-nav-section-label">${item.section}</div>` : "";
      if (item.section) insertedTools = true;
      const state = item.id === activePage ? " is-active" : "";
      return `
        ${section}
        <a class="v2-nav-item${state}" href="#${item.id}" ${item.id === activePage ? 'aria-current="page"' : ""}>
          ${icon(item.icon, "v2-nav-icon")}
          <span class="v2-nav-copy">
            <span class="v2-nav-label">${item.label}</span>
            <span class="v2-nav-sub">${item.sub}</span>
          </span>
          ${item.badge ? `<span class="v2-nav-badge">${item.badge}</span>` : ""}
        </a>
      `;
    }).join("");

    return `
      <aside class="v2-sidebar">
        <div class="v2-brand">
          <div class="v2-brand-mark">V</div>
          <div>Vonza</div>
        </div>
        <nav class="v2-sidebar-nav" aria-label="V2 preview pages">
          ${nav}
        </nav>
        <div class="v2-sidebar-spacer"></div>
        <div class="v2-plan-card">
          <div class="v2-plan-name">Pro Plan</div>
          <div class="v2-plan-meta">Next billing Jun 1, 2026</div>
          <div class="v2-plan-usage">
            <span>21,420 / 50,000 messages</span>
          </div>
          <div class="v2-progress" style="--v2-progress:43%"><span></span></div>
        </div>
        <div class="v2-user-card">
          <div class="v2-user-avatar">AR</div>
          <div>
            <div class="v2-user-name">Alex Rivera</div>
            <div class="v2-user-email">alex@vonza.com</div>
          </div>
          ${icon("chevronDown")}
        </div>
      </aside>
    `;
  }

  function pageHeader(title, subtitle, actions = "") {
    return `
      <header class="v2-page-header">
        <div>
          <h1 class="v2-page-title">${title}</h1>
          <p class="v2-page-subtitle">${subtitle}</p>
        </div>
        ${actions ? `<div class="v2-header-actions">${actions}</div>` : ""}
      </header>
    `;
  }

  function renderApp() {
    const activePage = pageFromHash();
    const meta = pageMeta[activePage];
    document.title = `Vonza V2 Preview | ${meta.title}`;
    root.innerHTML = `
      <div class="v2-app">
        ${renderSidebar(activePage)}
        <main class="v2-main">
          <div class="v2-page">
            ${renderPage(activePage)}
          </div>
        </main>
        <button class="v2-chat-fab" type="button" aria-label="Preview chat launcher">${icon("chat")}</button>
      </div>
    `;
  }

  function renderPage(page) {
    if (page === "customers") return renderCustomers();
    if (page === "front-desk") return renderFrontDesk();
    if (page === "analytics") return renderAnalytics();
    if (page === "install") return renderInstall();
    if (page === "settings") return renderSettings();
    return renderHome();
  }

  function renderHome() {
    const metrics = buildHomeMetrics();
    const priorityRows = buildHomePriorityRows();
    const activityRows = buildHomeActivityRows();
    const sourceRows = buildHomeSourceRows();
    const readinessRows = buildHomeReadinessRows();

    return `
      ${pageHeader(pageMeta.home.title, pageMeta.home.subtitle, `${button("Review replies", "chat", "v2-button-primary", 'data-preview-target="front-desk"')}${button("View analytics", "analytics", "", 'data-preview-target="analytics"')}`)}
      <section class="v2-grid v2-grid-4">
        ${metrics.map(metricCard).join("")}
      </section>
      <section class="v2-two-col v2-section">
        <article class="v2-card">
          <div class="v2-section-header">
            <div>
              <h2 class="v2-section-title">Today's priority</h2>
              <p class="v2-section-subtitle">Focused work that needs owner attention.</p>
            </div>
            ${pill(`${priorityRows.length} open`, priorityRows.length ? "amber" : "green")}
          </div>
          <div class="v2-list">
            ${priorityRows.length ? priorityRows.map((row) => actionRow(row.title, row.copy, row.action, row.tone, row.iconName)).join("") : emptyHomeRow("No owner priorities in the existing customer rows yet.")}
          </div>
        </article>
        <article class="v2-card">
          <div class="v2-section-header">
            <div>
              <h2 class="v2-section-title">Recent activity</h2>
              <p class="v2-section-subtitle">Latest events across entry points.</p>
            </div>
            ${button("View all", "", "")}
          </div>
          <div class="v2-list">
            ${activityRows.length ? activityRows.map((row) => activityRow(row.title, row.source, row.time, row.iconName, row.tone)).join("") : emptyHomeRow("Recent activity is not available yet.")}
          </div>
        </article>
      </section>
      <section class="v2-two-col v2-section">
        <article class="v2-card">
          <div class="v2-section-header">
            <div>
              <h2 class="v2-section-title">Assistant readiness</h2>
              <p class="v2-section-subtitle">Compact launch health for daily operations.</p>
            </div>
            ${pill(notAvailableLabel, "gray")}
          </div>
          <div class="v2-list">
            ${readinessRows.map((row) => readinessRow(row.title, row.copy, row.status, row.tone)).join("")}
          </div>
        </article>
        <article class="v2-card">
          <div class="v2-section-header">
            <div>
              <h2 class="v2-section-title">Source activity</h2>
              <p class="v2-section-subtitle">Where conversations started today.</p>
            </div>
          </div>
          <div class="v2-source-summary">
            ${sourceRows.map((row) => sourceTile(row.label, row.value, row.iconName, row.tone)).join("")}
          </div>
        </article>
      </section>
    `;
  }

  function buildHomeMetrics() {
    const todayRows = customerRows.filter((row) => isRecentPreviewRow(row.lastSeen));
    const leadRows = customerRows.filter((row) => /lead/i.test(row.status || ""));
    const needsReplyRows = getNeedsOwnerAttentionRows();
    const aiHandledRows = customerRows.filter((row) => row.status === "AI handled");
    const aiHandledValue = customerRows.length
      ? `${Math.round((aiHandledRows.length / customerRows.length) * 100)}%`
      : notAvailableLabel;

    return [
      { label: "Conversations today", value: String(todayRows.length), icon: "chat", tone: "blue" },
      { label: "Leads captured", value: String(leadRows.length), icon: "users", tone: "green" },
      { label: "Needs reply", value: String(needsReplyRows.length), icon: "bell", tone: "amber" },
      { label: "AI handled", value: aiHandledValue, icon: "sparkle", tone: "teal" },
    ];
  }

  function buildHomePriorityRows() {
    return getNeedsOwnerAttentionRows().slice(0, 3).map((row) => ({
      title: row.name,
      copy: row.lastMessage || notAvailableLabel,
      action: row.status === "Needs reply" ? "Reply" : "Review",
      tone: row.status === "Needs reply" ? "amber" : row.intentTone || "blue",
      iconName: row.sourceIcon || "chat",
    }));
  }

  function buildHomeActivityRows() {
    return customerRows.slice(0, 4).map((row) => ({
      title: `${row.name}: ${row.status || notAvailableLabel}`,
      source: row.source || notAvailableLabel,
      time: row.lastSeen || notAvailableLabel,
      iconName: row.status === "AI handled" ? "sparkle" : row.sourceIcon || "users",
      tone: row.statusTone || row.intentTone || "teal",
    }));
  }

  function buildHomeReadinessRows() {
    return [
      ["Business profile", notAvailableLabel],
      ["Website knowledge", notAvailableLabel],
      ["Suggested replies", notAvailableLabel],
      ["Full-page assistant", notAvailableLabel],
    ].map(([title, copy]) => ({ title, copy, status: notAvailableLabel, tone: "gray" }));
  }

  function buildHomeSourceRows() {
    const sourceCounts = customerRows.reduce((counts, row) => {
      const source = row.source || notAvailableLabel;
      counts.set(source, (counts.get(source) || 0) + 1);
      return counts;
    }, new Map());

    return Array.from(sourceCounts.entries()).map(([label, value]) => ({
      label,
      value: String(value),
      iconName: sourceIconForLabel(label),
      tone: sourceToneForLabel(label),
    }));
  }

  function getNeedsOwnerAttentionRows() {
    return customerRows.filter((row) => ["Needs reply", "Unanswered", "Follow-up"].includes(row.status));
  }

  function isRecentPreviewRow(label = "") {
    return /\b(?:just now|\d+\s*[mh]\s*ago)\b/i.test(label);
  }

  function sourceIconForLabel(label = "") {
    if (/qr/i.test(label)) return "qr";
    if (/full-page/i.test(label)) return "window";
    if (/integration/i.test(label)) return "sparkle";
    return "chat";
  }

  function sourceToneForLabel(label = "") {
    if (/qr/i.test(label)) return "green";
    if (/full-page/i.test(label)) return "blue";
    if (/integration/i.test(label)) return "purple";
    return "teal";
  }

  function actionRow(title, copy, action, tone, iconName) {
    return `
      <div class="v2-action-row">
        ${iconBadge(iconName, tone)}
        <div>
          <div class="v2-row-title">${title}</div>
          <div class="v2-row-copy">${copy}</div>
        </div>
        ${button(action, "chevronRight")}
      </div>
    `;
  }

  function activityRow(title, source, time, iconName, tone) {
    return `
      <div class="v2-activity-row">
        ${iconBadge(iconName, tone)}
        <div>
          <div class="v2-row-title">${title}</div>
          <div class="v2-row-copy">${source}</div>
        </div>
        <div class="v2-row-meta">${time}</div>
      </div>
    `;
  }

  function readinessRow(title, copy, status, tone) {
    const statusIcon = tone === "gray" ? "clock" : "check";
    return `
      <div class="v2-readiness-row">
        <span class="v2-check-icon ${tone}">${icon(statusIcon)}</span>
        <div>
          <div class="v2-row-title">${title}</div>
          <div class="v2-row-copy">${copy}</div>
        </div>
        ${pill(status, tone)}
      </div>
    `;
  }

  function sourceTile(label, value, iconName, tone) {
    return `
      <div class="v2-source-tile">
        <div class="v2-source-label">${iconBadge(iconName, tone)}<span>${label}</span></div>
        <div class="v2-source-value">${value}</div>
        <div class="v2-metric-change"><span>${notAvailableLabel}</span></div>
      </div>
    `;
  }

  function emptyHomeRow(copy) {
    return `<div class="v2-empty-note">${copy}</div>`;
  }

  function renderCustomers() {
    const metrics = [
      { label: "New leads", value: "38", change: "+21%", compare: "vs yesterday", icon: "chat", tone: "blue" },
      { label: "Warm leads", value: "72", change: "+14%", compare: "vs yesterday", icon: "user", tone: "amber" },
      { label: "Needs reply", value: "18", change: "+8%", compare: "vs yesterday", icon: "chat", tone: "amber" },
      { label: "Returning visitors", value: "47", change: "+11%", compare: "vs yesterday", icon: "users", tone: "green" },
    ];

    const toolbar = `
      <div class="v2-toolbar">
        <label class="v2-input-wrap">
          ${icon("search")}
          <input class="v2-input" type="search" value="" placeholder="Search by name, email or phone...">
        </label>
        <select class="v2-select" aria-label="Status filter"><option>Status</option></select>
        <select class="v2-select" aria-label="Source filter"><option>Source</option></select>
        <select class="v2-select" aria-label="Priority filter"><option>Priority</option></select>
        ${button("Filters", "filter")}
      </div>
    `;

    return `
      ${pageHeader(pageMeta.customers.title, pageMeta.customers.subtitle, toolbar)}
      <section class="v2-grid v2-grid-4">
        ${metrics.map(metricCard).join("")}
      </section>
      <section class="v2-customers-layout v2-section">
        ${renderCustomerTable()}
        ${renderCustomerDetail()}
      </section>
    `;
  }

  function renderCustomerTable() {
    const rows = customerRows.map((customer) => `
      <tr class="${customer.selected ? "is-selected" : ""}">
        <td><span class="v2-checkbox ${customer.selected ? "is-checked" : ""}">${customer.selected ? icon("check") : ""}</span></td>
        <td>
          <div class="v2-customer-cell">
            <div class="v2-avatar ${customer.avatarTone || ""}">${customer.initials}</div>
            <div>
              <div class="v2-name">${customer.name}</div>
              <div class="v2-subtext">${customer.email}<br>${customer.phone}</div>
            </div>
          </div>
        </td>
        <td><span class="v2-subtext">${icon(customer.sourceIcon)} ${customer.source}</span></td>
        <td>${pill(customer.intent, customer.intentTone)}</td>
        <td>${customer.lastMessage}</td>
        <td>${customer.lastSeen}</td>
        <td>${pill(customer.status, customer.statusTone)} ${customer.dot ? `<span class="v2-dot ${customer.dot === "red" ? "red" : ""}"></span>` : ""}</td>
      </tr>
    `).join("");

    return `
      <article class="v2-table-card">
        <div class="v2-table-header">
          <div class="v2-table-tabs">
            <button class="v2-table-tab is-active" type="button">All customers <span class="v2-count">164</span></button>
            <button class="v2-table-tab" type="button">Unread <span class="v2-count">18</span></button>
            <button class="v2-table-tab" type="button">Needs follow-up <span class="v2-count">30</span></button>
          </div>
          <button class="v2-button" type="button">Sort: Last seen ${icon("chevronDown")}</button>
        </div>
        <div class="v2-data-table-wrap">
          <table class="v2-data-table">
            <thead>
              <tr>
                <th><span class="v2-checkbox"></span></th>
                <th>Customer</th>
                <th>Source</th>
                <th>Intent</th>
                <th>Last message</th>
                <th>Last seen</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="v2-table-footer">
          <span>Showing 1 to 8 of 164 customers</span>
          <div class="v2-pagination">
            <span class="v2-page-chip">${icon("chevronRight")}</span>
            <span class="v2-page-chip is-active">1</span>
            <span class="v2-page-chip">2</span>
            <span class="v2-page-chip">3</span>
            <span class="v2-page-chip">...</span>
            <span class="v2-page-chip">21</span>
            <span class="v2-page-chip">${icon("chevronRight")}</span>
          </div>
          <button class="v2-button" type="button">10 / page ${icon("chevronDown")}</button>
        </div>
      </article>
    `;
  }

  function renderCustomerDetail() {
    return `
      <aside class="v2-detail-panel">
        <div class="v2-detail-head">
          <div class="v2-avatar large">JS</div>
          <div>
            <div class="v2-detail-title">Jessica Smith ${pill("Warm lead", "amber")}</div>
            <div class="v2-subtext">jessica@smithco.com</div>
            <div class="v2-subtext">(555) 123-4567</div>
            <div class="v2-subtext">${icon("globe")} San Diego, CA</div>
            <div class="v2-subtext">${icon("file")} Smith & Co.</div>
          </div>
          <button class="v2-detail-actions" type="button" aria-label="Close detail">${icon("x")}</button>
        </div>
        <div class="v2-detail-mini-grid">
          <div class="v2-mini-card">
            <div class="v2-mini-label">Source</div>
            <div class="v2-mini-value">${icon("qr")} QR code</div>
          </div>
          <div class="v2-mini-card">
            <div class="v2-mini-label">First seen</div>
            <div class="v2-mini-value">May 13, 2026 - 9:42 AM</div>
          </div>
        </div>
        <div class="v2-detail-section">
          <h3 class="v2-detail-section-title">Conversation summary</h3>
          <p class="v2-detail-copy">Jessica is interested in booking a demo for her team. She asked about availability this week and pricing. High intent.</p>
          <div style="margin-top: 10px">${pill("Intent: Book a demo", "teal")}</div>
        </div>
        <div class="v2-detail-section">
          <h3 class="v2-detail-section-title">${icon("sparkle")} Suggested next action</h3>
          <p class="v2-detail-copy">Reply with available time slots and share a quick overview of Vonza.</p>
          <div style="margin-top: 12px">${button("Use suggested reply", "send")}</div>
        </div>
        <div class="v2-detail-section">
          <h3 class="v2-detail-section-title">Conversation timeline</h3>
          <div class="v2-list">
            ${timelineRow("AI greeting", "Hi! How can we help you today?", "May 13, 9:42 AM", "chat", "purple")}
            ${timelineRow("Customer", "Do you have any openings this week?", "May 13, 9:43 AM", "user", "teal")}
            ${timelineRow("AI response", "Yes. What day and time works best for you?", "May 13, 9:43 AM", "chat", "purple")}
          </div>
          <button class="v2-button" type="button" style="width:100%; margin-top: 12px">View full conversation</button>
        </div>
        <div class="v2-detail-button-grid">
          ${button("Reply", "chat", "v2-button-primary")}
          ${button("Mark reviewed", "check")}
          ${button("Follow up later", "clock")}
          ${button("Open conversation", "external")}
        </div>
      </aside>
    `;
  }

  function timelineRow(title, copy, time, iconName, tone) {
    return `
      <div class="v2-timeline-row" style="grid-template-columns: 30px 1fr auto">
        ${iconBadge(iconName, tone)}
        <div>
          <div class="v2-row-title">${title}</div>
          <div class="v2-row-copy">${copy}</div>
        </div>
        <div class="v2-row-meta">${time}</div>
      </div>
    `;
  }

  function renderFrontDesk() {
    const actions = button("Preview assistant", "chat", "v2-button-primary");
    return `
      ${pageHeader(pageMeta["front-desk"].title, pageMeta["front-desk"].subtitle, actions)}
      ${frontDeskTabs()}
      ${frontDeskTab === "knowledge" ? renderFrontDeskKnowledge() : ""}
      ${frontDeskTab === "test" ? renderFrontDeskTest() : ""}
      ${frontDeskTab === "launch" ? renderFrontDeskLaunch() : ""}
      ${frontDeskTab === "overview" ? renderFrontDeskOverview() : ""}
    `;
  }

  function frontDeskTabs() {
    const tabs = [
      ["overview", "Overview", "analytics"],
      ["knowledge", "Knowledge", "file"],
      ["test", "Test", "chat"],
      ["launch", "Launch", "install"],
    ];
    return `
      <div class="v2-tabs" role="tablist" aria-label="Front Desk preview tabs">
        ${tabs.map(([id, label, iconName]) => `<button class="v2-tab ${frontDeskTab === id ? "is-active" : ""}" type="button" data-front-desk-tab="${id}">${icon(iconName)} ${label}</button>`).join("")}
      </div>
    `;
  }

  function renderFrontDeskOverview() {
    return `
      <section class="v2-grid v2-grid-3">
        ${readinessCard("Assistant basics", "92%", ["Name and tone configured", "Fallback behavior set", "Lead capture enabled"], "teal")}
        ${readinessCard("Website knowledge", "86%", ["23 website pages indexed", "Services extracted", "Pricing gaps flagged"], "blue")}
        ${readinessCard("Live install", "2/3", ["Widget installed", "QR touchpoints live", "Full-page pending"], "amber")}
      </section>
      <section class="v2-card v2-section">
        <div class="v2-section-header">
          <div>
            <h2 class="v2-section-title">Recommended next steps</h2>
            <p class="v2-section-subtitle">Concise setup work that improves answer quality.</p>
          </div>
          ${pill("3 items", "blue")}
        </div>
        <div class="v2-list">
          ${actionRow("Verify full-page assistant", "Open the public assistant page and confirm it loads.", "Set up", "blue", "window")}
          ${actionRow("Add booking constraints", "Tell Vonza when customers can request demos.", "Edit", "teal", "calendar")}
          ${actionRow("Review pricing answer", "A pricing question was answered with limited detail.", "Improve", "amber", "sparkle")}
        </div>
      </section>
    `;
  }

  function readinessCard(title, score, items, tone) {
    return `
      <article class="v2-card v2-readiness-card">
        <div class="v2-section-header">
          <div>
            <h2 class="v2-section-title">${title}</h2>
            <p class="v2-section-subtitle">Preview readiness status.</p>
          </div>
          ${iconBadge("check", tone)}
        </div>
        <div class="v2-readiness-score">
          <div class="v2-score-value">${score}</div>
          ${pill(tone === "amber" ? "Needs check" : "Ready", tone)}
        </div>
        <div class="v2-check-list">
          ${items.map((item) => `<div class="v2-check-item"><span class="v2-check-icon">${icon("check")}</span><span>${item}</span></div>`).join("")}
        </div>
      </article>
    `;
  }

  function renderFrontDeskKnowledge() {
    const cards = [
      ["Website content", "23 pages indexed", "Last import completed 12 minutes ago.", "globe", "teal"],
      ["Business profile", "Core facts ready", "Hours, service area, and contact routes are complete.", "file", "blue"],
      ["Services", "8 services mapped", "Top service questions are tied to approved answers.", "sparkle", "purple"],
      ["Contact/booking info", "Demo routing ready", "Booking instructions and handoff language are set.", "calendar", "amber"],
    ];
    return `
      <section class="v2-knowledge-grid">
        ${cards.map(([title, value, copy, iconName, tone]) => `
          <article class="v2-knowledge-card">
            ${iconBadge(iconName, tone)}
            <h3>${title}</h3>
            <div class="v2-metric-value" style="font-size: 24px; margin: 10px 0">${value}</div>
            <p>${copy}</p>
          </article>
        `).join("")}
      </section>
    `;
  }

  function renderFrontDeskTest() {
    return `
      <section class="v2-two-col">
        <article class="v2-card">
          <div class="v2-section-header">
            <div>
              <h2 class="v2-section-title">Chat preview</h2>
              <p class="v2-section-subtitle">Static sample of the assistant test surface.</p>
            </div>
            ${pill("Preview mode", "blue")}
          </div>
          <div class="v2-chat-preview">
            <div class="v2-chat-line"><div class="v2-avatar">V</div><div class="v2-chat-bubble">Hi! I am Vonza Assistant. How can I help today?</div></div>
            <div class="v2-chat-line user"><div class="v2-chat-bubble">Can I book a demo for next week?</div></div>
            <div class="v2-chat-line"><div class="v2-avatar">V</div><div class="v2-chat-bubble">Yes. Share the best day and team size, and I can help route the request.</div></div>
          </div>
        </article>
        <article class="v2-card">
          <div class="v2-section-header">
            <div>
              <h2 class="v2-section-title">Recent test result</h2>
              <p class="v2-section-subtitle">Latest sample answer quality.</p>
            </div>
            ${pill("Passed", "green")}
          </div>
          <div class="v2-list">
            ${readinessRow("Grounded answer", "Used website services and demo instructions.", "Good", "green")}
            ${readinessRow("Lead capture", "Asked for name and email at the right moment.", "Good", "green")}
            ${readinessRow("Pricing detail", "Answer could include plan summary.", "Improve", "amber")}
          </div>
        </article>
      </section>
    `;
  }

  function renderFrontDeskLaunch() {
    return `
      <section class="v2-two-col">
        <article class="v2-card">
          <div class="v2-section-header">
            <div>
              <h2 class="v2-section-title">Launch status</h2>
              <p class="v2-section-subtitle">Install channels and publish readiness.</p>
            </div>
            ${pill("2 live", "green")}
          </div>
          <div class="v2-list">
            ${statusRow("Widget", "Detected on your site", "Installed", "green", "check")}
            ${statusRow("Full-page assistant", "Needs verification before sharing", "Verify", "amber", "window")}
            ${statusRow("QR codes", "4 QR codes generated", "Live", "green", "qr")}
          </div>
        </article>
        <article class="v2-card">
          <div class="v2-section-header">
            <div>
              <h2 class="v2-section-title">Quick links</h2>
              <p class="v2-section-subtitle">Preview launch surfaces.</p>
            </div>
          </div>
          <div class="v2-list">
            ${linkRow("Open website widget preview", "/dashboard-v2-preview#install", "external")}
            ${linkRow("Copy full-page assistant URL", "https://vonza.com/a/smith-co", "copy")}
            ${linkRow("Download front desk QR", "QR touchpoint package", "download")}
          </div>
        </article>
      </section>
    `;
  }

  function statusRow(title, copy, status, tone, iconName) {
    return `
      <div class="v2-status-row">
        ${iconBadge(iconName, tone)}
        <div>
          <div class="v2-row-title">${title}</div>
          <div class="v2-row-copy">${copy}</div>
        </div>
        ${pill(status, tone)}
      </div>
    `;
  }

  function linkRow(title, copy, iconName) {
    return `
      <div class="v2-link-row" style="grid-template-columns: 32px 1fr auto">
        ${iconBadge(iconName, "blue")}
        <div>
          <div class="v2-row-title">${title}</div>
          <div class="v2-row-copy">${copy}</div>
        </div>
        ${icon("chevronRight")}
      </div>
    `;
  }

  function renderAnalytics() {
    const actions = `
      <select class="v2-select" aria-label="Date range"><option>Apr 29 - May 13, 2026</option></select>
      <select class="v2-select" aria-label="Source"><option>Source: All</option></select>
      ${button("Export", "download")}
    `;
    const metrics = [
      { label: "Total conversations", value: "1,248", change: "+24%", compare: "vs Apr 15 - Apr 28", icon: "chat", tone: "blue" },
      { label: "AI handled", value: "86%", change: "+8pp", compare: "vs Apr 15 - Apr 28", icon: "sparkle", tone: "teal" },
      { label: "Human follow-ups", value: "187", change: "-6%", compare: "vs Apr 15 - Apr 28", icon: "user", tone: "blue", down: true },
      { label: "Leads captured", value: "276", change: "+28%", compare: "vs Apr 15 - Apr 28", icon: "users", tone: "green" },
      { label: "Full-page visits", value: "568", change: "+19%", compare: "vs Apr 15 - Apr 28", icon: "window", tone: "blue" },
      { label: "QR scans", value: "142", change: "+31%", compare: "vs Apr 15 - Apr 28", icon: "qr", tone: "teal" },
    ];

    return `
      ${pageHeader(pageMeta.analytics.title, pageMeta.analytics.subtitle, actions)}
      <section class="v2-grid v2-grid-6">
        ${metrics.map(metricCard).join("")}
      </section>
      <section class="v2-three-col-wide v2-section">
        ${renderConversationChart()}
        ${renderSourceBreakdown()}
        ${renderTopQuestions()}
      </section>
      <section class="v2-analytics-second v2-section">
        ${renderHeatmap()}
        ${renderHandlingCard()}
        ${renderConversionCard()}
      </section>
      <section class="v2-table-card v2-section">
        <div class="v2-table-header">
          <div>
            <h2 class="v2-section-title">Performance by source</h2>
          </div>
        </div>
        <div class="v2-data-table-wrap">
          <table class="v2-data-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Visits</th>
                <th>Conversations</th>
                <th>Leads</th>
                <th>Conversion rate</th>
                <th>AI handled</th>
                <th>Human follow-ups</th>
                <th>Avg. time to first response</th>
              </tr>
            </thead>
            <tbody>
              ${performanceRow("Widget", "2,841", "699 (56%)", "181", "25.9%", "610 (87%)", "89 (13%)", "1m 18s", "window", "blue")}
              ${performanceRow("Full Page", "1,126", "274 (22%)", "51", "18.6%", "235 (86%)", "39 (14%)", "1m 32s", "window", "blue")}
              ${performanceRow("QR Flyer", "712", "114 (9%)", "21", "18.4%", "97 (85%)", "17 (15%)", "1m 41s", "qr", "teal")}
              ${performanceRow("QR Window", "386", "60 (5%)", "10", "16.7%", "50 (83%)", "10 (17%)", "1m 55s", "qr", "teal")}
              ${performanceRow("Direct Link", "241", "101 (8%)", "13", "12.9%", "81 (80%)", "20 (20%)", "1m 03s", "link", "blue")}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderConversationChart() {
    return `
      <article class="v2-card v2-chart-card">
        <div class="v2-section-header">
          <div>
            <h2 class="v2-section-title">Conversations over time</h2>
            <div class="v2-metric-value" style="font-size:24px; margin: 20px 0 6px">1,248 <span class="v2-subtext">Total conversations</span></div>
            <div class="v2-metric-change"><span class="v2-trend-up">${icon("arrowUp")} +24%</span><span>vs Apr 15 - Apr 28</span></div>
          </div>
          <button class="v2-button" type="button">Daily ${icon("chevronDown")}</button>
        </div>
        ${lineChartSvg()}
      </article>
    `;
  }

  function lineChartSvg() {
    return `
      <svg class="v2-line-chart" viewBox="0 0 680 180" role="img" aria-label="Mock conversations over time line chart">
        <defs>
          <linearGradient id="v2LineGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#0ea99b" stop-opacity="0.22"></stop>
            <stop offset="1" stop-color="#0ea99b" stop-opacity="0"></stop>
          </linearGradient>
        </defs>
        <path class="v2-chart-gridline" d="M50 25H650M50 68H650M50 111H650M50 154H650"></path>
        <path class="v2-chart-fill" d="M50 145 C80 135,86 142,110 125 S155 123,175 104 S225 110,252 90 S302 72,330 60 S376 102,405 84 S465 42,500 60 S535 37,566 43 S610 55,650 25 L650 154 L50 154 Z"></path>
        <path class="v2-chart-line" d="M50 145 C80 135,86 142,110 125 S155 123,175 104 S225 110,252 90 S302 72,330 60 S376 102,405 84 S465 42,500 60 S535 37,566 43 S610 55,650 25"></path>
        <text class="v2-axis-label" x="18" y="158">0</text>
        <text class="v2-axis-label" x="14" y="115">60</text>
        <text class="v2-axis-label" x="8" y="72">120</text>
        <text class="v2-axis-label" x="50" y="176">Apr 29</text>
        <text class="v2-axis-label" x="185" y="176">May 3</text>
        <text class="v2-axis-label" x="328" y="176">May 7</text>
        <text class="v2-axis-label" x="470" y="176">May 10</text>
        <text class="v2-axis-label" x="610" y="176">May 13</text>
      </svg>
    `;
  }

  function renderSourceBreakdown() {
    const rows = [
      ["Website widget", "56%", "699", "teal"],
      ["Full-page assistant", "22%", "274", "blue"],
      ["QR code", "14%", "174", "soft-blue"],
      ["Direct link", "8%", "101", "gray"],
    ];
    return `
      <article class="v2-card">
        <div class="v2-section-header">
          <h2 class="v2-section-title">Entry point / source breakdown</h2>
        </div>
        <div class="v2-donut-layout">
          <div class="v2-donut" aria-hidden="true"></div>
          <div class="v2-donut-legend">
            ${rows.map(([label, percent, count, tone]) => `
              <div class="v2-legend-row">
                <span class="v2-legend-color ${tone}"></span>
                <span>${label}</span>
                <strong>${percent}</strong>
                <span class="v2-subtext">${count}</span>
              </div>
            `).join("")}
            <div class="v2-legend-row" style="border-top:1px solid var(--v2-border-soft); padding-top:12px">
              <span></span><strong>Total</strong><strong></strong><strong>1,248</strong>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function renderTopQuestions() {
    const questions = [
      ["How much does it cost?", "241", "86%"],
      ["How long does it take?", "189", "72%"],
      ["Do you offer support?", "143", "57%"],
      ["Can I book a demo?", "118", "46%"],
      ["What integrations do you have?", "92", "34%"],
    ];
    return `
      <article class="v2-card">
        <div class="v2-section-header">
          <h2 class="v2-section-title">Top customer questions</h2>
          ${button("View all", "")}
        </div>
        <div class="v2-list">
          ${questions.map(([question, count, width]) => `
            <div class="v2-question-row">
              <div class="v2-row-title">${question}</div>
              <div class="v2-bar-track"><span class="v2-bar-fill" style="--v2-bar:${width}"></span></div>
              <div class="v2-row-meta">${count}</div>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }

  function renderHeatmap() {
    const times = ["12am", "4am", "8am", "12pm", "4pm", "8pm"];
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const colors = ["#e8f0ff", "#cfe0ff", "#9ec1ff", "#5d94f5", "#2563eb", "#0a3f94"];
    const cells = times.map((time, rowIndex) => {
      const rowCells = days.map((_day, dayIndex) => {
        const index = Math.min(colors.length - 1, Math.max(0, (rowIndex + dayIndex + (dayIndex % 3)) % colors.length));
        return `<span class="v2-heat-cell" style="--heat:${colors[index]}"></span>`;
      }).join("");
      return `<span class="v2-heatmap-label">${time}</span>${rowCells}`;
    }).join("");
    return `
      <article class="v2-card">
        <div class="v2-section-header">
          <h2 class="v2-section-title">Conversations by hour</h2>
          <span class="v2-info-dot">i</span>
        </div>
        <div class="v2-heatmap">
          <span></span>
          ${days.map((day) => `<span class="v2-heatmap-day">${day}</span>`).join("")}
          ${cells}
        </div>
        <div class="v2-heatmap-key">
          <span>Low</span>
          ${colors.map((color) => `<span class="v2-heat-key-box" style="--heat:${color}"></span>`).join("")}
          <span>High</span>
        </div>
      </article>
    `;
  }

  function renderHandlingCard() {
    return `
      <article class="v2-card">
        <div class="v2-section-header">
          <h2 class="v2-section-title">AI vs Human handling</h2>
        </div>
        <div class="v2-gauge">
          <svg viewBox="0 0 220 140" aria-label="AI handled 86 percent">
            <path class="v2-gauge-base" d="M35 112A75 75 0 0 1 185 112"></path>
            <path class="v2-gauge-value" d="M35 112A75 75 0 0 1 169 66"></path>
            <text class="v2-gauge-text" x="110" y="103">86%</text>
            <text class="v2-gauge-sub" x="110" y="124">AI handled</text>
          </svg>
        </div>
        <div class="v2-donut-legend">
          <div class="v2-legend-row"><span class="v2-legend-color teal"></span><span>AI handled</span><strong></strong><span>1,073 (86%)</span></div>
          <div class="v2-legend-row"><span class="v2-legend-color soft-blue"></span><span>Human follow-ups</span><strong></strong><span>175 (14%)</span></div>
        </div>
      </article>
    `;
  }

  function renderConversionCard() {
    return `
      <article class="v2-card">
        <div class="v2-split-stat">
          <div class="v2-split-stat-item">
            ${iconBadge("users", "teal")}
            <div>
              <div class="v2-row-title">Leads conversion rate</div>
              <div class="v2-split-stat-value">22.1%</div>
              <div class="v2-metric-change"><span class="v2-trend-up">${icon("arrowUp")} +4.3pp</span><span>vs Apr 15 - Apr 28</span></div>
            </div>
          </div>
          <div class="v2-split-stat-item">
            ${iconBadge("clock", "blue")}
            <div>
              <div class="v2-row-title">Avg. time to first response</div>
              <div class="v2-split-stat-value">1m 28s</div>
              <div class="v2-metric-change"><span class="v2-trend-up">${icon("arrowDown")} 12s</span><span>vs Apr 15 - Apr 28</span></div>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function performanceRow(source, visits, conversations, leads, conversion, aiHandled, human, responseTime, iconName, tone) {
    return `
      <tr>
        <td><span class="v2-name">${icon(iconName)} ${source}</span></td>
        <td>${visits}</td>
        <td>${conversations}</td>
        <td>${leads}</td>
        <td>${conversion}</td>
        <td>${aiHandled}</td>
        <td>${human}</td>
        <td>${responseTime}</td>
      </tr>
    `.replace(`class="v2-icon "`, `class="v2-icon ${tone}"`);
  }

  function renderInstall() {
    const actions = `${button("Copy install code", "copy", "v2-button-primary")}${button("Verify installation", "check")}`;
    return `
      ${pageHeader(pageMeta.install.title, pageMeta.install.subtitle, actions)}
      <section class="v2-install-methods">
        ${installMethodCard("widget", "Widget", "Embed the Vonza widget on your website.", "Recommended", "code", "teal")}
        ${installMethodCard("full-page", "Full-page assistant", "Create a dedicated assistant page.", "Great for discovery", "window", "blue")}
        ${installMethodCard("qr", "QR code", "Create QR touchpoints for any channel.", "Offline to online", "qr", "teal")}
      </section>
      <section class="v2-install-layout">
        <div>
          ${renderInstallDetail()}
          ${renderInstallSteps()}
          ${renderQrTouchpoints()}
        </div>
        <aside>
          ${renderInstallStatus()}
          ${renderInstallPreview()}
          ${renderInstallHelp()}
        </aside>
      </section>
    `;
  }

  function installMethodCard(id, title, copy, badge, iconName, tone) {
    return `
      <button class="v2-install-method ${installMethod === id ? "is-active" : ""}" type="button" data-install-method="${id}">
        ${iconBadge(iconName, tone)}
        <span>
          <h3>${title}</h3>
          <p>${copy}</p>
          ${pill(badge, installMethod === id ? "teal" : "gray")}
        </span>
      </button>
    `;
  }

  function renderInstallDetail() {
    if (installMethod === "full-page") {
      return `
        <article class="v2-method-detail">
          <div class="v2-section-header">
            <div>
              <h2 class="v2-section-title">Full-page assistant URL</h2>
              <p class="v2-section-subtitle">Share this page when customers need a focused assistant experience.</p>
            </div>
            ${pill("Needs verification", "amber")}
          </div>
          <div class="v2-url-box">
            <span>https://vonza.com/a/smith-co</span>
            ${button("Copy URL", "copy")}
          </div>
        </article>
      `;
    }

    if (installMethod === "qr") {
      return `
        <article class="v2-method-detail">
          <div class="v2-section-header">
            <div>
              <h2 class="v2-section-title">QR code touchpoint</h2>
              <p class="v2-section-subtitle">Use QR codes on menus, reception desks, flyers, and signs.</p>
            </div>
            ${pill("Live", "green")}
          </div>
          <div class="v2-qr-preview-large">
            <div class="v2-qr-code">${qrSvg(9)}</div>
            <div>
              <div class="v2-row-title">Front Desk QR</div>
              <div class="v2-row-copy">Scans open the Vonza full-page assistant for this workspace.</div>
              <ul class="v2-muted-list">
                <li>Reception desks and checkout counters</li>
                <li>Flyers, direct mail, and service menus</li>
                <li>Window signs and event materials</li>
              </ul>
              <div class="v2-toolbar" style="margin-top: 14px">${button("Download QR", "download", "v2-button-primary")}${button("Copy full-page URL", "copy")}</div>
            </div>
          </div>
        </article>
      `;
    }

    return `
      <article class="v2-method-detail">
        <div class="v2-section-header">
          <div>
            <h2 class="v2-section-title">Install the Vonza widget</h2>
            <p class="v2-section-subtitle">Add this script to every page where the widget should appear.</p>
          </div>
          ${pill("Installed", "green")}
        </div>
        <div class="v2-code-block">
          <div class="v2-code-actions">${button("Copy code", "copy")}</div>
<pre>&lt;!-- Vonza Widget --&gt;
&lt;script src="https://cdn.vonza.com/widget/v1/widget.js"
  data-site-id="site_8f3c2a9e"
  data-position="right"
  defer&gt;&lt;/script&gt;</pre>
          <div class="v2-code-meta">
            <span class="v2-code-chip">${icon("filter")} Position: Right</span>
            <span class="v2-code-chip">${icon("settings")} Theme: Auto (Light/Dark)</span>
            <span class="v2-code-chip">${icon("globe")} Environment: Production</span>
          </div>
        </div>
      </article>
    `;
  }

  function renderInstallSteps() {
    return `
      <article class="v2-card v2-install-steps-card v2-section">
        <div class="v2-section-header">
          <div>
            <h2 class="v2-section-title">Install steps</h2>
            <p class="v2-section-subtitle">Complete each channel when it is ready to publish.</p>
          </div>
        </div>
        <div class="v2-install-steps-grid">
          <div class="v2-install-step">
            <div class="v2-install-step-head">
              <div class="v2-step-number">1</div>
              <div>
                <h2 class="v2-section-title">Install the Vonza widget</h2>
                <p class="v2-section-subtitle">Add the script to every page where the widget should appear.</p>
              </div>
              ${pill("Installed", "green")}
            </div>
          </div>
          <div class="v2-install-step">
            <div class="v2-install-step-head">
              <div class="v2-step-number">2</div>
              <div>
                <h2 class="v2-section-title">Verify full-page assistant</h2>
                <p class="v2-section-subtitle">Confirm the dedicated assistant page loads before sharing it.</p>
              </div>
              ${pill("Needs verification", "amber")}
            </div>
          </div>
          <div class="v2-install-step">
            <div class="v2-install-step-head">
              <div class="v2-step-number">3</div>
              <div>
                <h2 class="v2-section-title">Publish QR touchpoints</h2>
                <p class="v2-section-subtitle">Download QR codes for counters, flyers, signs, and direct mail.</p>
              </div>
              ${pill("Live", "green")}
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function renderQrTouchpoints() {
    const cards = [
      ["Front Door", "Main entrance", "124", "+18%", 1],
      ["Flyer", "Marketing flyer", "87", "+12%", 2],
      ["Invoice", "Customer invoices", "56", "+8%", 3],
      ["Business Card", "Team cards", "42", "+5%", 4],
    ];
    return `
      <article class="v2-card v2-section">
        <div class="v2-section-header">
          <div>
            <h2 class="v2-section-title">Your QR touchpoints</h2>
            <p class="v2-section-subtitle">Scan stats update in real time.</p>
          </div>
          ${button("Download all", "download")}
        </div>
        <div class="v2-qr-grid">
          ${cards.map(([title, subtitle, scans, trend, seed]) => `
            <div class="v2-qr-card">
              <div class="v2-qr-head">
                <div>
                  <div class="v2-qr-title">${title}</div>
                  <div class="v2-qr-subtitle">${subtitle}</div>
                </div>
                <span class="v2-pill green"><span class="v2-dot"></span>Live</span>
              </div>
              <div class="v2-qr-code">${qrSvg(seed)}</div>
              <div class="v2-table-footer" style="padding: 0; border-top: 0">
                <span>Scans (30d)<br><strong style="color:#0f172a">${scans}</strong></span>
                <span class="v2-trend-up">${icon("arrowUp")} ${trend}</span>
              </div>
              <button class="v2-button" type="button" style="width:100%; margin-top: 10px">Download</button>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }

  function renderInstallStatus() {
    return `
      <article class="v2-card">
        <div class="v2-section-header">
          <h2 class="v2-section-title">Installation status</h2>
          ${icon("clock")}
        </div>
        <div class="v2-list">
          ${statusRow("Widget", "Detected on your site", "Installed", "green", "check")}
          ${statusRow("Full-page assistant", "Verify your assistant page", "Needs verification", "amber", "window")}
          ${statusRow("QR codes", "4 QR codes generated", "Live", "green", "qr")}
        </div>
      </article>
    `;
  }

  function renderInstallPreview() {
    return `
      <article class="v2-card v2-section">
        <div class="v2-section-header">
          <div>
            <h2 class="v2-section-title">Preview</h2>
            <p class="v2-section-subtitle">See how Vonza looks on your site.</p>
          </div>
        </div>
        <div class="v2-preview-browser">
          <div class="v2-browser-bar"><span class="v2-browser-line"></span><span class="v2-browser-line"></span><span class="v2-browser-line"></span></div>
          <div class="v2-browser-content">
            <span class="v2-browser-block"></span>
            <span class="v2-browser-block"></span>
            <span class="v2-browser-block"></span>
            <span class="v2-browser-block" style="width:70%"></span>
          </div>
          <div class="v2-widget-card">
            <div class="v2-widget-head"><div class="v2-mini-mark">V</div><span>Vonza AI<br><span class="v2-subtext">Online</span></span></div>
            <div class="v2-widget-bubble">Hi there! How can we help today?</div>
            <div class="v2-widget-input"><span>Ask anything...</span><span class="v2-dot"></span></div>
          </div>
        </div>
        <button class="v2-button" type="button" style="width:100%; margin-top: 12px">Open preview ${icon("external")}</button>
      </article>
    `;
  }

  function renderInstallHelp() {
    return `
      <article class="v2-card v2-section">
        <div class="v2-action-row" style="grid-template-columns: 44px 1fr">
          ${iconBadge("shield", "blue")}
          <div>
            <div class="v2-row-title">Need help with installation?</div>
            <div class="v2-row-copy">Follow step-by-step guides or let the team help set up Vonza.</div>
            <div style="margin-top: 12px">${button("Contact support", "external")}</div>
          </div>
        </div>
      </article>
    `;
  }

  function qrSvg(seed) {
    const blocks = [];
    const addFinder = (x, y) => {
      blocks.push(`<rect x="${x}" y="${y}" width="7" height="7"></rect>`);
      blocks.push(`<rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"></rect>`);
      blocks.push(`<rect x="${x + 2}" y="${y + 2}" width="3" height="3"></rect>`);
    };
    addFinder(0, 0);
    addFinder(14, 0);
    addFinder(0, 14);
    for (let y = 0; y < 21; y += 1) {
      for (let x = 0; x < 21; x += 1) {
        const inFinder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
        if (!inFinder && ((x * 7 + y * 5 + seed) % 4 === 0 || (x + y + seed) % 7 === 0)) {
          blocks.push(`<rect x="${x}" y="${y}" width="1" height="1"></rect>`);
        }
      }
    }
    return `<svg viewBox="0 0 21 21" aria-label="Mock QR code">${blocks.join("")}</svg>`;
  }

  function renderSettings() {
    const actions = button("Need help?", "chat");
    return `
      ${pageHeader(pageMeta.settings.title, pageMeta.settings.subtitle, actions)}
      <div class="v2-tabs v2-settings-tabs" role="tablist" aria-label="Settings sections">
        ${settingsTab("General", "settings", true)}
        ${settingsTab("Team", "users")}
        ${settingsTab("Notifications", "bell")}
        ${settingsTab("Billing", "card")}
        ${settingsTab("Privacy & compliance", "shield")}
        ${settingsTab("Integrations", "sparkle")}
      </div>
      <section class="v2-settings-grid">
        ${renderAssistantBranding()}
        ${renderBusinessProfile()}
        ${renderTeamAccess()}
      </section>
      <section class="v2-settings-grid-bottom">
        ${renderNotifications()}
        ${renderPrivacy()}
        ${renderBilling()}
      </section>
    `;
  }

  function settingsTab(label, iconName, active = false) {
    return `<button class="v2-tab ${active ? "is-active" : ""}" type="button">${icon(iconName)} ${label}</button>`;
  }

  function renderAssistantBranding() {
    return `
      <article class="v2-card">
        <div class="v2-section-header">
          <div style="display:flex; gap:12px; align-items:center">
            <div class="v2-brand-mark" style="width:42px;height:42px;font-size:23px">V</div>
            <div>
              <h2 class="v2-section-title">Assistant branding</h2>
              <p class="v2-section-subtitle">Customize how your AI Assistant shows up for customers.</p>
            </div>
          </div>
        </div>
        <div class="v2-field">
          <label class="v2-label" for="v2-assistant-name">Assistant name</label>
          <input class="v2-input" id="v2-assistant-name" type="text" value="Vonza Assistant">
        </div>
        <div class="v2-form-grid" style="margin-top: 16px">
          <div class="v2-field">
            <label class="v2-label" for="v2-accent">Accent color</label>
            <select class="v2-select" id="v2-accent"><option>Teal</option></select>
          </div>
          <div class="v2-field">
            <label class="v2-label" for="v2-tone">Tone of voice</label>
            <select class="v2-select" id="v2-tone"><option>Professional</option></select>
          </div>
        </div>
        <div class="v2-field" style="margin-top: 18px">
          <span class="v2-label">Preview</span>
          <div class="v2-brand-preview"><div class="v2-mini-mark">V</div><span>Hi! I'm Vonza Assistant. How can I help you today?</span></div>
        </div>
      </article>
    `;
  }

  function renderBusinessProfile() {
    return `
      <article class="v2-card">
        <div class="v2-section-header">
          <div>
            <h2 class="v2-section-title">Business profile</h2>
            <p class="v2-section-subtitle">Update business information used in conversations.</p>
          </div>
        </div>
        <div class="v2-field">
          <label class="v2-label" for="v2-website">Website URL</label>
          <input class="v2-input" id="v2-website" type="url" value="https://www.vonza.com">
        </div>
        <div class="v2-field" style="margin-top: 14px">
          <label class="v2-label" for="v2-support">Support email</label>
          <input class="v2-input" id="v2-support" type="email" value="support@vonza.com">
        </div>
        <div class="v2-field" style="margin-top: 14px">
          <label class="v2-label" for="v2-phone">Phone number</label>
          <input class="v2-input" id="v2-phone" type="tel" value="(555) 123-4567">
        </div>
        <div class="v2-table-footer" style="padding: 18px 0 0; border-top: 0">
          <span class="v2-trend-up">${icon("check")} Profile looks good</span>
          ${button("Save changes", "")}
        </div>
      </article>
    `;
  }

  function renderTeamAccess() {
    const members = [
      ["AR", "Alex Rivera", "alex@vonza.com", "Owner", "Active", "green"],
      ["JS", "Jessica Smith", "jessica@vonza.com", "Admin", "Active", "green"],
      ["DL", "Dylan Lee", "dylan@vonza.com", "Member", "Active", "green"],
      ["KH", "Katherine Hall", "katherine@vonza.com", "Member", "Invited", "amber"],
    ];
    return `
      <article class="v2-card">
        <div class="v2-section-header">
          <div>
            <h2 class="v2-section-title">Team access</h2>
            <p class="v2-section-subtitle">Manage who can access Vonza and permissions.</p>
          </div>
          ${button("Invite member", "users")}
        </div>
        <div class="v2-list">
          ${members.map(([initials, name, email, role, status, tone]) => `
            <div class="v2-team-row">
              <div class="v2-customer-cell" style="grid-template-columns:34px 1fr">
                <div class="v2-avatar">${initials}</div>
                <div>
                  <div class="v2-name">${name}</div>
                  <div class="v2-subtext">${email}</div>
                </div>
              </div>
              <select class="v2-select v2-role-select" aria-label="${name} role"><option>${role}</option></select>
              ${pill(status, tone)}
              ${icon("more")}
            </div>
          `).join("")}
        </div>
        <div class="v2-table-footer" style="margin: 14px -20px -20px; padding-left: 20px; padding-right:20px">
          <span>View all members</span>${icon("chevronRight")}
        </div>
      </article>
    `;
  }

  function renderNotifications() {
    return `
      <article class="v2-card">
        <div class="v2-section-header">
          <div>
            <h2 class="v2-section-title">Notifications</h2>
            <p class="v2-section-subtitle">Choose what you and your team get notified about.</p>
          </div>
        </div>
        ${settingToggle("Email alerts", "Receive important updates via email")}
        ${settingToggle("Lead alerts", "Get notified when new leads come in")}
        ${settingToggle("Weekly report", "Receive a summary of conversations every Monday")}
        <div class="v2-table-footer" style="margin: 18px -20px -20px; padding-left: 20px; padding-right:20px">
          <span>Manage notification preferences</span>${icon("chevronRight")}
        </div>
      </article>
    `;
  }

  function settingToggle(title, copy) {
    return `
      <div class="v2-setting-row">
        <div>
          <div class="v2-row-title">${title}</div>
          <div class="v2-row-copy">${copy}</div>
        </div>
        <button class="v2-toggle" type="button" aria-label="${title} enabled"></button>
      </div>
    `;
  }

  function renderPrivacy() {
    return `
      <article class="v2-card">
        <div class="v2-section-header">
          <div>
            <h2 class="v2-section-title">Privacy & compliance</h2>
            <p class="v2-section-subtitle">Manage data handling, consent, and legal preferences.</p>
          </div>
        </div>
        <div class="v2-setting-row">
          <div>
            <div class="v2-row-title">Customer consent</div>
            <div class="v2-row-copy">Ask for consent before collecting data</div>
          </div>
          <button class="v2-toggle" type="button" aria-label="Customer consent enabled"></button>
        </div>
        <div class="v2-setting-row">
          <div>
            <div class="v2-row-title">Data retention</div>
            <div class="v2-row-copy">Keep conversation data for 12 months</div>
          </div>
          <select class="v2-select" style="min-width: 120px" aria-label="Data retention"><option>12 months</option></select>
        </div>
        ${privacyLink("Terms of Service")}
        ${privacyLink("Privacy Policy")}
        ${privacyLink("Data Processing Agreement")}
      </article>
    `;
  }

  function privacyLink(label) {
    return `
      <div class="v2-setting-row">
        <div class="v2-row-title">${label}</div>
        ${icon("external")}
      </div>
    `;
  }

  function renderBilling() {
    return `
      <article class="v2-card">
        <div class="v2-section-header">
          <div>
            <h2 class="v2-section-title">Billing & plan</h2>
            <p class="v2-section-subtitle">View your plan details, usage, and billing information.</p>
          </div>
        </div>
        <div class="v2-billing-panel">
          <div class="v2-billing-head">
            <div class="v2-billing-plan">${icon("card")} Pro Plan ${pill("Active", "green")}</div>
            ${button("Upgrade plan", "")}
          </div>
          <div class="v2-billing-meta"><span>Usage this month</span><span>21,420 / 50,000 messages</span></div>
          <div class="v2-progress" style="--v2-progress:43%"><span></span></div>
          <div class="v2-billing-meta" style="border-top:1px solid var(--v2-border-soft); padding-top:16px">
            <span>Next invoice<br><strong>Amount</strong></span>
            <span>Jun 1, 2026<br><strong>$299.00 USD</strong></span>
          </div>
        </div>
        <div class="v2-table-footer" style="margin: 18px -20px -20px; padding-left: 20px; padding-right:20px">
          <span>View billing history</span>${icon("chevronRight")}
        </div>
      </article>
    `;
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-front-desk-tab], [data-install-method], [data-preview-target]");
    if (!target) return;
    if (target.dataset.previewTarget) {
      window.location.hash = target.dataset.previewTarget;
      renderApp();
      return;
    }
    if (target.dataset.frontDeskTab) {
      frontDeskTab = target.dataset.frontDeskTab;
      renderApp();
      return;
    }
    if (target.dataset.installMethod) {
      installMethod = target.dataset.installMethod;
      renderApp();
    }
  });

  window.addEventListener("hashchange", renderApp);
  renderApp();
})();
