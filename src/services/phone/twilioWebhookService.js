import crypto from "node:crypto";

import { getOwnerBillingSnapshot } from "../billing/billingUsageService.js";
import { cleanText } from "../../utils/text.js";
import { findPhoneNumberContextByTo, normalizePhoneNumberE164 } from "./phoneNumberService.js";
import {
  createOrUpdateCallSession,
  updateCallSessionStatusForProviderCall,
} from "./phoneCallSessionService.js";
import {
  PHONE_TWIML_MESSAGES,
  buildEmptyTwiML,
  buildPhoneBlockedTwiML,
  buildPhoneGreetingTwiML,
} from "./twimlService.js";

const PHONE_CALL_RATE_WINDOW_MS = 60_000;
const PHONE_CALL_RATE_MAX = 5;
const callerBuckets = new Map();
const FINAL_TWILIO_STATUSES = new Set(["completed", "failed", "busy", "no-answer", "canceled"]);

function isProductionLikeRuntime(env = process.env) {
  const nodeEnv = cleanText(env.NODE_ENV).toLowerCase();
  const deployEnv = cleanText(env.VONZA_DEPLOY_ENV || env.RENDER_ENV).toLowerCase();

  return nodeEnv === "production"
    || ["production", "prod", "staging"].includes(deployEnv)
    || cleanText(env.RENDER).toLowerCase() === "true";
}

