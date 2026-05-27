import { getPublicAppUrl, getSupabasePublicUrl } from "../config/env.js";

function normalizePath(req) {
  return String(req.path || req.url || "").split("?")[0] || "/";
}

function getRequestUrl(req) {
  try {
    return new URL(req.originalUrl || req.url || "/", "http://localhost");
  } catch {
    return new URL("/", "http://localhost");
  }
}

function isDashboardTopLevelPath(pathname) {
  return pathname === "/dashboard"
    || pathname === "/dashboard-v2-fixture"
    || pathname === "/dashboard-v2-preview"
    || pathname === "/full-page-assistant-v2-preview"
    || pathname === "/assistant-embed-matrix";
}

function isDashboardPrivateAssetPath(pathname) {
  return [
    "/public-config.js",
    "/supabase-auth.js",
    "/dashboard.js",
    "/dashboard.css",
    "/dashboard-customers.css",
    "/dashboard-install.css",
    "/dashboard-analytics.css",
    "/dashboard-front-desk.css",
    "/dashboard-glass.css",
    "/dashboardHelpers.js",
    "/dashboardState.js",
    "/dashboardLabels.js",
    "/dashboardInstall.js",
    "/dashboardFrontDesk.js",
    "/dashboardCustomers.js",
    "/dashboardAnalytics.js",
    "/dashboardToday.js",
    "/i18n/dashboardI18n.js",
    "/settings/SettingsShell.js",
    "/settings/settings.css",
  ].includes(pathname);
}

function isHostedFrontDeskPath(pathname) {
  return pathname.startsWith("/a/") || pathname.startsWith("/assistant/");
}

function isEmbedScriptAssetPath(pathname) {
  return pathname === "/embed.js"
    || pathname === "/embed-v1.js"
    || pathname === "/embed-lite.js"
    || pathname === "/assistant-embed.js";
}

function isEmbeddedWidgetRequest(requestUrl) {
  return requestUrl.pathname === "/widget" && requestUrl.searchParams.get("embedded") === "1";
}

function isTopLevelWidgetPath(pathname) {
  return pathname === "/widget";
}

function isBaselineMarketingOrLegalPath(pathname) {
  return [
    "/",
    "/hu",
    "/hu/features",
    "/hu/product",
    "/hu/pricing",
    "/hu/about",
    "/features",
    "/product",
    "/how-it-works",
    "/pricing",
    "/about",
    "/contact",
    "/aszf",
    "/impresszum",
    "/adatkezelesi-tajekoztato",
    "/cookie-tajekoztato",
    "/terms",
    "/privacy",
    "/cookies",
    "/imprint",
  ].includes(pathname);
}

function isAssistantEmbedPreviewPath(pathname) {
  return pathname === "/assistant-embed-matrix";
}

function isAssistantMicrophonePath(pathname, requestUrl) {
  return isEmbeddedWidgetRequest(requestUrl)
    || isTopLevelWidgetPath(pathname)
    || isHostedFrontDeskPath(pathname)
    || isAssistantEmbedPreviewPath(pathname);
}

function buildPermissionsPolicy(pathname, requestUrl) {
  const microphonePolicy = isAssistantMicrophonePath(pathname, requestUrl) ? "microphone=(self)" : "microphone=()";
  return `camera=(), ${microphonePolicy}, geolocation=(), payment=()`;
}

function buildDashboardCsp() {
  const publicAppUrl = getPublicAppUrl();
  const supabaseUrl = getSupabasePublicUrl();
  const connectSources = [
    "'self'",
    publicAppUrl,
    supabaseUrl,
    "https://api.stripe.com",
    "https://*.supabase.co",
    "wss://*.supabase.co",
  ].filter(Boolean);

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "script-src 'self' 'unsafe-inline'",
    `connect-src ${connectSources.join(" ")}`,
  ].join("; ");
}

function buildAssistantCsp({ frameAncestors }) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `frame-ancestors ${frameAncestors}`,
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'self' https:",
  ].join("; ");
}

function buildBaselinePublicCsp() {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'self' https:",
  ].join("; ");
}

export function applySecurityHeaders(req, res, next) {
  const pathname = normalizePath(req);
  const requestUrl = getRequestUrl(req);

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", buildPermissionsPolicy(pathname, requestUrl));

  if (isDashboardTopLevelPath(pathname) || isDashboardPrivateAssetPath(pathname)) {
    res.setHeader("Content-Security-Policy", buildDashboardCsp());
    res.setHeader("X-Frame-Options", "DENY");
  } else if (isEmbeddedWidgetRequest(requestUrl) || isEmbedScriptAssetPath(pathname)) {
    res.setHeader("Content-Security-Policy", buildAssistantCsp({ frameAncestors: "*" }));
    res.removeHeader("X-Frame-Options");
  } else if (isTopLevelWidgetPath(pathname) || isHostedFrontDeskPath(pathname)) {
    res.setHeader("Content-Security-Policy", buildAssistantCsp({ frameAncestors: "'none'" }));
    res.setHeader("X-Frame-Options", "DENY");
  } else if (isBaselineMarketingOrLegalPath(pathname)) {
    res.setHeader("Content-Security-Policy", buildBaselinePublicCsp());
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
  }

  next();
}
