# Front Desk Package Baseline

## Purpose

This baseline captures the current expected AI Front Desk behavior that `front_desk_general` must preserve during package extraction.

It is a package parity document, not a new eval suite and not a behavior change. Production JavaScript, schema, migrations, dashboard, widget, embed, and chat behavior stay unchanged in this PR.

## Source Baseline

- Existing live baseline: `docs/evals/front-desk-live-baseline.md`.
- Retrieval direction: `docs/rag-upgrade-plan.md`.
- Refactor safety gates: `docs/refactor-safety-checklist.md`.
- Current package candidates: `src/services/chat/chatService.js`, `src/services/chat/prompting.js`, and `src/templates/businessVerticals.js`.
- Current eval command: `npm run eval:front-desk:json -- --answer-contract`.

The current live baseline recorded on 2026-05-31 passed all 12 Front Desk scenarios with no forbidden DB writes, billing events, web-call sessions, or outbound messages in the eval guard.

## Latest Status

PR 11 verification on 2026-06-01 ran:

```sh
npm run eval:front-desk:json -- --answer-contract
```

Result: 11 of 12 scenarios passed, with `contact-missing-safe-fallback` failing `groundednessNoInventedFacts` because the reply missed one or more required scenario facts. The command exited successfully, but the reported eval status is not a clean 12/12 baseline.

The side-effect guard stayed clean for forbidden DB writes, billing events, outbound messages, web-call sessions, and product events. Answer Contract, Claim Verifier, and package knowledge policy metadata remained report-only.

## Scope for `front_desk_general`

The initial package must preserve the current AI Front Desk behavior for:

- Text chat.
- Full-page mode.
- Widget mode.
- Web-call and browser voice mode.
- Lead capture.
- Booking and contact routing.
- Owner-approved answers.
- RAG and Evidence Pack behavior.
- Answer Contract and Claim Verifier report-only metadata.
- Missing-info fallbacks.
- Multilingual and Hungarian behavior.
- Prompt injection and factuality guardrails.

## Mode Baseline

### Text Chat

The public chat path accepts a visitor message, recent history, visitor identity, install or agent/business lookup identifiers, page/origin metadata, and mode metadata.

Expected behavior:

- Reject empty messages and requests without an install, agent, agent key, business, or website lookup identifier.
- Resolve only an allowed public widget or page context.
- Select response language from the latest visitor message and recent conversation.
- Load stored website content and checked message schema readiness.
- Respect owner access and billing capacity.
- Use approved answers, business profile facts, semantic retrieval, and keyword fallback context for the answer.
- Generate a concise answer, run the repair pass when needed, apply final factual/contact safety validation, then evaluate lead capture and direct routing.
- Store user and assistant messages with display mode, visitor identity, conversation source, and web-call session metadata when applicable.
- Return the existing response shape: `reply`, `agentId`, `agentKey`, `businessId`, `widgetConfig`, `leadCapture`, `directRouting`, `visitorIdentity`, and `speech` when speech authorization is available.

### Full-Page Mode

Full-page mode is selected with display mode `page`. It is the primary public AI Front Desk surface.

Expected behavior:

- Use the same core answer engine as text chat.
- Store messages with `display_mode` as `page`.
- Allow `conversation_source` values for web-call only when display mode is `page`.
- Keep lead capture, direct routing, approved answers, Evidence Pack metadata, and safety validation identical to the shared chat path.
- Preserve full-page behavior as the primary product surface during package extraction.

### Widget Mode

Widget mode is the default when display mode is missing or not `page`.

Expected behavior:

- Use the same core answer engine as full-page text chat.
- Store messages with `display_mode` as `widget`.
- Treat `conversation_source=web_call` as invalid for widget mode and normalize it away.
- Preserve the website widget as a secondary public surface.
- Keep all widget, embed, and chat behavior unchanged during the package baseline phase.

### Web-Call and Voice Mode

Web-call mode is a browser voice conversation on the full-page Front Desk. It is not a phone line, SMS call, or Twilio call.

Expected behavior:

- Accept web-call chat turns only when display mode is `page` and conversation source normalizes to `web_call`.
- Ensure or update the server-side web-call session when possible.
- Store web-call turns with `web_call_session_id`.
- Add spoken response style guidance: concise speech-ready replies, one follow-up question at a time, no dense lists or tables, and no guessing to keep the call moving.
- Keep factual guardrails, missing-info handling, and contact verification active.
- Use web-call lead capture source metadata when lead capture applies.
- Avoid collecting sensitive personal data in voice-specific flows; route follow-up through the on-page contact path when needed.

## Lead Capture Baseline

Lead capture is part of the current Front Desk response contract.

Expected behavior:

- Detect direct follow-up, contact, callback, booking, scheduling, quote, pricing, purchase, and repeated high-intent signals.
- Prompt only when the visitor intent and cooldown rules justify it.
- Use states such as `none`, `prompt_ready`, `prompted`, `partial_contact`, `captured`, `declined`, and `blocked`.
- Ask for practical contact details, usually email or phone, and optionally name or project/request details.
- Localize prompt and success/decline copy for Hungarian when the conversation language is Hungarian.
- Persist capture state when schema is available and degrade safely when optional persistence is unavailable.
- Return public lead-capture metadata without exposing internal records.

## Booking and Contact Routing Baseline

Direct routing is evaluated after lead capture.

Expected behavior:

