self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    event.respondWith(fetch(request));
    return;
  }

  const url = new URL(request.url);
  const dashboardAssetPaths = new Set([
    "/dashboard",
    "/dashboard-v2-fixture",
    "/dashboard.js",
    "/dashboard.css",
    "/dashboard-customers.css",
    "/dashboard-install.css",
    "/dashboard-analytics.css",
    "/dashboard-front-desk.css",
    "/dashboardHelpers.js",
    "/dashboardState.js",
    "/dashboardLabels.js",
    "/dashboardInstall.js",
    "/dashboardFrontDesk.js",
    "/dashboardCustomers.js",
    "/dashboardAnalytics.js",
    "/dashboardToday.js",
    "/public-config.js",
    "/i18n/dashboardI18n.js",
    "/settings/SettingsShell.js",
    "/settings/settings.css",
  ]);

  if (url.origin === self.location.origin && dashboardAssetPaths.has(url.pathname)) {
    event.respondWith(fetch(new Request(request, { cache: "no-store" })));
    return;
  }

  event.respondWith(fetch(request));
});
