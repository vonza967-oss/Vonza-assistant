# Web Call Real-Device QA Checklist

Scope: browser-based, turn-based voice on the hosted full-page Front Desk. The website widget remains secondary. Do not validate Web Call through phone, Twilio, or phone-number flows.

## Test Setup

- Use a real owner account with active access and enough AI capacity.
- Enable voice input, spoken replies, and browser voice for the full-page Front Desk.
- Open the hosted Front Desk page over HTTPS.
- Use a test business and test contact details only.
- Confirm telemetry does not contain transcript text, assistant reply text, contact PII, speech tokens, cookies, authorization headers, or secrets.

## Device Matrix

| Surface | Pass criteria |
| --- | --- |
| iOS Safari | Microphone permission prompt appears, one voice turn records, transcript is sent as a Web Call turn, spoken reply can be started by the user when autoplay is blocked, and typed fallback remains available. |
| Android Chrome | One voice turn records and stops cleanly, assistant response returns, spoken reply plays after a user gesture, and retry/contact fallback appears after recoverable failures. |
| Desktop Chrome | Multiple voice turns work up to the configured turn limit, latency telemetry is recorded per turn, and no phone/Twilio routes are called. |
| Desktop Safari | Recording and playback work where supported; if playback is blocked, the answer remains readable and Play/retry/type/contact fallbacks are visible. |

## Scenario Checklist

| Scenario | Expected behavior | Pass/Fail |
| --- | --- | --- |
| Happy path, one turn | User taps Start voice turn, speaks one short question, taps Done speaking, receives a text answer and optional spoken reply. `web_call_sessions`, Web Call product events, Web Call messages, and turn telemetry share the server session ID. | Pass if all rows are scoped to the correct owner/agent and no unsafe telemetry fields are stored. |
| Multi-turn session | User completes 2-3 sequential turns. | Pass if turn indexes increment, session `turn_count` updates, and each telemetry row is tied to the same session. |
| iOS autoplay restriction | Spoken reply cannot autoplay without a valid user gesture. | Pass if the text answer stays visible and the UI offers Play, retry, type, or contact fallback without treating this as a crash. |
| Denied microphone permission | User denies mic access. | Pass if the UI shows a safe permission message, does not send audio/transcript/chat traffic, records only safe failure category telemetry, and offers type/contact fallback. |
| Noisy or unclear audio | Use background noise or a very short unclear utterance. | Pass if the turn is rejected or asks the user to repeat, does not send garbled transcript to chat, and records only safe failure category/timing metadata. |
| Slow network | Throttle to Slow 3G or equivalent. | Pass if loading states remain clear, request failures show retry/type/contact fallback, and latency fields reflect longer upload/transcription/response timings. |
| Transcription provider failure | Force `/api/voice/transcribe` to return 429/503. | Pass if the UI avoids provider details, no chat turn is sent, and safe failure telemetry is recorded. |
| Assistant response failure | Force `/chat` to return 500/timeout. | Pass if the user sees a recoverable Front Desk failure, the session remains owner/agent scoped, and no transcript/reply text is written to telemetry. |
| TTS provider failure | Force `/api/voice/speech` to return 503. | Pass if the text reply remains readable, spoken-reply failure is categorized safely, and contact/type fallback is available. |
| Capacity/access block | Use inactive access or capped AI usage. | Pass if Web Call does not bypass billing/access checks and the user can still type where allowed by existing policy. |

## Final Acceptance

- No Web Call request touches `/phone`, Twilio webhooks, or phone session storage.
- Public browser requests never write directly to Supabase.
- RLS is enabled on Web Call session and telemetry tables.
- Owner dashboard analytics can aggregate safe Web Call health without exposing PII.
- QA notes include device, browser version, Front Desk URL, outcome, and any safe error category only.
