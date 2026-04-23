import { cleanText } from "../../utils/text.js";

export const DASHBOARD_PREFERENCES_TABLE = "user_dashboard_preferences";
export const SUPPORTED_DASHBOARD_LANGUAGES = Object.freeze(["en", "hu"]);
export const DEFAULT_DASHBOARD_LANGUAGE = "en";

export function normalizeDashboardLanguage(value) {
  const normalized = cleanText(value).toLowerCase();
  return SUPPORTED_DASHBOARD_LANGUAGES.includes(normalized)
    ? normalized
    : DEFAULT_DASHBOARD_LANGUAGE;
}

export function isSupportedDashboardLanguage(value) {
  return SUPPORTED_DASHBOARD_LANGUAGES.includes(cleanText(value).toLowerCase());
}

function isMissingPreferenceTableError(error) {
  return error?.code === "42P01" || /user_dashboard_preferences|relation .* does not exist/i.test(error?.message || "");
}

export async function getDashboardPreferences(supabase, { ownerUserId } = {}) {
  const userId = cleanText(ownerUserId);

  if (!userId) {
    const error = new Error("Authenticated user is required.");
    error.statusCode = 401;
    throw error;
  }

  const { data, error } = await supabase
    .from(DASHBOARD_PREFERENCES_TABLE)
    .select("owner_user_id, dashboard_language, created_at, updated_at")
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingPreferenceTableError(error)) {
      return {
        dashboardLanguage: null,
        persistenceAvailable: false,
        migrationRequired: true,
      };
    }

    throw error;
  }

  return {
    dashboardLanguage: data?.dashboard_language || null,
    persistenceAvailable: true,
    migrationRequired: false,
  };
}

export async function saveDashboardLanguagePreference(supabase, { ownerUserId, dashboardLanguage } = {}) {
  const userId = cleanText(ownerUserId);
  const language = cleanText(dashboardLanguage).toLowerCase();

  if (!userId) {
    const error = new Error("Authenticated user is required.");
    error.statusCode = 401;
    throw error;
  }

  if (!isSupportedDashboardLanguage(language)) {
    const error = new Error("Choose a supported dashboard language.");
    error.statusCode = 400;
    throw error;
  }

  const { data, error } = await supabase
    .from(DASHBOARD_PREFERENCES_TABLE)
    .upsert({
      owner_user_id: userId,
      dashboard_language: language,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "owner_user_id",
    })
    .select("owner_user_id, dashboard_language, created_at, updated_at")
    .single();

  if (error) {
    if (isMissingPreferenceTableError(error)) {
      const missingError = new Error("Dashboard language storage is not ready yet. Please try again after the latest deploy finishes.");
      missingError.statusCode = 503;
      missingError.code = "dashboard_preferences_missing";
      throw missingError;
    }

    throw error;
  }

  return {
    ok: true,
    dashboardLanguage: normalizeDashboardLanguage(data?.dashboard_language),
  };
}
