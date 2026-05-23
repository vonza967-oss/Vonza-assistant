import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import express from "express";

import { createAgentRouter } from "../src/routes/agentRoutes.js";
import { clearRateLimitForTests } from "../src/utils/rateLimiter.js";

function createSupabaseStub() {
  const state = {
    agents: [
      {
        id: "agent-1",
        business_id: "business-1",
        public_agent_key: "agent-key",
        name: "Vonza",
        is_active: true,
      },
    ],
    businesses: [
      {
        id: "business-1",
        name: "Example Co",
        website_url: "https://example.com",
      },
    ],
    widget_configs: [
      {
        id: "widget-1",
        agent_id: "agent-1",
        install_id: "11111111-1111-1111-1111-111111111111",
        allowed_domains: ["example.com"],
        booking_url: "https://example.com/book",
        booking_start_url: "https://example.com/book/start",
        booking_success_url: "https://example.com/book/thanks",
        quote_url: "https://example.com/quote",
        checkout_url: "https://example.com/checkout",
        contact_email: "team@example.com",
        contact_phone: "+1 206 555 0199",
      },
    ],
    agent_contact_leads: [],
    agent_conversion_outcomes: [],
    agent_action_queue_statuses: [],
  };

  class QueryBuilder {
    constructor(table) {
      this.table = table;
      this.operation = "select";
      this.filters = [];
      this.values = null;
      this.limitCount = null;
    }

    select() {
      return this;
    }

    eq(column, value) {
      this.filters.push((row) => row[column] === value);
      return this;
    }

    in(column, values) {
      const lookup = new Set(values);
      this.filters.push((row) => lookup.has(row[column]));
      return this;
    }

    order() {
      return this;
    }

    limit(count) {
      this.limitCount = count;
      return this;
    }

    insert(values) {
      this.operation = "insert";
      this.values = values;
      return this;
    }

    update(values) {
      this.operation = "update";
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

    #rows() {
      return state[this.table] || [];
    }

    #matches() {
      let rows = this.#rows().filter((row) => this.filters.every((filter) => filter(row)));

      if (this.limitCount !== null) {
        rows = rows.slice(0, this.limitCount);
      }

      return rows;
    }

    #executeSingle() {
      const result = this.#execute();
      const rows = Array.isArray(result.data) ? result.data : [];
      return {
        data: rows[0] ? { ...rows[0] } : null,
        error: result.error || null,
      };
    }

    #execute() {
      if (this.operation === "select") {
        return {
          data: this.#matches().map((row) => ({ ...row })),
          error: null,
        };
      }

      if (this.operation === "insert") {
        const values = Array.isArray(this.values) ? this.values : [this.values];
        const rows = this.#rows();
        const inserted = values.map((value, index) => ({
          id: value.id || `${this.table}-${rows.length + index + 1}`,
          ...value,
        }));
        rows.push(...inserted);

        return {
          data: inserted.map((row) => ({ ...row })),
          error: null,
        };
      }

      if (this.operation === "update") {
        const matches = this.#matches();
        matches.forEach((row) => Object.assign(row, this.values));
        return {
          data: matches.map((row) => ({ ...row })),
          error: null,
        };
      }

      throw new Error(`Unsupported operation ${this.operation}`);
    }
  }

  return {
    from(table) {
      return new QueryBuilder(table);
    },
    state,
  };
}

function createApp(supabase) {
  const app = express();
  app.use(express.json());
  app.use(createAgentRouter({
    getSupabaseClient: () => supabase,
    getOpenAIClient: () => ({}),
    limitWidgetBootstrap: (_req, _res, next) => next(),
    limitPublicInstallSignal: (_req, _res, next) => next(),
    limitAuthAdjacent: (_req, _res, next) => next(),
    limitInstallVerify: (_req, _res, next) => next(),
  }));
  return app;
}

