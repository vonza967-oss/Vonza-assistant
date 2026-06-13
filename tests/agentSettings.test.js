import test from "node:test";
import assert from "node:assert/strict";

import {
  CUSTOM_INSTRUCTIONS_MAX_LENGTH,
  getAgentWorkspaceSnapshot,
  getFullPageDesignPresetDefaults,
  getWidgetBootstrap,
  normalizeVoiceConfig,
  normalizeFullPageDesignConfig,
  normalizeFullPageConfig,
  requireAgentAccess,
  updateAgentPackageAssignment,
  updateAgentSettings,
} from "../src/services/agents/agentService.js";
import {
  uploadFrontDeskBackground,
  validateFrontDeskBackgroundUpload,
} from "../src/services/agents/frontDeskBackgroundService.js";
import { DEFAULT_WIDGET_CONFIG, FULL_PAGE_BACKGROUND_PRESETS } from "../src/services/agents/agentDefaults.js";
import { generateWebsiteWidgetAgentInstructions } from "../src/services/agents/agentInstructionGenerator.js";

function createSupabaseStub(initialState) {
  const state = {
    agents: (initialState.agents || []).map((row) => ({ ...row })),
    businesses: (initialState.businesses || []).map((row) => ({ ...row })),
    widget_configs: (initialState.widget_configs || []).map((row) => ({ ...row })),
    messages: (initialState.messages || []).map((row) => ({ ...row })),
    agent_installations: (initialState.agent_installations || []).map((row) => ({ ...row })),
    agent_widget_events: (initialState.agent_widget_events || []).map((row) => ({ ...row })),
    widgetRoutingUpsertError: initialState.widgetRoutingUpsertError || null,
  };

  class QueryBuilder {
    constructor(table) {
      this.table = table;
      this.operation = "select";
      this.filters = [];
      this.values = null;
      this.selectUsed = false;
    }

    select() {
      this.selectUsed = true;
      return this;
    }

    eq(column, value) {
      this.filters.push({ op: "eq", column, value });
      return this;
    }

    in(column, values) {
      this.filters.push({ op: "in", column, value: new Set(values || []) });
      return this;
    }

    is(column, value) {
      this.filters.push({ op: "is", column, value });
      return this;
    }

    order() {
      return this;
    }

    limit() {
      return this;
    }

    update(values) {
      this.operation = "update";
      this.values = values;
      return this;
    }

    upsert(values) {
      this.operation = "upsert";
      this.values = values;
      return this;
    }

    maybeSingle() {
      return Promise.resolve(this.#executeSingle());
    }

    single() {
      return Promise.resolve(this.#executeSingle());
    }

    then(resolve, reject) {
      return Promise.resolve(this.#execute()).then(resolve, reject);
    }

    #getRows() {
      return state[this.table] || [];
    }

    #getMatches() {
      return this.#getRows().filter((row) =>
        this.filters.every((filter) => {
          if (filter.op === "in") {
            return filter.value.has(row[filter.column]);
          }

          if (filter.op === "is") {
            return row[filter.column] === filter.value;
          }

          return row[filter.column] === filter.value;
        })
      );
    }

    #executeSingle() {
      if (this.operation !== "select") {
        const result = this.#execute();
        const rows = Array.isArray(result.data) ? result.data : [];
        return {
          data: rows[0] ? { ...rows[0] } : null,
          error: result.error || null,
        };
      }

      const matches = this.#getMatches();
      return {
        data: matches[0] ? { ...matches[0] } : null,
        error: null,
      };
    }

    #execute() {
      if (this.operation === "select") {
        return {
          data: this.#getMatches().map((row) => ({ ...row })),
          error: null,
        };
      }

      if (this.operation === "update") {
        const matches = this.#getMatches();
        matches.forEach((row) => Object.assign(row, this.values));
        return this.selectUsed
          ? { data: matches.map((row) => ({ ...row })), error: null }
          : { error: null };
      }

      if (this.operation === "upsert") {
        if (this.table === "widget_configs" && state.widgetRoutingUpsertError) {
          return { data: null, error: state.widgetRoutingUpsertError };
        }

        const rows = this.#getRows();
        const conflictColumn = this.table === "widget_configs" ? "agent_id" : "id";
        const existingRow = rows.find((row) => row[conflictColumn] === this.values[conflictColumn]);

        if (existingRow) {
          Object.assign(existingRow, this.values);
        } else {
          rows.push({ ...this.values });
        }

        const persistedRow =
          rows.find((row) => row[conflictColumn] === this.values[conflictColumn]) || null;

        return this.selectUsed
          ? { data: persistedRow ? [{ ...persistedRow }] : [], error: null }
          : { error: null };
      }

      throw new Error(`Unsupported operation: ${this.operation}`);
    }
  }

  return {
    from(table) {
      return new QueryBuilder(table);
    },
    state,
  };
}

test("default Weboldali agent identity avoids Front Desk copy", () => {
  assert.equal(DEFAULT_WIDGET_CONFIG.buttonLabel, "Agent megnyitása");
  assert.equal(DEFAULT_WIDGET_CONFIG.launcherText, "");
  assert.equal(DEFAULT_WIDGET_CONFIG.welcomeMessage, "Üdvözöljük! Miben segíthetünk?");
  assert.doesNotMatch(DEFAULT_WIDGET_CONFIG.welcomeMessage, /\b(?:Szia|szeretnéd|megadhatod|kérdezz|írd be)\b/i);
  assert.doesNotMatch(JSON.stringify(DEFAULT_WIDGET_CONFIG), /Front Desk|front desk/i);
});

test("requireAgentAccess exposes default package fields for missing or blank agent row values", async () => {
  const supabase = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        name: "Vonza",
        purpose: "support",
        system_prompt: "",
        tone: "friendly",
        language: "English",
        is_active: true,
      },
      {
        id: "agent-2",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key-2",
        package_key: "   ",
        package_version: "",
        name: "Vonza",
        purpose: "support",
        system_prompt: "",
        tone: "friendly",
        language: "English",
        is_active: true,
      },
    ],
  });

  const missingPackageAgent = await requireAgentAccess(supabase, {
    agentId: "agent-1",
    ownerUserId: "owner-1",
  });
  const blankPackageAgent = await requireAgentAccess(supabase, {
    agentId: "agent-2",
    ownerUserId: "owner-1",
  });

  assert.equal(missingPackageAgent.packageKey, "front_desk_general");
  assert.equal(missingPackageAgent.packageVersion, "0.1.0");
  assert.equal(blankPackageAgent.packageKey, "front_desk_general");
  assert.equal(blankPackageAgent.packageVersion, "0.1.0");
});

test("requireAgentAccess exposes explicit package fields from agent rows", async () => {
  const supabase = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        package_key: "front_desk_general",
        package_version: "0.1.7",
        name: "Vonza",
        purpose: "support",
        system_prompt: "",
        tone: "friendly",
        language: "English",
        is_active: true,
      },
    ],
  });

  const agent = await requireAgentAccess(supabase, {
    agentId: "agent-1",
    ownerUserId: "owner-1",
  });

  assert.equal(agent.packageKey, "front_desk_general");
  assert.equal(agent.packageVersion, "0.1.7");
});

test("updateAgentPackageAssignment rejects unknown package keys before persistence", async () => {
  await assert.rejects(
    () =>
      updateAgentPackageAssignment({
        from() {
          throw new Error("package validation should happen before DB writes");
        },
      }, {
        agentId: "agent-1",
        ownerUserId: "owner-1",
        packageKey: "unknown_package",
      }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "unknown_agent_package_key");
      assert.match(error.message, /unknown agent package key/i);
      return true;
    }
  );
});

