export const PRODUCT_KEYS = Object.freeze({
  FRONT_DESK: "front_desk",
  WEBSITE_WIDGET: "website_widget",
  VOICE_AGENT: "voice_agent",
});

export const PRODUCT_KEY_VALUES = Object.freeze(Object.values(PRODUCT_KEYS));

const PRODUCT_CATALOG = Object.freeze({
  [PRODUCT_KEYS.FRONT_DESK]: Object.freeze({
    key: PRODUCT_KEYS.FRONT_DESK,
    label: "Front Desk",
    setupUrl: "/dashboard/front-desk",
    futurePriceEnvVarNames: Object.freeze({
      monthly: "STRIPE_PRICE_ID_FRONT_DESK_MONTHLY",
    }),
    capabilities: Object.freeze([
      "public_front_desk_page",
      "visitor_conversation",
      "knowledge_grounded_answers",
    ]),
  }),
  [PRODUCT_KEYS.WEBSITE_WIDGET]: Object.freeze({
    key: PRODUCT_KEYS.WEBSITE_WIDGET,
    label: "Website Agent",
    setupUrl: "/dashboard/widget",
    futurePriceEnvVarNames: Object.freeze({
      monthly: "STRIPE_PRICE_ID_WEBSITE_WIDGET_MONTHLY",
    }),
    capabilities: Object.freeze([
      "website_embed",
      "visitor_conversation",
      "install_detection",
    ]),
  }),
  [PRODUCT_KEYS.VOICE_AGENT]: Object.freeze({
    key: PRODUCT_KEYS.VOICE_AGENT,
    label: "Voice Agent",
    setupUrl: "/dashboard/voice",
    futurePriceEnvVarNames: Object.freeze({
      monthly: "STRIPE_PRICE_ID_VOICE_AGENT_MONTHLY",
    }),
    capabilities: Object.freeze([
      "browser_voice_input",
      "spoken_replies",
      "web_call_setup",
    ]),
  }),
});

function cloneCatalogEntry(entry) {
  return entry
    ? {
        ...entry,
        futurePriceEnvVarNames: {
          ...entry.futurePriceEnvVarNames,
        },
        capabilities: [...entry.capabilities],
      }
    : null;
}

export function getProductCatalogEntry(productKey) {
  return cloneCatalogEntry(PRODUCT_CATALOG[productKey]);
}

export function listProductCatalog() {
  return PRODUCT_KEY_VALUES.map((productKey) => getProductCatalogEntry(productKey));
}

function trimText(value) {
  return String(value || "").trim();
}

export function listProductStripePriceMappings(env = process.env) {
  return listProductCatalog().map((product) => {
    const monthlyPriceEnvKey = product.futurePriceEnvVarNames?.monthly || "";

    return {
      productKey: product.key,
      label: product.label,
      interval: "month",
      stripePriceEnvKey: monthlyPriceEnvKey,
      stripePriceId: trimText(env?.[monthlyPriceEnvKey]),
    };
  });
}
