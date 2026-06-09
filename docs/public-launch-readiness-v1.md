# Vonza Public Launch Readiness v1

## First Public Product Shape
- Sell Vonza as a Hungarian-first AI Front Desk SaaS for SMEs: a full-page customer-facing Front Desk for questions, quote intent, booking intent, contact capture, and follow-up.
- Stable launch core: hosted AI Front Desk page, website import, template/tone setup, install options, Home, Customers, Front Desk, Analytics, Customize, lead capture, and the shared owner dashboard.
- Website Widget is secondary. Position it as the fastest embedded install/channel option for existing websites that need a compact launcher or one-line assistant snippet.
- Optional Google-connected beta: Google connect, Inbox, Calendar, Automations.
- Hidden from the public launch path: advanced guidance, manual outcome marks, knowledge-fix workflows.

## First ICP
- Hungarian SMEs with inbound customer questions and service requests.
- Best fit: businesses that already get quote, booking, callback, or availability requests through their website, email, phone, QR touchpoints, or social profiles.
- Example segments: home services, clinics, studios, agencies, consultants.

## Stable / Beta / Hidden Matrix
- `stable`: `marketing_site`, `signup_auth`, `checkout`, `front_desk` customer page and owner control center, `website_import`, `widget_install` as secondary embedded channel, `today`, `contacts`, `outcomes`, `customize`, `lead_capture`
- `beta`: `google_connect`, `inbox`, `calendar`, `automations`
- `hidden`: `advanced_guidance`, `manual_outcome_marks`, `knowledge_fix_workflows`

## Launch Checklist
- Apply the canonical schema and linked Supabase migrations with no drift.
- Confirm required env vars are set for auth, billing, database, and public app URL.
- Confirm the stable / beta / hidden matrix is intentional for this deployment.
- Verify the core paid-user path: homepage -> pricing -> signup/checkout -> auth -> dashboard -> publish full-page AI Front Desk.
- Verify website URL save and website import work on a real customer-style site.
- Verify template/tone setup, hosted Front Desk preview, QR/direct link sharing, WordPress or smart embed install, and install detection on a real published page.
- Verify the first live full-page AI Front Desk conversation.
- Verify Website Widget setup only as a secondary embedded channel, including one-line embed install and allowed-domain checks.
- Verify lead capture creates a contact record.
- Verify contact timeline renders safely with sparse and richer data.
- Verify outcomes appear after a real or controlled proof path.
- Verify widget-only mode still renders safely when the operator workspace is off.
- Verify optional Google mode only appears when enabled, and works end-to-end when connected.
- Verify one failed optional dashboard sub-request does not blank the workspace.
- Verify startup checks pass with no schema drift or broken boot path.
