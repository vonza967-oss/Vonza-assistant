const form = document.querySelector("#waitlist-form");
const statusNode = document.querySelector("#form-status");
const successDialog = document.querySelector("#success-dialog");
const closeSuccess = document.querySelector(".success-close");

function setStatus(message, tone = "") {
  statusNode.textContent = message;
  statusNode.className = tone ? `form-status ${tone}` : "form-status";
}

function normalizeWebsiteUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }

  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function getPayload() {
  const formData = new FormData(form);
  return {
    name: formData.get("name"),
    company: formData.get("company"),
    focusArea: formData.get("focusArea"),
    websiteUrl: normalizeWebsiteUrl(formData.get("websiteUrl")),
    contact: formData.get("contact"),
    nickname: formData.get("nickname"),
  };
}

function validatePayload(payload) {
  const required = [
    ["name", "Add meg a neved."],
    ["company", "Add meg a cég nevét."],
    ["focusArea", "Add meg a fókuszterületet."],
    ["websiteUrl", "Add meg a weboldal URL-t."],
    ["contact", "Adj meg emailt vagy telefonszámot."],
  ];
  const missing = required.find(([key]) => !String(payload[key] || "").trim());

  if (missing) {
    return missing[1];
  }

  return "";
}

function showSuccess() {
  successDialog.hidden = false;
  closeSuccess.focus();
}

function hideSuccess() {
  successDialog.hidden = true;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = form.querySelector("button[type='submit']");
  const payload = getPayload();
  const validationMessage = validatePayload(payload);

  if (validationMessage) {
    setStatus(validationMessage, "error");
    return;
  }

  submitButton.disabled = true;
  setStatus("Jelentkezés küldése...");

  if (window.location.protocol === "file:") {
    setStatus("A mentéshez nyisd meg a helyi szervert: http://localhost:4177", "error");
    submitButton.disabled = false;
    return;
  }

  try {
    const response = await fetch(form.action, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || "A jelentkezést most nem sikerült elküldeni.");
    }

    form.reset();
    setStatus("");
    showSuccess();
  } catch (error) {
    setStatus(error.message || "A jelentkezést most nem sikerült elküldeni.", "error");
  } finally {
    submitButton.disabled = false;
  }
});

closeSuccess.addEventListener("click", hideSuccess);

successDialog.addEventListener("click", (event) => {
  if (event.target === successDialog) {
    hideSuccess();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !successDialog.hidden) {
    hideSuccess();
  }
});
