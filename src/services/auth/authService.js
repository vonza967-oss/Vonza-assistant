import { cleanText } from "../../utils/text.js";

function getBearerToken(req) {
  const header = cleanText(req.headers.authorization || "");

  if (!header.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return cleanText(header.slice(7));
}

export async function getAuthenticatedUser(supabase, req) {
  const accessToken = getBearerToken(req);

  if (!accessToken) {
    const authError = new Error("Unauthorized");
    authError.statusCode = 401;
    throw authError;
  }

  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data?.user) {
    const authError = new Error("Unauthorized");
    authError.statusCode = 401;
    throw authError;
  }

  return data.user;
}
