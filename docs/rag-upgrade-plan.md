# Retrieval/RAG Upgrade Plan

This hardening pass keeps retrieval keyword-based and avoids adding a large embedding system before launch.

Next semantic retrieval pass:

- Store website content as small chunks with URL, title, headings, section type, and freshness metadata.
- Add chunk-level embeddings with Supabase `pgvector` or a managed external vector store.
- Retrieve owner-approved answers first, then semantic website chunks, then contact/config facts.
- Keep draft, archived, and cross-agent training out of public retrieval.
- Add a small evaluation set for prices, services, policies, availability, booking times, discounts, owner-approved overrides, no-context fallbacks, and irrelevant-section rejection.
- Track retrieval precision and answer-grounding failures before changing the production answer path.
