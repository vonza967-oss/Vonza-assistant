export function getPort() {
  return Number(process.env.PORT || 3000);
}

export function getPublicAppUrl(port = getPort()) {
  return (process.env.PUBLIC_APP_URL || `http://0.0.0.0:${port}`).replace(/\/$/, "");
}
