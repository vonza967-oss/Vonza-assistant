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
    "Irodaház portaszolgálatára lenne szükségünk Budapesten, hétköznap 8-18 óráig.",
    "Raktár élőerős vagyonvédelmét szeretnénk egyeztetni Győrben, folyamatos lefedettséggel.",
    "CCTV kamerarendszer és beléptető felmérés kell egy ipari helyszínhez.",
    "Facility Management karbantartási vagy épületüzemeltetési igényünk van több telephelyen.",
    "Hatósági engedélyhez, auditanyaghoz vagy beszerzési támogatáshoz kérnénk segítséget.",
  ]);

  const esgServiceGuides = Object.freeze([
    {
      key: "security_guarding",
      labelHu: "Őrzés-védelem / élőerős vagyonvédelem",
      shortLabelHu: "Őrzés-védelem",
      symbol: "OV",
      summaryHu: "Vagyonőri jelenlét, járőrözés, telephely- vagy rendezvénybiztosítás.",
      signalLabel: "Lefedettség és helyszíni kockázat",
      questions: [
        "Milyen objektumot vagy területet kell őrizni?",
        "Folyamatos, időszakos vagy eseményhez kötött jelenlétre van szükség?",
        "Mikor indulna a feladat, és milyen napi vagy heti lefedettség kell?",
      ],
    },
    {
      key: "reception_object_protection",
      labelHu: "Portaszolgálat / objektumvédelem",
      shortLabelHu: "Portaszolgálat",
      symbol: "PO",
      summaryHu: "Recepció, porta, beléptetési rend, látogatói folyamat és objektumvédelem.",
      signalLabel: "Bejáratok, műszakok, látogatói rend",
      questions: [
        "Milyen portaszolgálati vagy objektumvédelmi feladatot kell lefedni?",
        "Hány bejárat, műszak vagy látogatói folyamat érintett?",
        "Van meglévő beléptetési szabályzat vagy helyszíni rend?",
      ],
    },
    {
      key: "facility_management",
      labelHu: "Facility Management",
      shortLabelHu: "Facility Management",
      symbol: "FM",
      summaryHu: "Létesítményüzemeltetés, karbantartás, takarítási vagy koordinációs igény.",
      signalLabel: "Telephelyek és feladattípusok",
      questions: [
        "Milyen létesítmény vagy telephely üzemeltetéséről van szó?",
        "Mely FM feladatok tartoznak bele: karbantartás, takarítás, koordináció vagy vegyes támogatás?",
        "Egyszeri feladat, rendszeres szolgáltatás vagy több telephelyes keretigény?",
      ],
    },
    {
      key: "security_technology",
      labelHu: "Biztonságtechnika / kamera / beléptetés / riasztó",
      shortLabelHu: "Biztonságtechnika",
      symbol: "BT",
      summaryHu: "Kamerarendszer, beléptető, riasztó, tűzjelző, sorompó vagy kapcsolódó felmérés.",
      signalLabel: "Rendszerek, pontok, integrációk",
      questions: [
        "Milyen biztonságtechnikai rendszerre van szükség?",
        "Új telepítésről, bővítésről, karbantartásról vagy állapotfelmérésről van szó?",
        "Hány helyszín, bejárat, kamera vagy jogosultsági pont érintett?",
      ],
    },
    {
      key: "audit_compliance",
      labelHu: "Audit / compliance / hatósági előkészítés",
      shortLabelHu: "Audit / compliance",
      symbol: "AC",
      summaryHu: "Hatósági, audit, engedélyezési, beszerzési vagy megfelelőségi előkészítés.",
      signalLabel: "Határidő, dokumentumlista, kockázat",
      questions: [
        "Milyen hatósági, audit vagy engedélyezési célhoz kell támogatás?",
        "Mely terület érintett: őrzés-védelem, FM, biztonságtechnika, beszerzés vagy belső szabályozás?",
        "Van auditdátum, határidő, engedélytípus vagy dokumentumlista?",
      ],
    },
    {
      key: "mixed_enterprise_request",
      labelHu: "Vegyes vállalati megkeresés",
      shortLabelHu: "Vegyes igény",
      symbol: "VI",
      summaryHu: "Több ESG szolgáltatási területet érintő, közösen tisztázandó igény.",
      signalLabel: "Elsődleges cél és érintett területek",
      questions: [
        "Mely ESG szolgáltatási területeket kell együtt kezelni?",
        "Van elsődleges prioritás, vagy több terület párhuzamosan érintett?",
        "Egy helyszínről vagy több telephelyes keretigényről van szó?",
      ],
    },
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
      staffingRequirement: "Létszám",
      assetsCoverageNotes: "Értékek / lefedés",
      securityTechDetails: "Biztonságtechnika",
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
        workspaceLabels: {
          overview: "Áttekintés",
          requests: "Megkeresések",
          security_guarding: "Őrzés-védelem",
          reception_object_protection: "Portaszolgálat / objektumvédelem",
          facility_management: "Facility Management",
          security_technology: "Biztonságtechnika",
          audit_compliance: "Hatósági / audit",
          mixed_enterprise_request: "Vegyes megkeresések",
          settings: "Beállítások",
        },
        workspaceDescriptions: {
          overview: "Közös intake queue állapota szolgáltatási terület és feldolgozási státusz szerint.",
          requests: "Minden beérkezett vállalati megkeresés egy közös feldolgozási listában.",
          security_guarding: "Élőerős őrzés-védelem, járőrözés és objektumőrzés előszűrt megkeresései.",
          reception_object_protection: "Portaszolgálati, recepciós, beléptetési és objektumvédelmi igények.",
          facility_management: "Létesítményüzemeltetési, karbantartási és FM jellegű igények.",
          security_technology: "Kamera, beléptetés, riasztó, tűzjelző és kapcsolódó biztonságtechnikai megkeresések.",
          audit_compliance: "Hatósági, audit, engedélyezési és beszerzési támogatási megkeresések.",
          mixed_enterprise_request: "Több szolgáltatási területet érintő, belső szétválasztást igénylő kérések.",
          settings: "Setup állapot, intake link, szolgáltatási vonalak és termékhatárok.",
        },
        workspaceEmptyStates: {
          security_guarding: "Itt az őrzés-védelmi, vagyonőri vagy járőrözési igények jelennek meg.",
          reception_object_protection: "Itt a portaszolgálati, recepciós, beléptetési és objektumvédelmi kérések jelennek meg.",
          facility_management: "Itt az FM, karbantartási és létesítményüzemeltetési megkeresések jelennek meg.",
          security_technology: "Itt a kamera, beléptető, riasztó, tűzjelző és biztonságtechnikai igények jelennek meg.",
          audit_compliance: "Itt a hatósági, audit, engedélyezési és beszerzési támogatási igények jelennek meg.",
          mixed_enterprise_request: "Itt a több szolgáltatási területet érintő vegyes megkeresések jelennek meg.",
        },
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
      headerNote: "ESG megkeresés pontosítása strukturált áttekintéshez.",
      lanes: sharedLanes.filter((lane) => lane.key !== "general_enquiry"),
      serviceGuides: esgServiceGuides,
      detailLabels: {
        ...profileBase.detailLabels,
        area: "Szolgáltatási terület",
        serviceNeed: "ESG igény",
        locationOrSite: "Helyszín / objektum",
        urgencyOrTiming: "Lefedettség vagy időzítés",
        siteType: "Objektumtípus",
        staffingRequirement: "Személyzet",
        assetsCoverageNotes: "Tárolt értékek / lefedés",
        securityTechDetails: "Kamera / beléptetés",
      },
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
          "Üdvözlöm. Írja le természetes mondatban az ESG-nek szánt objektumvédelmi, FM, biztonságtechnikai vagy audit jellegű igényt, és segítek tiszta, áttekinthető briefet készíteni.",
        heroTitle: "ESG megkeresésből tiszta szolgáltatási brief.",
        heroBody:
          "Írja le szabadon a biztonsági, facility management, biztonságtechnikai vagy audit/compliance igényt. A felület felismeri a szolgáltatási területet, jelzi a hiányzó részleteket, majd ellenőrzés után küldhető tovább az ESG csapatának.",
        placeholder:
          "pl. Irodaház portaszolgálatára lenne szükségünk Budapesten, hétköznap 8-18 óráig...",
        quickStarts: esgQuickStarts,
        nextQuestionDefault: "Melyik ESG szolgáltatási területhez kapcsolódik az igény?",
        reviewTitle: "Ellenőrzés küldés előtt",
        reviewBody: "A következő lépést és a vállalhatóságot az ESG csapata a megadott részletek alapján tudja áttekinteni. Ez nem árgarancia és nem automatikus helyszíni intézkedés.",
        consentText: "Elolvastam a briefet, és hozzájárulok, hogy az ESG csapata a megadott adatok alapján áttekintse a megkeresést.",
        submitLabel: "Megkeresés elküldése az ESG-nek",
        successTitle: "Az ESG megkapta a strukturált megkeresést.",
        successBody: "A csapat a szolgáltatási terület, helyszín, lefedettség és kapcsolat alapján áttekinti a vállalhatóságot és a következő lépést.",
        mixedServiceNeedLabel: "Vegyes ESG szolgáltatási igény",
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
        workspaceLabels: {
          overview: "Áttekintés",
          requests: "Megkeresések",
          security_guarding: "Őrzés-védelem",
          reception_object_protection: "Portaszolgálat / objektumvédelem",
          facility_management: "Facility Management",
          security_technology: "Biztonságtechnika",
          audit_compliance: "Hatósági / audit",
          mixed_enterprise_request: "Vegyes megkeresések",
          settings: "Beállítások",
        },
        workspaceDescriptions: {
          overview: "Az ESG intake queue állapota szolgáltatási terület és feldolgozási státusz szerint.",
          requests: "Minden beérkezett ESG megkeresés egy közös feldolgozási listában.",
          security_guarding: "ESG őrzés-védelmi, vagyonőri vagy járőrözési megkeresések.",
          reception_object_protection: "ESG portaszolgálati, recepciós, beléptetési és objektumvédelmi igények.",
          facility_management: "ESG létesítményüzemeltetési, karbantartási és FM jellegű igények.",
          security_technology: "ESG kamera, beléptetés, riasztó, tűzjelző és biztonságtechnikai megkeresések.",
          audit_compliance: "ESG hatósági, audit, engedélyezési és beszerzési támogatási megkeresések.",
          mixed_enterprise_request: "Több ESG szolgáltatási területet érintő, belső szétválasztást igénylő kérések.",
          settings: "ESG setup állapot, intake link, szolgáltatási vonalak és termékhatárok.",
        },
        workspaceEmptyStates: {
          security_guarding: "Itt az ESG őrzés-védelmi, vagyonőri vagy járőrözési igények jelennek meg.",
          reception_object_protection: "Itt az ESG portaszolgálati, recepciós, beléptetési és objektumvédelmi kérések jelennek meg.",
          facility_management: "Itt az ESG FM, karbantartási és létesítményüzemeltetési megkeresések jelennek meg.",
          security_technology: "Itt az ESG kamera, beléptető, riasztó, tűzjelző és biztonságtechnikai igények jelennek meg.",
          audit_compliance: "Itt az ESG hatósági, audit, engedélyezési és beszerzési támogatási igények jelennek meg.",
          mixed_enterprise_request: "Itt a több ESG szolgáltatási területet érintő vegyes megkeresések jelennek meg.",
        },
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