test("updateAgentPackageAssignment updates only the matching owned agent and defaults version from manifest", async () => {
  const { state, ...supabase } = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        package_key: "front_desk_general",
        package_version: "0.1.0",
        name: "Vonza",
        purpose: "support",
        system_prompt: "",
        tone: "friendly",
        language: "English",
        is_active: true,
      },
    ],
  });

  await assert.rejects(
    () =>
      updateAgentPackageAssignment(supabase, {
        agentId: "agent-1",
        ownerUserId: "other-owner",
        packageKey: "hotel_concierge",
      }),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.message, "Agent not found");
      return true;
    }
  );

  assert.equal(state.agents[0].package_key, "front_desk_general");
  assert.equal(state.agents[0].package_version, "0.1.0");

  const agent = await updateAgentPackageAssignment(supabase, {
    agentId: "agent-1",
    ownerUserId: "owner-1",
    packageKey: " HOTEL_CONCIERGE ",
  });

  assert.equal(agent.packageKey, "hotel_concierge");
  assert.equal(agent.packageVersion, "0.1.0");
  assert.equal(state.agents[0].package_key, "hotel_concierge");
  assert.equal(state.agents[0].package_version, "0.1.0");
});

test("updateAgentSettings does not expose package switching fields", async () => {
  const { state, ...supabase } = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        package_key: "front_desk_general",
        package_version: "0.1.0",
        name: "Vonza",
        purpose: "support",
        system_prompt: "",
        tone: "friendly",
        language: "English",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Vonza",
        website_url: "https://example.com",
      },
    ],
    widget_configs: [
      {
        id: "widget-1",
        agent_id: "agent-1",
        assistant_name: "Vonza",
        welcome_message: "Hello there",
        button_label: "Chat now",
        primary_color: "#14b8a6",
        secondary_color: "#0f766e",
        launcher_text: "Chat now",
        theme_mode: "light",
      },
    ],
  });

  const result = await updateAgentSettings(supabase, {
    agentId: "agent-1",
    assistantName: "Vonza Hotel",
    packageKey: "hotel_concierge",
    package_key: "hotel_concierge",
    packageVersion: "9.9.9",
    package_version: "9.9.9",
  });

  assert.equal(result.assistantName, "Vonza Hotel");
  assert.equal(result.packageKey, "front_desk_general");
  assert.equal(result.packageVersion, "0.1.0");
  assert.equal(state.agents[0].package_key, "front_desk_general");
  assert.equal(state.agents[0].package_version, "0.1.0");
});

test("updateAgentSettings normalizes website URLs and reuses an existing business row", async () => {
  const { state, ...supabase } = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        name: "Vonza",
        purpose: "help",
        system_prompt: "old guidance",
        tone: "friendly",
        language: "English",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Old Business",
        website_url: "https://old-example.com",
      },
      {
        id: "business-2",
        name: "New Business",
        website_url: "https://new-example.com",
      },
    ],
    widget_configs: [
      {
        id: "widget-1",
        agent_id: "agent-1",
        assistant_name: "Vonza",
        welcome_message: "Hello there",
        button_label: "Chat now",
        primary_color: "#14b8a6",
        secondary_color: "#0f766e",
        launcher_text: "Chat now",
        theme_mode: "light",
      },
    ],
  });

  const result = await updateAgentSettings(supabase, {
    agentId: "agent-1",
    assistantName: "Vonza Pro",
    tone: "professional",
    buttonLabel: "Ask Vonza",
    websiteUrl: "new-example.com/",
    welcomeMessage: "Welcome to Vonza",
    systemPrompt: "Keep answers concise",
    primaryColor: "#111111",
    secondaryColor: "#222222",
  });

  assert.equal(result.assistantName, "Vonza Pro");
  assert.equal(result.businessId, "business-2");
  assert.equal(result.tone, "professional");
  assert.equal(result.buttonLabel, "Ask Vonza");
  assert.equal(result.websiteUrl, "https://new-example.com/");
  assert.equal(result.websiteSync.previousUrl, "https://old-example.com/");
  assert.equal(result.websiteSync.currentUrl, "https://new-example.com/");
  assert.equal(result.websiteSync.changed, true);
  assert.equal(result.welcomeMessage, "Welcome to Vonza");
  assert.equal(result.primaryColor, "#111111");
  assert.equal(result.secondaryColor, "#222222");
  assert.equal(result.systemPrompt, "Keep answers concise");
  assert.equal(state.agents[0].business_id, "business-2");
  assert.equal(state.businesses[0].website_url, "https://old-example.com");
  assert.equal(state.widget_configs[0].assistant_name, "Vonza Pro");
  assert.equal(state.widget_configs[0].button_label, "Ask Vonza");
});

test("updateAgentSettings preserves explicit saved widget assistant name and launcher label", async () => {
  const { state, ...supabase } = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        name: "Fallback Agent",
        purpose: "support",
        system_prompt: "",
        tone: "friendly",
        language: "English",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Saved Business",
        website_url: "https://example.com",
      },
    ],
    widget_configs: [
      {
        id: "widget-1",
        agent_id: "agent-1",
        assistant_name: "Custom Agent Concierge",
        welcome_message: "Hello there",
        button_label: "Ask the team",
        primary_color: "#14b8a6",
        secondary_color: "#0f766e",
        launcher_text: "Custom launcher",
        theme_mode: "light",
      },
    ],
  });

  const result = await updateAgentSettings(supabase, {
    agentId: "agent-1",
    websiteUrl: "https://example.com/",
    tone: "professional",
  });

  assert.equal(result.buttonLabel, "Ask the team");
  assert.equal(state.widget_configs[0].assistant_name, "Custom Agent Concierge");
  assert.equal(state.widget_configs[0].button_label, "Ask the team");
});

