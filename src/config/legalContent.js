const LEGAL_EFFECTIVE_DATE = "2026-04-28";
const LEGAL_VERSION = "2026-04-28.1";

export const LEGAL_PATHS = Object.freeze({
  terms: "/aszf",
  imprint: "/impresszum",
  privacy: "/adatkezelesi-tajekoztato",
  cookies: "/cookie-tajekoztato",
});

export const LEGAL_LINKS = Object.freeze([
  { key: "terms", label: "ÁSZF", href: LEGAL_PATHS.terms },
  { key: "imprint", label: "Impresszum", href: LEGAL_PATHS.imprint },
  { key: "privacy", label: "Adatkezelési tájékoztató", href: LEGAL_PATHS.privacy },
  { key: "cookies", label: "Cookie tájékoztató", href: LEGAL_PATHS.cookies },
]);

const REPO_CONFIRMED_FACTS = Object.freeze({
  productName: "Vonza",
  deploymentServiceName: "vonza-assistant",
  hosting: "A repository Render web service-t konfigurál.",
  authAndData: "A signed-out és signed-in alkalmazás a jelenlegi kódbázisban Supabase Auth és Supabase adatkapcsolat használatára épül.",
  payments: "A fizetéshez a jelenlegi kódbázis hosted Stripe Checkout munkamenetet hoz létre, majd a visszatérést a /dashboard felületre irányítja.",
  ai: "A backend OpenAI API klienst tartalmaz az asszisztensválaszok előállításához.",
  optionalGoogle: "A kódbázis opcionális Google Gmail és Google Calendar integrációkat is tartalmaz, de ezek workspace-szinten külön kapcsolódnak.",
  publicSurfaces: [
    "publikus marketing oldal a / útvonalon",
    "publikus widget a /widget útvonalon",
    "signed-out és signed-in dashboard / auth felület a /dashboard útvonalon",
    "beágyazó scriptek a /embed.js és /embed-lite.js útvonalakon",
    "hosted checkout indítása a dashboardból",
  ],
});

const MISSING_COMPANY_FIELDS = Object.freeze([
  "jogi személy / egyéni vállalkozó pontos neve",
  "székhely / bejegyzett iroda címe",
  "képviselő neve",
  "kapcsolattartási e-mail cím",
  "cégjegyzékszám vagy egyéb nyilvántartási azonosító",
  "adószám / közösségi adószám",
]);

const MISSING_CONTRACT_FIELDS = Object.freeze([
  "publikus ár vagy díjcsomag leírása",
  "visszatérítési / elállási / lemondási szabályok",
  "panaszkezelési kapcsolattartó és elérhetőség",
  "irányadó jog és illetékes bíróság",
]);

const MISSING_PRIVACY_FIELDS = Object.freeze([
  "adatkezelő hivatalos neve",
  "adatkezelő postai címe",
  "adatkezelő közvetlen kapcsolattartási e-mail címe",
  "végleges megőrzési időtartamok szerveroldali adatkategóriánként",
  "nemzetközi adattovábbítás jogalapja / garanciája szolgáltatónként",
  "felügyeleti hatóság pontos megnevezése és elérhetősége az adatkezelő letelepedése alapján",
]);

const MISSING_HOSTING_FIELDS = Object.freeze([
  "hosting provider teljes cégnév",
  "hosting provider székhelye",
  "hosting provider egyéb kötelező impresszum adatai",
]);

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderParagraphs(paragraphs = []) {
  return paragraphs
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
}

