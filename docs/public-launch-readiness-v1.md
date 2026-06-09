# Vonza Public Launch Readiness v1

## First Public Product Shape
- Sell Vonza as a Website Widget for service businesses with inbound leads: an AI agent on the customer website in 5 minutes, with no technical skill required.
- Stable launch core: Website Widget, website import, template/tone setup, widget install verification, Today, Contacts, Customize, Outcomes, lead capture, and the shared AI Front Desk dashboard.
- Optional Google-connected beta: Google connect, Inbox, Calendar, Automations.
- Hidden from the public launch path: advanced guidance, manual outcome marks, knowledge-fix workflows.

## First ICP
- Service businesses with inbound leads.
- Best fit: businesses that already get quote, booking, callback, or availability requests through their website.
- Example segments: home services, clinics, studios, agencies, consultants.

## Stable / Beta / Hidden Matrix
- `stable`: `marketing_site`, `signup_auth`, `checkout`, `front_desk` control center, `website_import`, `widget_install`, `today`, `contacts`, `outcomes`, `customize`, `lead_capture`
- `beta`: `google_connect`, `inbox`, `calendar`, `automations`
- `hidden`: `advanced_guidance`, `manual_outcome_marks`, `knowledge_fix_workflows`

## Launch Checklist
- Apply the canonical schema and linked Supabase migrations with no drift.
- Confirm required env vars are set for auth, billing, database, and public app URL.
- Confirm the stable / beta / hidden matrix is intentional for this deployment.
- Verify the core paid-user path: homepage -> pricing -> signup/checkout -> auth -> Website Widget dashboard.
- Verify website URL save and website import work on a real customer-style site.
- Verify template/tone setup, widget preview, WordPress or one-line embed install, and install detection on a real published page.
- Verify the first live Website Widget conversation.
- Verify lead capture creates a contact record.
- Verify contact timeline renders safely with sparse and richer data.
- Verify outcomes appear after a real or controlled proof path.
- Verify widget-only mode renders safely when the operator workspace is off.
- Verify optional Google mode only appears when enabled, and works end-to-end when connected.
- Verify one failed optional dashboard sub-request does not blank the workspace.
- Verify startup checks pass with no schema drift or broken boot path.