test("updateAgentSettings persists sanitized full-page assistant config", async () => {
  const { state, ...supabase } = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        name: "Vonza",
        purpose: "support",
        system_prompt: "",
        tone: "friendly",
        language: "English",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Acme",
        website_url: "https://example.com",
      },
    ],
    widget_configs: [
      {
        id: "widget-1",
        agent_id: "agent-1",
        assistant_name: "Vonza",
        welcome_message: "Welcome",
        button_label: "Chat",
        primary_color: "#14b8a6",
        secondary_color: "#0f766e",
        launcher_text: "Chat",
        theme_mode: "light",
      },
    ],
  });

  const result = await updateAgentSettings(supabase, {
    agentId: "agent-1",
    assistantName: "Vonza",
    fullPageConfig: {
      headline: `${"Custom support headline ".repeat(6)}<script>alert(1)</script>`,
      subtitle: "Ask us about service plans, estimates, support, or the best next step.",
      accent_color: "not-a-color",
      logo_url: "https://cdn.example.com/logo.png",
      action_cards: [
        {
          label: "Service help that is much too long for the UI control",
          description: "A".repeat(150),
          prompt: "P".repeat(240),
          type: "services",
          enabled: true,
        },
        {
          label: "Book a time",
          description: "Book",
          prompt: "I'd like to book a time.",
          type: "booking",
          enabled: true,
        },
      ],
      suggested_questions: ["Q".repeat(140)],
      show_booking: true,
      show_quote: true,
      show_contact: true,
      trust_items: ["Instant help", "Real team follow-up", "Private"],
      design: {
        preset: "video-hero",
        background_type: "video",
        background_color: "#111827",
        background_gradient_to: "#2563eb",
        background_image_url: "https://cdn.example.com/not-supported.gif",
        background_video_url: "https://cdn.example.com/frontdesk.webm",
        background_overlay_color: "#000",
        background_overlay_opacity: 2,
        background_blur: 30,
        background_focal_point: "left",
        text_theme: "light",
        composer_style: "elevated",
        chip_style: "subtle-fill",
        status_style: "pill",
        background_scope: "iframe",
        disable_video_on_mobile: false,
      },
    },
  });

  assert.equal(result.fullPageConfig.headline.length, 80);
  assert.equal(result.fullPageConfig.accentColor, null);
  assert.equal(result.fullPageConfig.logoUrl, "https://cdn.example.com/logo.png");
  assert.equal(result.fullPageConfig.actionCards[0].label.length, 40);
  assert.equal(result.fullPageConfig.actionCards[0].description.length, 120);
  assert.equal(result.fullPageConfig.actionCards[0].prompt.length, 200);
  assert.equal(result.fullPageConfig.showBooking, false);
  assert.equal(result.fullPageConfig.actionCards[1].enabled, false);
  assert.equal(result.fullPageConfig.suggestedQuestions[0].length, 120);
  assert.equal(result.fullPageConfig.design.preset, "video-hero");
  assert.equal(result.fullPageConfig.design.backgroundType, "video");
  assert.equal(result.fullPageConfig.design.backgroundImageUrl, null);
  assert.equal(result.fullPageConfig.design.backgroundVideoUrl, "https://cdn.example.com/frontdesk.webm");
  assert.equal(result.fullPageConfig.design.backgroundOverlayColor, "#000000");
  assert.equal(result.fullPageConfig.design.backgroundOverlayOpacity, 0.92);
  assert.equal(result.fullPageConfig.design.backgroundBlur, 18);
  assert.equal(result.fullPageConfig.design.backgroundScope, "iframe");
  assert.equal(result.fullPageConfig.design.disableVideoOnMobile, false);
  assert.equal(state.widget_configs[0].full_page_config.headline.length, 80);
  assert.equal(state.widget_configs[0].full_page_config.accent_color, null);
  assert.equal(state.widget_configs[0].full_page_config.show_booking, false);
  assert.equal(state.widget_configs[0].full_page_config.design.background_video_url, "https://cdn.example.com/frontdesk.webm");
  assert.equal(state.widget_configs[0].full_page_config.design.background_scope, "iframe");
});

test("updateAgentSettings persists Weboldali agent quick prompts and bootstrap returns them", async () => {
  const { state, ...supabase } = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        name: "Vonza",
        purpose: "support",
        system_prompt: "",
        tone: "friendly",
        language: "Hungarian",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Acme",
        website_url: "https://example.com",
      },
    ],
    widget_configs: [
      {
        id: "widget-1",
        agent_id: "agent-1",
        assistant_name: "Vonza",
        welcome_message: "Welcome",
        button_label: "Chat",
        primary_color: "#14b8a6",
        secondary_color: "#0f766e",
        launcher_text: "Chat",
        theme_mode: "light",
      },
    ],
  });

  const result = await updateAgentSettings(supabase, {
    agentId: "agent-1",
    fullPageConfig: {
      public_page_enabled: true,
      public_page_key: "page-key",
      suggested_questions: ["Full-page only question"],
      quick_prompts: [
        { label: "<img src=x onerror=alert(1)>", prompt: "Do not persist this row." },
        { label: "A".repeat(60), prompt: "P".repeat(240) },
        { label: "Árak", prompt: "Milyen árakkal vagy díjakkal számolhatok?" },
        { label: "Árak", prompt: "Duplicate label should be ignored." },
        { label: "Ajánlat", prompt: "Szeretnék ajánlatot kérni." },
        { label: "Kapcsolat", prompt: "Hogyan tudom felvenni a kapcsolatot?" },
        { label: "Foglalás", prompt: "Szeretnék időpontot foglalni." },
        { label: "Extra", prompt: "This sixth valid prompt should be trimmed." },
      ],
    },
  });

  assert.equal(result.fullPageConfig.suggestedQuestions[0], "Full-page only question");
  assert.equal(result.fullPageConfig.quickPrompts.length, 5);
  assert.equal(result.fullPageConfig.quickPrompts[0].label.length, 40);
  assert.equal(result.fullPageConfig.quickPrompts[0].prompt.length, 200);
  assert.equal(result.fullPageConfig.quickPrompts[1].label, "Árak");
  assert.equal(result.fullPageConfig.quickPrompts[1].prompt, "Milyen árakkal vagy díjakkal számolhatok?");
  assert.equal(result.fullPageConfig.quickPrompts.some((item) => item.label.includes("<")), false);
  assert.equal(result.fullPageConfig.quickPrompts.some((item) => item.label === "Extra"), false);
  assert.deepEqual(
    state.widget_configs[0].full_page_config.quick_prompts,
    result.fullPageConfig.quickPrompts
  );

  const bootstrap = await getWidgetBootstrap(supabase, {
    agentId: "agent-1",
    origin: "https://example.com",
    pageUrl: "https://example.com/contact",
    displayMode: "widget",
  });

  assert.deepEqual(
    bootstrap.widgetConfig.fullPageConfig.quickPrompts,
    result.fullPageConfig.quickPrompts
  );
  assert.deepEqual(
    bootstrap.widgetConfig.full_page_config.quick_prompts,
    result.fullPageConfig.quickPrompts
  );
});

test("full-page design defaults and presets resolve safely", () => {
  const defaultDesign = normalizeFullPageDesignConfig();
  assert.equal(defaultDesign.preset, "clean-light");
  assert.equal(defaultDesign.backgroundScope, "section");
  assert.equal(defaultDesign.backgroundType, "color");
  assert.equal(defaultDesign.textTheme, "dark");
  assert.equal(defaultDesign.composerStyle, "soft");

  const darkPreset = getFullPageDesignPresetDefaults("dark-professional");
  assert.equal(darkPreset.backgroundColor, "#111827");
  assert.equal(darkPreset.textTheme, "light");
  assert.equal(darkPreset.statusStyle, "pill");

  const normalized = normalizeFullPageDesignConfig({
    preset: "bold-gradient",
    background_type: "nonsense",
    background_color: "#123",
    background_gradient_to: "bad",
    background_image_url: "https://cdn.example.com/hero.gif",
    background_video_url: "https://cdn.example.com/hero.mov",
    background_overlay_opacity: -1,
    background_blur: "9",
    text_theme: "light",
  });

  assert.equal(normalized.backgroundType, "gradient");
  assert.equal(normalized.backgroundColor, "#112233");
  assert.equal(normalized.backgroundGradientTo, "#2563eb");
  assert.equal(normalized.backgroundImageUrl, null);
  assert.equal(normalized.backgroundVideoUrl, null);
  assert.equal(normalized.backgroundOverlayOpacity, 0);
  assert.equal(normalized.backgroundBlur, 9);
  assert.equal(normalized.textTheme, "light");
});

test("normalizeFullPageConfig allows booking only when booking support exists", () => {
  const withoutBooking = normalizeFullPageConfig({
    show_booking: true,
    action_cards: [
      {
        label: "Book a time",
        prompt: "I'd like to book a time.",
        type: "booking",
        enabled: true,
      },
    ],
  });

  assert.equal(withoutBooking.showBooking, false);
  assert.equal(withoutBooking.actionCards[0].enabled, false);

  const withBooking = normalizeFullPageConfig({
    show_booking: true,
  }, {
    bookingSupport: true,
  });

  assert.equal(withBooking.showBooking, true);
  assert.ok(withBooking.actionCards.some((card) => card.type === "booking" && card.enabled));
});

