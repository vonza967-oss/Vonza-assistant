import { BUSINESSES_TABLE } from "../../config/constants.js";
import { cleanText, isUuid, slugifyLookupValue } from "../../utils/text.js";
import { getHostnameFromUrl } from "../../utils/url.js";
import { normalizeBusinessVertical } from "../../templates/businessVerticals.js";

const BUSINESS_SELECT = "id, name, website_url, vertical";
const LEGACY_BUSINESS_SELECT = "id, name, website_url";

function isMissingVerticalColumnError(error) {
  const message = cleanText(error?.message || "").toLowerCase();
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    (message.includes("vertical") && message.includes("does not exist"))
  );
}

async function selectBusinessMaybeWithVertical(queryBuilder, fallbackFactory) {
  let { data, error } = await queryBuilder(BUSINESS_SELECT);

  if (error && isMissingVerticalColumnError(error)) {
    ({ data, error } = await fallbackFactory(LEGACY_BUSINESS_SELECT));
  }

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export function buildBusinessLookupKeys(business) {
  const keys = new Set();
  const businessId = cleanText(business.id).toLowerCase();
  const businessName = cleanText(business.name);
  const websiteUrl = cleanText(business.website_url);

  if (businessId) {
    keys.add(businessId);
  }

  if (businessName) {
    keys.add(businessName.toLowerCase());
    keys.add(slugifyLookupValue(businessName));
  }

  if (websiteUrl) {
    keys.add(websiteUrl.toLowerCase());
    keys.add(slugifyLookupValue(websiteUrl));

    const hostname = getHostnameFromUrl(websiteUrl);
    if (hostname) {
      keys.add(hostname);
      keys.add(slugifyLookupValue(hostname));
    }
  }

  return keys;
}

export async function findBusinessByIdentifier(supabase, businessIdentifier) {
  const lookupValue = cleanText(businessIdentifier);

  if (!lookupValue) {
    return null;
  }

  if (isUuid(lookupValue)) {
    const business = await selectBusinessMaybeWithVertical(
      (selectColumns) => supabase
        .from(BUSINESSES_TABLE)
        .select(selectColumns)
        .eq("id", lookupValue)
        .maybeSingle(),
      (selectColumns) => supabase
        .from(BUSINESSES_TABLE)
        .select(selectColumns)
        .eq("id", lookupValue)
        .maybeSingle()
    );

    return business || null;
  }

  const normalizedLookup = slugifyLookupValue(lookupValue);
  const lowercaseLookup = lookupValue.toLowerCase();
  const businesses = await selectBusinessMaybeWithVertical(
    (selectColumns) => supabase.from(BUSINESSES_TABLE).select(selectColumns),
    (selectColumns) => supabase.from(BUSINESSES_TABLE).select(selectColumns)
  );

  return (
    (businesses || []).find((business) => {
      const keys = buildBusinessLookupKeys(business);
      return keys.has(lowercaseLookup) || keys.has(normalizedLookup);
    }) || null
  );
}

export async function ensureBusinessRecord(supabase, options = {}) {
  const { businessId, websiteUrl, name } = options;
  const vertical = normalizeBusinessVertical(options.vertical);

  if (businessId) {
    const business = await findBusinessByIdentifier(supabase, businessId);

    if (business?.website_url) {
      return business;
    }

    if (business && !business.website_url) {
      const notFoundError = new Error("Business website_url not found");
      notFoundError.statusCode = 404;
      throw notFoundError;
    }
  }

  if (!websiteUrl) {
    const missingError = new Error(
      "Business not found. Use a valid business UUID, matching business key, or set data-website-url in the embed script."
    );
    missingError.statusCode = 400;
    throw missingError;
  }

  const existingBusiness = await selectBusinessMaybeWithVertical(
    (selectColumns) => supabase
      .from(BUSINESSES_TABLE)
      .select(selectColumns)
      .eq("website_url", websiteUrl)
      .maybeSingle(),
    (selectColumns) => supabase
      .from(BUSINESSES_TABLE)
      .select(selectColumns)
      .eq("website_url", websiteUrl)
      .maybeSingle()
  );

  if (existingBusiness) {
    if (vertical && existingBusiness.vertical !== vertical) {
      const { data: updatedBusiness, error: updateError } = await supabase
        .from(BUSINESSES_TABLE)
        .update({ vertical })
        .eq("id", existingBusiness.id)
        .select(BUSINESS_SELECT)
        .single();

      if (!updateError) {
        return updatedBusiness;
      }

      if (!isMissingVerticalColumnError(updateError)) {
        console.error(updateError);
        throw updateError;
      }
    }

    return existingBusiness;
  }

  const insertPayload = {
    name: name || new URL(websiteUrl).hostname,
    website_url: websiteUrl,
  };

  if (vertical) {
    insertPayload.vertical = vertical;
  }

  let { data: createdBusiness, error: createError } = await supabase
    .from(BUSINESSES_TABLE)
    .insert(insertPayload)
    .select(BUSINESS_SELECT)
    .single();

  if (createError && isMissingVerticalColumnError(createError)) {
    delete insertPayload.vertical;
    ({ data: createdBusiness, error: createError } = await supabase
      .from(BUSINESSES_TABLE)
      .insert(insertPayload)
      .select(LEGACY_BUSINESS_SELECT)
      .single());
  }

  if (createError) {
    console.error(createError);
    throw createError;
  }

  return createdBusiness;
}
