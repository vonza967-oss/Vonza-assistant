(function registerVonzaDashboardHelpers(global) {
  function trimText(value) {
    return String(value || "").trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeBillingPlanKey(value, plans = [], fallback = "growth") {
    const normalized = trimText(value).toLowerCase();
    return plans.some((plan) => plan?.key === normalized) ? normalized : fallback;
  }

  function formatPercent(value) {
    return `${Math.round(Number(value || 0))}%`;
  }

  function formatBillingDate(value) {
    if (!trimText(value)) {
      return "Not available yet";
    }

    const timestamp = new Date(value).getTime();

    if (!Number.isFinite(timestamp)) {
      return "Not available yet";
    }

    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function getDashboardApiErrorMessage(data, fallback = "Something went wrong.") {
    const normalizeMessage = (value) => {
      if (typeof value === "string") {
        return trimText(value);
      }

      if (value && typeof value === "object") {
        if (typeof value.message === "string") {
          return trimText(value.message);
        }

        if (typeof value.error === "string") {
          return trimText(value.error);
        }
      }

      return "";
    };
    const directMessage = normalizeMessage(data)
      || normalizeMessage(data?.error)
      || normalizeMessage(data?.message);

    if (directMessage) {
      return directMessage;
    }

    if (Array.isArray(data?.errors)) {
      for (const error of data.errors) {
        const itemMessage = normalizeMessage(error);

        if (itemMessage) {
          return itemMessage;
        }
      }
    }

    return trimText(fallback) || "Something went wrong.";
  }

  async function runDashboardMutation({
    button = null,
    controls = [],
    loadingText = "",
    successText = "",
    errorText = "Something went wrong.",
    setStatus = () => {},
    mutation,
    onLoading,
    onSuccess,
    onError,
    onFinally,
  } = {}) {
    if (typeof mutation !== "function") {
      throw new TypeError("runDashboardMutation requires a mutation function.");
    }

    const disabledControls = [button, ...controls].filter(Boolean);
    disabledControls.forEach((control) => {
      control.disabled = true;
    });

    if (typeof onLoading === "function") {
      onLoading();
    }

    if (loadingText) {
      setStatus(loadingText);
    }

    try {
      const data = await mutation();

      if (successText) {
        setStatus(successText);
      }

      if (typeof onSuccess === "function") {
        await onSuccess(data);
      }

      return { ok: true, data };
    } catch (error) {
      const message = getDashboardApiErrorMessage(error, errorText);

      if (message) {
        setStatus(message);
      }

      if (typeof onError === "function") {
        await onError(error, message);
      }

      return { ok: false, error, message };
    } finally {
      disabledControls.forEach((control) => {
        control.disabled = false;
      });

      if (typeof onFinally === "function") {
        await onFinally();
      }
    }
  }

  function bindDashboardLanguagePreferenceForms(forms, dependencies = {}) {
    const formList = Array.from(forms || []);
    const normalizeLanguage = typeof dependencies.normalizeDashboardLanguage === "function"
      ? dependencies.normalizeDashboardLanguage
      : (value) => trimText(value).toLowerCase() || "hu";
    const translate = typeof dependencies.translate === "function"
      ? dependencies.translate
      : (key) => key;
    const setStatus = typeof dependencies.setStatus === "function"
      ? dependencies.setStatus
      : () => {};
    const saveDashboardLanguage = typeof dependencies.saveDashboardLanguage === "function"
      ? dependencies.saveDashboardLanguage
      : async () => {};
    const renderWorkspaceFromState = typeof dependencies.renderWorkspaceFromState === "function"
      ? dependencies.renderWorkspaceFromState
      : () => {};
    const runMutation = typeof dependencies.runDashboardMutation === "function"
      ? dependencies.runDashboardMutation
      : runDashboardMutation;

    formList.forEach((form) => {
      const saveState = form.querySelector("[data-save-state]");
      const select = form.querySelector('select[name="dashboard_language"]');
      const submitButton = form.querySelector('button[type="submit"]');
      const initialLanguage = normalizeLanguage(select?.value);

      form.addEventListener("change", () => {
        if (!saveState || !select) {
          return;
        }

        const hasChanged = normalizeLanguage(select.value) !== initialLanguage;
        saveState.textContent = hasChanged ? translate("language.unsaved") : translate("language.noChanges");
        saveState.className = hasChanged ? "save-state unsaved" : "save-state";
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const nextLanguage = normalizeLanguage(select?.value);

        const result = await runMutation({
          button: submitButton,
          loadingText: translate("language.saving"),
          successText: translate("language.settingsSaved"),
          errorText: translate("language.settingsError"),
          setStatus,
          mutation: () => saveDashboardLanguage(nextLanguage),
          onLoading: () => {
            if (saveState) {
              saveState.textContent = translate("language.saving");
              saveState.className = "save-state saving";
              saveState.removeAttribute("title");
            }
          },
          onSuccess: () => {
            if (saveState) {
              saveState.textContent = translate("language.settingsSaved");
              saveState.className = "save-state saved";
              saveState.removeAttribute("title");
            }
            renderWorkspaceFromState();
          },
          onError: (_error, message) => {
            if (saveState) {
              saveState.textContent = translate("language.settingsError");
              saveState.className = "save-state unsaved";
              saveState.title = message;
            }
          },
        });

        return result;
      });
    });
  }

  global.VonzaDashboardHelpers = Object.freeze({
    escapeHtml,
    trimText,
    normalizeBillingPlanKey,
    formatPercent,
    formatBillingDate,
    getDashboardApiErrorMessage,
    runDashboardMutation,
    bindDashboardLanguagePreferenceForms,
  });
})(window);