test("updateAgentSettings persists a website-only change without disturbing other customize fields", async () => {
  const { state, ...supabase } = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        name: "Vonza",
        purpose: "help",
        system_prompt: "stay helpful",
        tone: "friendly",
        language: "English",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Vonza",
        website_url: "https://old-example.com",
      },
    ],
    widget_configs: [
      {
        id: "widget-1",
        agent_id: "agent-1",
        assistant_name: "Vonza",
        welcome_message: "Hello there",
        button_label: "Chat now",
        primary_color: "#14b8a6",
        secondary_color: "#0f766e",
        launcher_text: "Chat now",
        theme_mode: "light",
      },
    ],
  });

  const result = await updateAgentSettings(supabase, {
    agentId: "agent-1",
    websiteUrl: "https://new-example.com",
  });

  assert.equal(result.websiteUrl, "https://new-example.com/");
  assert.equal(result.websiteSync.changed, true);
  assert.equal(result.assistantName, "Vonza");
  assert.equal(result.tone, "friendly");
  assert.equal(result.buttonLabel, "Chat now");
  assert.equal(result.welcomeMessage, "Hello there");
  assert.equal(result.primaryColor, "#14b8a6");
  assert.equal(result.secondaryColor, "#0f766e");
  assert.equal(state.businesses[0].website_url, "https://new-example.com/");
});

test("updateAgentSettings persists widget AI behavior and defaults legacy purpose to support", async () => {
  const { state, ...supabase } = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        name: "Vonza",
        purpose: "help",
        system_prompt: "stay helpful",
        tone: "friendly",
        language: "English",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Vonza",
        website_url: "https://example.com",
      },
    ],
    widget_configs: [
      {
        id: "widget-1",
        agent_id: "agent-1",
        assistant_name: "Vonza",
        welcome_message: "Hello there",
        button_label: "Chat now",
        primary_color: "#14b8a6",
        secondary_color: "#0f766e",
        launcher_text: "Chat now",
        theme_mode: "light",
      },
    ],
  });

  const defaulted = await updateAgentSettings(supabase, {
    agentId: "agent-1",
    assistantName: "Vonza",
  });

  assert.equal(defaulted.purpose, "support");
  assert.equal(state.agents[0].purpose, "support");

  const result = await updateAgentSettings(supabase, {
    agentId: "agent-1",
    assistantName: "Vonza",
    widgetPurpose: "make_decision",
    tone: "sales",
    systemPrompt: "Ask about project timing before suggesting a next step.",
  });

  assert.equal(result.purpose, "make_decision");
  assert.equal(result.tone, "sales");
  assert.equal(result.systemPrompt, "Ask about project timing before suggesting a next step.");
  assert.equal(state.agents[0].purpose, "make_decision");
  assert.equal(state.agents[0].tone, "sales");
  assert.equal(state.agents[0].system_prompt, "Ask about project timing before suggesting a next step.");
});

test("updateAgentSettings persists, reloads, and clears advanced custom instructions", async () => {
  const { state, ...supabase } = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        name: "Vonza",
        purpose: "support",
        system_prompt: "stay helpful",
        custom_instructions: "Old custom instructions",
        tone: "friendly",
        language: "English",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Vonza",
        website_url: "https://example.com",
      },
    ],
    widget_configs: [
      {
        id: "widget-1",
        agent_id: "agent-1",
        assistant_name: "Vonza",
        welcome_message: "Hello there",
        button_label: "Chat now",
        primary_color: "#14b8a6",
        secondary_color: "#0f766e",
        launcher_text: "Chat now",
        theme_mode: "light",
      },
    ],
  });
  const customInstructions = [
    "Keep replies under 4 sentences unless the visitor asks for detail.",
    "Use one friendly emoji only when confirming bookings.",
    "Always answer in Hungarian unless the visitor writes in English.",
  ].join("\n");

  const result = await updateAgentSettings(supabase, {
    agentId: "agent-1",
    customInstructions,
  });
  const reloaded = await requireAgentAccess(supabase, {
    agentId: "agent-1",
    ownerUserId: "owner-1",
  });

  assert.equal(result.customInstructions, customInstructions);
  assert.equal(state.agents[0].custom_instructions, customInstructions);
  assert.equal(reloaded.customInstructions, customInstructions);

  const cleared = await updateAgentSettings(supabase, {
    agentId: "agent-1",
    customInstructions: "",
  });

  assert.equal(cleared.customInstructions, "");
  assert.equal(state.agents[0].custom_instructions, null);
});

test("updateAgentSettings rejects advanced custom instructions over the max length", async () => {
  const { state, ...supabase } = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        name: "Vonza",
        purpose: "support",
        system_prompt: "",
        custom_instructions: "safe custom instructions",
        tone: "friendly",
        language: "English",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Vonza",
        website_url: "https://example.com",
      },
    ],
    widget_configs: [
      {
        id: "widget-1",
        agent_id: "agent-1",
        assistant_name: "Vonza",
        welcome_message: "Hello there",
        button_label: "Chat now",
        primary_color: "#14b8a6",
        secondary_color: "#0f766e",
        launcher_text: "Chat now",
        theme_mode: "light",
      },
    ],
  });

  await assert.rejects(
    () =>
      updateAgentSettings(supabase, {
        agentId: "agent-1",
        customInstructions: "x".repeat(CUSTOM_INSTRUCTIONS_MAX_LENGTH + 1),
      }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "custom_instructions_too_long");
      assert.match(error.message, /10,000 characters or fewer/i);
      return true;
    }
  );
  assert.equal(state.agents[0].custom_instructions, "safe custom instructions");
});

test("updateAgentSettings persists generated Weboldali agent instructions through system_prompt", async () => {
  const { state, ...supabase } = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        name: "Vonza",
        purpose: "support",
        system_prompt: "",
        tone: "friendly",
        language: "Hungarian",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Vonza",
        website_url: "https://example.com",
      },
    ],
    widget_configs: [
      {
        id: "widget-1",
        agent_id: "agent-1",
        assistant_name: "Vonza",
        welcome_message: "Üdvözöljük! Miben segíthetünk?",
        button_label: "Chat",
        primary_color: "#14b8a6",
        secondary_color: "#0f766e",
        launcher_text: "Chat",
        theme_mode: "light",
      },
    ],
  });
  const generatedInstructions = generateWebsiteWidgetAgentInstructions({
    language: "hu",
    widgetPurpose: "lead_capture",
    tone: "professional",
    websiteUrl: "https://example.com",
    knowledgeReady: true,
    knowledgePageCount: 2,
    quickPrompts: [{ label: "Ajánlatkérés", prompt: "Szeretnék ajánlatot kérni." }],
  });
  const editedInstructions = `${generatedInstructions}\n- Az ajánlatkérésnél kérjen rövid projektleírást.`;
  const persistedInstructions = editedInstructions.replace(/\s+/g, " ").trim();

  const result = await updateAgentSettings(supabase, {
    agentId: "agent-1",
    widgetPurpose: "lead_capture",
    tone: "professional",
    systemPrompt: editedInstructions,
  });

  assert.equal(result.systemPrompt, persistedInstructions);
  assert.equal(state.agents[0].system_prompt, persistedInstructions);
  assert.match(result.systemPrompt, /AI utasítások|Weboldali agent asszisztense/);
  assert.match(result.systemPrompt, /projektleírást/);
});

