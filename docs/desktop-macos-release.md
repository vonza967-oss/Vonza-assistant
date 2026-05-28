# macOS Desktop Release

Vonza for Mac lives in `apps/desktop`. It is a Tauri 2 wrapper that opens the hosted dashboard and preserves the existing web application behavior.

## Build Commands

```bash
npm run desktop:install
npm run desktop:check
npm run desktop:dev
npm run desktop:build
```

Use a staging dashboard URL when needed:

```bash
VONZA_DESKTOP_DASHBOARD_URL=https://staging.example.com/dashboard npm run desktop:dev
```

Build a universal macOS app when Rust targets and Tauri bundling support are available:

```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run desktop:build:universal
```

## Distribution Requirements

Direct internet distribution outside the Mac App Store requires:

- Apple Developer Program membership
- Developer ID Application certificate
- App-specific password or App Store Connect API credentials for notarization
- macOS build environment
- Xcode command line tools
- secure CI secrets

Unsigned local builds are allowed for development only. Do not publish unsigned builds as production downloads.

Production DMGs must be signed with a Developer ID Application certificate, notarized by Apple, and stapled by Tauri before they are linked from the public website. Tauri reads the signing identity from `APPLE_SIGNING_IDENTITY` when provided, or infers it from `APPLE_CERTIFICATE` after the Developer ID certificate is imported.

## CI Secrets

The release workflow recognizes these GitHub Actions secrets for Apple ID notarization:

```bash
APPLE_CERTIFICATE
APPLE_CERTIFICATE_PASSWORD
KEYCHAIN_PASSWORD
APPLE_ID
APPLE_TEAM_ID
APPLE_PASSWORD
```

`APPLE_APP_SPECIFIC_PASSWORD` is also accepted as a fallback secret name for `APPLE_PASSWORD`.

Optional secret:

```bash
APPLE_SIGNING_IDENTITY
APPLE_PROVIDER_SHORT_NAME
```

`APPLE_CERTIFICATE` is expected to be a base64-encoded `.p12` Developer ID Application certificate. `APPLE_CERTIFICATE_PASSWORD` is the password used when exporting the `.p12`. `KEYCHAIN_PASSWORD` is only for the temporary CI keychain and should be a separate generated value. If `APPLE_SIGNING_IDENTITY` is omitted, the workflow detects the imported `Developer ID Application` identity and exports it for Tauri.

Tauri also supports App Store Connect API key notarization. This workflow does not use it yet. If it is adopted later, replace the Apple ID notarization secrets with:

```bash
APPLE_API_ISSUER
APPLE_API_KEY
APPLE_API_KEY_PATH
APPLE_TEAM_ID
APPLE_CERTIFICATE
APPLE_CERTIFICATE_PASSWORD
KEYCHAIN_PASSWORD
```

## Website Download Page

The public download entry point is `/download/mac`. Until a signed and notarized DMG exists, it shows the Mac app as release-prep status rather than a final production download.

Set these production environment variables after the first signed release:

```bash
VONZA_MAC_DMG_URL=https://example.com/Vonza_1.0.0_universal.dmg
VONZA_MAC_DMG_SIGNED_NOTARIZED=true
VONZA_MAC_DMG_SHA256=<64-character sha256>
VONZA_MAC_VERSION=1.0.0
VONZA_MAC_RELEASE_DATE=2026-05-28
```

`VONZA_MAC_DMG_URL` must be an HTTPS URL. The production download CTA is hidden unless `VONZA_MAC_DMG_SIGNED_NOTARIZED=true` is also configured. The checksum is rendered when it is a valid 64-character SHA-256 value.

## Verification

For every desktop release candidate:

```bash
node --check frontend/dashboard.js
node --check frontend/script.js
node --check frontend/settings/SettingsShell.js
node --check assistant-embed.js
npm run test:smoke
npm run check:schema-sync
npm run lint
git diff --check
```

Desktop-specific checks:

```bash
npm run desktop:check
npm run desktop:build
npm run desktop:build:universal
shasum -a 256 apps/desktop/src-tauri/target/release/bundle/dmg/*.dmg
```

Manual QA checklist for the universal DMG:

1. Install from the universal DMG.
2. Drag `Vonza.app` to `/Applications`.
3. Open `Vonza.app`.
4. Confirm it loads `https://vonza-assistant.onrender.com/dashboard`.
5. Confirm login works.
6. Confirm Home, Front Desk, Customers, Analytics, Install, and Settings open.
7. Confirm external and OAuth-style links open in the system browser.
8. Quit and reopen the app.
9. Confirm expected session persistence behavior after reopen.
10. Confirm the app name, icon, and window title/size settings are correct.
11. Confirm no secrets are committed.

## First Signed DMG Steps

1. Create or confirm an Apple Developer ID Application certificate.
2. Export it from Keychain Access as a password-protected `.p12`.
3. Base64 encode it:

```bash
openssl base64 -A -in DeveloperIDApplication.p12 -out developer-id-application-base64.txt
```

4. Add the GitHub Actions secrets listed above.
5. Run the `Desktop macOS Release` workflow manually first and keep the artifact private.
6. Download the artifact and verify signing/notarization locally:

```bash
codesign -dvvv --entitlements :- /Applications/Vonza.app
spctl -a -vv /Applications/Vonza.app
```

7. Run the manual QA checklist.
8. Generate the release checksum:

```bash
shasum -a 256 apps/desktop/src-tauri/target/universal-apple-darwin/release/bundle/dmg/Vonza_1.0.0_universal.dmg
```

9. Upload only the signed/notarized universal DMG to the chosen release host.
10. Set the `VONZA_MAC_*` production environment variables.
11. Deploy `main` and verify `/download/mac` shows the production download CTA and checksum.
