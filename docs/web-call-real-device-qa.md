# Web Call Real-Device QA Checklist

Scope: browser-based voice on the hosted full-page Front Desk, including optional Realtime WebRTC mode and the existing turn-based fallback. The website agent remains secondary. Do not validate Web Call through phone, Twilio, or phone-number flows.

## Test Setup

- Use a real owner account with active access and enough AI capacity.
- Enable voice input, spoken replies, and browser voice for the full-page Front Desk.
- Open the hosted Front Desk page over HTTPS.
- Use a test business and test contact details only.
- Confirm telemetry does not contain raw audio, transcript text, assistant reply text, contact PII, ephemeral Realtime client secrets, OpenAI keys, speech tokens, cookies, authorization headers, or secrets.

## Device Matrix

| Surface | Pass criteria |
| --- | --- |
| iOS Safari | Realtime attempts over HTTPS where supported; if WebRTC, autoplay, or mic permission fails, the UI falls back to turn-based browser voice or typed/contact fallback. |
| Android Chrome | Realtime WebRTC connects and plays model audio where supported; if token, SDP, network, or autoplay setup fails, one turn-based voice turn records and stops cleanly. |
| Desktop Chrome | Realtime mode supports natural speech, VAD-driven turns, interruption/barge-in where API events expose it, reconnect state, safe telemetry, and no phone/Twilio routes. |
| Desktop Safari | Realtime or turn-based fallback works where supported; if playback is blocked, the answer remains readable and retry/type/contact fallback is visible. |

## Scenario Checklist

| Scenario | Expected behavior | Pass/Fail |
| --- | --- | --- |
| Happy path, one turn | User taps Start voice turn or Talk to the Front Desk, speaks one short question, taps Done speaking in turn-based mode, receives a text answer and optional spoken reply. `web_call_sessions`, Web Call product events, Web Call messages, and turn telemetry share the server session ID. | Pass if all rows are scoped to the correct owner/agent and no unsafe telemetry fields are stored. |
| Realtime happy path | User taps Talk to the Front Desk, grants mic access, speaks naturally, and hears concise model audio through the browser. | Pass if only safe session telemetry is stored: connection latency, first-audio latency, interruptions, reconnects, duration, turn count, fallback reason, and failure category. UI states should stay browser-specific: connecting browser voice, listening now, preparing a short reply, speaking in your browser, reconnecting browser voice, and browser voice ended. |
| OpenAI Realtime unavailable | Force `/api/voice/realtime/session` or the SDP exchange to fail. | Pass if the UI records `openai_realtime_unavailable`, `realtime_token_failed`, or `realtime_connect_failed` safely and starts the existing turn-based Web Call flow without exposing provider details, API names, tokens, or secrets to the visitor. |
| Reconnect | Toggle network briefly during Realtime. | Pass if the UI shows reconnecting, increments safe reconnect telemetry, and either recovers or falls back to turn-based browser voice. |
| Interruption/barge-in | Speak while the model is speaking. | Pass if the UI returns to listening, increments interruption telemetry, and no raw transcript/reply text is stored in product events. |
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
- Realtime session setup uses browser-voice instructions: concise front-desk replies, no phone-line claims, server VAD with interruption enabled, and a supported Realtime voice.
- QA notes include device, browser version, Front Desk URL, outcome, and any safe error category only.