test("updateAgentSettings persists and reloads Front Desk voice settings with safe defaults", async () => {
  const { state, ...supabase } = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        name: "Vonza",
        purpose: "support",
        system_prompt: "stay helpful",
        tone: "friendly",
        language: "English",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Vonza",
        website_url: "https://example.com",
      },
    ],
    widget_configs: [
      {
        id: "widget-1",
        agent_id: "agent-1",
        assistant_name: "Vonza",
        welcome_message: "Hello there",
        button_label: "Chat now",
        primary_color: "#14b8a6",
        secondary_color: "#0f766e",
        launcher_text: "Chat now",
        theme_mode: "light",
      },
    ],
  });

  const defaulted = await updateAgentSettings(supabase, {
    agentId: "agent-1",
    assistantName: "Vonza",
  });

  assert.deepEqual(defaulted.voiceConfig, {
    voiceInputEnabled: false,
    spokenRepliesEnabled: false,
    webCallEnabled: false,
    autoSendTranscript: false,
    autoPlaySpokenReplies: false,
    voice: "alloy",
    languageBehavior: "auto",
  });
  assert.deepEqual(state.widget_configs[0].voice_config, {
    voice_input_enabled: false,
    spoken_replies_enabled: false,
    web_call_enabled: false,
    auto_send_transcript: false,
    auto_play_spoken_replies: false,
    voice: "alloy",
    language_behavior: "auto",
  });

  const result = await updateAgentSettings(supabase, {
    agentId: "agent-1",
    voiceConfig: {
      voice_input_enabled: true,
      spoken_replies_enabled: true,
      web_call_enabled: true,
      auto_send_transcript: true,
      auto_play_spoken_replies: false,
      voice: "sage",
      language_behavior: "business",
    },
  });

  assert.deepEqual(result.voiceConfig, {
    voiceInputEnabled: true,
    spokenRepliesEnabled: true,
    webCallEnabled: true,
    autoSendTranscript: true,
    autoPlaySpokenReplies: false,
    voice: "sage",
    languageBehavior: "business",
  });
  assert.deepEqual(state.widget_configs[0].voice_config, {
    voice_input_enabled: true,
    spoken_replies_enabled: true,
    web_call_enabled: true,
    auto_send_transcript: true,
    auto_play_spoken_replies: false,
    voice: "sage",
    language_behavior: "business",
  });

  const reloaded = await getAgentWorkspaceSnapshot(supabase, "agent-1");
  assert.deepEqual(reloaded.voiceConfig, result.voiceConfig);
});

test("voice config without web_call_enabled normalizes web call off", () => {
  assert.deepEqual(normalizeVoiceConfig({
    voice_input_enabled: true,
    spoken_replies_enabled: true,
    auto_send_transcript: true,
    auto_play_spoken_replies: true,
    voice: "sage",
    language_behavior: "business",
  }), {
    voiceInputEnabled: true,
    spokenRepliesEnabled: true,
    webCallEnabled: false,
    autoSendTranscript: true,
    autoPlaySpokenReplies: true,
    voice: "sage",
    languageBehavior: "business",
  });
});

test("updateAgentSettings persists clearing the welcome message", async () => {
  const { state, ...supabase } = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        name: "Vonza",
        purpose: "help",
        system_prompt: "stay helpful",
        tone: "friendly",
        language: "English",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Vonza",
        website_url: "https://example.com",
      },
    ],
    widget_configs: [
      {
        id: "widget-1",
        agent_id: "agent-1",
        assistant_name: "Vonza",
        welcome_message: "Hello there",
        button_label: "Chat now",
        primary_color: "#14b8a6",
        secondary_color: "#0f766e",
        launcher_text: "Chat now",
        theme_mode: "light",
      },
    ],
  });

  const result = await updateAgentSettings(supabase, {
    agentId: "agent-1",
    welcomeMessage: "",
  });

  assert.equal(result.welcomeMessage, "");
  assert.equal(state.widget_configs[0].welcome_message, "");
  assert.equal(state.widget_configs[0].button_label, "Chat now");
});

test("updateAgentSettings persists clearing the launcher text", async () => {
  const { state, ...supabase } = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        name: "Vonza",
        purpose: "help",
        system_prompt: "stay helpful",
        tone: "friendly",
        language: "English",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Vonza",
        website_url: "https://example.com",
      },
    ],
    widget_configs: [
      {
        id: "widget-1",
        agent_id: "agent-1",
        assistant_name: "Vonza",
        welcome_message: "Hello there",
        button_label: "Chat now",
        primary_color: "#14b8a6",
        secondary_color: "#0f766e",
        launcher_text: "Chat now",
        theme_mode: "light",
      },
    ],
  });

  const result = await updateAgentSettings(supabase, {
    agentId: "agent-1",
    buttonLabel: "",
  });

  assert.equal(result.buttonLabel, "");
  assert.equal(state.widget_configs[0].button_label, "");
  assert.equal(state.widget_configs[0].welcome_message, "Hello there");
});

test("updateAgentSettings persists clearing brand colors", async () => {
  const { state, ...supabase } = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        name: "Vonza",
        purpose: "help",
        system_prompt: "stay helpful",
        tone: "friendly",
        language: "English",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Vonza",
        website_url: "https://example.com",
      },
    ],
    widget_configs: [
      {
        id: "widget-1",
        agent_id: "agent-1",
        assistant_name: "Vonza",
        welcome_message: "Hello there",
        button_label: "Chat now",
        primary_color: "#14b8a6",
        secondary_color: "#0f766e",
        launcher_text: "Chat now",
        theme_mode: "light",
      },
    ],
  });

  const result = await updateAgentSettings(supabase, {
    agentId: "agent-1",
    primaryColor: "",
    secondaryColor: "",
  });

  assert.equal(result.primaryColor, "");
  assert.equal(result.secondaryColor, "");
  assert.equal(state.widget_configs[0].primary_color, "");
  assert.equal(state.widget_configs[0].secondary_color, "");
});

test("updateAgentSettings persists widget logo upload data", async () => {
  const logoDataUrl = "data:image/png;base64,iVBORw0KGgo=";
  const supabase = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        public_agent_key: "agent-key",
        name: "Acme Assistant",
        purpose: "support",
        tone: "friendly",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Acme",
        website_url: "https://acme.example",
      },
    ],
    widget_configs: [
      {
        agent_id: "agent-1",
        assistant_name: "Acme Assistant",
        welcome_message: "Hello.",
        button_label: "Chat",
        primary_color: "#14b8a6",
        secondary_color: "#0f766e",
        launcher_text: "YOUR PERSONAL ASSISTANT",
        theme_mode: "dark",
        install_id: "install-1",
        allowed_domains: ["acme.example"],
      },
    ],
  });

  const result = await updateAgentSettings(supabase, {
    agentId: "agent-1",
    widgetLogoUrl: logoDataUrl,
  });

  assert.equal(result.widgetLogoUrl, logoDataUrl);
  assert.equal(supabase.state.widget_configs[0].widget_logo_url, logoDataUrl);
});

