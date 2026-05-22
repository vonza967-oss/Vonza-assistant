import { getPublicAppUrl, getSupabasePublicUrl } from "../config/env.js";

function normalizePath(req) {
  return String(req.path || req.url || "").split("?")[0] || "/";
}

function isDashboardDocumentPath(pathname) {
  return pathname === "/dashboard" || pathname === "/public-config.js" || pathname === "/supabase-auth.js";
}

function isDashboardAssetPath(pathname) {
  return [
    "/dashboard.js",
    "/dashboard.css",
    "/dashboardHelpers.js",
    "/dashboardState.js",
    "/dashboardLabels.js",
    "/dashboardInstall.js",
    "/dashboardFrontDesk.js",
    "/i18n/dashboardI18n.js",
    "/settings/SettingsShell.js",
    "/settings/settings.css",
  ].includes(pathname);
}

function isPublicAssistantPath(pathname) {
  return pathname === "/widget"
    || pathname.startsWith("/a/")
    || pathname.startsWith("/assistant/")
    || pathname === "/embed.js"
    || pathname === "/embed-lite.js"
    || pathname === "/assistant-embed.js";
}

function buildPermissionsPolicy(pathname) {
  const microphonePolicy = isPublicAssistantPath(pathname) ? "microphone=(self)" : "microphone=()";
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
    "frame-ancestors 'self'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "script-src 'self' 'unsafe-inline'",
    `connect-src ${connectSources.join(" ")}`,
  ].join("; ");
}

function buildPublicAssistantCsp() {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors *",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'self' https:",
  ].join("; ");
}

export function applySecurityHeaders(req, res, next) {
  const pathname = normalizePath(req);

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", buildPermissionsPolicy(pathname));

  if (isDashboardDocumentPath(pathname) || isDashboardAssetPath(pathname)) {
    res.setHeader("Content-Security-Policy", buildDashboardCsp());
    res.setHeader("X-Frame-Options", "DENY");
  } else if (isPublicAssistantPath(pathname)) {
    res.setHeader("Content-Security-Policy", buildPublicAssistantCsp());
    res.removeHeader("X-Frame-Options");
  }

  next();
}