async function startServer(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

test("/install/cta accepts configured booking_url and records booking_started", async () => {
  const supabase = createSupabaseStub();
  const server = await startServer(createApp(supabase));

  try {
    const response = await fetch(`${server.baseUrl}/install/cta?install_id=11111111-1111-1111-1111-111111111111&session_id=session-1&cta_type=booking&target_type=url&target_url=${encodeURIComponent("https://example.com/book")}`, {
      redirect: "manual",
    });

    assert.equal(response.status, 302);
    assert.match(response.headers.get("location") || "", /^https:\/\/example\.com\/book\?/);
    assert.equal(supabase.state.agent_conversion_outcomes.length, 1);
    assert.equal(supabase.state.agent_conversion_outcomes[0].outcome_type, "booking_started");
  } finally {
    await server.close();
  }
});

test("/install/cta rejects external mismatched target_url without recording a click", async () => {
  const supabase = createSupabaseStub();
  const server = await startServer(createApp(supabase));

  try {
    const response = await fetch(`${server.baseUrl}/install/cta?install_id=11111111-1111-1111-1111-111111111111&session_id=session-1&cta_type=booking&target_type=url&target_url=${encodeURIComponent("https://evil.example/book")}`, {
      redirect: "manual",
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "CTA target is not configured for this install.");
    assert.equal(supabase.state.agent_conversion_outcomes.length, 0);
  } finally {
    await server.close();
  }
});

test("/install/cta preserves valid vz_cta_event_id redirect behavior", async () => {
  const supabase = createSupabaseStub();
  const server = await startServer(createApp(supabase));
  const ctaEventId = "99999999-9999-4999-8999-999999999999";

  try {
    const response = await fetch(`${server.baseUrl}/install/cta?install_id=11111111-1111-1111-1111-111111111111&session_id=session-1&cta_type=booking&target_type=url&target_url=${encodeURIComponent("https://example.com/book")}&vz_cta_event_id=${ctaEventId}`, {
      redirect: "manual",
    });
    const location = new URL(response.headers.get("location") || "");

    assert.equal(response.status, 302);
    assert.equal(location.searchParams.get("vz_cta_event_id"), ctaEventId);
    assert.equal(supabase.state.agent_conversion_outcomes[0].cta_event_id, ctaEventId);
  } finally {
    await server.close();
  }
});

test("/install/outcomes/detect rejects arbitrary explicit confirmation without trust", async () => {
  const supabase = createSupabaseStub();
  const server = await startServer(createApp(supabase));

  try {
    const response = await fetch(`${server.baseUrl}/install/outcomes/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        install_id: "11111111-1111-1111-1111-111111111111",
        session_id: "session-1",
        page_url: "https://example.com/pricing",
        outcome_type: "booking_confirmed",
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Public outcome confirmation requires a configured success URL or a valid CTA event.");
    assert.equal(supabase.state.agent_conversion_outcomes.length, 0);
  } finally {
    await server.close();
  }
});

test("/install/cta rate limits repeated configured target clicks from the same client", async () => {
  clearRateLimitForTests();
  const supabase = createSupabaseStub();
  const server = await startServer(createApp(supabase));
  const url = `${server.baseUrl}/install/cta?install_id=11111111-1111-1111-1111-111111111111&session_id=session-rate-limit&cta_type=booking&target_type=url&target_url=${encodeURIComponent("https://example.com/book")}`;

  try {
    for (let index = 0; index < 20; index += 1) {
      const response = await fetch(url, { redirect: "manual" });
      assert.equal(response.status, 302);
    }

    const limited = await fetch(url, { redirect: "manual" });
    const body = await limited.json();

    assert.equal(limited.status, 429);
    assert.equal(body.error, "Too many requests. Please wait a moment and try again.");
    assert.equal(limited.headers.get("ratelimit-limit"), "20");
    assert.equal(supabase.state.agent_conversion_outcomes.length, 20);
  } finally {
    await server.close();
    clearRateLimitForTests();
  }
});