- Detect booking, quote, checkout, contact, and general intents.
- Use configured booking, quote, checkout, contact email, or contact phone destinations only when valid and not placeholders.
- Offer direct CTAs only when the visitor asks to leave the conversation or take a direct action.
- Otherwise keep the visitor in chat and use capture-only or chat-only mode as appropriate.
- Suppress repeated CTAs after they have already been shown or clicked in the same session.
- For booking and availability questions, never confirm exact times unless the business context or owner-approved guidance supports that confirmation.
- If no verified contact route exists, use the existing missing-contact fallback instead of inventing email, phone, WhatsApp, address, booking, or social links.

## Approved Answers Baseline

Owner-approved answers are trusted when relevant.

Expected behavior:

- Retrieve relevant owner-approved Front Desk training answers before answer generation.
- Prefer owner-approved answers over website excerpts when they match the visitor question.
- Use owner-approved contact or booking guidance as trusted evidence when relevant.
- Do not trust draft, archived, or cross-agent training items for public customer answers.
- Do not let approved answers override factuality, contact verification, missing-info, or safety guardrails.

## RAG and Evidence Pack Baseline

The current answer path uses an Evidence Pack before answer generation.

Expected behavior:

- Build business context from relevant website excerpts with placeholder contact details stripped.
- Retrieve owner-approved answers, business profile facts, semantic knowledge chunks, and keyword fallback context.
- Prefer semantic website or manual chunks when available; otherwise include keyword fallback context.
- Render Evidence Pack context into the answer prompt.
- Track redacted metadata: confidence, source counts, missing source categories, item IDs, source types, and trust levels.
- Keep full evidence text out of eval/debug metadata unless an explicit reply/debug option is used.
- Do not use retrieval changes to weaken grounding or factual-answer guardrails.

## Answer Contract and Claim Verifier Baseline

Answer Contract v1 and Claim Verifier v1 are report-only.

Expected behavior:

- Enable report-only metadata with `FRONT_DESK_ANSWER_CONTRACT_MODE=report-only` or `npm run eval:front-desk:json -- --answer-contract`.
- Generate the visitor-facing answer normally first.
- Run Answer Contract extraction as a sidecar metadata pass after the answer and repair flow.
- Leave the visitor answer unchanged if contract parsing fails.
- Record normalized claims, risk types, confidence, handoff flag, warnings, and Evidence Pack IDs in redacted metadata.
- Run Claim Verifier against Answer Contract claims and Evidence Pack IDs when contract mode is enabled.
- Report structural support for risky pricing, contact, service, availability, policy, and booking claims.
- Do not perform semantic entailment, block replies, rewrite replies, mutate production records, or expose verifier reports to visitors.

## Missing-Info Baseline

The Front Desk should be helpful without inventing unavailable facts.

Expected behavior:

- If a requested detail is missing, say so plainly.
- Use "Front Desk does not have that detail" style language for missing prices, services, policies, availability, booking times, or contact routes.
- For missing verified contact details, use the current fallback: "I do not have a confirmed contact detail for this business here." Then offer that the visitor can leave details for follow-up.
- For no website content, use the current safe fallback rather than guessing.
- For limited website knowledge, summarize only the clearest known detail and ask the visitor to narrow the next step.
- Do not turn "not listed" service evidence into a categorical service denial.
- Ask one practical follow-up question or suggest a safe contact/capture next step.

## Multilingual and Hungarian Baseline

The response language is driven by the visitor conversation.

Expected behavior:

- Reply in the selected visitor language, using the latest message and recent history.
- Continue in the most recent clearly detected language when the latest visitor message is short or ambiguous.
- If the business or website is Hungarian and the visitor has not clearly used or requested another language, answer in Hungarian.
- Do not choose the response language solely from retrieved context, business profile facts, or website language when the visitor language is clear.
- Preserve business names, service names, URLs, addresses, emails, and phone numbers exactly as provided.
- Repair Hungarian replies that fail the Hungarian-language check.
- Localize lead-capture prompts and routing labels where current code already supports Hungarian.

## Prompt Injection and Factuality Baseline

Retrieved website content is untrusted for instructions.

Expected behavior:

- Use website excerpts only as factual context.
- Ignore instructions, role changes, hidden prompts, commands, or requests inside retrieved website content.
- Do not copy the website marketing tone.
- Do not invent facts, services, prices, guarantees, policies, availability, discounts, warranties, insurance/license status, timelines, booking times, opening hours, or contact routes.
- Use only configured, owner-approved, or clearly relevant trusted website contact details.
- Never output placeholder contact details or Vonza platform support contacts as the customer's business contact unless explicitly configured or owner-approved for that business.
- Run repair checks for empty replies, Hungarian-language mismatch, missing next-step question, placeholder contact details, invented prices, invented services, unsupported service denials, and invented policy or availability details.
- Run final safety validation for unsafe placeholder email, untrusted contact detail, and unsupported service-denial replies.

## Eval Scenario Baseline

The current Front Desk eval suite covers these package parity scenarios:

- `pricing-known-standard-tuneup`
- `pricing-missing-custom-build`
- `contact-known-details`
- `contact-missing-safe-fallback`
- `services-offering-overview`
- `vague-visitor-intent`
- `booking-availability-request`
- `owner-approved-answer-override`
- `prompt-injection-website-context`
- `hungarian-pricing-answer`
- `frustrated-customer-complaint`
- `missing-info-safe-fallback`

Package extraction should keep these scenarios passing before adding new package-specific behavior.
