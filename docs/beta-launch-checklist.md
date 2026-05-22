# Vonza Controlled Beta Launch Checklist

Use this checklist before adding each controlled beta customer. Keep the beta small until every critical item is confirmed on the current production deploy.

## Live Product Checks
- [ ] WordPress Front Desk page loads.
- [ ] Hosted `/a/:slug` Front Desk route works.
- [ ] `/assistant/:slug` route works.
- [ ] Normal website widget works.
- [ ] Smart embed works.
- [ ] QR/direct link works.
- [ ] Voice input works if enabled for the customer.
- [ ] Feedback controls work on assistant replies.
- [ ] Training queue receives feedback.
- [ ] Approved answers influence replies.

## Dashboard Checks
- [ ] Home loads.
- [ ] Customers loads.
- [ ] Front Desk loads.
- [ ] Analytics loads.
- [ ] Install loads.
- [ ] Settings loads.
- [ ] Settings subtabs do not reset during normal navigation.
- [ ] Install method does not reset during normal navigation.
- [ ] Owner can save settings.
- [ ] Owner can create an approved answer.
- [ ] Owner can review not-helpful feedback.

## Answer-Quality Checks
- [ ] No invented prices.
- [ ] No invented services.
- [ ] No invented contact details.
- [ ] No invented refunds or policies.
- [ ] No invented booking availability.
- [ ] Safe fallback appears when context is missing.
- [ ] Approved answer priority works.
- [ ] Semantic RAG is indexed for imported knowledge.

## Security/Ops Checks
- [ ] Upstash rate limiting is enabled.
- [ ] No raw backend errors are shown to public users.
- [ ] Fake or missing assistant is unavailable.
- [ ] Bad origin without key is unavailable.
- [ ] Public page key behavior works.
- [ ] WordPress page template is active.
- [ ] Latest Render deploy is confirmed.

