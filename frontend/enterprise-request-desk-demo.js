(function initEnterpriseRequestDeskDemo() {
  const MAX_MESSAGE_LENGTH = 1800;
  const SAMPLE_REQUESTS = Object.freeze({
    guarding:
      "Irodaház őrzés-védelemre van szükség Budapesten, jövő hónaptól. Kapcsolattartó: Kovács Anna, anna@client.hu.",
    facility:
      "Facility management támogatás kell egy budapesti telephelyre, karbantartás és takarítás egyeztetéssel, jövő héten. Telefon: +36 30 123 4567.",
    technology:
      "CCTV kamerarendszer és beléptető felmérés kell egy raktárhoz Győrben, 1-2 héten belül. Email: security@client.hu.",
    audit:
      "Audit / compliance előkészítés érdekel vagyonvédelmi szabályzat kapcsán Budapesten, a negyedév végéig. Kapcsolat: compliance@client.hu.",
    mixed:
      "Komplex őrzés és facility management megoldást keresünk több telephelyre országosan, jövő hónaptól. Email: ops@client.hu.",
  });

  const root = document.querySelector(".erd-shell");
  const form = document.querySelector("[data-erd-form]");
  const requestInput = document.querySelector("[data-erd-request]");
  const submitButton = document.querySelector("[data-erd-submit]");
  const characterCount = document.querySelector("[data-erd-character-count]");
  const readiness = document.querySelector("[data-erd-readiness]");
  const lane = document.querySelector("[data-erd-lane]");
  const confidence = document.querySelector("[data-erd-confidence]");
  const site = document.querySelector("[data-erd-site]");
  const need = document.querySelector("[data-erd-need]");
  const timing = document.querySelector("[data-erd-timing]");
  const contact = document.querySelector("[data-erd-contact]");
  const missing = document.querySelector("[data-erd-missing]");
  const question = document.querySelector("[data-erd-question]");
  const handoff = document.querySelector("[data-erd-handoff]");

  if (!root || !form || !requestInput) {
    return;
  }

  function getAnalyzePath() {
    return window.location.pathname.startsWith("/esg-request-desk")
      ? "/esg-request-desk/demo/analyze"
      : "/enterprise-request-desk/demo/analyze";
  }

  function setText(element, value) {
    if (element) {
      element.textContent = String(value || "");
    }
  }

  function updateCharacterCount() {
    setText(characterCount, `${requestInput.value.length} / ${MAX_MESSAGE_LENGTH}`);
  }

  function setBusy(isBusy) {
    if (submitButton) {
      submitButton.disabled = isBusy;
      submitButton.textContent = isBusy ? "Elemzés..." : "Besorolás és brief";
    }

    if (readiness && isBusy) {
      readiness.textContent = "Elemzés folyamatban";
      readiness.classList.add("is-waiting");
    }
  }

  function setReadiness(isReady) {
    if (!readiness) {
      return;
    }

    readiness.classList.toggle("is-waiting", !isReady);
    readiness.textContent = isReady ? "Minimális adatok megvannak" : "További pontosítás kell";
  }

  function renderMissingFields(items) {
    if (!missing) {
      return;
    }

    missing.textContent = "";

    if (!items.length) {
      const item = document.createElement("li");
      item.className = "is-complete";
      item.textContent = "nincs hiányzó minimális adat";
      missing.append(item);
      return;
    }

    for (const label of items) {
      const item = document.createElement("li");
      item.textContent = label;
      missing.append(item);
    }
  }

  function renderResult(payload) {
    const brief = payload.brief || {};
    setReadiness(payload.readyForInternalReview === true);
    setText(lane, payload.lane?.labelHu || brief.lane || "Általános érdeklődés");
    setText(confidence, payload.lane?.confidenceHu || "alacsony");
    setText(site, brief.siteLocation || "Nincs megadva");
    setText(need, brief.serviceNeed || "Nincs megadva");
    setText(timing, brief.timingUrgency || "Nincs megadva");
    setText(contact, brief.contactNeeded || "Kapcsolati adat hiányzik a visszajelzéshez.");
    renderMissingFields(Array.isArray(payload.missingFields) ? payload.missingFields : []);
    setText(question, brief.recommendedNextQuestion || "Melyik szolgáltatási területhez kapcsolódik a megkeresés?");
    setText(handoff, brief.handoffNote || "Előszűrt belső brief; a hiányzó adatok tisztázása után adható tovább feldolgozásra.");
  }

  async function analyzeRequest(message) {
    setBusy(true);

    try {
      const response = await fetch(getAnalyzePath(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "A demo elemzés nem sikerült.");
      }

      renderResult(payload || {});
    } catch (error) {
      setReadiness(false);
      setText(question, error.message || "A demo elemzés nem sikerült.");
      setText(handoff, "A brief előnézet változatlan maradt; próbálja újra rövidebb megkereséssel.");
    } finally {
      setBusy(false);
      updateCharacterCount();
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = requestInput.value.trim();

    if (!message) {
      setReadiness(false);
      setText(question, "Írjon be egy vállalati megkeresést a demo elemzéshez.");
      return;
    }

    analyzeRequest(message);
  });

  requestInput.addEventListener("input", updateCharacterCount);

  for (const button of document.querySelectorAll("[data-erd-sample]")) {
    button.addEventListener("click", () => {
      const sample = SAMPLE_REQUESTS[button.dataset.erdSample] || SAMPLE_REQUESTS.guarding;
      requestInput.value = sample;
      updateCharacterCount();
      analyzeRequest(sample);
    });
  }

  updateCharacterCount();
  analyzeRequest(requestInput.value.trim());
}());