function renderList(items = []) {
  return `
    <ul>
      ${items.filter(Boolean).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
}

function renderDefinitionList(items = []) {
  return `
    <dl class="legal-facts">
      ${items
        .filter((item) => item?.term && item?.description)
        .map((item) => `
          <div class="legal-facts-row">
            <dt>${escapeHtml(item.term)}</dt>
            <dd>${escapeHtml(item.description)}</dd>
          </div>
        `)
        .join("")}
    </dl>
  `;
}

function renderMissingFields(title, fields = [], intro = "") {
  return `
    <aside class="legal-notice legal-notice-warning" aria-label="${escapeHtml(title)}">
      <h3>${escapeHtml(title)}</h3>
      ${intro ? `<p>${escapeHtml(intro)}</p>` : ""}
      ${renderList(fields)}
    </aside>
  `;
}

function renderInfoNotice(title, paragraphs = [], items = []) {
  return `
    <aside class="legal-notice" aria-label="${escapeHtml(title)}">
      <h3>${escapeHtml(title)}</h3>
      ${renderParagraphs(paragraphs)}
      ${items.length ? renderList(items) : ""}
    </aside>
  `;
}

function renderSection(title, contentHtml) {
  return `
    <section class="legal-section">
      <h2>${escapeHtml(title)}</h2>
      ${contentHtml}
    </section>
  `;
}

function buildIntroNotice() {
  return renderInfoNotice(
    "Nyilvános tényalap",
    [
      "Ez a nyilvános jogi felület csak olyan működési tényeket állít biztosként, amelyek a jelenlegi repositoryból vagy konfigurációból ellenőrizhetők.",
      "Ahol a kódbázis nem tartalmaz kötelező cégjogi vagy adatkezelési adatot, ott az oldal ezt kifejezetten hiányzó operátori inputként jelzi, nem pedig feltételezett adattal tölti ki.",
    ]
  );
}

function buildCommonMetaCard(documentTitle, description) {
  return `
    <section class="legal-hero-card">
      <div>
        <p class="legal-eyebrow">Vonza jogi felület</p>
        <h1>${escapeHtml(documentTitle)}</h1>
        <p class="legal-lede">${escapeHtml(description)}</p>
      </div>
      <div class="legal-meta-grid" aria-label="Dokumentum meta adatok">
        <div class="legal-meta-item">
          <span>Hatályos</span>
          <strong>${escapeHtml(LEGAL_EFFECTIVE_DATE)}</strong>
        </div>
        <div class="legal-meta-item">
          <span>Verzió</span>
          <strong>${escapeHtml(LEGAL_VERSION)}</strong>
        </div>
        <div class="legal-meta-item">
          <span>Termék</span>
          <strong>${escapeHtml(REPO_CONFIRMED_FACTS.productName)}</strong>
        </div>
      </div>
    </section>
  `;
}

function buildConfirmedFactsSection() {
  return renderSection(
    "Repositoryból ellenőrizhető működési tények",
    renderDefinitionList([
      {
        term: "Publikus felületek",
        description: REPO_CONFIRMED_FACTS.publicSurfaces.join("; "),
      },
      {
        term: "Hosting",
        description: REPO_CONFIRMED_FACTS.hosting,
      },
      {
        term: "Auth és adatkapcsolat",
        description: REPO_CONFIRMED_FACTS.authAndData,
      },
      {
        term: "Fizetési infrastruktúra",
        description: REPO_CONFIRMED_FACTS.payments,
      },
      {
        term: "AI infrastruktúra",
        description: REPO_CONFIRMED_FACTS.ai,
      },
      {
        term: "Opcionális kapcsolatok",
        description: REPO_CONFIRMED_FACTS.optionalGoogle,
      },
    ])
  );
}

function buildTermsBody() {
  return [
    buildIntroNotice(),
    buildConfirmedFactsSection(),
    renderSection(
      "1. Szolgáltató adatai",
      [
        renderParagraphs([
          "A jelenlegi repository a Vonza terméknevet és a publikus szolgáltatás működési felületeit azonosítja, de nem tartalmaz teljes szolgáltatói cégadat-sort.",
          "A szolgáltató teljes azonosítását a publikus Impresszum oldalon kell véglegesíteni valós operátori adatokkal.",
        ]),
        renderMissingFields(
          "Hiányzó kötelező szolgáltatói adatok",
          MISSING_COMPANY_FIELDS,
          "A következő mezők nem állapíthatók meg biztonsággal a repositoryból:"
        ),
      ].join("")
    ),
    renderSection(
      "2. A szolgáltatás leírása",
      [
        renderParagraphs([
          "A Vonza a jelenlegi kódbázis szerint olyan AI-alapú ügyfélkapcsolati felület, amely a publikus weboldalon widgetet jelenít meg, ügyfélkérdéseket kezel, adatokat rögzít az appban, és a dashboardból hosted checkouttal aktiválható.",
          "A szolgáltatás magában foglalhatja a publikus marketing oldalt, a signed-out / signed-in auth és dashboard felületeket, a beágyazott widgetet, valamint a dashboardból indított fizetési folyamatot.",
        ]),
        renderList([
          "marketing és bizalmi tájékoztató felületek",
          "widgetes ügyfélkommunikáció és lead capture",
          "signed-out auth: regisztráció, bejelentkezés, reset, magic link",
          "signed-in dashboard: workspace, beállítások, analytics, install",
          "hosted checkout és fizetési visszatérés a dashboardba",
        ]),
      ].join("")
    ),
    renderSection(
      "3. Fiók létrehozása és hozzáférés",
      [
        renderParagraphs([
          "A jelenlegi app email / jelszó alapú regisztrációt és bejelentkezést, jelszó-visszaállítást, valamint magic link fallbacket is tartalmaz.",
          "A felhasználó felelős azért, hogy a saját hozzáférési adatai pontosak legyenek, és az accountot ne használja jogosulatlan személy.",
          "A workspace-hozzáférés a kódbázis szerint elkülönül a puszta account-létezéstől; a fizetési és aktiválási állapot befolyásolhatja, hogy a dashboard mely részei nyílnak meg.",
        ]),
      ].join("")
    ),
    renderSection(
      "4. Elfogadható használat",
      [
        renderParagraphs([
          "A Vonza nem használható jogellenes, megtévesztő, visszaélésszerű, biztonságot sértő vagy harmadik személy jogait sértő célra.",
          "Nem megengedett a widget vagy az auth / install / domain-védelem megkerülése, a szolgáltatás visszafejtése, tömeges zavarása, illetve olyan tartalom beküldése, amelyhez a felhasználónak nincs joga.",
          "A felhasználó felelős a saját business-kontextus, ügyfélkommunikációs beállítások és routing-célpontok jogszerű használatáért.",
        ]),
      ].join("")
    ),
    renderSection(
      "5. Díjazás, számlázás, megújítás, lemondás",
      [
        renderParagraphs([
          "A jelenlegi checkout-implementáció hosted Stripe Checkout munkamenetet indít egyszeri payment módban. A repository nem tartalmaz nyilvános előfizetéses megújítási logikát.",
          "A publikus ár, számlázási jogcím, számla-kibocsátó adatai, refund-politika és esetleges elállási / lemondási feltételek nem olvashatók ki a repositoryból, ezért ezeket a szolgáltatónak valós adatokkal kell véglegesítenie.",
          "Amíg ezek az adatok nem állnak rendelkezésre, a fizetési felület csak annyit állít biztosan, hogy a hozzáférés hosted Stripe Checkouton keresztül aktiválható.",
        ]),
        renderMissingFields(
          "Hiányzó kereskedelmi / szerződéses adatok",
          MISSING_CONTRACT_FIELDS,
          "A kódbázis alapján ezek a nyilvános feltételek még pontosításra szorulnak:"
        ),
      ].join("")
    ),
    renderSection(
      "6. Fizetési szolgáltató",
      [
        renderParagraphs([
          "A jelenlegi kódbázis Stripe SDK-t használ, és hosted Stripe Checkout munkamenetet hoz létre. A fizetési kártyaadatok bevitele a Stripe felületén történik.",
          "A Vonza app a checkout sikerességének ellenőrzéséhez Stripe session-azonosítót és fizetési állapotot vizsgál, továbbá a checkout eredményét a dashboardba visszatérve kezeli.",
        ]),
      ].join("")
    ),
    renderSection(
      "7. Támogatás és rendelkezésre állás",
      [
        renderParagraphs([
          "A repository jelenlegi állapota nem tartalmaz publikus SLA-t, garantált rendelkezésre állási vállalást vagy support e-mail címet.",
          "A szolgáltatás működése a kódbázis szerint külső infrastruktúrára is támaszkodik, ezért a szolgáltató külön támogatási és hibakezelési szabályzatot is közzétehet.",
        ]),
      ].join("")
    ),
    renderSection(
      "8. Szellemi tulajdon",
      [
        renderParagraphs([
          "A Vonza szoftveres felületei, a widget, a dashboard, a megjelenített branding-elemek, valamint a kapcsolódó know-how a szolgáltatóhoz vagy annak jogosult partnereihez tartozhatnak.",
          "A felhasználó által feltöltött saját üzleti tartalmak és konfigurációk feletti jogokat a szolgáltató nem sajátíthatja ki, ugyanakkor a szolgáltatás nyújtásához szükséges felhasználási jogot a működés idejére biztosítani kell.",
        ]),
      ].join("")
    ),
    renderSection(
      "9. Felelősségkorlátozás",
      [
        renderParagraphs([
          "A Vonza AI-alapú válaszokat, routingot és összefoglalásokat jeleníthet meg, ezért a felhasználónak ésszerűen ellenőriznie kell a számára üzletileg vagy jogilag kritikus beállításokat és tartalmakat.",
          "A szolgáltató felelőssége nem zárható ki ott, ahol ezt kógens jog tiltja, ugyanakkor a végleges felelősségi korlátokat a valós szolgáltatói adatokkal és alkalmazandó joggal összhangban kell véglegesíteni.",
        ]),
      ].join("")
    ),
    renderSection(
      "10. Felfüggesztés és megszüntetés",
      [
        renderParagraphs([
          "A szolgáltató felfüggesztheti vagy korlátozhatja a hozzáférést különösen jogellenes használat, biztonsági kockázat, súlyos visszaélés, illetve fizetési vagy aktiválási feltételek hiánya esetén.",
          "A felhasználó kérheti a szolgáltatás megszüntetését, de az adatok törlésének, megőrzésének és az esetleges pénzügyi elszámolásnak a részletszabályait a szolgáltatónak még pontosítania kell.",
        ]),
      ].join("")
    ),
    renderSection(
      "11. Panaszkezelés",
      [
        renderParagraphs([
          "A widget és az app a kódbázis szerint képes panasz- vagy support-jellegű beszélgetéseket azonosítani és dashboard-szinten kiemelni.",
          "A formális fogyasztói vagy üzleti panaszkezelés kapcsolattartója és eljárásrendje azonban nem szerepel a repositoryban, ezért ezt a szolgáltatónak valós adatokkal kell nyilvánossá tennie.",
        ]),
      ].join("")
    ),
    renderSection(
      "12. Irányadó jog és illetékesség",
      [
        renderParagraphs([
          "Az irányadó jogot és az illetékes bíróságot a szolgáltató székhelye és a tényleges szerződéses konstrukció alapján kell meghatározni.",
          "A jelenlegi repository ezt az információt nem tartalmazza, ezért ezen a ponton nem közlünk feltételezett joghatóságot.",
        ]),
      ].join("")
    ),
    renderSection(
      "13. Kapcsolat",
      [
        renderParagraphs([
          "A kapcsolattartási adatoknak az Impresszumban és az adatkezelési tájékoztatóban egységesen kell szerepelniük.",
        ]),
        renderMissingFields(
          "Hiányzó publikus kapcsolati adatok",
          ["általános kapcsolattartási e-mail cím", "panaszkezelési e-mail cím vagy más csatorna"],
          "A repository ezeket az elérhetőségeket nem tartalmazza."
        ),
      ].join("")
    ),
    renderSection(
      "14. Hatálybalépés és verzió",
      renderDefinitionList([
        { term: "Hatálybalépés", description: LEGAL_EFFECTIVE_DATE },
        { term: "Verzió", description: LEGAL_VERSION },
      ])
    ),
  ].join("");
}

function buildImprintBody() {
  return [
    buildIntroNotice(),
    renderSection(
      "Kötelező üzleti adatok",
      [
        renderDefinitionList([
          { term: "Termék / szolgáltatás neve", description: REPO_CONFIRMED_FACTS.productName },
          { term: "Deploy service neve", description: REPO_CONFIRMED_FACTS.deploymentServiceName },
          { term: "Hosting", description: "Render konfiguráció található a render.yaml fájlban." },
          { term: "Fizetési infrastruktúra", description: "Stripe hosted checkout integráció szerepel a kódbázisban." },
          { term: "Auth és backend", description: "Supabase Auth és Supabase adatkapcsolat szerepel a publikus app shellben." },
        ]),
        renderMissingFields(
          "Hiányzó impresszum adatok",
          MISSING_COMPANY_FIELDS,
          "A következő mezőket a repository nem bizonyítja, ezért publikus közzététel előtt valós adatokkal kell pótolni:"
        ),
      ].join("")
    ),
    renderSection(
      "Hosting provider",
      [
        renderParagraphs([
          "A jelenlegi deploy-konfiguráció Render web service-t használ.",
          "A hosting provider teljes jogi adatai azonban nincsenek beégetve a repositoryba.",
        ]),
        renderMissingFields(
          "Hiányzó hosting provider adatok",
          MISSING_HOSTING_FIELDS
        ),
      ].join("")
    ),
    renderSection(
      "Egyéb üzleti adatok",
      renderParagraphs([
        "Amennyiben a szolgáltatóra további kötelező ágazati, kamarai, engedélyezési vagy felügyeleti adatok vonatkoznak, azokat ezen az oldalon kell közzétenni.",
        "A jelenlegi repository ilyen további nyilvános üzleti adatot nem tartalmaz.",
      ])
    ),
  ].join("");
}

function buildPrivacyBody() {
  return [
    buildIntroNotice(),
    renderSection(
      "1. Adatkezelő adatai",
      [
        renderParagraphs([
          "A Vonza jelenlegi kódbázisa nem tartalmaz végleges adatkezelői cégadat-sort.",
          "Ezért ez az oldal csak a működési adatáramokat írja le biztosan, és külön jelzi, mely adatkezelői mezőket kell a szolgáltatónak megadnia.",
        ]),
        renderMissingFields(
          "Hiányzó adatkezelői adatok",
          MISSING_COMPANY_FIELDS,
          "Az alábbi mezők szükségesek a végleges GDPR-tájékoztatóhoz:"
        ),
      ].join("")
    ),
    renderSection(
      "2. Milyen adatokat kezel a jelenlegi szolgáltatás",
      [
        renderParagraphs([
          "A leírás a website, app, widget, auth és payments felületek jelenlegi repository-alapú működését követi.",
        ]),
        renderDefinitionList([
          {
            term: "Website / marketing felület",
            description: "Publikus oldalmegnyitás, dashboardba vezető CTA-k, valamint ha már létezik auth session, annak böngészőoldali állapota a CTA-útvonal finomításához.",
          },
          {
            term: "Auth / account felület",
            description: "Email-cím, jelszóbevitel, reset-link és magic link flow; a jelszókezelést a kliensoldal a Supabase Auth felé továbbítja.",
          },
          {
            term: "Signed-in app / dashboard",
            description: "Workspace-beállítások, business profile, website URL, routing-célpontok, install állapot, analitikai összesítések és workspace-adatok.",
          },
          {
            term: "Widget",
            description: "Név (opcionális), email-cím (azonosított módnál), visitor session key, oldal URL, origin, esetleges fingerprint / session_id, chatüzenetek, lead capture és routing-események.",
          },
          {
            term: "Payments / billing",
            description: "Bejelentkezett owner user azonosító, email, Stripe checkout session-azonosító, fizetési állapot, valamint a konfigurált árhoz tartozó ellenőrzés.",
          },
          {
            term: "Support / complaint / follow-up",
            description: "Ügyfélüzenetek, support- vagy panaszjelzések, rögzített kapcsolati adatok, follow-up draftok és kimeneti események.",
          },
          {
            term: "Opcionális Google workspace funkciók",
            description: "Ha a workspace tulajdonosa külön összekapcsolja, email- és naptármetaadatok, valamint kapcsolódó workflow-adatok kezelése történhet.",
          },
        ]),
      ].join("")
    ),
    renderSection(
      "3. Adatkezelési célok és jogalapok",
      renderDefinitionList([
        {
          term: "Szerződés teljesítése / szolgáltatás nyújtása",
          description: "Account-hozzáférés, dashboard működtetés, widgetes kérdéskezelés, routing, workspace-aktiválás és checkout-visszatérés kezelése.",
        },
        {
          term: "Kapcsolattartás és follow-up",
          description: "Lead capture, ügyfélvisszahívás / válasz-előkészítés, panaszok és kérdések kezelése.",
        },
        {
          term: "Biztonság és visszaélés-megelőzés",
          description: "Install, auth és widget események, routing- és outcome-ellenőrzések, valamint hozzáférési állapotok kezelése.",
        },
        {
          term: "Fizetés és elszámolás",
          description: "Hosted Stripe Checkout indítása, fizetési visszaigazolás, hozzáférés aktiválása.",
        },
        {
          term: "Termékfejlesztés és analitika",
          description: "Product eventek, widget telemetry, dashboard-összesítések és kérdésmintázatok elemzése.",
        },
      ])
    ),
    renderSection(
      "4. Címzettek és adatfeldolgozók",
      renderDefinitionList([
        {
          term: "Stripe",
          description: "Hosted checkout, fizetési session és fizetési állapot kezelése.",
        },
        {
          term: "Supabase",
          description: "Auth, sessionkezelés és a jelenlegi kódbázis backend adatkapcsolata.",
        },
        {
          term: "Render",
          description: "Alkalmazáshosting a repository deploy-konfigurációja alapján.",
        },
        {
          term: "OpenAI",
          description: "Az asszisztensválaszokhoz kapcsolódó AI API kliens a backendben.",
        },
        {
          term: "Google (opcionális)",
          description: "Workspace-szintű Gmail / Calendar kapcsolat, ha azt az owner külön bekapcsolja.",
        },
      ])
    ),
    renderSection(
      "5. Megőrzési idő",
      [
        renderParagraphs([
          "A repository részletes szerveroldali retention-szabályzatot nem publikál. Ezért jelenleg csak annyi állapítható meg biztosan, hogy a böngészőoldali beállítások és session-jellegű elemek a felhasználó böngészőjében maradnak, amíg ki nem jelentkezik, felül nem írja őket, vagy manuálisan nem törli őket.",
          "A szolgáltatónak a tényleges adatmegőrzési időket adatkategóriánként (account, widget chat, lead capture, payment logs, support records, analytics) külön kell véglegesítenie.",
        ]),
        renderMissingFields(
          "Hiányzó retention mezők",
          [
            "auth account adatok megőrzési ideje",
            "widget chat és lead capture adatok megőrzési ideje",
            "payment és számlázási naplók megőrzési ideje",
            "support / complaint / follow-up adatok megőrzési ideje",
            "dashboard analytics és product event adatok megőrzési ideje",
          ]
        ),
      ].join("")
    ),
    renderSection(
      "6. Érintetti jogok",
      renderList([
        "tájékoztatáshoz való jog",
        "hozzáféréshez való jog",
        "helyesbítéshez való jog",
        "törléshez való jog",
        "adatkezelés korlátozásához való jog",
        "adathordozhatósághoz való jog, ahol alkalmazható",
        "tiltakozáshoz való jog a jogos érdek alapján végzett adatkezelés ellen",
        "hozzájárulás visszavonása, ahol az adatkezelés hozzájáruláson alapul",
      ])
    ),
    renderSection(
      "7. Panasz és felügyeleti hatóság",
      [
        renderParagraphs([
          "Az érintett panaszt tehet az illetékes adatvédelmi felügyeleti hatóságnál, illetve bírósághoz fordulhat.",
          "A pontos felügyeleti hatóság megnevezéséhez az adatkezelő letelepedési és kapcsolati adatai szükségesek, amelyeket a repository jelenleg nem tartalmaz.",
        ]),
        renderMissingFields(
          "Hiányzó hatósági részletek",
          ["adatkezelő letelepedése alapján releváns felügyeleti hatóság pontos megnevezése és elérhetősége"]
        ),
      ].join("")
    ),
    renderSection(
      "8. Nemzetközi adattovábbítás",
      [
        renderParagraphs([
          "A jelenlegi architektúrában külső infrastruktúra- és AI-szolgáltatók vesznek részt, ezért nemzetközi adattovábbítás előfordulhat.",
          "A repository azonban nem tartalmaz szolgáltatónként régió- vagy transfer-mechanizmus listát, ezért az alkalmazott garanciákat (például SCC, adequacy vagy régiós elhelyezés) a szolgáltatónak külön kell véglegesítenie.",
        ]),
      ].join("")
    ),
    renderSection(
      "9. Widget-specifikus adatkezelés",
      renderList([
        "a látogató választhat guest vagy email-alapú folytatást",
        "azonosított mód esetén email-cím és opcionális név kerülhet rögzítésre",
        "a widget visitor session key-t és kapcsolódó routing- / outcome-jelöléseket tárolhat a böngészőben",
        "a chatüzenetek, lead capture és widget telemetry események a backend felé továbbítódhatnak",
      ])
    ),
    renderSection(
      "10. Fizetési és számlázási adatkezelés",
      renderList([
        "hosted Stripe Checkout session létrehozása",
        "owner user azonosító és email továbbítása a checkout indításához",
        "checkout session-azonosító és fizetési státusz ellenőrzése",
        "a hozzáférés aktiválásához szükséges fizetési visszaigazolás kezelése",
        "a repository nem tartalmaz publikus refund- vagy számlázási retention-szabályzatot",
      ])
    ),
    renderSection(
      "11. Auth és account adatkezelés",
      renderList([
        "email / jelszó alapú regisztráció és bejelentkezés",
        "jelszó-visszaállítás és magic link auth flow",
        "browser-side auth session tárolás Supabase Auth klienssel",
        "dashboard nyelvi és felületi preferenciák lokális tárolása",
      ])
    ),
    renderSection(
      "12. Cookie, localStorage és session storage hivatkozás",
      renderParagraphs([
        "A jelenlegi nyilvános kódbázis elsődlegesen localStorage-ot és sessionStorage-ot használ. A kapcsolódó részleteket a Cookie tájékoztató oldala sorolja fel.",
      ])
    ),
  ].join("");
}

function buildCookiesBody() {
  return [
    buildIntroNotice(),
    renderSection(
      "1. Mit használ a jelenlegi kódbázis",
      [
        renderParagraphs([
          "A jelenlegi repository nem bizonyít önálló, nem feltétlenül szükséges elsődleges marketing- vagy third-party tracking cookie beállítást a publikus Vonza felületeken.",
          "A működéshez viszont több localStorage és sessionStorage elem használatos a website, app, widget és auth felületeken.",
        ]),
      ].join("")
    ),
    renderSection(
      "2. Szükséges technológiák",
      renderDefinitionList([
        {
          term: "Auth session",
          description: "Supabase auth session lokális tárolása a böngészőben, tipikusan sb-<project-ref>-auth-token kulcs alatt.",
        },
        {
          term: "Dashboard preferenciák",
          description: "vonza_dashboard_theme, vonza_dashboard_language, vonza_dashboard_section és kapcsolódó Vonza dashboard kulcsok.",
        },
        {
          term: "Widget session és identity",
          description: "vonza_visitor_session_<scope>, vonza_visitor_identity_<scope>, dismissed route kulcsok és outcome-detection sessionStorage kulcsok.",
        },
        {
          term: "Install / launch / UI állapot",
          description: "vonza_install_progress_<agent>, vonza_launch_state, vonza_dashboard_handoff_seen és más UI-állapot kulcsok.",
        },
        {
          term: "Settings shell állapot",
          description: "vonza_dashboard_settings_section a beállítások szekciójának megőrzésére.",
        },
      ])
    ),
    renderSection(
      "3. Auth / session elemek",
      renderList([
        "Supabase session token lokális tárolása",
        "dashboard source / arrival sessionStorage állapot",
        "claim / handoff / focus / section választások lokális tárolása",
        "nyelvi és témabeállítás mentése a böngészőben",
      ])
    ),
    renderSection(
      "4. Widget / session elemek",
      renderList([
        "visitor session azonosító localStorage-ban",
        "visitor identity választás (guest vagy identified) localStorage-ban",
        "dismissed direct routing kulcsok localStorage-ban",
        "outcome detection sessionStorage jelölő, hogy az adott oldalra már lefutott-e az outcome-detect kérés",
        "agent_key localStorage elem a widget bootstraphez",
      ])
    ),
    renderSection(
      "5. Analitika és tracking",
      [
        renderParagraphs([
          "A jelenlegi kódbázis product event és widget telemetry végpontokat használ, de a repository nem bizonyít klasszikus third-party analytics vagy advertising tracker cookie beállítást.",
          "A kliensoldali azonosítók és storage-elemek főként deduplikációhoz, session-azonosításhoz, install-ellenőrzéshez és dashboard- / widget-állapotmegőrzéshez szolgálnak.",
        ]),
      ].join("")
    ),
    renderSection(
      "6. Nem feltétlenül szükséges cookie-k",
      renderParagraphs([
        "A jelenlegi repository alapján nem állítható biztosan, hogy a Vonza publikus felületei nem feltétlenül szükséges marketing- vagy reklámcookie-t állítanának be.",
        "Ezért ebben a passzban nem került külön cookie-consent banner bevezetésre. Ha később third-party analytics, remarketing vagy consent-köteles tracker kerül be, a banner és a consent-logika külön implementálandó.",
      ])
    ),
    renderSection(
      "7. Felhasználói kontroll",
      renderList([
        "a böngésző localStorage és sessionStorage elemei kézzel törölhetők",
        "a signed-in appból kijelentkezve az auth session megszüntethető",
        "a böngésző cookie- és storage-beállításai korlátozhatják az auth vagy widget működés egy részét",
        "a service worker a jelenlegi kódbázisban csak átadja a fetch kéréseket, külön offline cache-logika nélkül",
      ])
    ),
    renderSection(
      "8. Utolsó frissítés",
      renderDefinitionList([
        { term: "Utolsó frissítés", description: LEGAL_EFFECTIVE_DATE },
      ])
    ),
  ].join("");
}

const LEGAL_DOCUMENTS = Object.freeze({
  terms: {
    title: "ÁSZF",
    description: "A Vonza publikus website, app, widget és hosted checkout felületeinek általános szerződéses kerete.",
    body: buildTermsBody,
  },
  imprint: {
    title: "Impresszum",
    description: "A Vonza publikus üzleti és szolgáltatói azonosító felülete a repositoryból ismert és hiányzó adatok egyértelmű jelölésével.",
    body: buildImprintBody,
  },
  privacy: {
    title: "Adatkezelési tájékoztató",
    description: "A Vonza website, app, widget, auth, support és payments adatáramainak repository-alapú összefoglalása.",
    body: buildPrivacyBody,
  },
  cookies: {
    title: "Cookie tájékoztató",
    description: "A Vonza jelenlegi kódbázisában használt cookie-, localStorage- és sessionStorage elemek leírása.",
    body: buildCookiesBody,
  },
});

function renderHeader(activeKey) {
  return `
    <header class="legal-site-header">
      <a class="legal-brand" href="/">
        <span class="legal-brand-mark">V</span>
        <span>Vonza</span>
      </a>
      <nav class="legal-top-nav" aria-label="Jogi navigáció">
        <a href="/">Kezdőlap</a>
        <a href="/dashboard">App</a>
        ${LEGAL_LINKS.map((link) => `
          <a href="${escapeHtml(link.href)}" ${link.key === activeKey ? 'aria-current="page"' : ""}>${escapeHtml(link.label)}</a>
        `).join("")}
      </nav>
    </header>
  `;
}

function renderFooter() {
  return `
    <footer class="legal-footer">
      <p>Ahol a repository nem igazol kötelező cégadatot vagy policy-részletet, ott a Vonza nyilvános jogi felülete ezt hiányzó operátori inputként jelzi.</p>
      <div class="legal-footer-links">
        ${LEGAL_LINKS.map((link) => `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`).join("")}
      </div>
    </footer>
  `;
}

export function renderLegalPage(documentKey) {
  const document = LEGAL_DOCUMENTS[documentKey];

  if (!document) {
    throw new Error(`Unsupported legal document key: ${documentKey}`);
  }

  const bodyHtml = document.body();

  return `
<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(document.title)} | Vonza</title>
  <meta name="description" content="${escapeHtml(document.description)}">
  <link rel="icon" type="image/svg+xml" href="/icon-192.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/legal.css">
</head>
<body>
  <div class="legal-page">
    ${renderHeader(documentKey)}
    <main class="legal-shell">
      ${buildCommonMetaCard(document.title, document.description)}
      <div class="legal-content">
        ${bodyHtml}
      </div>
    </main>
    ${renderFooter()}
  </div>
</body>
</html>
`.trim();
}
