# Vonza

Vonza is an AI Front Desk SaaS for small businesses. The current public launch wedge is the Website Widget: an AI agent on a customer website in 5 minutes, with no technical skill required. The broader AI Front Desk remains the shared dashboard and long-term product system behind the widget.

## Main Features

- Website Widget for existing websites with install verification and allowed-domain checks
- WordPress or one-line embed installation for the widget-first launch path
- Website import that turns public site content into chat grounding
- Configurable system prompt, tone, widget purpose, business context, and industry vertical
- Lead capture for warm visitors, quote requests, booking intent, and contact handoff
- Owner dashboard for conversations, customers, setup, analytics, install, and settings
- Analytics for conversations, lead capture, conversion outcomes, weak answers, top questions, and AI usage
- Stripe checkout, subscriptions, plan capacity, webhook sync, and AI usage ledger
- Optional Google-connected operator workflows for email, calendar, automations, and follow-up drafts
- Direct conversion routing for booking, quote, checkout, contact, and capture actions

## Architecture

Vonza is a Node.js and Express application backed by Supabase. The frontend is mostly static HTML, CSS, and browser JavaScript served by Express. Runtime services coordinate Supabase persistence, OpenAI chat replies, Stripe billing, website scraping, widget telemetry, lead capture, and owner analytics.

```text
Website visitor
  -> Vonza Website Widget on an existing site
  -> Express routes (/chat, /widget/bootstrap, /install/events)
  -> Services (chat, prompting, scraping, leads, analytics, billing)
  -> Supabase tables (businesses, agents, widget_configs, messages, leads, outcomes, usage)
  -> OpenAI for grounded assistant replies
  -> Stripe for checkout, webhooks, plan state, and capacity

Owner
  -> /dashboard
  -> owner APIs (/agents/*, /dashboard/analytics/summary)
  -> Supabase auth + owner/admin access checks
```

## Local Development

Install dependencies:

```bash
npm install
```

Create a local `.env` file with the required values. Do not commit secrets.

```bash
PUBLIC_APP_URL=http://localhost:3000
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
ADMIN_TOKEN=...
BOOKING_WEBHOOK_ENCRYPTION_SECRET=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PRICE_ID_STARTER_MONTHLY=...
STRIPE_PRICE_ID_GROWTH_MONTHLY=...
STRIPE_PRICE_ID_PRO_MONTHLY=...
```

Apply database schema in Supabase. `db/schema.sql` is canonical for a fresh database, and incremental migrations live in `supabase/migrations/` plus matching `db/*.sql` files. For an existing database, apply the new migration files in order. Production must include `supabase/migrations/20260510000000_business_vertical.sql` before relying on persisted business verticals.

Start the app:

```bash
npm start
```

Open the dashboard at `http://localhost:3000/website-widget/dashboard`. Legacy dashboard paths redirect to the Website Widget dashboard in the current public launch. Analytics renders inside the dashboard shell and reads JSON from `/dashboard/analytics/summary`; `/dashboard/analytics` is a JSON-only compatibility alias. The widget preview is served at `/widget`; the embeddable scripts are `/embed.js` and `/embed-lite.js`.

## Calendly Webhook Provisioning

Calendly booking confirmations use an internal provisioning script. Set `BOOKING_WEBHOOK_ENCRYPTION_SECRET` to a long random value before provisioning; it encrypts stored Calendly webhook signing secrets and is separate from the Calendly signing secret itself.

Provision an existing owner/agent pair with a signing secret supplied from an environment variable:

```bash
read -r -s CALENDLY_WEBHOOK_SIGNING_SECRET
export CALENDLY_WEBHOOK_SIGNING_SECRET
npm run provision:calendly-webhook -- \
  --owner-user-id <owner_uuid> \
  --agent-id <agent_uuid> \
  --webhook-secret-env CALENDLY_WEBHOOK_SIGNING_SECRET \
  --booking-url https://calendly.com/example/demo
unset CALENDLY_WEBHOOK_SIGNING_SECRET
```

The script upserts `agent_booking_integrations`, stores only the endpoint token hash and encrypted signing secret, and prints the Calendly webhook URL once. It does not register a Calendly webhook automatically.

## Testing

Run the smoke test suite:

```bash
npm run test:smoke
```

Run Supabase connectivity checks when validating a configured environment:

```bash
npm run test:supabase
```

Useful schema/deploy checks:

```bash
npm run check:schema-sync
npm run verify:deploy-readiness
```

## Contribution Guidelines

- Keep `db/schema.sql` aligned with every migration.
- Keep changes small and tied to the requested product behavior.
- Preserve auth, `owner_user_id`, `access_status`, billing, install, and lead-capture flows.
- Do not expose secrets or commit `.env` values.
- Do not change `/widget`, `/embed.js`, `/embed-lite.js`, or chat logic unless the task requires it.
- Escape user-supplied data in browser-rendered HTML.
- Add focused tests for new services, prompt behavior, endpoints, and frontend safety rules.

## Known Limitations and Future Work

- Analytics currently uses stored message and event read models; very recent widget telemetry can briefly lead persisted conversation summaries.
- Vertical templates are intentionally conservative and cover clinics, web studios, and home services first.
- The dashboard is static browser JavaScript rather than a component framework, so larger UI changes need careful organization.
- Google-connected operator workflows are optional beta surfaces and should remain approval-first.
- Local development requires a configured Supabase project for full end-to-end behavior.
