# Vonza Beta Monitoring

Review these items daily while a customer is in controlled beta. Escalate anything that affects public availability, access control, or answer safety immediately.

## Daily Checks
- Unanswered or unsafe customer questions.
- Not-helpful feedback.
- Training queue items awaiting review.
- Contact captures and whether they contain usable follow-up details.
- Failed assistant bootstraps.
- Rate-limit hits.
- OpenAI or Supabase errors.
- RAG no-context fallbacks.
- Voice failures if voice input is enabled.
- Customer confusion in the dashboard.

## Issue Triage Labels

### P0
- Public assistant unavailable.
- Data leak or security issue.
- Invented dangerous business facts.
- Auth or access control broken.

### P1
- Wrong answer about price, service, contact, or policy.
- WordPress install broken.
- Dashboard save broken.
- Feedback or training broken.

### P2
- Layout issue.
- Confusing copy.
- Non-critical UX bug.

### P3
- Polish.

