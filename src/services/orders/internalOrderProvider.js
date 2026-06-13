import { COMMERCE_ORDER_SNAPSHOT_TABLE } from "../../config/constants.js";
import {
  cleanText,
  extractEmails,
  extractPhoneCandidates,
  isInternalPlatformEmail,
  isPlaceholderEmail,
  isPlaceholderPhone,
} from "../../utils/text.js";

const ORDER_SNAPSHOT_SELECT = [
  "id",
  "owner_user_id",
  "business_id",
  "provider",
  "provider_account_id",
  "external_order_id",
  "order_number",
  "customer_email",
  "customer_phone",
  "financial_status",
  "fulfillment_status",
  "shipping_status",
  "tracking_number",
  "tracking_url",
  "carrier",
  "order_status_url",
  "currency",
  "total_amount_minor",
  "items_summary",
  "shipping_address_summary",
  "contact_email",
  "contact_phone",
  "metadata",
  "created_at",
  "updated_at",
].join(", ");

const SHIPPED_OR_LOCKED_STATUSES = new Set([
  "fulfilled",
  "in_transit",
  "out_for_delivery",
  "shipped",
  "delivered",
]);

const HIGH_RISK_CHANGE_TYPES = new Set([
  "cancellation",
  "item_change",
]);

function normalizeEmail(value = "") {
  const email = cleanText(value).toLowerCase();

  if (!email || isPlaceholderEmail(email) || isInternalPlatformEmail(email)) {
    return "";
  }

  return email;
}

function normalizePhoneDigits(value = "") {
  return cleanText(value).replace(/\D/g, "");
}

function normalizePlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null ? value : {};
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function mapOrderSnapshot(row = {}) {
  if (!row) {
    return null;
  }

  return {
    id: cleanText(row.id),
    ownerUserId: cleanText(row.owner_user_id),
    businessId: cleanText(row.business_id),
    provider: cleanText(row.provider) || "internal",
    providerAccountId: cleanText(row.provider_account_id),
    externalOrderId: cleanText(row.external_order_id || row.id),
    orderNumber: cleanText(row.order_number),
    customerEmail: normalizeEmail(row.customer_email),
    customerPhone: cleanText(row.customer_phone),
    financialStatus: cleanText(row.financial_status),
    fulfillmentStatus: cleanText(row.fulfillment_status),
    shippingStatus: cleanText(row.shipping_status),
    trackingNumber: cleanText(row.tracking_number),
    trackingUrl: cleanText(row.tracking_url),
    carrier: cleanText(row.carrier),
    orderStatusUrl: cleanText(row.order_status_url),
    currency: cleanText(row.currency).toUpperCase(),
    totalAmountMinor: Number.isFinite(Number(row.total_amount_minor))
      ? Number(row.total_amount_minor)
      : null,
    itemsSummary: normalizeArray(row.items_summary),
    shippingAddressSummary: cleanText(row.shipping_address_summary),
    contactEmail: normalizeEmail(row.contact_email),
    contactPhone: cleanText(row.contact_phone),
    metadata: normalizePlainObject(row.metadata),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function verificationIdentifiersMatch(order = {}, emailOrPhone = "") {
  const emails = extractEmails(emailOrPhone).map(normalizeEmail).filter(Boolean);
  const phones = extractPhoneCandidates(emailOrPhone)
    .filter((phone) => phone && !isPlaceholderPhone(phone))
    .map(normalizePhoneDigits)
    .filter(Boolean);
  const directPhoneDigits = normalizePhoneDigits(emailOrPhone);

  if (directPhoneDigits.length >= 7) {
    phones.push(directPhoneDigits);
  }

  const orderEmails = [
    order.customerEmail,
    order.contactEmail,
  ].map(normalizeEmail).filter(Boolean);
  const orderPhones = [
    order.customerPhone,
    order.contactPhone,
  ].map(normalizePhoneDigits).filter(Boolean);

  return emails.some((email) => orderEmails.includes(email))
    || phones.some((phone) => orderPhones.some((orderPhone) =>
      orderPhone === phone || orderPhone.endsWith(phone) || phone.endsWith(orderPhone)
    ));
}

async function querySnapshotByOrderNumber(supabase, {
  ownerUserId,
  businessId,
  provider = "internal",
  orderNumber,
}) {
  let query = supabase
    .from(COMMERCE_ORDER_SNAPSHOT_TABLE)
    .select(ORDER_SNAPSHOT_SELECT)
    .eq("owner_user_id", ownerUserId)
    .eq("provider", provider)
    .eq("order_number", orderNumber);

  if (businessId) {
    query = query.eq("business_id", businessId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return mapOrderSnapshot(data);
}

async function querySnapshotByExternalId(supabase, {
  ownerUserId,
  businessId,
  provider = "internal",
  externalOrderId,
}) {
  let query = supabase
    .from(COMMERCE_ORDER_SNAPSHOT_TABLE)
    .select(ORDER_SNAPSHOT_SELECT)
    .eq("owner_user_id", ownerUserId)
    .eq("provider", provider)
    .eq("external_order_id", externalOrderId);

  if (businessId) {
    query = query.eq("business_id", businessId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return mapOrderSnapshot(data);
}

function isOrderLockedForChange(order = {}) {
  const fulfillmentStatus = cleanText(order.fulfillmentStatus).toLowerCase();
  const shippingStatus = cleanText(order.shippingStatus).toLowerCase();

  return SHIPPED_OR_LOCKED_STATUSES.has(fulfillmentStatus)
    || SHIPPED_OR_LOCKED_STATUSES.has(shippingStatus)
    || Boolean(cleanText(order.trackingNumber) || cleanText(order.trackingUrl));
}

export const internalCommerceOrderProvider = Object.freeze({
  key: "internal",
  label: "Internal order snapshots",

  async findOrder({ supabase, ownerUserId, businessId, orderNumber, emailOrPhone }) {
    const normalizedOrderNumber = cleanText(orderNumber);
    const normalizedOwnerUserId = cleanText(ownerUserId);

    if (!normalizedOwnerUserId || !normalizedOrderNumber || !cleanText(emailOrPhone)) {
      return {
        found: false,
        verificationPassed: false,
        reason: "missing_verification",
      };
    }

    const order = await querySnapshotByOrderNumber(supabase, {
      ownerUserId: normalizedOwnerUserId,
      businessId: cleanText(businessId),
      provider: "internal",
      orderNumber: normalizedOrderNumber,
    });

    if (!order) {
      return {
        found: false,
        verificationPassed: false,
        reason: "order_not_found",
      };
    }

    if (!verificationIdentifiersMatch(order, emailOrPhone)) {
      return {
        found: true,
        verificationPassed: false,
        reason: "verification_failed",
      };
    }

    return {
      found: true,
      verificationPassed: true,
      order,
    };
  },

  async getOrderStatus({ supabase, ownerUserId, businessId, externalOrderId }) {
    return querySnapshotByExternalId(supabase, {
      ownerUserId: cleanText(ownerUserId),
      businessId: cleanText(businessId),
      provider: "internal",
      externalOrderId: cleanText(externalOrderId),
    });
  },

  async getFulfillmentStatus({ supabase, ownerUserId, businessId, externalOrderId }) {
    const order = await this.getOrderStatus({
      supabase,
      ownerUserId,
      businessId,
      externalOrderId,
    });

    return order
      ? {
          fulfillmentStatus: order.fulfillmentStatus,
          shippingStatus: order.shippingStatus,
          trackingNumber: order.trackingNumber,
          trackingUrl: order.trackingUrl,
          carrier: order.carrier,
          orderStatusUrl: order.orderStatusUrl,
        }
      : null;
  },

  validateRequestedChange({ order, change }) {
    const actionType = cleanText(change?.actionType || change?.action_type).toLowerCase();

    if (!order) {
      return {
        decision: "not_allowed",
        reason: "order_not_verified",
      };
    }

    if (isOrderLockedForChange(order)) {
      return {
        decision: "requires_staff_review",
        reason: "order_already_shipped_or_fulfilled",
      };
    }

    if (HIGH_RISK_CHANGE_TYPES.has(actionType)) {
      return {
        decision: "requires_staff_review",
        reason: "high_risk_order_change",
      };
    }

    return {
      decision: "pending_request",
      reason: "provider_requires_staff_review",
    };
  },

  async submitChangeRequest() {
    return {
      submittedToProvider: false,
      reason: "internal_provider_uses_vonza_request_queue",
    };
  },

  async applySafeChange() {
    return {
      applied: false,
      reason: "internal_provider_has_no_automatic_mutations",
    };
  },
});

export default internalCommerceOrderProvider;
