import { cleanText } from "../../utils/text.js";

const ADMIN_AUDIT_LOGS_TABLE = "admin_audit_logs";
const ADMIN_ROLES = new Set(["admin", "vonza_admin", "support_admin", "owner_admin"]);

function normalizeList(value = "") {
  return String(value || "")
    .split(",")
    .map((entry) => cleanText(entry).toLowerCase())
    .filter(Boolean);
}

function getUserRoles(user = {}) {
  const metadata = {
    ...(user.app_metadata || {}),
    ...(user.user_metadata || {}),
  };
  const rawRoles = [
    metadata.role,
    metadata.roles,
    metadata.vonza_role,
    metadata.vonza_roles,
  ];

  return rawRoles
    .flatMap((value) => (Array.isArray(value) ? value : String(value || "").split(",")))
    .map((role) => cleanText(role).toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(user = {}, env = process.env) {
  const userId = cleanText(user.id);
  const email = cleanText(user.email).toLowerCase();
  const allowedUserIds = normalizeList(env.VONZA_ADMIN_USER_IDS);
  const allowedEmails = normalizeList(env.VONZA_ADMIN_EMAILS);
  const roles = getUserRoles(user);

  return roles.some((role) => ADMIN_ROLES.has(role))
    || (userId && allowedUserIds.includes(userId.toLowerCase()))
    || (email && allowedEmails.includes(email));
}

export async function requireAdminUser(supabase, req, authenticateUser, options = {}) {
  const user = await authenticateUser(supabase, req);

  if (!isAdminUser(user, options.env || process.env)) {
    const error = new Error("Admin role is required.");
    error.statusCode = 403;
    error.code = "admin_role_required";
    error.publicMessage = "You do not have access to this resource.";
    throw error;
  }

  return user;
}

export async function recordAdminAuditEvent(supabase, event = {}) {
  const action = cleanText(event.action);
  const adminUserId = cleanText(event.adminUserId);

  if (!action || !adminUserId) {
    return { ok: false, skipped: true };
  }

  const payload = {
    admin_user_id: adminUserId,
    admin_email: cleanText(event.adminEmail) || null,
    action,
    target_type: cleanText(event.targetType) || null,
    target_id: cleanText(event.targetId) || null,
    owner_user_id: cleanText(event.ownerUserId) || null,
    agent_id: cleanText(event.agentId) || null,
    metadata: event.metadata && typeof event.metadata === "object" ? event.metadata : null,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from(ADMIN_AUDIT_LOGS_TABLE).insert(payload);

  if (error) {
    const message = cleanText(error.message).toLowerCase();
    if (
      error.code === "PGRST205"
      || error.code === "PGRST204"
      || error.code === "42P01"
      || error.code === "42703"
      || message.includes("admin_audit_logs")
    ) {
      console.warn("[admin audit] audit table unavailable; event skipped", {
        action,
        adminUserId,
      });
      return { ok: false, skipped: true };
    }

    throw error;
  }

  return { ok: true };
}