test("normalizeFullPageDesignConfig maps built-in background presets", () => {
  const light = normalizeFullPageDesignConfig({
    background_source: "preset",
    background_preset: "clean-light-abstract",
    background_overlay_opacity: 0.22,
  });
  const dark = normalizeFullPageDesignConfig({
    background_source: "preset",
    background_preset: "dark-gold-abstract",
  });
  const brightVideo = normalizeFullPageDesignConfig({
    background_source: "preset",
    background_preset: "bright-abstract-motion",
  });
  const darkVideo = normalizeFullPageDesignConfig({
    background_source: "preset",
    background_preset: "dark-abstract-motion",
  });

  assert.equal(FULL_PAGE_BACKGROUND_PRESETS["bright-abstract-motion"].videoUrl, "/assets/front-desk/backgrounds/vonza_front_desk_bright_loop.mp4");
  assert.equal(FULL_PAGE_BACKGROUND_PRESETS["dark-abstract-motion"].videoUrl, "/assets/front-desk/backgrounds/vonza_front_desk_dark_loop.mp4");
  assert.equal(light.backgroundType, "image");
  assert.equal(light.backgroundSource, "preset");
  assert.equal(light.backgroundPreset, "clean-light-abstract");
  assert.equal(light.backgroundImageUrl, "/assets/front-desk/backgrounds/abstract-light-gold.png");
  assert.equal(light.textTheme, "dark");
  assert.equal(light.backgroundOverlayOpacity, 0.22);
  assert.equal(dark.backgroundType, "image");
  assert.equal(dark.backgroundSource, "preset");
  assert.equal(dark.backgroundPreset, "dark-gold-abstract");
  assert.equal(dark.backgroundImageUrl, "/assets/front-desk/backgrounds/abstract-dark-gold.png");
  assert.equal(dark.textTheme, "light");
  assert.equal(brightVideo.backgroundType, "video");
  assert.equal(brightVideo.backgroundSource, "preset");
  assert.equal(brightVideo.backgroundPreset, "bright-abstract-motion");
  assert.equal(brightVideo.backgroundVideoUrl, "/assets/front-desk/backgrounds/vonza_front_desk_bright_loop.mp4");
  assert.equal(brightVideo.backgroundImageUrl, "/assets/front-desk/backgrounds/vonza_front_desk_bright_poster.png");
  assert.equal(brightVideo.textTheme, "dark");
  assert.equal(brightVideo.backgroundOverlayOpacity, 0.1);
  assert.equal(brightVideo.disableVideoOnMobile, true);
  assert.equal(darkVideo.backgroundType, "video");
  assert.equal(darkVideo.backgroundSource, "preset");
  assert.equal(darkVideo.backgroundPreset, "dark-abstract-motion");
  assert.equal(darkVideo.backgroundVideoUrl, "/assets/front-desk/backgrounds/vonza_front_desk_dark_loop.mp4");
  assert.equal(darkVideo.backgroundImageUrl, "/assets/front-desk/backgrounds/vonza_front_desk_dark_poster.png");
  assert.equal(darkVideo.textTheme, "light");
  assert.equal(darkVideo.backgroundOverlayOpacity, 0.24);
  assert.equal(darkVideo.disableVideoOnMobile, true);
});

test("normalizeFullPageDesignConfig gives media backgrounds readable overlay defaults", () => {
  const lightTextVideo = normalizeFullPageDesignConfig({
    background_type: "video",
    background_source: "url",
    background_video_url: "https://cdn.example.com/lobby.webm",
    background_image_url: "https://cdn.example.com/lobby.png",
    text_theme: "light",
  });
  const darkTextImage = normalizeFullPageDesignConfig({
    background_type: "image",
    background_source: "upload",
    background_image_url: "https://cdn.example.com/lobby.webp",
    text_theme: "dark",
  });

  assert.equal(lightTextVideo.backgroundOverlayColor, "#020617");
  assert.equal(lightTextVideo.backgroundOverlayOpacity, 0.36);
  assert.equal(darkTextImage.backgroundOverlayColor, "#ffffff");
  assert.equal(darkTextImage.backgroundOverlayOpacity, 0.2);
});

test("normalizeFullPageDesignConfig falls back safely for invalid background design values", () => {
  const design = normalizeFullPageDesignConfig({
    background_type: "javascript",
    background_source: "preset",
    background_preset: "not-real",
    background_color: "not-a-color",
    background_gradient_to: "<b>bad</b>",
    background_image_url: "ftp://example.com/background.png",
    background_video_url: "https://example.com/video.svg",
    background_overlay_opacity: 7,
    background_blur: 100,
    background_scope: "page",
    text_theme: "neon",
  });

  assert.equal(design.backgroundType, "color");
  assert.equal(design.backgroundSource, "url");
  assert.equal(design.backgroundPreset, null);
  assert.equal(design.backgroundColor, "#ffffff");
  assert.equal(design.backgroundGradientTo, "#eef4ff");
  assert.equal(design.backgroundImageUrl, null);
  assert.equal(design.backgroundVideoUrl, null);
  assert.equal(design.backgroundOverlayOpacity, 0.92);
  assert.equal(design.backgroundBlur, 18);
  assert.equal(design.backgroundScope, "section");
  assert.equal(design.textTheme, "dark");
});

test("updateAgentSettings persists built-in full-page background preset fields", async () => {
  const supabase = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        name: "Acme Assistant",
        purpose: "support",
        tone: "friendly",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Acme",
        website_url: "https://acme.example",
      },
    ],
    widget_configs: [
      {
        agent_id: "agent-1",
        assistant_name: "Acme Assistant",
        welcome_message: "Hello.",
        button_label: "Chat",
        primary_color: "#14b8a6",
        secondary_color: "#0f766e",
        launcher_text: "YOUR PERSONAL ASSISTANT",
        theme_mode: "dark",
      },
    ],
  });

  const result = await updateAgentSettings(supabase, {
    agentId: "agent-1",
    fullPageConfig: {
      design: {
        background_source: "preset",
        background_preset: "dark-abstract-motion",
      },
    },
  });

  assert.equal(result.fullPageConfig.design.backgroundPreset, "dark-abstract-motion");
  assert.equal(result.fullPageConfig.design.backgroundType, "video");
  assert.equal(result.fullPageConfig.design.backgroundImageUrl, "/assets/front-desk/backgrounds/vonza_front_desk_dark_poster.png");
  assert.equal(result.fullPageConfig.design.backgroundVideoUrl, "/assets/front-desk/backgrounds/vonza_front_desk_dark_loop.mp4");
  assert.equal(supabase.state.widget_configs[0].full_page_config.design.background_source, "preset");
  assert.equal(supabase.state.widget_configs[0].full_page_config.design.background_preset, "dark-abstract-motion");
  assert.equal(supabase.state.widget_configs[0].full_page_config.design.background_video_url, "/assets/front-desk/backgrounds/vonza_front_desk_dark_loop.mp4");
});

test("front desk background upload validation accepts supported image and video files", () => {
  assert.equal(
    validateFrontDeskBackgroundUpload({
      filename: "hero.PNG",
      contentType: "image/png",
      buffer: Buffer.alloc(100),
    }, "image").extension,
    "png"
  );
  assert.equal(
    validateFrontDeskBackgroundUpload({
      filename: "hero.webm",
      contentType: "video/webm",
      buffer: Buffer.alloc(100),
    }, "video").mimeType,
    "video/webm"
  );
});

test("front desk background upload validation rejects svg, mismatched, and oversized files", () => {
  assert.throws(
    () => validateFrontDeskBackgroundUpload({
      filename: "hero.svg",
      contentType: "image/svg+xml",
      buffer: Buffer.alloc(100),
    }, "image"),
    /PNG, JPG, JPEG, or WebP/
  );
  assert.throws(
    () => validateFrontDeskBackgroundUpload({
      filename: "hero.png",
      contentType: "video/mp4",
      buffer: Buffer.alloc(100),
    }, "image"),
    /PNG, JPG, JPEG, or WebP/
  );
  assert.throws(
    () => validateFrontDeskBackgroundUpload({
      filename: "hero.mp4",
      contentType: "video/mp4",
      size: 51 * 1024 * 1024,
      buffer: Buffer.alloc(1),
    }, "video"),
    /under 50 MB/
  );
});

