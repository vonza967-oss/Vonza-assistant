(() => {
  const root = document.getElementById("qdh-setup-root");
  const statusRoot = document.getElementById("qdh-setup-status");

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
      <section class="qdh-setup-empty">
        <h2>A Supabase Auth nincs beállítva</h2>
        <p>A QDH setup oldal elérhető, de élő hozzáféréshez publikus Supabase URL és anon kulcs szükséges.</p>
      </section>
    `;
  }

  function renderAuthGate(message = "") {
    root.innerHTML = `
      <section class="qdh-auth-card" aria-label="QDH hozzáférés">
        <h2>QDH fiókhozzáférés</h2>
        <p>Jelentkezz be vagy indíts hozzáférést a meglévő Supabase auth folyamaton keresztül. A setup csak bejelentkezett tulajdonoshoz menthető.</p>
        ${message ? `<p>${escapeHtml(message)}</p>` : ""}
        <form class="qdh-auth-form" data-qdh-auth-form>
          <label>
            Email
            <input type="email" name="email" autocomplete="email" required>
          </label>
          <label>
            Jelszó
            <input type="password" name="password" autocomplete="current-password">
          </label>
          <div class="qdh-auth-actions">
            <button class="qdh-button qdh-button-primary" type="submit" data-qdh-auth-mode="password">Belépés</button>
            <button class="qdh-button" type="submit" data-qdh-auth-mode="signup">Fiók létrehozása</button>
            <button class="qdh-button" type="button" data-qdh-auth-mode="magic">Varázslink küldése</button>
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
        <div class="qdh-setup-customer-link" aria-label="QDH ügyféloldali intake link">
          <strong>Weboldali “Kérjen ajánlatot” link</strong>
          <p>${escapeHtml(intake.guidanceHu || "Ezt a linket tedd a weboldal ajánlatkérő gombja mögé.")}</p>
          <code>${escapeHtml(path)}</code>
          <div>
            <a class="qdh-button" href="${escapeHtml(path)}" target="_blank" rel="noreferrer">Megnyitás</a>
            <button class="qdh-button" type="button" data-qdh-copy-intake-link="${escapeHtml(path)}">Másolás</button>
          </div>
          ${aliasPath ? `<small>Alias: ${escapeHtml(aliasPath)}</small>` : ""}
        </div>
      `;
    }

    return `
      <div class="qdh-setup-customer-link qdh-setup-customer-link-muted" aria-label="QDH ügyféloldali intake link előfeltétel">
        <strong>Ügyféloldali intake link</strong>
        <p>${escapeHtml(intake.guidanceHu || "Aktív public agent kulcs szükséges, mielőtt a QDH ügyféloldali ajánlatkérő link használható.")}</p>
        <code>/qdh/intake?agent_key=&lt;public_agent_key&gt;</code>
      </div>
    `;
  }

  function renderSetupForm() {
    const servicesOffered = Array.isArray(currentSetup?.servicesOffered)
      ? currentSetup.servicesOffered.join("\n")
      : "";

    root.innerHTML = `
      <div class="qdh-account-row">
        <span>${escapeHtml(authUser?.email || "Bejelentkezett QDH tulajdonos")}</span>
        <button class="qdh-button" type="button" data-qdh-sign-out>Kilépés</button>
      </div>
      <section class="qdh-setup-card" aria-label="QDH setup űrlap">
        <h2>Vállalkozás és ajánlatkérési alapok</h2>
        <p>A QDH ebben a fázisban setup-readiness rekordot ment. A publikus assistant telepítése és üzleti konfiguráció élesítése továbbra is külön deploy/config lépés.</p>
        ${renderCustomerIntakeGuidance()}
        <form data-qdh-setup-form>
          <div class="qdh-form-grid">
            <label class="qdh-field">
              Vállalkozás neve
              <input name="business_name" value="${escapeHtml(currentSetup?.businessName || "")}" autocomplete="organization" required>
            </label>
            <label class="qdh-field">
              Weboldal URL
              <input name="website_url" value="${escapeHtml(currentSetup?.websiteUrl || "")}" inputmode="url" autocomplete="url" placeholder="https://pelda.hu" required>
            </label>
            <label class="qdh-field">
              Szolgáltatási típus
              <input name="service_type" value="${escapeHtml(currentSetup?.serviceType || "")}" placeholder="pl. tetőfedés, klíma, webstúdió" required>
            </label>
            <label class="qdh-field">
              Város / szolgáltatási terület
              <input name="service_area" value="${escapeHtml(currentSetup?.serviceArea || "")}" placeholder="pl. Budapest és Pest megye" required>
            </label>
            <label class="qdh-field">
              Ajánlatkérés kezelése
              <select name="handling_preference" required>
                ${[
                  ["staff_review", "Staff review a QDH dashboardban"],
                  ["email_review", "Tulajdonosi email review"],
                  ["phone_review", "Telefonos visszahívás előkészítése"],
                ].map(([value, label]) => `
                  <option value="${escapeHtml(value)}" ${currentSetup?.handlingPreference === value ? "selected" : ""}>${escapeHtml(label)}</option>
                `).join("")}
              </select>
            </label>
            <label class="qdh-field">
              Tulajdonosi email
              <input name="owner_contact_email" type="email" value="${escapeHtml(currentSetup?.ownerContactEmail || authUser?.email || "")}" autocomplete="email" required>
            </label>
            <label class="qdh-field qdh-field-wide">
              Alap szolgáltatások
              <textarea name="services_offered" placeholder="Egy szolgáltatás soronként" required>${escapeHtml(servicesOffered)}</textarea>
              <small>Csak intake és review célra mentjük. Ez nem árlista és nem automatikus ajánlatképzés.</small>
            </label>
          </div>
          <div class="qdh-form-actions">
            <button class="qdh-button qdh-button-primary" type="submit">Setup mentése</button>
            <a class="qdh-button" href="/qdh/dashboard">QDH dashboard</a>
          </div>
        </form>
      </section>
    `;
  }

  function readSetupForm(form) {
    const formData = new FormData(form);
    return {
      business_name: trimText(formData.get("business_name")),
      website_url: trimText(formData.get("website_url")),
      service_type: trimText(formData.get("service_type")),
      service_area: trimText(formData.get("service_area")),
      handling_preference: trimText(formData.get("handling_preference")),
      owner_contact_email: trimText(formData.get("owner_contact_email")),
      services_offered: trimText(formData.get("services_offered"))
        .split(/\n+/)
        .map((item) => trimText(item))
        .filter(Boolean),
    };
  }

  async function loadSetup() {
    setStatus("QDH setup állapot betöltése...");
    try {
      const data = await fetchJson("/quote-desk-hu/setup-state");
      currentSetup = data.setup || null;
      currentCustomerIntake = data.customerIntake || null;
      setStatus(currentSetup ? "Meglévő QDH setup betöltve." : "QDH setup még nincs mentve.");
      renderSetupForm();
    } catch (error) {
      if (error.code === "qdh_setup_table_missing") {
        root.innerHTML = `
          <section class="qdh-setup-empty">
            <h2>QDH setup migráció szükséges</h2>
            <p>${escapeHtml(error.message)}</p>
          </section>
        `;
        setStatus("QDH setup tábla hiányzik.");
        return;
      }
      renderAuthGate(error.message);
      setStatus("QDH setup állapot nem tölthető be.");
    }
  }

  async function handleAuth(event) {
    const form = event.target.closest("[data-qdh-auth-form]");
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
    const mode = submitter?.dataset.qdhAuthMode || "password";
    const email = trimText(new FormData(form).get("email"));
    const password = String(new FormData(form).get("password") || "");

    try {
      setStatus(mode === "magic" ? "Varázslink küldése..." : "Auth folyamat...");
      if (mode === "magic") {
        const { error } = await client.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/qdh/setup`,
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
              emailRedirectTo: `${window.location.origin}/qdh/setup`,
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
    const form = event.target.closest("[data-qdh-setup-form]");
    if (!form) {
      return;
    }

    event.preventDefault();
    const button = event.submitter;
    if (button) {
      button.disabled = true;
    }

    try {
      setStatus("QDH setup mentése...");
      const data = await fetchJson("/quote-desk-hu/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(readSetupForm(form)),
      });
      currentSetup = data.setup || null;
      currentCustomerIntake = data.customerIntake || null;
      setStatus("QDH setup mentve. Dashboard megnyitása...");
      window.location.assign(data.nextUrl || "/qdh/dashboard");
    } catch (error) {
      setStatus(error.message || "QDH setup mentése nem sikerült.");
    } finally {
      if (button) {
        button.disabled = false;
      }
    }
  }

  async function handleClick(event) {
    const magicButton = event.target.closest("[data-qdh-auth-mode='magic']");
    if (magicButton) {
      event.preventDefault();
      const form = magicButton.closest("[data-qdh-auth-form]");
      if (form) {
        await handleAuth({ target: form, preventDefault() {}, submitter: magicButton });
      }
      return;
    }

    const signOutButton = event.target.closest("[data-qdh-sign-out]");
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

    const copyIntakeButton = event.target.closest("[data-qdh-copy-intake-link]");
    if (copyIntakeButton) {
      event.preventDefault();
      await copyIntakeLink(copyIntakeButton);
    }
  }

  async function copyIntakeLink(button) {
    const path = trimText(button.dataset.qdhCopyIntakeLink);
    if (!path) {
      return;
    }

    const absoluteUrl = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setStatus("QDH ügyfél link másolva.");
    } catch {
      setStatus(absoluteUrl);
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
        setStatus("QDH hozzáféréshez jelentkezz be vagy indíts fiókot.");
        return;
      }
      await loadSetup();
    } catch (error) {
      renderAuthGate(error.message);
      setStatus("QDH auth session nem tölthető be.");
    }
  }

  document.addEventListener("submit", (event) => {
    if (event.target.closest("[data-qdh-auth-form]")) {
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
