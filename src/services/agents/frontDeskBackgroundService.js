import crypto from "node:crypto";

import { cleanText } from "../../utils/text.js";

export const FRONT_DESK_BACKGROUND_BUCKET =
  process.env.FRONT_DESK_BACKGROUND_BUCKET || "front-desk-backgrounds";

export const FRONT_DESK_BACKGROUND_UPLOAD_LIMITS = Object.freeze({
  image: 8 * 1024 * 1024,
  video: 50 * 1024 * 1024,
});

const BACKGROUND_TYPES = Object.freeze({
  image: Object.freeze({
    extensions: new Set(["png", "jpg", "jpeg", "webp"]),
    mimeTypes: new Set(["image/png", "image/jpeg", "image/webp"]),
  }),
  video: Object.freeze({
    extensions: new Set(["mp4", "webm"]),
    mimeTypes: new Set(["video/mp4", "video/webm"]),
  }),
});

function getExtension(filename = "") {
  const match = cleanText(filename).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}

export function sanitizeUploadFileName(filename = "") {
  const normalized = cleanText(filename)
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "")
    .slice(0, 96);

  return normalized || "background";
}

export function validateFrontDeskBackgroundUpload(file = {}, kind = "image") {
  const config = BACKGROUND_TYPES[kind];

  if (!config) {
    const error = new Error("Unsupported background type.");
    error.statusCode = 400;
    throw error;
  }

  const filename = sanitizeUploadFileName(file.filename || file.originalname || "");
  const extension = getExtension(filename);
  const mimeType = cleanText(file.contentType || file.mimetype).toLowerCase();
  const size = Number(file.size || file.buffer?.length || 0);

  if (!config.extensions.has(extension) || !config.mimeTypes.has(mimeType)) {
    const error = new Error(kind === "image"
      ? "Upload a PNG, JPG, JPEG, or WebP background image."
      : "Upload an MP4 or WebM background video.");
    error.statusCode = 400;
    throw error;
  }

  if (!size || size > FRONT_DESK_BACKGROUND_UPLOAD_LIMITS[kind]) {
    const error = new Error(kind === "image"
      ? "Use a background image under 8 MB."
      : "Use a background video under 50 MB.");
    error.statusCode = 413;
    throw error;
  }

  return {
    filename,
    extension,
    mimeType,
    size,
  };
}

export function buildFrontDeskBackgroundStoragePath({ ownerUserId, agentId, kind, filename }) {
  const safeOwner = sanitizeUploadFileName(ownerUserId || "owner");
  const safeAgent = sanitizeUploadFileName(agentId || "agent");
  const safeFilename = sanitizeUploadFileName(filename);
  const uniquePrefix = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;

  return `${safeOwner}/${safeAgent}/${kind}/${uniquePrefix}-${safeFilename}`;
}

export async function uploadFrontDeskBackground(supabase, {
  agent,
  ownerUserId,
  kind,
  file,
  bucket = FRONT_DESK_BACKGROUND_BUCKET,
} = {}) {
  const metadata = validateFrontDeskBackgroundUpload(file, kind);
  const objectPath = buildFrontDeskBackgroundStoragePath({
    ownerUserId,
    agentId: agent?.id,
    kind,
    filename: metadata.filename,
  });

  const { error } = await supabase.storage
    .from(bucket)
    .upload(objectPath, file.buffer, {
      contentType: metadata.mimeType,
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) {
    error.statusCode = error.statusCode || 500;
    throw error;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);

  if (!data?.publicUrl) {
    const publicUrlError = new Error("Background upload succeeded but no public URL was returned.");
    publicUrlError.statusCode = 500;
    throw publicUrlError;
  }

  return {
    kind,
    bucket,
    path: objectPath,
    url: data.publicUrl,
    contentType: metadata.mimeType,
    size: metadata.size,
  };
}