function timingSafeEqualString(left = "", right = "") {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  return leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function listParamPairs(params = {}) {
  return Object.keys(params)
    .sort()
    .flatMap((key) => {
      const value = params[key];
      return Array.isArray(value)
        ? value.map((item) => [key, cleanText(item)])
        : [[key, cleanText(value)]];
    });
}

export function computeTwilioSignature({ url, params, authToken }) {
  const signedPayload = listParamPairs(params).reduce(
    (payload, [key, value]) => `${payload}${key}${value}`,
    cleanText(url)
  );

  return crypto
    .createHmac("sha1", cleanText(authToken))
    .update(signedPayload)
    .digest("base64");
}

function getHeaderValue(headers = {}, key = "") {
  const direct = headers[key] || headers[key.toLowerCase()];
  return Array.isArray(direct) ? direct[0] : cleanText(direct);
}

function getPublicBaseUrl(env = process.env) {
  return cleanText(env.PUBLIC_APP_URL).replace(/\/+$/, "");
}

function listRequestUrlCandidates(req, env = process.env) {
  const originalUrl = cleanText(req.originalUrl || req.url);
  const host = cleanText(req.headers?.host || req.get?.("host"));
  const forwardedHost = cleanText(getHeaderValue(req.headers, "x-forwarded-host"));
  const forwardedProto = cleanText(getHeaderValue(req.headers, "x-forwarded-proto"));
  const requestProto = cleanText(req.protocol) || "https";
  const candidates = [];
  const publicBaseUrl = getPublicBaseUrl(env);

  if (publicBaseUrl && originalUrl) {
    candidates.push(`${publicBaseUrl}${originalUrl}`);
  }

  if (forwardedHost && forwardedProto && originalUrl) {
    candidates.push(`${forwardedProto.split(",")[0]}://${forwardedHost.split(",")[0]}${originalUrl}`);
  }

  if (host && originalUrl) {
    candidates.push(`${requestProto}://${host}${originalUrl}`);
  }

  return [...new Set(candidates.filter(Boolean))];
}

export function verifyTwilioWebhookRequest({ req, params, authToken, env = process.env }) {
  const token = cleanText(authToken || env.TWILIO_AUTH_TOKEN);
  const signature = getHeaderValue(req?.headers || {}, "x-twilio-signature");

  if (!token) {
    const error = new Error("Twilio webhook auth token is not configured.");
    error.statusCode = isProductionLikeRuntime(env) ? 503 : 403;
    error.code = "twilio_auth_token_missing";
    throw error;
  }

  if (!signature) {
    return false;
  }

  return listRequestUrlCandidates(req, env).some((url) =>
    timingSafeEqualString(
      computeTwilioSignature({ url, params, authToken: token }),
      signature
    )
  );
}

function parseTwilioParams(params = {}) {
  return {
    callSid: cleanText(params.CallSid),
    accountSid: cleanText(params.AccountSid),
    from: normalizePhoneNumberE164(params.From),
    to: normalizePhoneNumberE164(params.To),
    callStatus: cleanText(params.CallStatus).toLowerCase(),
    direction: cleanText(params.Direction).toLowerCase(),
    rawFrom: cleanText(params.From),
    rawTo: cleanText(params.To),
  };
}

function buildProviderMetadata(params = {}) {
  return {
    account_sid_present: Boolean(cleanText(params.AccountSid)),
    call_status: cleanText(params.CallStatus).toLowerCase() || null,
    direction: cleanText(params.Direction).toLowerCase() || null,
    api_version: cleanText(params.ApiVersion) || null,
  };
}

function buildBlock(reason) {
  return {
    allowed: false,
    reason,
    twiml: buildPhoneBlockedTwiML(PHONE_TWIML_MESSAGES.unavailable),
  };
}

async function checkDefaultCallerRateLimit({ callerPhoneE164, calledPhoneE164 }) {
  const caller = normalizePhoneNumberE164(callerPhoneE164) || "unknown";
  const called = normalizePhoneNumberE164(calledPhoneE164) || "unknown";
  const key = `${caller}:${called}`;
  const now = Date.now();
  const recent = (callerBuckets.get(key) || [])
    .filter((timestamp) => now - timestamp < PHONE_CALL_RATE_WINDOW_MS);

  if (recent.length >= PHONE_CALL_RATE_MAX) {
    return {
      allowed: false,
      reason: "caller_rate_limited",
    };
  }

  recent.push(now);
  callerBuckets.set(key, recent);
  return { allowed: true };
}

async function evaluateInboundReadiness({ supabase, phoneNumber, agent, twilio, deps = {} }) {
  if (!phoneNumber) {
    return buildBlock("phone_number_not_found");
  }

  if (phoneNumber.status !== "active") {
    return buildBlock("phone_number_inactive");
  }

  if (phoneNumber.phoneChannelEnabled !== true) {
    return buildBlock("phone_channel_disabled");
  }

  if (!agent || cleanText(agent.owner_user_id) !== phoneNumber.ownerUserId) {
    return buildBlock("agent_scope_mismatch");
  }

  if (agent.is_active === false || cleanText(agent.access_status).toLowerCase() !== "active") {
    return buildBlock("owner_access_inactive");
  }

  const getOwnerBillingSnapshotImpl = deps.getOwnerBillingSnapshot || getOwnerBillingSnapshot;
  const billingSnapshot = await getOwnerBillingSnapshotImpl(supabase, {
    ownerUserId: phoneNumber.ownerUserId,
    accessStatus: cleanText(agent.access_status).toLowerCase(),
  });

  if (billingSnapshot?.usage?.isCapped) {
    return buildBlock("owner_billing_capped");
  }

  const checkCallerRateLimit = deps.checkCallerRateLimit || checkDefaultCallerRateLimit;
  const rateResult = await checkCallerRateLimit({
    callerPhoneE164: twilio.from,
    calledPhoneE164: twilio.to,
    ownerUserId: phoneNumber.ownerUserId,
    agentId: phoneNumber.agentId,
  });

  if (rateResult?.allowed === false) {
    return buildBlock(cleanText(rateResult.reason) || "caller_rate_limited");
  }

  return {
    allowed: true,
    reason: "",
    twiml: buildPhoneGreetingTwiML({
      disclosureText: phoneNumber.disclosureText,
      greetingText: phoneNumber.greetingText,
    }),
  };
}

export async function processTwilioInboundWebhook(supabase, options = {}) {
  const params = options.params || {};
  const twilio = parseTwilioParams(params);
  const context = await findPhoneNumberContextByTo(supabase, {
    provider: "twilio",
    to: twilio.to || twilio.rawTo,
  });
  const readiness = await evaluateInboundReadiness({
    supabase,
    phoneNumber: context.phoneNumber,
    agent: context.agent,
    twilio,
    deps: options.deps,
  });

  if (context.phoneNumber && twilio.callSid) {
    await createOrUpdateCallSession(supabase, {
      phoneNumberId: context.phoneNumber.id,
      agentId: context.phoneNumber.agentId,
      businessId: context.phoneNumber.businessId,
      ownerUserId: context.phoneNumber.ownerUserId,
      provider: "twilio",
      providerCallSid: twilio.callSid,
      callerPhoneE164: twilio.from,
      calledPhoneE164: twilio.to || context.normalizedTo,
      status: readiness.allowed ? "greeting" : "blocked",
      blockReason: readiness.allowed ? "" : readiness.reason,
      metadata: buildProviderMetadata(params),
    });
  }

  return {
    statusCode: 200,
    twiml: readiness.twiml,
    allowed: readiness.allowed,
    blockReason: readiness.reason,
  };
}

function mapTwilioStatusToSessionStatus(callStatus = "") {
  const normalized = cleanText(callStatus).toLowerCase();

  if (normalized === "completed") {
    return "completed";
  }

  if (["failed", "busy", "no-answer", "canceled"].includes(normalized)) {
    return "failed";
  }

  return "started";
}

export async function processTwilioStatusWebhook(supabase, options = {}) {
  const params = options.params || {};
  const twilio = parseTwilioParams(params);
  const context = await findPhoneNumberContextByTo(supabase, {
    provider: "twilio",
    to: twilio.to || twilio.rawTo,
  });
  const isFinal = FINAL_TWILIO_STATUSES.has(twilio.callStatus);

  if (twilio.callSid && context.phoneNumber) {
    await updateCallSessionStatusForProviderCall(supabase, {
      provider: "twilio",
      providerCallSid: twilio.callSid,
      phoneNumberId: context.phoneNumber.id,
      ownerUserId: context.phoneNumber.ownerUserId,
      status: mapTwilioStatusToSessionStatus(twilio.callStatus),
      endedAt: isFinal ? new Date().toISOString() : null,
      metadata: {
        status_callback: {
          call_status: twilio.callStatus || null,
          call_duration: cleanText(params.CallDuration) || null,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }

  return {
    statusCode: 200,
    twiml: buildEmptyTwiML(),
  };
}

export function clearPhoneRateLimitForTests() {
  callerBuckets.clear();
}
