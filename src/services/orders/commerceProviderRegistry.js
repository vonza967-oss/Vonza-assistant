import { cleanText } from "../../utils/text.js";
import { internalCommerceOrderProvider } from "./internalOrderProvider.js";

const PROVIDER_ADAPTERS = new Map([
  [internalCommerceOrderProvider.key, internalCommerceOrderProvider],
]);

function normalizeProviderKey(value = "") {
  return cleanText(value).toLowerCase() || "internal";
}

export function getCommerceProviderAdapter(providerKey = "internal") {
  return PROVIDER_ADAPTERS.get(normalizeProviderKey(providerKey)) || null;
}

export function hasCommerceProviderAdapter(providerKey = "internal") {
  return PROVIDER_ADAPTERS.has(normalizeProviderKey(providerKey));
}

export function listCommerceProviderAdapters() {
  return Object.freeze(
    [...PROVIDER_ADAPTERS.values()].map((adapter) => Object.freeze({
      key: adapter.key,
      label: adapter.label,
    }))
  );
}

export function registerCommerceProviderAdapter(adapter = {}) {
  const key = normalizeProviderKey(adapter.key);

  if (!key || typeof adapter.findOrder !== "function") {
    throw new Error("Commerce provider adapters require a key and findOrder implementation.");
  }

  PROVIDER_ADAPTERS.set(key, Object.freeze({ ...adapter, key }));
}
