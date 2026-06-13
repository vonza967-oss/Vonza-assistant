# Vonza Public Launch Readiness v1

## First Public Product Shape
- Sell Vonza as a Hungarian-first Website Agent SaaS for SMEs: a website AI agent for questions, quote intent, booking intent, contact capture, and follow-up on existing business websites.
- Public launch promise: install a Hungarian website AI agent in about 5 minutes, with no technical skill required.
- Stable launch core: Website Agent setup, website import, template/tone setup, install verification, allowed domains, Home, Customers, Front Desk, Analytics, Customize, lead capture, and the shared owner dashboard.
- The AI Front Desk is the broader system behind the agent. Keep the full-page Front Desk as a companion/expansion channel for QR/direct links, WordPress pages, smart embeds, and dedicated customer-facing flows.
- Optional Google-connected beta: Google connect, Inbox, Calendar, Automations.
- Hidden from the public launch path: advanced guidance, manual outcome marks, knowledge-fix workflows.

## First ICP
- Hungarian SMEs with inbound customer questions and service requests.
- Best fit: businesses that already get quote, booking, callback, or availability requests through their website, email, phone, QR touchpoints, or social profiles.
- Example segments: home services, clinics, studios, agencies, consultants.

## Stable / Beta / Hidden Matrix
- `stable`: `marketing_site`, `signup_auth`, `checkout`, `widget_install` as the public launch channel, `front_desk` shared system and companion full-page channel, `website_import`, `today`, `contacts`, `outcomes`, `customize`, `lead_capture`
- `beta`: `google_connect`, `inbox`, `calendar`, `automations`
- `hidden`: `advanced_guidance`, `manual_outcome_marks`, `knowledge_fix_workflows`

## Launch Checklist
- Apply the canonical schema and linked Supabase migrations with no drift.
- Confirm required env vars are set for auth, billing, database, and public app URL.
- Confirm the stable / beta / hidden matrix is intentional for this deployment.
- Verify the core paid-user path: homepage -> pricing -> signup/checkout -> auth -> dashboard -> install Website Agent.
- Verify website URL save and website import work on a real customer-style site.
- Verify template/tone setup, one-line Website Agent install, install detection, and allowed-domain checks on a real published page.
- Verify the first live Website Agent conversation uses Hungarian-first defaults and grounded website answers.
- Verify the full-page Front Desk companion channel still works for QR/direct link sharing, WordPress pages, smart embeds, and dedicated page installs.
- Verify lead capture creates a contact record.
- Verify contact timeline renders safely with sparse and richer data.
- Verify outcomes appear after a real or controlled proof path.
- Verify agent-only mode still renders safely when the operator workspace is off.
- Verify optional Google mode only appears when enabled, and works end-to-end when connected.
- Verify one failed optional dashboard sub-request does not blank the workspace.
- Verify startup checks pass with no schema drift or broken boot path.
