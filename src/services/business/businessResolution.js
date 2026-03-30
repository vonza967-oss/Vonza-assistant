import { BUSINESSES_TABLE } from "../../config/constants.js";
import { cleanText, isUuid, slugifyLookupValue } from "../../utils/text.js";
import { getHostnameFromUrl } from "../../utils/url.js";

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
    const { data: business, error } = await supabase
      .from(BUSINESSES_TABLE)
      .select("id, name, website_url")
      .eq("id", lookupValue)
      .maybeSingle();

    if (error) {
      console.error(error);
      throw error;
    }

    return business || null;
  }

  const normalizedLookup = slugifyLookupValue(lookupValue);
  const lowercaseLookup = lookupValue.toLowerCase();
  const { data: businesses, error } = await supabase
    .from(BUSINESSES_TABLE)
    .select("id, name, website_url");

  if (error) {
    console.error(error);
    throw error;
  }

  return (
    (businesses || []).find((business) => {
      const keys = buildBusinessLookupKeys(business);
      return keys.has(lowercaseLookup) || keys.has(normalizedLookup);
    }) || null
  );
}

export async function ensureBusinessRecord(supabase, options = {}) {
  const { businessId, websiteUrl, name } = options;

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

  const { data: existingBusiness, error: lookupError } = await supabase
    .from(BUSINESSES_TABLE)
    .select("id, name, website_url")
    .eq("website_url", websiteUrl)
    .maybeSingle();

  if (lookupError) {
    console.error(lookupError);
    throw lookupError;
  }

  if (existingBusiness) {
    return existingBusiness;
  }

  const { data: createdBusiness, error: createError } = await supabase
    .from(BUSINESSES_TABLE)
    .insert({
      name: name || new URL(websiteUrl).hostname,
      website_url: websiteUrl,
    })
    .select("id, name, website_url")
    .single();

  if (createError) {
    console.error(createError);
    throw createError;
  }

  return createdBusiness;
}