test("uploadFrontDeskBackground stores owner and agent scoped public storage object", async () => {
  const calls = [];
  const supabase = {
    storage: {
      from(bucket) {
        return {
          async upload(path, buffer, options) {
            calls.push({ bucket, path, buffer, options });
            return { data: { path }, error: null };
          },
          getPublicUrl(path) {
            return { data: { publicUrl: `https://cdn.example.com/${bucket}/${path}` } };
          },
        };
      },
    },
  };

  const result = await uploadFrontDeskBackground(supabase, {
    agent: { id: "agent-1" },
    ownerUserId: "owner-1",
    kind: "image",
    file: {
      filename: "../Light Hero.webp",
      contentType: "image/webp",
      buffer: Buffer.from("image"),
    },
    bucket: "test-backgrounds",
  });

  assert.equal(result.url.startsWith("https://cdn.example.com/test-backgrounds/owner-1/agent-1/image/"), true);
  assert.equal(calls[0].bucket, "test-backgrounds");
  assert.match(calls[0].path, /^owner-1\/agent-1\/image\/\d+-[a-f0-9]+-Light-Hero\.webp$/);
  assert.equal(calls[0].options.contentType, "image/webp");
  assert.equal(calls[0].options.upsert, false);
});

test("updateAgentSettings persists clearing the website", async () => {
  const { state, ...supabase } = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        name: "Vonza",
        purpose: "help",
        system_prompt: "stay helpful",
        tone: "friendly",
        language: "English",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Vonza",
        website_url: "https://example.com",
      },
    ],
    widget_configs: [
      {
        id: "widget-1",
        agent_id: "agent-1",
        assistant_name: "Vonza",
        welcome_message: "Hello there",
        button_label: "Chat now",
        primary_color: "#14b8a6",
        secondary_color: "#0f766e",
        launcher_text: "Chat now",
        theme_mode: "light",
        allowed_domains: [],
      },
    ],
  });

  const result = await updateAgentSettings(supabase, {
    agentId: "agent-1",
    websiteUrl: "",
  });

  assert.equal(result.websiteUrl, "");
  assert.equal(state.businesses[0].website_url, null);
  assert.deepEqual(state.widget_configs[0].allowed_domains, []);
});

test("updateAgentSettings keeps a stable install id while refreshing allowed domains", async () => {
  const { state, ...supabase } = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        name: "Vonza",
        purpose: "help",
        system_prompt: "stay helpful",
        tone: "friendly",
        language: "English",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Example",
        website_url: "https://example.com",
      },
    ],
    widget_configs: [
      {
        id: "widget-1",
        agent_id: "agent-1",
        assistant_name: "Vonza",
        welcome_message: "Hello there",
        button_label: "Chat now",
        primary_color: "#14b8a6",
        secondary_color: "#0f766e",
        launcher_text: "Chat now",
        theme_mode: "light",
        install_id: "11111111-1111-1111-1111-111111111111",
        allowed_domains: ["example.com"],
      },
    ],
  });

  const result = await updateAgentSettings(supabase, {
    agentId: "agent-1",
    allowedDomains: "example.com\nshop.example.com",
  });

  assert.equal(result.installId, "11111111-1111-1111-1111-111111111111");
  assert.deepEqual(result.allowedDomains, ["example.com", "shop.example.com"]);
  assert.deepEqual(state.widget_configs[0].allowed_domains, ["example.com", "shop.example.com"]);
});

test("updateAgentSettings persists and rehydrates Front Desk routing settings", async () => {
  const { state, ...supabase } = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        name: "Vonza",
        purpose: "support",
        system_prompt: "stay helpful",
        tone: "friendly",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Example",
        website_url: "https://example.com",
      },
    ],
    widget_configs: [
      {
        id: "widget-1",
        agent_id: "agent-1",
        assistant_name: "Vonza",
        welcome_message: "Hello there",
        button_label: "Chat now",
        primary_color: "#14b8a6",
        secondary_color: "#0f766e",
        launcher_text: "Chat now",
        theme_mode: "light",
        booking_url: "https://example.com/book",
        quote_url: "https://example.com/quote",
        checkout_url: "https://example.com/shop",
        success_url_match_mode: "starts_with",
        manual_outcome_mode: false,
        primary_cta_mode: "booking",
        fallback_cta_mode: "contact",
        allowed_domains: ["example.com"],
      },
    ],
  });

  const result = await updateAgentSettings(supabase, {
    agentId: "agent-1",
    bookingUrl: "https://example.com/book-now",
    bookingStartUrl: "https://example.com/book/start",
    quoteStartUrl: "https://example.com/quote/start",
    bookingSuccessUrl: "https://example.com/book/confirmed",
    quoteSuccessUrl: "https://example.com/quote/thanks",
    checkoutSuccessUrl: "https://example.com/shop/complete",
    successUrlMatchMode: "exact",
    manualOutcomeMode: true,
    primaryCtaMode: "quote",
    fallbackCtaMode: "capture",
    businessHoursNote: "Monday-Friday, 9-5",
  });

  assert.equal(result.bookingUrl, "https://example.com/book-now");
  assert.equal(result.quoteUrl, "https://example.com/quote");
  assert.equal(result.checkoutUrl, "https://example.com/shop");
  assert.equal(result.bookingStartUrl, "https://example.com/book/start");
  assert.equal(result.quoteStartUrl, "https://example.com/quote/start");
  assert.equal(result.bookingSuccessUrl, "https://example.com/book/confirmed");
  assert.equal(result.quoteSuccessUrl, "https://example.com/quote/thanks");
  assert.equal(result.checkoutSuccessUrl, "https://example.com/shop/complete");
  assert.equal(result.successUrlMatchMode, "exact");
  assert.equal(result.manualOutcomeMode, true);
  assert.equal(result.primaryCtaMode, "quote");
  assert.equal(result.fallbackCtaMode, "capture");
  assert.equal(result.businessHoursNote, "Monday-Friday, 9-5");

  const savedRow = state.widget_configs[0];
  assert.equal(savedRow.booking_url, "https://example.com/book-now");
  assert.equal(savedRow.quote_url, "https://example.com/quote");
  assert.equal(savedRow.checkout_url, "https://example.com/shop");
  assert.equal(savedRow.booking_start_url, "https://example.com/book/start");
  assert.equal(savedRow.quote_start_url, "https://example.com/quote/start");
  assert.equal(savedRow.booking_success_url, "https://example.com/book/confirmed");
  assert.equal(savedRow.quote_success_url, "https://example.com/quote/thanks");
  assert.equal(savedRow.checkout_success_url, "https://example.com/shop/complete");
  assert.equal(savedRow.success_url_match_mode, "exact");
  assert.equal(savedRow.manual_outcome_mode, true);
  assert.equal(savedRow.primary_cta_mode, "quote");
  assert.equal(savedRow.fallback_cta_mode, "capture");
  assert.equal(savedRow.business_hours_note, "Monday-Friday, 9-5");

  const reloaded = await getAgentWorkspaceSnapshot(supabase, "agent-1");
  assert.equal(reloaded.bookingUrl, "https://example.com/book-now");
  assert.equal(reloaded.quoteUrl, "https://example.com/quote");
  assert.equal(reloaded.checkoutUrl, "https://example.com/shop");
  assert.equal(reloaded.bookingStartUrl, "https://example.com/book/start");
  assert.equal(reloaded.quoteStartUrl, "https://example.com/quote/start");
  assert.equal(reloaded.bookingSuccessUrl, "https://example.com/book/confirmed");
  assert.equal(reloaded.quoteSuccessUrl, "https://example.com/quote/thanks");
  assert.equal(reloaded.checkoutSuccessUrl, "https://example.com/shop/complete");
  assert.equal(reloaded.successUrlMatchMode, "exact");
  assert.equal(reloaded.manualOutcomeMode, true);
  assert.equal(reloaded.primaryCtaMode, "quote");
  assert.equal(reloaded.fallbackCtaMode, "capture");
  assert.equal(reloaded.businessHoursNote, "Monday-Friday, 9-5");
});

