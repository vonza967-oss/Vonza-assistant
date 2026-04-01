## Local auth + payment test setup

Fill these values in your real `.env` before testing:

- `PORT`
- `PUBLIC_APP_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `ADMIN_TOKEN`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`

For local testing:

- `PUBLIC_APP_URL` should be `http://localhost:3000`
- Stripe CLI forwarding must be running
- Run:

```bash
stripe listen --forward-to localhost:3000/stripe/webhook
```

- `STRIPE_WEBHOOK_SECRET` must match the signing secret printed by Stripe CLI
- Use this Stripe test card:

```text
4242 4242 4242 4242
```
