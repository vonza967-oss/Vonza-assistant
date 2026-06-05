(() => {
  const root = document.getElementById("erdp-setup-root");
  const statusRoot = document.getElementById("erdp-setup-status");
  const profileApi = window.VonzaEnterpriseRequestDeskProfiles;
  const profile = profileApi?.getProfile ? profileApi.getProfile() : null;
  if (profileApi?.applyDocumentProfile && profile) {
    profileApi.applyDocumentProfile(profile);
    document.title = profile.setup?.title || profile.productName;
    const heading = document.querySelector(".erdp-setup-copy h1");
    if (heading) {
      heading.textContent = profile.setup?.heading || heading.textContent;
    }
    const intro = document.querySelector(".erdp-setup-copy > p");
    if (intro) {
      intro.textContent = profile.setup?.intro || intro.textContent;
    }
  }

  let authClient = null;
  let authSession = null;
  let authUser = null;
  let currentSetup = null;
  let currentCustomerIntake = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function trimText(value) {
    return String(value ?? "").trim();
  }

  function setStatus(message = "") {
    if (statusRoot) {
      statusRoot.textContent = message;
    }
  }

  function getApiPrefix() {
    return window.location.pathname.startsWith("/esg-request-desk")
      ? "/esg-request-desk"
      : "/enterprise-request-desk";
  }

  function hasAuthConfig() {
    return Boolean(window.VONZA_SUPABASE_URL && window.VONZA_SUPABASE_ANON_KEY && window.supabase?.createClient);
  }

  function createAuthClientIfNeeded() {
    if (authClient || !hasAuthConfig()) {
      return authClient;
    }

    authClient = window.supabase.createClient(
      window.VONZA_SUPABASE_URL,
      window.VONZA_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          detectSessionInUrl: true,
        },
      }
    );

    authClient.auth.onAuthStateChange((_event, session) => {
      authSession = session || null;
      authUser = authSession?.user || null;
      if (authUser) {
        loadSetup();
      }
    });

    return authClient;
  }

  async function ensureAuthSession() {
    const client = createAuthClientIfNeeded();

    if (!client) {
      return null;
    }

    const { data, error } = await client.auth.getSession();
    if (error) {
      throw error;
    }

    authSession = data?.session?.access_token ? data.session : null;
    authUser = authSession?.user || null;
    return authSession;
  }

  function getAuthHeaders(headers = {}) {
    return {
      ...headers,
      ...(authSession?.access_token ? { Authorization: `Bearer ${authSession.access_token}` } : {}),
    };
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: getAuthHeaders(options.headers || {}),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(data?.error || "A kérés nem sikerült.");
      error.code = data?.code || "";
      throw error;
    }

    return data;
  }

  function renderAuthUnavailable() {
    root.innerHTML = `
      <section class="erdp-empty">
        <h2>A Supabase Auth nincs beállítva</h2>
        <p>A ${escapeHtml(profile?.productName || "Enterprise Request Desk")} setup oldal betöltött, de élő hozzáféréshez publikus Supabase URL és anon kulcs szükséges.</p>
      </section>
    `;
  }

  function renderAuthGate(message = "") {
    root.innerHTML = `
      <section class="erdp-auth-card" aria-label="${escapeHtml(profile?.productName || "Enterprise Request Desk")} hozzáférés">
        <div>
          <h2>${escapeHtml(profile?.productName || "Enterprise Request Desk")} hozzáférés</h2>
          <p>Jelentkezz be, hozz létre fiókot, vagy kérj varázslinket. A setup csak bejelentkezett tulajdonosi session alatt menthető.</p>
          ${message ? `<p>${escapeHtml(message)}</p>` : ""}
        </div>
        <form class="erdp-auth-form" data-erdp-auth-form>
          <label class="erdp-field">
            Email
            <input type="email" name="email" autocomplete="email" required>
          </label>
          <label class="erdp-field">
            Jelszó
            <input type="password" name="password" autocomplete="current-password">
          </label>
          <div class="erdp-auth-actions">
            <button class="erdp-button erdp-button-primary" type="submit" data-erdp-auth-mode="password">Belépés</button>
            <button class="erdp-button" type="submit" data-erdp-auth-mode="signup">Fiók létrehozása</button>
            <button class="erdp-button" type="button" data-erdp-auth-mode="magic">Varázslink küldése</button>
          </div>
        </form>
      </section>
    `;
  }

  function renderCustomerIntakeGuidance() {
    if (!currentSetup) {
      return "";
    }

    const intake = currentCustomerIntake || {};
    const path = trimText(intake.path);
    const aliasPath = trimText(intake.aliasPath);

    if (intake.available && path) {
      return `
        <div class="erdp-customer-link" aria-label="${escapeHtml(profile?.productName || "Enterprise Request Desk")} ügyféloldali intake link">
          <strong>Ügyféloldali intake link</strong>
          <p>${escapeHtml(intake.guidanceHu || "Ezt a linket add meg a vállalati megkeresések belépési pontjaként.")}</p>
          <code>${escapeHtml(path)}</code>
          <div class="erdp-link-actions">
            <a class="erdp-button" href="${escapeHtml(path)}" target="_blank" rel="noreferrer">Megnyitás</a>
            <button class="erdp-button" type="button" data-erdp-copy-intake-link="${escapeHtml(path)}">Másolás</button>
          </div>
          ${aliasPath ? `<small>Alias: ${escapeHtml(aliasPath)}</small>` : ""}
        </div>
      `;
    }

    return `
      <div class="erdp-customer-link erdp-customer-link-muted" aria-label="${escapeHtml(profile?.productName || "Enterprise Request Desk")} intake link előfeltétel">
        <strong>Ügyféloldali intake link</strong>
        <p>${escapeHtml(intake.guidanceHu || "Aktív public agent kulcs szükséges, mielőtt az ügyféloldali intake link használható.")}</p>
        <code>${escapeHtml(getApiPrefix())}/intake?agent_key=&lt;public_agent_key&gt;</code>
      </div>
    `;
  }

  function renderSetupForm() {
    const serviceLines = Array.isArray(currentSetup?.serviceLines)
      ? currentSetup.serviceLines.join("\n")
      : "";

    root.innerHTML = `
      <div class="erdp-account-row">
        <span>Bejelentkezve: ${escapeHtml(authUser?.email || "tulajdonosi fiók")}</span>
        <button class="erdp-button" type="button" data-erdp-sign-out>Kilépés</button>
      </div>
      <section class="erdp-setup-card" aria-label="${escapeHtml(profile?.productName || "Enterprise Request Desk")} setup űrlap">
        <h2>${escapeHtml(profile?.setup?.formTitle || "Szervezet és feldolgozási alapok")}</h2>
        <p>${escapeHtml(profile?.setup?.formIntro || "A mentett setup alapján válik egyértelművé, melyik szervezethez és szolgáltatási területhez tartozik a beérkező megkeresés.")}</p>
        ${renderCustomerIntakeGuidance()}
        <form data-erdp-setup-form>
          <div class="erdp-form-grid">
            <label class="erdp-field">
              Szervezet neve
              <input name="organization_name" value="${escapeHtml(currentSetup?.organizationName || "")}" autocomplete="organization" required>
            </label>
            <label class="erdp-field">
              Weboldal URL
              <input name="website_url" value="${escapeHtml(currentSetup?.websiteUrl || "")}" inputmode="url" autocomplete="url" placeholder="https://pelda.hu" required>
            </label>
            <label class="erdp-field">
              Szolgáltatási terület
              <input name="service_area" value="${escapeHtml(currentSetup?.serviceArea || "")}" placeholder="pl. Budapest, irodaházak, telephelyek vagy országos helyszínek" required>
            </label>
            <label class="erdp-field">
              Belső továbbítás
              <select name="routing_preference" required>
                ${[
                  ["internal_handoff", "Belső feldolgozás a dashboardban"],
                  ["email_triage", "Email alapú előszűrés"],
                  ["phone_followup", "Telefonos visszahívás előkészítése"],
                ].map(([value, label]) => `
                  <option value="${escapeHtml(value)}" ${currentSetup?.routingPreference === value ? "selected" : ""}>${escapeHtml(label)}</option>
                `).join("")}
              </select>
            </label>
            <label class="erdp-field erdp-field-wide">
              Intake pozicionálás
              <textarea name="intake_positioning" placeholder="${escapeHtml(profile?.setup?.intakePositioningDefault || "Vállalati objektumvédelmi, FM és biztonságtechnikai megkeresések előszűrése belső feldolgozáshoz.")}">${escapeHtml(currentSetup?.intakePositioning || profile?.setup?.intakePositioningDefault || "Vállalati objektumvédelmi, FM és biztonságtechnikai megkeresések előszűrése belső feldolgozáshoz.")}</textarea>
            </label>
            <label class="erdp-field">
              Tulajdonosi email
              <input name="owner_contact_email" type="email" value="${escapeHtml(currentSetup?.ownerContactEmail || authUser?.email || "")}" autocomplete="email" required>
            </label>
            <label class="erdp-field erdp-field-wide">
              Szolgáltatási vonalak
              <textarea name="service_lines" placeholder="${escapeHtml(profile?.setup?.serviceLinesPlaceholder || "Egy szolgáltatási vonal soronként")}" required>${escapeHtml(serviceLines)}</textarea>
              <small>${escapeHtml(profile?.setup?.serviceLinesHelp || "Őrzés-védelem, portaszolgálat, objektumvédelem, Facility Management, biztonságtechnika vagy hatósági/audit jellegű sorok.")}</small>
            </label>
          </div>
          <div class="erdp-form-actions">
            <button class="erdp-button erdp-button-primary" type="submit">Setup mentése</button>
            <a class="erdp-button" href="${escapeHtml(getApiPrefix())}/dashboard">Megkeresések</a>
          </div>
        </form>
      </section>
    `;
  }

  function readSetupForm(form) {
    const formData = new FormData(form);
    return {
      organization_name: trimText(formData.get("organization_name")),
      website_url: trimText(formData.get("website_url")),
      service_area: trimText(formData.get("service_area")),
      service_lines: trimText(formData.get("service_lines"))
        .split(/\n+/)
        .map((item) => trimText(item))
        .filter(Boolean),
      intake_positioning: trimText(formData.get("intake_positioning")),
      routing_preference: trimText(formData.get("routing_preference")),
      owner_contact_email: trimText(formData.get("owner_contact_email")),
    };
  }

  async function loadSetup() {
    setStatus(`${profile?.productName || "Enterprise Request Desk"} setup állapot betöltése...`);
    try {
      const data = await fetchJson(`${getApiPrefix()}/setup-state`);
      currentSetup = data.setup || null;
      currentCustomerIntake = data.customerIntake || null;
      setStatus(currentSetup ? "Meglévő setup betöltve." : "Setup még nincs mentve.");
      renderSetupForm();
    } catch (error) {
      if (error.code === "enterprise_request_desk_setup_table_missing") {
        root.innerHTML = `
          <section class="erdp-empty">
            <h2>Setup migráció szükséges</h2>
            <p>${escapeHtml(error.message)}</p>
          </section>
        `;
        setStatus("Setup tábla hiányzik.");
        return;
      }
      renderAuthGate(error.message);
      setStatus("Setup állapot nem tölthető be.");
    }
  }

  async function handleAuth(event) {
    const form = event.target.closest("[data-erdp-auth-form]");
    if (!form) {
      return;
    }

    event.preventDefault();
    const client = createAuthClientIfNeeded();
    if (!client) {
      renderAuthUnavailable();
      return;
    }

    const submitter = event.submitter;
    const mode = submitter?.dataset.erdpAuthMode || "password";
    const email = trimText(new FormData(form).get("email"));
    const password = String(new FormData(form).get("password") || "");
    const setupUrl = `${window.location.origin}${getApiPrefix()}/setup`;

    try {
      setStatus(mode === "magic" ? "Varázslink küldése..." : "Auth folyamat...");
      if (mode === "magic") {
        const { error } = await client.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: setupUrl,
          },
        });
        if (error) throw error;
        setStatus("Varázslink elküldve, ellenőrizd az emailed.");
        return;
      }

      if (!password) {
        throw new Error("Jelszó szükséges ehhez a művelethez, vagy használj varázslinket.");
      }

      const authCall = mode === "signup"
        ? client.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: setupUrl,
            },
          })
        : client.auth.signInWithPassword({ email, password });
      const { data, error } = await authCall;
      if (error) throw error;

      authSession = data?.session || authSession;
      authUser = data?.user || authSession?.user || null;
      if (!authSession && mode === "signup") {
        setStatus("Fiók létrehozva. Ha email megerősítés szükséges, nyisd meg a megerősítő linket.");
        return;
      }
      await loadSetup();
    } catch (error) {
      setStatus(error.message || "Auth hiba.");
    }
  }

  async function handleSetupSubmit(event) {
    const form = event.target.closest("[data-erdp-setup-form]");
    if (!form) {
      return;
    }

    event.preventDefault();
    const button = event.submitter;
    if (button) {
      button.disabled = true;
    }

    try {
      setStatus(`${profile?.productName || "Enterprise Request Desk"} setup mentése...`);
      const data = await fetchJson(`${getApiPrefix()}/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(readSetupForm(form)),
      });
      currentSetup = data.setup || null;
      currentCustomerIntake = data.customerIntake || null;
      setStatus("Setup mentve. Megkereséslista megnyitása...");
      window.location.assign(data.nextUrl || `${getApiPrefix()}/dashboard`);
    } catch (error) {
      setStatus(error.message || "Setup mentése nem sikerült.");
    } finally {
      if (button) {
        button.disabled = false;
      }
    }
  }

  async function copyIntakeLink(button) {
    const path = trimText(button.dataset.erdpCopyIntakeLink);
    if (!path) {
      return;
    }

    const absoluteUrl = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setStatus("Ügyféloldali intake link másolva.");
    } catch {
      setStatus(absoluteUrl);
    }
  }

  async function handleClick(event) {
    const magicButton = event.target.closest("[data-erdp-auth-mode='magic']");
    if (magicButton) {
      event.preventDefault();
      const form = magicButton.closest("[data-erdp-auth-form]");
      if (form) {
        await handleAuth({ target: form, preventDefault() {}, submitter: magicButton });
      }
      return;
    }

    const signOutButton = event.target.closest("[data-erdp-sign-out]");
    if (signOutButton) {
      event.preventDefault();
      const client = createAuthClientIfNeeded();
      if (client) {
        await client.auth.signOut();
      }
      authSession = null;
      authUser = null;
      currentSetup = null;
      currentCustomerIntake = null;
      setStatus("Kijelentkezve.");
      renderAuthGate();
      return;
    }

    const copyIntakeButton = event.target.closest("[data-erdp-copy-intake-link]");
    if (copyIntakeButton) {
      event.preventDefault();
      await copyIntakeLink(copyIntakeButton);
    }
  }

  async function init() {
    if (!root) {
      return;
    }

    if (!hasAuthConfig()) {
      renderAuthUnavailable();
      return;
    }

    try {
      const session = await ensureAuthSession();
      if (!session) {
        renderAuthGate();
        setStatus(`${profile?.productName || "Enterprise Request Desk"} hozzáféréshez jelentkezz be vagy indíts fiókot.`);
        return;
      }
      await loadSetup();
    } catch (error) {
      renderAuthGate(error.message);
      setStatus("Auth session nem tölthető be.");
    }
  }

  document.addEventListener("submit", (event) => {
    if (event.target.closest("[data-erdp-auth-form]")) {
      handleAuth(event);
      return;
    }
    handleSetupSubmit(event);
  });
  document.addEventListener("click", (event) => {
    handleClick(event);
  });

  init();
})();