test("updateAgentSettings saves a valid Calendly booking provider link", async () => {
  const { state, ...supabase } = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        name: "Vonza",
        purpose: "support",
        system_prompt: "stay helpful",
        tone: "friendly",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Example",
        website_url: "https://example.com",
      },
    ],
    widget_configs: [
      {
        id: "widget-1",
        agent_id: "agent-1",
        assistant_name: "Vonza",
        welcome_message: "Hello there",
        button_label: "Chat now",
        primary_color: "#14b8a6",
        secondary_color: "#0f766e",
        launcher_text: "Chat now",
        theme_mode: "light",
        full_page_config: {
          public_page_enabled: true,
          public_page_key: "page-key",
        },
      },
    ],
  });

  const result = await updateAgentSettings(supabase, {
    agentId: "agent-1",
    bookingProvider: "calendly",
    bookingUrl: "https://calendly.com/acme/demo",
    primaryCtaMode: "booking",
  });

  assert.equal(result.bookingProvider, "calendly");
  assert.equal(result.bookingUrl, "https://calendly.com/acme/demo");
  assert.equal(result.fullPageConfig.bookingProvider, "calendly");
  assert.equal(state.widget_configs[0].booking_url, "https://calendly.com/acme/demo");
  assert.equal(state.widget_configs[0].full_page_config.booking_provider, "calendly");
});

test("updateAgentSettings rejects invalid Calendly booking provider URLs", async () => {
  const buildSupabase = () => createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        name: "Vonza",
        purpose: "support",
        system_prompt: "stay helpful",
        tone: "friendly",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Example",
        website_url: "https://example.com",
      },
    ],
    widget_configs: [
      {
        id: "widget-1",
        agent_id: "agent-1",
        assistant_name: "Vonza",
        welcome_message: "Hello there",
        button_label: "Chat now",
        primary_color: "#14b8a6",
        secondary_color: "#0f766e",
        launcher_text: "Chat now",
        theme_mode: "light",
      },
    ],
  });

  for (const bookingUrl of [
    "https://example.com/book",
    "http://calendly.com/acme/demo",
    "https://calendly.com.evil.example/acme/demo",
    "https://localhost/acme/demo",
  ]) {
    const { state, ...supabase } = buildSupabase();

    await assert.rejects(
      () =>
        updateAgentSettings(supabase, {
          agentId: "agent-1",
          bookingProvider: "calendly",
          bookingUrl,
        }),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /public https Calendly URL/i);
        return true;
      }
    );
    assert.equal(state.widget_configs[0].booking_url, undefined);
  }
});

test("updateAgentSettings keeps manual booking links working as before", async () => {
  const { state, ...supabase } = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        name: "Vonza",
        purpose: "support",
        system_prompt: "stay helpful",
        tone: "friendly",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Example",
        website_url: "https://example.com",
      },
    ],
    widget_configs: [
      {
        id: "widget-1",
        agent_id: "agent-1",
        assistant_name: "Vonza",
        welcome_message: "Hello there",
        button_label: "Chat now",
        primary_color: "#14b8a6",
        secondary_color: "#0f766e",
        launcher_text: "Chat now",
        theme_mode: "light",
      },
    ],
  });

  const result = await updateAgentSettings(supabase, {
    agentId: "agent-1",
    bookingProvider: "manual",
    bookingUrl: "https://book.example.com/consultation",
  });

  assert.equal(result.bookingProvider, "manual");
  assert.equal(result.bookingUrl, "https://book.example.com/consultation");
  assert.equal(state.widget_configs[0].booking_url, "https://book.example.com/consultation");
});

test("updateAgentSettings rejects routing saves when routing columns are unavailable", async () => {
  const { state, ...supabase } = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        name: "Vonza",
        purpose: "support",
        system_prompt: "stay helpful",
        tone: "friendly",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Example",
        website_url: "https://example.com",
      },
    ],
    widget_configs: [
      {
        id: "widget-1",
        agent_id: "agent-1",
        assistant_name: "Vonza",
        welcome_message: "Hello there",
        button_label: "Chat now",
        primary_color: "#14b8a6",
        secondary_color: "#0f766e",
        launcher_text: "Chat now",
        theme_mode: "light",
      },
    ],
    widgetRoutingUpsertError: {
      code: "42703",
      message: "column widget_configs.booking_start_url does not exist",
    },
  });

  await assert.rejects(
    () =>
      updateAgentSettings(supabase, {
        agentId: "agent-1",
        bookingStartUrl: "https://example.com/book/start",
      }),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.match(error.message, /routing settings could not be saved/i);
      return true;
    }
  );

  assert.equal(state.widget_configs[0].booking_start_url, undefined);
});

test("updateAgentSettings preserves omitted fields during partial updates", async () => {
  const { state, ...supabase } = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        name: "Vonza",
        purpose: "help",
        system_prompt: "old guidance",
        tone: "friendly",
        language: "English",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Vonza",
        website_url: null,
      },
    ],
    widget_configs: [
      {
        id: "widget-1",
        agent_id: "agent-1",
        assistant_name: "Vonza",
        welcome_message: "",
        button_label: "",
        primary_color: "",
        secondary_color: "",
        launcher_text: "Chat now",
        theme_mode: "light",
        allowed_domains: [],
      },
    ],
  });

  const result = await updateAgentSettings(supabase, {
    agentId: "agent-1",
    tone: "professional",
  });

  assert.equal(result.tone, "professional");
  assert.equal(result.welcomeMessage, "");
  assert.equal(result.buttonLabel, "");
  assert.equal(result.primaryColor, "");
  assert.equal(result.secondaryColor, "");
  assert.equal(result.websiteUrl, "");
  assert.equal(state.widget_configs[0].welcome_message, "");
  assert.equal(state.widget_configs[0].button_label, "");
  assert.equal(state.widget_configs[0].primary_color, "");
  assert.equal(state.widget_configs[0].secondary_color, "");
  assert.equal(state.businesses[0].website_url, null);
});

test("updateAgentSettings keeps unchanged values persisted and rejects invalid website URLs", async () => {
  const { state, ...supabase } = createSupabaseStub({
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        client_id: "client-1",
        owner_user_id: "owner-1",
        access_status: "active",
        public_agent_key: "agent-key",
        name: "Vonza",
        purpose: "help",
        system_prompt: "old guidance",
        tone: "friendly",
        language: "English",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Old Business",
        website_url: "https://example.com",
      },
    ],
    widget_configs: [
      {
        id: "widget-1",
        agent_id: "agent-1",
        assistant_name: "Vonza",
        welcome_message: "Hello there",
        button_label: "Chat now",
        primary_color: "#14b8a6",
        secondary_color: "#0f766e",
        launcher_text: "Chat now",
        theme_mode: "light",
      },
    ],
  });

  const unchangedResult = await updateAgentSettings(supabase, {
    agentId: "agent-1",
    assistantName: "Vonza",
    tone: "friendly",
    buttonLabel: "Chat now",
    websiteUrl: "https://example.com",
    welcomeMessage: "Hello there",
    systemPrompt: "old guidance",
    primaryColor: "#14b8a6",
    secondaryColor: "#0f766e",
  });

  assert.equal(unchangedResult.websiteUrl, "https://example.com/");
  assert.equal(unchangedResult.websiteSync.changed, false);
  assert.equal(state.agents[0].business_id, "business-1");
  assert.equal(state.widget_configs[0].assistant_name, "Vonza");

  await assert.rejects(
    () =>
      updateAgentSettings(supabase, {
        agentId: "agent-1",
        websiteUrl: "notaurl",
      }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /valid public https URL/i);
      return true;
    }
  );
});
