# Vonza for Mac

Vonza for Mac is a Tauri 2 desktop wrapper around the hosted Vonza dashboard. It does not bundle dashboard business logic, backend APIs, customer data logic, analytics logic, database access, or install flows.

The app loads this dashboard URL by default:

```bash
https://vonza-assistant.onrender.com/dashboard
```

Override it for staging or production smoke checks:

```bash
VONZA_DESKTOP_DASHBOARD_URL=https://your-host.example/dashboard npm run dev
```

## Requirements

- macOS build machine
- Xcode command line tools
- Rust toolchain with `rustc` and `cargo`
- Node.js and npm
- Apple Developer Program membership for public signed releases
- Developer ID Application certificate for direct internet distribution

## Local Development

From the repository root:

```bash
npm run desktop:install
npm run desktop:dev
```

Unsigned local builds are development-only:

```bash
npm run desktop:build
```

Universal Apple Silicon and Intel builds, when the local Rust targets are installed:

```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run desktop:build:universal
```

If universal packaging is not reliable in CI, build separate `aarch64-apple-darwin` and `x86_64-apple-darwin` artifacts and publish both downloads.

## Signing And Notarization

Public downloads outside the Mac App Store must be signed with Developer ID, notarized by Apple, and stapled where applicable. Unsigned `.app` or `.dmg` files should not be presented as production-ready.

Use secure CI secrets. Do not commit certificates, passwords, API keys, or `.env` values.

Supported secret names for this project:

```bash
APPLE_CERTIFICATE
APPLE_CERTIFICATE_PASSWORD
KEYCHAIN_PASSWORD
APPLE_ID
APPLE_TEAM_ID
APPLE_PASSWORD
```

`APPLE_APP_SPECIFIC_PASSWORD` is accepted by the GitHub workflow as a fallback secret name for `APPLE_PASSWORD`. `APPLE_CERTIFICATE` should contain a base64-encoded `.p12` Developer ID Application certificate. `KEYCHAIN_PASSWORD` is for the temporary CI keychain and should be different from the `.p12` password.

Optional secrets:

```bash
APPLE_SIGNING_IDENTITY
APPLE_PROVIDER_SHORT_NAME
```

App Store Connect API key notarization can be added later with:

```bash
APPLE_API_KEY
APPLE_API_KEY_PATH
APPLE_API_ISSUER
APPLE_TEAM_ID
```

## OAuth And Auth Compatibility

Dashboard email/password auth uses Supabase session persistence in the WebView and should work like normal browser access. Magic links and password reset links opened from email may open in the user's default browser unless a desktop deep-link callback is added later.

Google connected-tools OAuth is intentionally opened in the system browser from the desktop app. Google may block embedded WebViews, so the desktop wrapper does not force Google OAuth inside the WebView. After completing Google connection in the browser, return to the desktop app and reload the dashboard if the connection status has not refreshed.

A future native desktop login upgrade should add a custom protocol such as `vonza://auth/callback` and a supported server-side redirect/callback flow without breaking the existing `/dashboard` browser login.

## Release Checklist

1. Build on macOS.
2. Sign with Developer ID Application.
3. Notarize with Apple.
4. Staple the notarization ticket to the app or DMG.
5. Generate and publish a checksum.
6. Upload the `.dmg` to GitHub Releases or the Vonza website.
7. Update the website download page with version, release date, download URL, and checksum.

## Manual QA

1. Install from the universal DMG.
2. Drag `Vonza.app` to `/Applications`.
3. Open `Vonza.app`.
4. Confirm it loads `https://vonza-assistant.onrender.com/dashboard`.
5. Confirm login works.
6. Confirm Home, Front Desk, Customers, Analytics, Install, and Settings open.
7. Confirm external and OAuth-style links open in the system browser.
8. Confirm app quit/reopen works.
9. Confirm expected session persistence behavior.
10. Confirm the app name, icon, and window settings are correct.

## Auto-Update Plan

Auto-update is not enabled in this first desktop wrapper. The safest future option is Tauri's updater plugin with signed update manifests hosted on GitHub Releases or the Vonza website.
