(function initEnterpriseRequestDeskProfiles() {
  const sharedLanes = Object.freeze([
    { key: "security_guarding", labelHu: "Őrzés-védelem" },
    { key: "reception_object_protection", labelHu: "Portaszolgálat / objektumvédelem" },
    { key: "facility_management", labelHu: "Facility Management" },
    { key: "security_technology", labelHu: "Biztonságtechnika" },
    { key: "audit_compliance", labelHu: "Hatósági / audit támogatás" },
    { key: "mixed_enterprise_request", labelHu: "Vegyes vállalati megkeresés" },
    { key: "general_enquiry", labelHu: "Általános érdeklődés" },
  ]);

  const esgQuickStarts = Object.freeze([
    "Irodaház portaszolgálatára és objektumvédelmére lenne szükségünk Budapesten.",
    "Raktár vagy telephely őrzését szeretnénk egyeztetni.",
    "CCTV kamerarendszer és beléptető felmérés kell egy ipari helyszínhez.",
    "Facility Management karbantartási vagy épületüzemeltetési igényünk van.",
    "Hatósági engedélyhez, auditanyaghoz vagy beszerzési támogatáshoz kérnénk segítséget.",
  ]);

  const enterpriseQuickStarts = Object.freeze([
    "Milyen szolgáltatásokra használható ez?",
    "Portaszolgálatra lenne szükségünk egy irodaházban.",
    "Kamerarendszert és beléptetést szeretnénk.",
    "Facility Management hibabejelentést szeretnék.",
    "Hatósági vagy audit támogatáshoz kérnénk segítséget.",
  ]);

  const profileBase = {
    brandInitial: "E",
    detailLabels: {
      organizationName: "Szervezet",
      serviceNeed: "Igény",
      locationOrSite: "Helyszín",
      urgencyOrTiming: "Időzítés",
      contactName: "Kapcsolattartó",
      contactEmail: "Email",
      contactPhone: "Telefon",
      siteType: "Objektum",
      area: "Szolgáltatási terület",
    },
    missingFieldLabels: {
      service_need: "szolgáltatási igény",
      location_or_site: "helyszín vagy objektum",
      urgency_or_timing: "időzítés vagy sürgősség",
      contact_need: "biztonságos kapcsolati adat",
    },
  };

  const profiles = Object.freeze({
    enterprise: Object.freeze({
      ...profileBase,
      key: "enterprise",
      routePrefix: "/enterprise-request-desk",
      productName: "Enterprise Request Desk",
      productNameHu: "Enterprise Megkereséskezelő",
      brandSubtitle: "Vállalati intake pult",
      headerNote: "Megkeresés előszűrése belső feldolgozáshoz.",
      lanes: sharedLanes,
      fixtureBusiness: {
        businessName: "Enterprise Request Desk",
        serviceArea: "egyeztetett vállalati helyszínek",
        serviceTypes: [
          "őrzés-védelem",
          "portaszolgálat / objektumvédelem",
          "Facility Management",
          "biztonságtechnika",
          "hatósági / audit támogatás",
        ],
      },
      intake: {
        title: "Enterprise Request Desk intake",
        loadingTitle: "Enterprise Request Desk betöltése",
        unavailableLabel: "Enterprise Request Desk link nem elérhető",
        openingMessage:
          "Üdvözlöm. Írja le természetes mondatban a vállalati objektumvédelmi, FM, biztonságtechnikai vagy audit jellegű igényt, és összerakom a belső feldolgozáshoz szükséges rövid összefoglalót.",
        heroTitle: "Írja le, mire van szükség. Az asszisztens pontosít.",
        heroBody:
          "Strukturált összefoglaló készül a megkeresésből a belső feldolgozáshoz.",
        placeholder:
          "pl. Portaszolgálatra lenne szükségünk egy irodaházban Budapesten, jövő héttől...",
        quickStarts: enterpriseQuickStarts,
        nextQuestionDefault: "Melyik szolgáltatási területhez kapcsolódik az igény?",
      },
      dashboard: {
        title: "Enterprise Request Desk dashboard",
        navLabel: "Enterprise Request Desk navigáció",
        productLabel: "Enterprise Request Desk",
        heading: "Vállalati megkeresések feldolgozási felülete",
        intro:
          "Beérkező objektumvédelmi, FM, biztonságtechnikai és audit jellegű kérések összefoglaló, hiányzó adatok és belső megjegyzés alapján.",
        sideTitle: "Kontrollált feldolgozás",
        sideBody: "Előszűrés, strukturált összefoglaló és belső feldolgozás. Az operatív döntések ezen a felületen kívül maradnak.",
        setupActive: "Enterprise setup aktív",
        safetyTitle: "Setup teljes. A beérkező megkeresések belső feldolgozásra kerülnek.",
        safetyBody: "Különálló megkereséskezelő felület előszűréshez, összefoglalóhoz és belső továbbításhoz.",
        emptyQueue: "Még nincs beérkezett megkeresés.",
        emptyHint: "Nyissa meg az intake linket, és küldjön be egy tesztmegkeresést a folyamat ellenőrzéséhez.",
      },
      setup: {
        title: "Enterprise Request Desk setup",
        asideLabel: "Enterprise Request Desk setup áttekintés",
        heading: "Setup vállalati, objektumvédelmi és FM megkeresésekhez.",
        intro:
          "Add meg a szervezet alapadatait, a szolgáltatási területet és a belső továbbítási módot. A mentés után a külön megkereséskezelő dashboard nyílik meg.",
        formTitle: "Szervezet és feldolgozási alapok",
        formIntro:
          "A mentett setup alapján válik egyértelművé, melyik szervezethez és szolgáltatási területhez tartozik a beérkező megkeresés.",
        intakePositioningDefault:
          "Vállalati objektumvédelmi, FM és biztonságtechnikai megkeresések előszűrése belső feldolgozáshoz.",
        serviceLinesHelp:
          "Őrzés-védelem, portaszolgálat, objektumvédelem, Facility Management, biztonságtechnika vagy hatósági/audit jellegű sorok.",
        serviceLinesPlaceholder:
          "Őrzés-védelem\nPortaszolgálat / objektumvédelem\nFacility Management\nBiztonságtechnika\nHatósági / audit támogatás",
      },
    }),
    esg: Object.freeze({
      ...profileBase,
      key: "esg",
      routePrefix: "/esg-request-desk",
      productName: "ESG Request Desk",
      productNameHu: "ESG Megkereséskezelő",
      brandInitial: "ESG",
      brandSubtitle: "Objektumvédelem, FM, biztonságtechnika",
      headerNote: "ESG megkeresés előszűrése belső feldolgozáshoz.",
      lanes: sharedLanes.filter((lane) => lane.key !== "general_enquiry"),
      fixtureBusiness: {
        businessName: "ESG Holding Zrt.",
        serviceArea: "egyeztetett ESG vállalati helyszínek",
        serviceTypes: [
          "Őrzés-védelem",
          "Portaszolgálat / objektumvédelem",
          "Facility Management",
          "Biztonságtechnika",
          "Hatósági / audit támogatás",
        ],
      },
      intake: {
        title: "ESG Request Desk intake",
        loadingTitle: "ESG Request Desk betöltése",
        unavailableLabel: "ESG Request Desk link nem elérhető",
        openingMessage:
          "Üdvözlöm. Írja le az objektumvédelmi, FM vagy biztonságtechnikai igényt, és előkészítem a belső feldolgozáshoz szükséges összefoglalót.",
        heroTitle: "Miben segíthet az ESG csapata?",
        heroBody:
          "Írja le az objektumvédelmi, FM, biztonságtechnikai vagy hatósági/audit igényt. A cél a helyszín, lefedettség, időzítés, szolgáltatási terület és kapcsolat tisztázása.",
        placeholder:
          "pl. Irodaház portaszolgálatára lenne szükségünk Budapesten, hétköznap 8-18 óráig...",
        quickStarts: esgQuickStarts,
        nextQuestionDefault: "Melyik ESG szolgáltatási területhez kapcsolódik az igény?",
      },
      dashboard: {
        title: "ESG Request Desk dashboard",
        navLabel: "ESG Megkereséskezelő navigáció",
        productLabel: "ESG Megkereséskezelő",
        heading: "ESG megkeresések feldolgozási felülete",
        intro:
          "Objektumvédelmi, portaszolgálati, FM, biztonságtechnikai és hatósági/audit megkeresések magyar nyelvű belső feldolgozáshoz.",
        sideTitle: "ESG feldolgozási keret",
        sideBody: "Előszűrés, összefoglaló, hiányzó adatok és belső megjegyzés. A vállalhatóságot és a következő lépést az ESG csapata erősíti meg.",
        setupActive: "ESG pult aktív",
        safetyTitle: "ESG setup teljes. A beérkező megkeresések belső feldolgozásra kerülnek.",
        safetyBody: "Objektumvédelmi, FM, biztonságtechnikai és hatósági/audit igények előszűrése egy ESG-specifikus felületen.",
        emptyQueue: "Még nincs beérkezett ESG megkeresés.",
        emptyHint: "Nyissa meg az ESG intake linket, és küldjön be egy irodaház, raktár, CCTV, FM vagy hatósági/audit témájú tesztmegkeresést.",
      },
      setup: {
        title: "ESG Request Desk setup",
        asideLabel: "ESG Request Desk setup áttekintés",
        heading: "ESG intake pult beállítása objektumvédelmi, FM és biztonságtechnikai megkeresésekhez.",
        intro:
          "Add meg az ESG megkereséskezelő alapadatait, szolgáltatási területét, szolgáltatási vonalait és belső továbbítási módját.",
        formTitle: "ESG szervezet és feldolgozási alapok",
        formIntro:
          "A mentett setup alapján az ESG intake link és a dashboard az objektumvédelmi, FM, biztonságtechnikai és hatósági/audit megkeresésekhez igazodik.",
        intakePositioningDefault:
          "ESG objektumvédelmi, Facility Management, biztonságtechnikai és hatósági/audit megkeresések előszűrése belső feldolgozáshoz.",
        serviceLinesHelp:
          "Példák: Őrzés-védelem, portaszolgálat / objektumvédelem, Facility Management, biztonságtechnika, hatósági / audit támogatás.",
        serviceLinesPlaceholder:
          "Őrzés-védelem\nPortaszolgálat / objektumvédelem\nFacility Management\nBiztonságtechnika\nHatósági / audit támogatás",
      },
    }),
  });

  function resolveProfile() {
    return window.location.pathname.startsWith("/esg-request-desk")
      ? profiles.esg
      : profiles.enterprise;
  }

  function applyDocumentProfile(profile = resolveProfile()) {
    document.body.dataset.erdpProfile = profile.key;
    document.querySelectorAll("[data-erdp-brand-name]").forEach((node) => {
      node.textContent = profile.productName;
    });
    document.querySelectorAll("[data-erdp-brand-subtitle]").forEach((node) => {
      node.textContent = profile.brandSubtitle;
    });
    document.querySelectorAll("[data-erdp-brand-initial]").forEach((node) => {
      node.textContent = profile.brandInitial;
    });
    document.querySelectorAll("[data-erdp-header-note]").forEach((node) => {
      node.textContent = profile.headerNote;
    });
    document.querySelectorAll("[data-erdp-route-prefix]").forEach((node) => {
      const suffix = node.dataset.erdpRouteSuffix || "";
      node.setAttribute("href", `${profile.routePrefix}${suffix}`);
    });
  }

  window.VonzaEnterpriseRequestDeskProfiles = {
    profiles,
    getProfile: resolveProfile,
    applyDocumentProfile,
  };
}());
