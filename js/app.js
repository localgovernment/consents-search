/* Property Consents Search
 * Search the Rateable Property layer, then list related building and
 * resource consents from the consents table (valuation_id -> PROP_Valuation_Reference_Number).
 *
 * Uses the ArcGIS Maps SDK for JavaScript via $arcgis.import, which works in
 * 4.32+ (script tag) and 5.x (module script), so upgrading is a URL change.
 */
(async function () {
  "use strict";

  const CFG = window.CONSENTS_SEARCH_CONFIG;
  const $ = (id) => document.getElementById(id);

  const els = {
    form: $("search-form"),
    input: $("search-input"),
    clear: $("clear-btn"),
    resultsStatus: $("results-status"),
    results: $("results-list"),
    detailEmpty: $("detail-empty"),
    detailContent: $("detail-content"),
    propertyTitle: $("property-title"),
    propertySites: $("property-sites"),
    propertyFacts: $("property-facts"),
    consentsStatus: $("consents-status"),
    tabs: $("consent-tabs"),
    tabBuilding: $("tab-building"),
    tabResource: $("tab-resource"),
    tabOther: $("tab-other"),
    countOther: $("count-other"),
    panelOther: $("panel-other"),
    countBuilding: $("count-building"),
    countResource: $("count-resource"),
    panelBuilding: $("panel-building"),
    panelResource: $("panel-resource")
  };

  const PROPERTY_FIELDS = [
    "OBJECTID", "valuation_id", "address", "m_property_legal_desc",
    "m_supplementary_legal_desc", "m_cert_of_title", "certificate_of_title", "ra_unique_id"
  ];
  const CONSENT_FIELDS = [
    "OBJECTID", "CONSENT_APPLN_ID", "CONSENT_APPLN_TYPE", "CONSENT_FILE_ID",
    "CONSENT_DESCRIPTION", "CONSENT_SITE_NAME", "CONSENT_STATUS",
    "CONSENT_APPLN_STAGE_CODE", "CONSENT_DECISION_TYPE_CODE",
    "CONSENT_LODGED_DATE", "CONSENT_ACCEPTED_DATE", "CONSENT_DECISION_DATE",
    "CONSENT_LAPSED_DATE", "CONSENT_COMPLETED_DATE", CFG.consentKeyField
  ];

  // ---------------------------------------------------------------- SDK
  const [Map, MapView, FeatureLayer, GraphicsLayer, Graphic] = await Promise.all([
    $arcgis.import("@arcgis/core/Map.js"),
    $arcgis.import("@arcgis/core/views/MapView.js"),
    $arcgis.import("@arcgis/core/layers/FeatureLayer.js"),
    $arcgis.import("@arcgis/core/layers/GraphicsLayer.js"),
    $arcgis.import("@arcgis/core/Graphic.js")
  ]);

  const DEFAULT_TITLE = document.title;

  const propertyLayer = new FeatureLayer({
    url: CFG.propertyLayerUrl,
    title: "Rateable properties",
    outFields: PROPERTY_FIELDS,
    minScale: CFG.parcelMinScale,
    popupEnabled: false,
    renderer: {
      type: "simple",
      symbol: {
        type: "simple-fill",
        color: [0, 0, 0, 0],
        outline: { color: [60, 60, 60, 0.6], width: 0.75 }
      }
    }
  });

  // Table (no geometry) – only queried, never drawn.
  const consentsTable = new FeatureLayer({ url: CFG.consentsTableUrl });

  const selectionLayer = new GraphicsLayer({ title: "Selected property" });

  const map = new Map({ basemap: CFG.basemap, layers: [propertyLayer, selectionLayer] });
  const view = new MapView({
    container: "map",
    map,
    center: CFG.initialCenter,
    zoom: CFG.initialZoom,
    constraints: { snapToZoom: false },
    popupEnabled: false
  });

  // Home button: return to the default map view and clear the search.
  // (A plain button rather than the Home widget, which is deprecated in SDK 4.32+.)
  const homeButton = document.createElement("button");
  homeButton.type = "button";
  homeButton.className = "map-home-btn";
  homeButton.title = homeButton.ariaLabel = "Reset map and clear search";
  homeButton.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.3 1 7.4l.7.8L3 7.1V15h4v-4h2v4h4V7.1l1.3 1.1.7-.8L8 1.3zM12 14h-2v-4H6v4H4V6.2l4-3.5 4 3.5V14z"/></svg>';
  // Shared by the map Home button and the × in the search box
  function goHome() {
    // Focus first, while still inside the tap/click: mobile browsers (iOS in
    // particular) only allow focus - and show the keyboard - during the gesture.
    els.input.focus({ preventScroll: true });
    resetAll();
    scrollToWorkArea();     // same position as after selecting a property
    view.goTo({ center: CFG.initialCenter, zoom: CFG.initialZoom }, { duration: 600 }).catch(() => {});
  }

  // Search panel (and map, on desktop) at the top of the screen; the header and intro scroll away.
  function scrollToWorkArea() {
    const top = document.querySelector("main.layout").getBoundingClientRect().top + window.scrollY - 16;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }
  homeButton.addEventListener("click", goHome);
  view.ui.add(homeButton, "top-left");

  // ---------------------------------------------------------------- helpers
  function debounce(fn, ms) {
    let t;
    const d = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    d.cancel = () => clearTimeout(t);
    return d;
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  // Remove macrons/diacritics so "Taupō" matches "Taupo" in the data.
  function normalise(s) {
    return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function sqlString(s) {
    return "'" + String(s).replace(/'/g, "''") + "'";
  }

  // The whole input is one search phrase: "144 lakewood" looks for
  // "144 LAKEWOOD" as a single string, not "144" and "lakewood" separately.
  // Returned as an array (of zero or one phrase) for the helpers below.
  function searchTerms(text) {
    const phrase = normalise(text)
      .toUpperCase()
      .replace(/[%_]/g, "")         // don't let users inject wildcards
      .replace(/\s+/g, " ")         // collapse repeated spaces
      .trim();
    return phrase ? [phrase] : [];
  }

  // Commas and extra spaces don't matter: "1 Smith Street, Taupo" ~ "1 SMITH STREET TAUPO"
  function cleanText(s) {
    return normalise(String(s || "")).toUpperCase().replace(/,/g, " ").replace(/\s+/g, " ").trim();
  }

  // The server can't strip commas from the data (no REPLACE in its SQL), so search for
  // several spellings of the phrase at once: as typed, without commas, and without
  // commas but with ", " at one word gap ("1 SMITH STREET, TAUPO"). One comma only.
  const MAX_COMMA_GAPS = 8;
  function phraseVariants(phrase) {
    const cleaned = cleanText(phrase);
    const out = new Set([phrase, cleaned]);
    const words = cleaned.split(" ");
    for (let i = 1; i < words.length && i <= MAX_COMMA_GAPS; i++) {
      out.add(`${words.slice(0, i).join(" ")}, ${words.slice(i).join(" ")}`);
    }
    return [...out].filter(Boolean);
  }

  // Any spelling of the phrase must appear in at least one search field. The comma
  // variants are only checked on text fields that contain commas (address, legal
  // description, site name) - IDs never do - which keeps the query quick.
  function buildWhere(terms, fields = CFG.searchFields) {
    return terms.map((t) => {
      const all = phraseVariants(t);
      const basic = [...new Set([t, cleanText(t)])].filter(Boolean);
      const conds = fields.flatMap((f) =>
        (CFG.commaFields.includes(f) ? all : basic).map((v) => `UPPER(${f}) LIKE ${sqlString("%" + v + "%")}`));
      return "(" + conds.join(" OR ") + ")";
    }).join(" AND ");
  }

  // Site names in the consents data have untidy spacing: " Storey Place ,Taupo"
  function tidySiteName(s) {
    return String(s || "").replace(/\s*,\s*/g, ", ").replace(/\s+/g, " ").replace(/^[\s,]+|[\s,]+$/g, "");
  }
  // Comparison key: letters and digits only ("2 Tongariro St, Taupo" ~ "2 TONGARIROSTTAUPO")
  function compareKey(s) {
    return normalise(String(s || "")).toUpperCase().replace(/[^A-Z0-9]/g, "");
  }
  // Same rule as the search: ignore commas and extra spaces on both sides
  function contains(value, phrase) {
    return !!value && cleanText(value).includes(cleanText(phrase));
  }

  function highlight(text, terms) {
    const safe = escapeHtml(text);
    if (!terms.length || !text) return safe;
    // Words of the phrase, allowing any commas/spaces between them in the text
    const pattern = terms
      .map((t) => cleanText(t).split(" ")
        .map((w) => escapeHtml(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("[\\s,]+"))
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .join("|");
    if (!pattern) return safe;
    return safe.replace(new RegExp(`(${pattern})`, "gi"), "<mark>$1</mark>");
  }

  // Dates come through as strings like "28-Jan-1993 00:00:00".
  const MONTHS = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
  // Consent dates are real date fields (epoch milliseconds). The values are New
  // Zealand wall-clock times stored as UTC, so they're displayed in UTC to show
  // them exactly as stored. Older text dates ("28-Jan-1993 00:00:00") still parse.
  function parseDate(s) {
    if (s === null || s === undefined || s === "") return null;
    if (typeof s === "number") return new Date(s);
    const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(s);
    if (m) return new Date(Date.UTC(+m[3], MONTHS[m[2].toUpperCase()], +m[1]));
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }
  const dateFmt = new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const timeFmt = new Intl.DateTimeFormat("en-NZ", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  // Date only, plus the time when one is recorded (i.e. not midnight)
  function formatDate(s) {
    const d = parseDate(s);
    if (!d) return "";
    const hasTime = d.getUTCHours() || d.getUTCMinutes();
    return hasTime ? `${dateFmt.format(d)}, ${timeFmt.format(d)}` : dateFmt.format(d);
  }

  function consentTypeInfo(code) {
    const known = CFG.consentTypes[code];
    if (known) return known;
    const category = /^RC/i.test(code || "") ? "resource" : /^BC/i.test(code || "") ? "building" : "other";
    return { label: code || "Unknown", category };
  }

  // Badge shows the stage; if there's no stage, fall back to the overall status (D = Determined, ...)
  function stageInfo(code, status) {
    if (!code) return CFG.statuses[status] || { label: "Unknown", tone: "neutral" };
    return CFG.stages[code] || { label: code.charAt(0) + code.slice(1).toLowerCase(), tone: "neutral" };
  }

  function isAbort(err) {
    return err && (err.name === "AbortError" || /abort/i.test(err.message || ""));
  }

  function setStatus(el, text, isError = false) {
    el.textContent = text;
    el.classList.toggle("error", isError);
  }

  // ---------------------------------------------------------------- search
  let searchController = null;
  let currentResults = [];
  let currentTerms = [];
  let currentKey = null;      // search phrase the displayed results belong to
  let inflight = null;        // { key, promise } for the search currently running
  let selectedKey = null;     // valuation number, or "consent:<ID>" for a consent with no linked property
  // Identifies a result: its valuation number, or its consent ID when it has no linked property
  const resultKey = (r) => (r._unlinked ? `consent:${r._consentId}` : r.valuation_id);

  // Resolves to the result rows, or undefined if the search was superseded or failed.
  function runSearch(text) {
    const terms = searchTerms(text);
    const key = terms.join(" ");
    if (inflight && inflight.key === key) return inflight.promise;
    const promise = doSearch(text, terms, key);
    inflight = { key, promise };
    promise.finally(() => { if (inflight && inflight.promise === promise) inflight = null; });
    return promise;
  }

  async function doSearch(text, terms, key) {
    const joined = terms.join("");
    if (searchController) searchController.abort();

    if (joined.length < CFG.minSearchLength) {
      currentResults = [];
      currentKey = null;
      renderResults([], terms, 0);
      setStatus(els.resultsStatus, text.trim() ? `Type at least ${CFG.minSearchLength} characters.` : "");
      return;
    }

    searchController = new AbortController();
    const { signal } = searchController;
    setStatus(els.resultsStatus, "Searching…");

    try {
      const where = buildWhere(terms);
      const [fs, propTotal, consentMatches] = await Promise.all([
        propertyLayer.queryFeatures({
          where,
          outFields: PROPERTY_FIELDS,
          returnGeometry: false,
          orderByFields: ["address", "valuation_id"],
          num: CFG.maxResults
        }, { signal }),
        propertyLayer.queryFeatureCount({ where }, { signal }),
        searchConsents(terms, signal)
      ]);

      // Attach matching consents to their properties; fetch properties that
      // were only found through a consent.
      const rows = fs.features.map((f) => f.attributes);
      const byValuation = new globalThis.Map(rows.map((r) => [r.valuation_id, r]));
      // Only look up as many consent-only properties as the list can show
      const allMissing = [...consentMatches.keys()].filter((v) => !byValuation.has(v));
      const missing = allMissing.slice(0, Math.max(0, CFG.maxResults - rows.length));
      for (const r of await fetchProperties(missing, signal)) {
        if (!byValuation.has(r.valuation_id)) { byValuation.set(r.valuation_id, r); rows.push(r); }
      }
      const phrase = terms[0];
      for (const r of rows) {
        const matches = consentMatches.get(r.valuation_id);
        r._ownMatch = CFG.searchFields.some((f) => contains(r[f], phrase));
        r._consentMatches = matches && !r._ownMatch ? matches : null;
      }
      // Approximate when a broad search hits the limits (more consents or properties than fetched)
      const consentOnly = rows.filter((r) => !r._ownMatch).length;
      // Valuations we looked up but that aren't in the property layer aren't properties
      // (their consents are listed as "no linked property" instead), so don't count them
      const notFound = missing.filter((v) => !byValuation.has(v)).length;
      const total = consentMatches.truncated ? Infinity : propTotal + Math.max(consentOnly, allMissing.length - notFound);
      const properties = sortResults(rows, terms).slice(0, CFG.maxResults);

      // Consents not linked to any property go at the end, in whatever room is left
      const unlinked = findUnlinked(consentMatches, byValuation, new Set([...fs.features.map((f) => f.attributes.valuation_id), ...missing]), phrase);
      const results = properties.concat(unlinked.slice(0, Math.max(0, CFG.maxResults - properties.length)));
      currentResults = results;
      currentTerms = terms;
      currentKey = key;
      renderResults(results, terms, total);
      if (unlinked.length) setStatus(els.resultsStatus, resultsSummary(properties.length, total, unlinked.length, results.length, consentMatches.truncated));
      loadConsentCounts(properties, signal);
      return results;
    } catch (err) {
      if (isAbort(err)) return;
      console.error(err);
      setStatus(els.resultsStatus, "Sorry, the property search is not available right now. Please try again.", true);
    }
  }

  // Consents whose file ID or site name contains the phrase, grouped by valuation number.
  // out.byConsent: every matching consent (one entry per consent ID) with the set of
  // valuation numbers it's linked to (empty when it has none) - used to find consents
  // that aren't linked to any property.
  async function searchConsents(terms, signal) {
    const out = new globalThis.Map();
    out.byConsent = new globalThis.Map();
    try {
      const fs = await consentsTable.queryFeatures({
        where: buildWhere(terms, CFG.consentSearchFields),
        outFields: ["CONSENT_FILE_ID", "CONSENT_SITE_NAME", "CONSENT_APPLN_TYPE", CFG.consentKeyField],
        returnGeometry: false,
        orderByFields: ["CONSENT_FILE_ID"],
        num: CFG.maxConsentMatches
      }, { signal });
      out.truncated = !!fs.exceededTransferLimit;
      const phrase = terms[0];
      for (const { attributes: c } of fs.features) {
        const v = c[CFG.consentKeyField];
        const match = {
          fileId: c.CONSENT_FILE_ID,
          site: tidySiteName(c.CONSENT_SITE_NAME),
          type: c.CONSENT_APPLN_TYPE,
          valuation: v || "",
          on: contains(c.CONSENT_FILE_ID, phrase) ? "id" : contains(c.CONSENT_SITE_NAME, phrase) ? "site" : "valuation"
        };
        if (!out.byConsent.has(match.fileId)) out.byConsent.set(match.fileId, { match, vals: new Set() });
        if (!v) continue;
        out.byConsent.get(match.fileId).vals.add(v);
        if (!out.has(v)) out.set(v, []);
        out.get(v).push(match);
      }
    } catch (err) {
      if (isAbort(err)) throw err;
      console.warn("Consent search unavailable", err);   // still show property matches
    }
    return out;
  }

  // Matching consents that can't be shown under a property: no valuation number, or
  // only valuation numbers that aren't in the property layer. A consent that's linked
  // to at least one property we found is shown under that property instead.
  // checked = valuation numbers we actually looked up (others are unknown, so skipped).
  function findUnlinked(consentMatches, byValuation, checked, phrase) {
    const out = [];
    for (const { match, vals } of consentMatches.byConsent.values()) {
      const v = [...vals];
      if (v.some((x) => byValuation.has(x))) continue;      // shown under a property
      if (v.some((x) => !checked.has(x))) continue;         // not checked (list already full)
      out.push({
        _unlinked: true,
        _consentId: match.fileId,
        _valuationNote: v.length ? `${v.find((x) => x.toUpperCase().includes(phrase)) || v[0]} (no matching property)` : "Not specified",
        _consentMatches: [match],
        _ownMatch: false
      });
    }
    // Exact consent number first, then newest consent numbers first
    const exact = (r) => (String(r._consentId).toUpperCase() === phrase ? 0 : 1);
    return out.sort((a, b) => exact(a) - exact(b) ||
      String(b._consentId).localeCompare(String(a._consentId), "en-NZ", { numeric: true }));
  }

  // Status line when the list includes consents with no linked property
  function resultsSummary(nProps, propTotal, nUnlinked, shown, truncated) {
    if (truncated || propTotal + nUnlinked > shown) {
      return `Showing ${truncated ? "the first " : ""}${shown}${truncated ? "" : ` of ${(propTotal + nUnlinked).toLocaleString("en-NZ")}`} matches – add more detail to narrow the list.`;
    }
    const c = `${nUnlinked} ${nUnlinked === 1 ? "consent" : "consents"} with no linked property`;
    return nProps ? `${nProps} matching ${nProps === 1 ? "property" : "properties"} and ${c}.` : `${c}.`;
  }

  // Batches run in parallel; 100 IDs per request keeps URLs a sensible length.
  async function fetchProperties(valuationIds, signal) {
    const chunks = [];
    for (let i = 0; i < valuationIds.length; i += 100) chunks.push(valuationIds.slice(i, i + 100));
    const sets = await Promise.all(chunks.map((chunk) => propertyLayer.queryFeatures({
      where: `valuation_id IN (${chunk.map(sqlString).join(",")})`,
      outFields: PROPERTY_FIELDS,
      returnGeometry: false
    }, { signal })));
    return sets.flatMap((fs) => fs.features.map((f) => f.attributes));
  }

  // Exact consent number / valuation matches first, then prefix matches, then natural address order.
  function sortResults(rows, terms) {
    const first = terms[0] || "";
    const rank = (r) => {
      const v = (r.valuation_id || "").toUpperCase();
      const ids = (r._consentMatches || []).map((m) => String(m.fileId || "").toUpperCase());
      const addr = cleanText(r.address);
      if (v === first || ids.includes(first)) return 0;
      if (v.startsWith(first) || ids.some((id) => id.startsWith(first)) || addr.startsWith(cleanText(first))) return 1;
      return 2;
    };
    const collator = new Intl.Collator("en-NZ", { numeric: true, sensitivity: "base" });
    return rows.sort((a, b) =>
      rank(a) - rank(b) ||
      collator.compare(streetSortKey(a.address), streetSortKey(b.address)) ||
      collator.compare(a.address || "", b.address || "") ||
      collator.compare(a.valuation_id || "", b.valuation_id || ""));
  }
  // "12 Smith Street Taupo" -> "Smith Street Taupo 12" so streets group together
  function streetSortKey(addr) {
    const m = /^([\d/A-Za-z-]*\d[\d/A-Za-z-]*)\s+(.*)$/.exec(addr || "");
    return m ? `${m[2]} ${m[1]}` : (addr || "");
  }

  function renderResults(rows, terms, total) {
    els.results.innerHTML = "";
    if (!rows.length) {
      if (terms.join("").length >= CFG.minSearchLength) {
        setStatus(els.resultsStatus, "No properties match your search. Check the spelling, or try typing less (for example just the street name).");
      }
      return;
    }
    const shown = rows.length;
    setStatus(els.resultsStatus, total === Infinity
      ? `Showing the first ${shown} matches – add more detail to narrow the list.`
      : total > shown
      ? `Showing ${shown} of ${total.toLocaleString("en-NZ")} matches – add more detail to narrow the list.`
      : `${total} matching ${total === 1 ? "property" : "properties"}.`);

    const frag = document.createDocumentFragment();
    for (const r of rows) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "result-btn";
      btn.dataset.key = resultKey(r);
      if (resultKey(r) === selectedKey) btn.setAttribute("aria-current", "true");
      btn.addEventListener("click", () => selectProperty(r));
      li.appendChild(btn);
      frag.appendChild(li);
      if (r._unlinked) {
        btn.classList.add("is-unlinked");
        btn.innerHTML = `
          <span class="result-address">
            <span>No linked property</span>
            <span class="badge-count">1 consent</span>
          </span>
          <span class="result-meta">Valuation <span class="val">${highlight(r._valuationNote, terms)}</span></span>
          ${consentMatchLine(r._consentMatches, terms)}`;
        continue;
      }
      // The supplementary legal description is always contained in the full
      // legal description, so it's only used as a fallback.
      const legal = (r.m_property_legal_desc || r.m_supplementary_legal_desc || "").trim();
      btn.innerHTML = `
        <span class="result-address">
          <span>${highlight(r.address || "(no address)", terms)}</span>
          <span class="badge-count" data-count-for="${escapeHtml(r.valuation_id)}" hidden></span>
        </span>
        <span class="result-meta">Valuation <span class="val">${highlight(r.valuation_id, terms)}</span></span>
        ${legal ? `<span class="result-meta result-legal" title="${escapeHtml(legal)}">${highlight(legal, terms)}</span>` : ""}
        ${r._consentMatches ? consentMatchLine(r._consentMatches, terms) : ""}`;
    }
    els.results.appendChild(frag);
  }

  // "(Consent BC1995/951416)" or "(Consent site: 36-64 Tongariro Street, Taupo)" + "+2 more"
  function consentMatchLine(matches, terms) {
    const ids = [...new Set(matches.map((m) => m.fileId))];
    const first = matches.find((m) => m.on === "id") || matches[0];
    const text = first.on === "id"
      ? `Consent ${highlight(first.fileId, terms)}`
      : first.on === "valuation"
      ? `Consent ${escapeHtml(first.fileId)} on valuation ${highlight(first.valuation, terms)}`
      : `Consent site: ${highlight(first.site, terms)}`;
    const more = ids.length > 1 ? ` <span class="more">+${ids.length - 1} more</span>` : "";
    const title = matches.map((m) => `${m.fileId} – ${m.site}`).join("\n");
    return `<span class="result-consent" title="${escapeHtml(title)}">(${text})${more}</span>`;
  }

  // One statistics query tells the user which results have consents.
  async function loadConsentCounts(rows, signal) {
    const ids = [...new Set(rows.map((r) => r.valuation_id).filter(Boolean))];
    if (!ids.length) return;
    try {
      const fs = await consentsTable.queryFeatures({
        where: `${CFG.consentKeyField} IN (${ids.map(sqlString).join(",")})`,
        groupByFieldsForStatistics: [CFG.consentKeyField],
        outStatistics: [{ statisticType: "count", onStatisticField: "OBJECTID", outStatisticFieldName: "n" }]
      }, { signal });
      const counts = {};
      for (const f of fs.features) counts[f.attributes[CFG.consentKeyField]] = f.attributes.n;
      els.results.querySelectorAll("[data-count-for]").forEach((badge) => {
        const n = counts[badge.dataset.countFor] || 0;
        badge.textContent = n === 1 ? "1 consent" : `${n} consents`;
        badge.classList.toggle("zero", n === 0);
        badge.hidden = false;
      });
    } catch (err) {
      if (!isAbort(err)) console.warn("Consent counts unavailable", err);
    }
  }

  // ---------------------------------------------------------------- selection
  let detailController = null;

  // highlightIds: consent file IDs to highlight (defaults to the consents this
  // result was found through, if any).
  // scrollToTop: on desktop, bring the search panel and map to the top of the screen
  // (user selections; not when a property opens from a link or the Back button).
  async function selectProperty(attrs, { updateUrl = true, highlightIds, scrollToTop = true } = {}) {
    selectedKey = resultKey(attrs);
    // A consent with no linked property is shown on its own, so there's nothing to highlight
    if (!highlightIds) highlightIds = attrs._unlinked ? [] : (attrs._consentMatches || []).map((m) => m.fileId);
    const markTerms = attrs._consentMatches ? currentTerms : [];
    els.results.querySelectorAll(".result-btn").forEach((b) => {
      if (b.dataset.key === selectedKey) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    });
    if (updateUrl) {
      const url = new URL(location.href);
      if (attrs._unlinked) {
        url.searchParams.delete("valuation");
        url.searchParams.set("consent", attrs._consentId);
      } else {
        url.searchParams.set("valuation", attrs.valuation_id);
        // Only consent-number matches go in the link (site name matches can be many)
        const idMatches = (attrs._consentMatches || []).filter((m) => m.on === "id").map((m) => m.fileId);
        if (idMatches.length) url.searchParams.set("consent", idMatches.join(","));
        else url.searchParams.delete("consent");
      }
      history.pushState({ key: selectedKey }, "", url);
    }

    renderPropertySummary(attrs);
    const desktop = window.matchMedia("(min-width: 861px)").matches;
    if (scrollToTop && desktop) scrollToWorkArea();
    if (detailController) detailController.abort();
    detailController = new AbortController();
    const { signal } = detailController;

    showOnMap(attrs, signal);
    const matchRow = await loadConsents(attrs, signal, highlightIds, markTerms);

    if (matchRow) {
      updateStickyHeight();   // the new property's header may be taller; measure before scrolling
      matchRow.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (!desktop) {
      els.detailContent.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderPropertySummary(a) {
    els.detailEmpty.hidden = true;
    els.detailContent.hidden = false;
    els.propertyTitle.textContent = a._unlinked ? "No linked property" : (a.address || `Valuation ${a.valuation_id}`);
    els.propertySites.hidden = true;
    els.propertySites.innerHTML = "";
    const facts = a._unlinked
      ? [["Valuation number", a._valuationNote]]
      : [
        ["Valuation number", a.valuation_id],
        ["Legal description", a.m_property_legal_desc || a.m_supplementary_legal_desc],
        ["Certificate of title", a.m_cert_of_title || a.certificate_of_title]
      ].filter(([, v]) => v);
    els.propertyFacts.innerHTML = facts
      .map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`)
      .join("");
    document.title = `[Beta] ${els.propertyTitle.textContent} – consents | Taupō District Council`;
  }

  async function showOnMap(a, signal) {
    selectionLayer.removeAll();
    if (a._unlinked) {
      view.goTo({ center: CFG.initialCenter, zoom: CFG.initialZoom }, { duration: 600, signal }).catch(() => {});
      return;
    }
    try {
      const fs = await propertyLayer.queryFeatures({
        where: `OBJECTID = ${Number(a.OBJECTID)}`,
        returnGeometry: true,
        outSpatialReference: view.spatialReference
      }, { signal });
      const f = fs.features[0];
      if (!f || !f.geometry) return;
      selectionLayer.add(new Graphic({
        geometry: f.geometry,
        symbol: {
          type: "simple-fill",
          color: [0, 96, 122, 0.18],
          outline: { color: [0, 96, 122, 1], width: 3 }
        }
      }));
      await view.goTo({ target: f.geometry.extent.clone().expand(2.2) }, { duration: 600, signal });
    } catch (err) {
      if (!isAbort(err)) console.warn("Could not show property on map", err);
    }
  }

  // Returns the first highlighted consent row, if any.
  async function loadConsents(property, signal, highlightIds = [], markTerms = []) {
    const valuationId = property.valuation_id;
    // Keep the previous consents on screen (dimmed) until the new ones arrive,
    // so the page height doesn't collapse and jump while loading.
    els.detailContent.classList.add("is-loading");
    els.detailContent.setAttribute("aria-busy", "true");
    setStatus(els.consentsStatus, "Loading consents…");
    const done = () => {
      els.detailContent.classList.remove("is-loading");
      els.detailContent.removeAttribute("aria-busy");
    };

    let rows;
    try {
      const fs = await consentsTable.queryFeatures({
        where: property._unlinked
          ? `CONSENT_FILE_ID = ${sqlString(property._consentId)}`
          : `${CFG.consentKeyField} = ${sqlString(valuationId)}`,
        outFields: CONSENT_FIELDS,
        returnGeometry: false,
        num: 2000
      }, { signal });
      // The table has a row per consent per linked property; show each consent once
      const seen = new Set();
      rows = fs.features.map((f) => f.attributes).filter((r) => {
        const k = `${r.CONSENT_APPLN_ID}|${r.CONSENT_FILE_ID}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    } catch (err) {
      if (isAbort(err)) return;
      console.error(err);
      done();
      els.tabs.hidden = true;
      els.panelBuilding.innerHTML = "";
      els.panelResource.innerHTML = "";
      els.panelOther.innerHTML = "";
      els.panelBuilding.hidden = true;
      els.panelResource.hidden = true;
      els.panelOther.hidden = true;
      setStatus(els.consentsStatus, "Sorry, consent information is not available right now. Please try again.", true);
      return;
    }
    done();

    // Newest first
    rows.sort((x, y) =>
      (parseDate(y.CONSENT_LODGED_DATE) || 0) - (parseDate(x.CONSENT_LODGED_DATE) || 0) ||
      String(y.CONSENT_FILE_ID).localeCompare(String(x.CONSENT_FILE_ID)));

    const cat = (r) => consentTypeInfo(r.CONSENT_APPLN_TYPE).category;
    const building = rows.filter((r) => cat(r) === "building");
    const resource = rows.filter((r) => cat(r) === "resource");
    const other = rows.filter((r) => cat(r) === "other");

    els.countBuilding.textContent = building.length;
    els.countResource.textContent = resource.length;
    els.countOther.textContent = other.length;
    els.tabOther.hidden = !other.length;          // only shown when needed
    const hl = new Set(highlightIds.map((id) => String(id).toUpperCase()));
    els.panelBuilding.innerHTML = consentTable(building, "building", hl, markTerms);
    els.panelResource.innerHTML = consentTable(resource, "resource", hl, markTerms);
    els.panelOther.innerHTML = consentTable(other, "other", hl, markTerms);
    renderSiteNames(property, rows);

    if (!rows.length) {
      setStatus(els.consentsStatus, "No building or resource consents were found for this property.");
    } else {
      setStatus(els.consentsStatus,
        `${rows.length} ${rows.length === 1 ? "consent" : "consents"} found: ` +
        `${building.length} building, ${resource.length} resource` +
        (other.length ? `, ${other.length} other.` : "."));
    }
    els.tabs.hidden = false;
    // Open the tab holding the first highlighted consent, else building (if any)
    const firstMatch = rows.find((r) => hl.has(String(r.CONSENT_FILE_ID).toUpperCase()));
    const tabFor = { building: els.tabBuilding, resource: els.tabResource, other: els.tabOther };
    const tab = firstMatch
      ? tabFor[cat(firstMatch)]
      : (building.length ? els.tabBuilding : resource.length ? els.tabResource : other.length ? els.tabOther : els.tabBuilding);
    selectTab(tab, false);
    const cards = els.detailContent.classList.contains("use-cards");
    return firstMatch ? $(tab.getAttribute("aria-controls")).querySelector(cards ? ".consent-card.is-match" : "tr.is-match") : null;
  }

  // Site names from the consents that differ from the rating address, under the address heading.
  function renderSiteNames(property, consents) {
    const seen = new Set([compareKey(property.address)]);
    const names = [];
    for (const c of consents) {
      const name = tidySiteName(c.CONSENT_SITE_NAME);
      const k = compareKey(name);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      names.push(name);
    }
    if (!names.length) { els.propertySites.hidden = true; return; }
    const SHOW = 3;
    const list = (arr) => arr.map((n) => `<span class="site">${escapeHtml(n)}</span>`).join("");
    els.propertySites.innerHTML =
      `<span class="label">${names.length === 1 ? "Consent site name" : "Consent site names"}:</span> ` +
      `<span class="sites">${list(names.slice(0, SHOW))}</span>` +
      (names.length > SHOW
        ? `<span class="sites-more" hidden>${list(names.slice(SHOW))}</span>` +
          `<button type="button" class="link-btn" aria-expanded="false">+${names.length - SHOW} more</button>`
        : "");
    const btn = els.propertySites.querySelector(".link-btn");
    if (btn) btn.addEventListener("click", () => {
      const more = els.propertySites.querySelector(".sites-more");
      const open = more.hidden;
      more.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      btn.textContent = open ? "show fewer" : `+${names.length - SHOW} more`;
    });
    els.propertySites.hidden = false;
  }

  // Decision outcome under the status badge, only when it says something the stage doesn't
  // Outlined pill under the stage badge; "Decision:" is in the tooltip and for screen readers
  function decisionNote(r, stage) {
    const code = r.CONSENT_DECISION_TYPE_CODE;
    if (!code) return "";
    const d = CFG.decisions[code] || { label: code, tone: "neutral" };
    if (d.label.toUpperCase() === stage.label.toUpperCase()) return "";
    return `<span class="status decision ${d.tone}" title="Decision: ${escapeHtml(d.label)}">` +
      `<span class="visually-hidden">Decision: </span>${escapeHtml(d.label)}</span>`;
  }

  function consentTable(rows, kind, hl = new Set(), markTerms = []) {
    if (!rows.length) {
      return `<p class="none">No ${kind} consents were found for this property.</p>`;
    }
    const kindLabel = { building: "Building Consent", resource: "Resource Consent" }[kind] || "Consent";
    const cards = [];
    const body = rows.map((r) => {
      const type = consentTypeInfo(r.CONSENT_APPLN_TYPE);
      const stage = stageInfo(r.CONSENT_APPLN_STAGE_CODE, r.CONSENT_STATUS);
      const lodged = formatDate(r.CONSENT_LODGED_DATE);
      const decided = formatDate(r.CONSENT_DECISION_DATE);
      const closedLabel = r.CONSENT_COMPLETED_DATE ? "Completed" : (r.CONSENT_LAPSED_DATE ? "Lapsed" : "");
      const closed = formatDate(r.CONSENT_COMPLETED_DATE || r.CONSENT_LAPSED_DATE);
      const closedText = closed ? `${closed}${closedLabel === "Lapsed" ? " (lapsed)" : ""}` : "–";
      const isMatch = hl.has(String(r.CONSENT_FILE_ID).toUpperCase());
      const pills = `<span class="status ${stage.tone}">${escapeHtml(stage.label)}</span>${decisionNote(r, stage)}`;
      const site = r.CONSENT_SITE_NAME ? highlight(tidySiteName(r.CONSENT_SITE_NAME), markTerms) : "";

      // Phone card: one line per item, same font size throughout
      cards.push(`<li class="consent-card${isMatch ? " is-match" : ""}">
        <p class="cc-title">${kindLabel}: ${highlight(r.CONSENT_FILE_ID || r.CONSENT_APPLN_ID, markTerms)}</p>
        ${isMatch ? '<p><span class="match-tag">Search match</span></p>' : ""}
        <p><span class="cc-k">Application:</span> ${escapeHtml(type.label)}</p>
        ${r.CONSENT_DESCRIPTION ? `<p class="cc-desc">${escapeHtml(r.CONSENT_DESCRIPTION)}</p>` : ""}
        ${site ? `<p><span class="cc-k">Site:</span> ${site}</p>` : ""}
        <p class="cc-status"><span class="cc-k">Status:</span> ${pills}</p>
        <p><span class="cc-k">Lodged:</span> ${lodged || "–"}</p>
        <p><span class="cc-k">Determined:</span> ${decided || "–"}</p>
        <p><span class="cc-k">Completed / Lapsed:</span> ${closedText}</p>
      </li>`);

      return `<tr${isMatch ? ' class="is-match"' : ""}>
        <td data-label="Consent">
          <span class="consent-id">${highlight(r.CONSENT_FILE_ID || r.CONSENT_APPLN_ID, markTerms)}</span>
          ${r.CONSENT_APPLN_TYPE ? `<span class="consent-code">${escapeHtml(r.CONSENT_APPLN_TYPE)}</span>` : ""}
          <span class="consent-type">${escapeHtml(type.label)}</span>
          ${isMatch ? '<span class="match-tag">Search match</span>' : ""}
        </td>
        <td data-label="Description" class="desc">
          ${escapeHtml(r.CONSENT_DESCRIPTION || "")}
          ${r.CONSENT_SITE_NAME ? `<span class="consent-site">Site: ${highlight(tidySiteName(r.CONSENT_SITE_NAME), markTerms)}</span>` : ""}
        </td>
        <td data-label="Status"><span class="status-stack">${pills}</span></td>
        <td data-label="Lodged" class="nowrap">${lodged || "–"}</td>
        <td data-label="Determined" class="nowrap">${decided || "–"}</td>
        <td data-label="${closedLabel || "Completed / lapsed"}" class="nowrap">${closedText}</td>
      </tr>`;
    }).join("");
    return `<div class="table-wrap"><table class="consents">
      <caption class="visually-hidden">${kind === "building" ? "Building" : "Resource"} consents, newest first</caption>
      <thead><tr>
        <th scope="col">Consent</th><th scope="col">Description</th><th scope="col">Status</th>
        <th scope="col">Lodged</th><th scope="col">Determined</th><th scope="col">Completed / lapsed</th>
      </tr></thead>
      <tbody>${body}</tbody></table></div>
      <ul class="consent-cards" aria-label="${kindLabel}s, newest first">${cards.join("")}</ul>`;
  }

  // ---------------------------------------------------------------- sticky header
  // The column headings stick directly under the sticky property block, whose
  // height changes (long addresses, "+N more" site names), so track it.
  const stickyBlock = $("detail-sticky");
  function updateStickyHeight() {
    document.documentElement.style.setProperty("--sticky-h", `${Math.ceil(stickyBlock.getBoundingClientRect().height)}px`);
  }
  new ResizeObserver(updateStickyHeight).observe(stickyBlock);

  // ---------------------------------------------------------------- card mode
  // Show the compact cards instead of the table whenever the table wouldn't fit
  // the consents area without columns being cut off: always on phones, and on
  // tablets / small windows when needed. Re-checked on tab change and resize.
  const phoneQuery = window.matchMedia("(max-width: 640px)");
  function updateCardMode() {
    const dc = els.detailContent;
    if (dc.hidden) return;
    if (phoneQuery.matches) { dc.classList.add("use-cards"); return; }
    const panel = [els.panelBuilding, els.panelResource, els.panelOther].find((p) => !p.hidden);
    const table = panel && panel.querySelector("table.consents");
    if (!table) return;                       // nothing to measure (no consents in this tab)
    dc.classList.remove("use-cards");         // measure the table at its natural width...
    const fits = table.getBoundingClientRect().width <= panel.clientWidth + 1;
    dc.classList.toggle("use-cards", !fits);  // ...and switch before the browser paints
  }
  let lastDetailWidth = 0;
  new ResizeObserver((entries) => {
    const w = Math.round(entries[0].contentRect.width);
    if (w !== lastDetailWidth) { lastDetailWidth = w; updateCardMode(); }
  }).observe(document.querySelector(".detail"));

  // ---------------------------------------------------------------- tabs
  const tabs = [els.tabBuilding, els.tabResource, els.tabOther];
  function selectTab(tab, focus = true) {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute("aria-controls")).hidden = !on;
    }
    updateCardMode();
    if (focus) tab.focus();
  }
  tabs.forEach((t) => {
    t.addEventListener("click", () => selectTab(t));
    t.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const shown = tabs.filter((x) => !x.hidden);   // skip the Other tab when it's hidden
        const i = shown.indexOf(t);
        selectTab(shown[(i + (e.key === "ArrowRight" ? 1 : shown.length - 1)) % shown.length]);
      }
    });
  });

  // ---------------------------------------------------------------- map click
  view.on("click", async (event) => {
    if (view.scale > CFG.parcelMinScale) {
      view.goTo({ target: event.mapPoint, scale: CFG.parcelMinScale / 2 }, { duration: 500 }).catch(() => {});
      return;
    }
    if (searchController) searchController.abort();
    searchController = new AbortController();
    const { signal } = searchController;
    try {
      const fs = await propertyLayer.queryFeatures({
        geometry: event.mapPoint,
        spatialRelationship: "intersects",
        outFields: PROPERTY_FIELDS,
        returnGeometry: false,
        num: CFG.maxResults
      }, { signal });
      const rows = sortResults(fs.features.map((f) => f.attributes), []);
      if (!rows.length) return;
      els.input.value = "";
      els.clear.hidden = true;
      currentResults = rows;
      currentTerms = [];
      currentKey = "";   // empty box: Enter picks the top property at the clicked spot
      renderResults(rows, [], rows.length);
      setStatus(els.resultsStatus, rows.length === 1
        ? "1 property at the location you clicked."
        : `${rows.length} properties at the location you clicked.`);
      loadConsentCounts(rows, signal);
      if (rows.length === 1) selectProperty(rows[0]);
    } catch (err) {
      if (!isAbort(err)) console.warn("Map identify failed", err);
    }
  });

  // ---------------------------------------------------------------- wiring
  // Search hint: collapse it while the results list has properties in it,
  // show it again whenever the list is empty (start, < 3 chars, no matches, reset).
  const hint = $("search-hint");
  const syncHint = () => hint.classList.toggle("is-collapsed", els.results.children.length > 0);
  new MutationObserver(syncHint).observe(els.results, { childList: true });
  syncHint();

  const debouncedSearch = debounce(runSearch, CFG.searchDebounceMs);
  els.input.addEventListener("input", () => {
    els.clear.hidden = !els.input.value;
    debouncedSearch(els.input.value);
  });
  // Enter selects the top result (searching first if the list isn't up to date).
  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    debouncedSearch.cancel();
    const text = els.input.value;
    const key = searchTerms(text).join(" ");
    const results = key === currentKey && currentResults.length ? currentResults : await runSearch(text);
    // Ignore if the user kept typing while the search ran
    if (results && results.length && searchTerms(els.input.value).join(" ") === key) {
      selectProperty(results[0]);
    }
  });
  els.input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      const first = els.results.querySelector(".result-btn");
      if (first) { e.preventDefault(); first.focus(); }
    }
  });
  els.results.addEventListener("keydown", (e) => {
    if (!e.target.classList.contains("result-btn")) return;
    const li = e.target.parentElement;
    if (e.key === "ArrowDown" && li.nextElementSibling) {
      e.preventDefault(); li.nextElementSibling.firstElementChild.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      (li.previousElementSibling ? li.previousElementSibling.firstElementChild : els.input).focus();
    }
  });
  // × in the search box: same as the map Home button (clear everything, reset the map)
  els.clear.addEventListener("click", goHome);

  // Deep link: ?valuation=0730200400 (also supports ?q=search text)
  async function loadFromUrl() {
    const params = new URLSearchParams(location.search);
    const v = params.get("valuation");
    const q = params.get("q");
    if (q && !els.input.value) {
      els.input.value = q;
      els.clear.hidden = false;
      runSearch(q);
    }
    const consentParam = params.get("consent");
    if (!v && consentParam) {             // ?consent=ID alone: a consent with no linked property
      openUnlinkedFromUrl(consentParam.split(",")[0]);
      return;
    }
    if (!v) {
      if (selectedKey) clearSelection();
      return;
    }
    try {
      const fs = await propertyLayer.queryFeatures({
        where: `valuation_id = ${sqlString(v)}`,
        outFields: PROPERTY_FIELDS,
        returnGeometry: false,
        num: 1
      });
      if (fs.features.length) {
        const attrs = fs.features[0].attributes;
        if (!els.results.children.length) {
          renderResults([attrs], [], 1);
          loadConsentCounts([attrs]);
        }
        selectProperty(attrs, { updateUrl: false, scrollToTop: false, highlightIds: consentParam ? consentParam.split(",") : [] });
      } else {
        setStatus(els.resultsStatus, `No property found with valuation number ${v}.`, true);
      }
    } catch (err) {
      console.error(err);
    }
  }
  // ---------------------------------------------------------------- reset
  function clearSelection() {
    if (detailController) detailController.abort();
    selectedKey = null;
    selectionLayer.removeAll();
    els.results.querySelectorAll('.result-btn[aria-current="true"]').forEach((b) => b.removeAttribute("aria-current"));
    els.detailContent.hidden = true;
    els.detailContent.classList.remove("is-loading");
    els.detailContent.removeAttribute("aria-busy");
    els.detailEmpty.hidden = false;
    els.tabs.hidden = true;
    els.panelBuilding.innerHTML = "";
    els.panelResource.innerHTML = "";
    els.panelOther.innerHTML = "";
    setStatus(els.consentsStatus, "");
    document.title = DEFAULT_TITLE;
  }

  // Clear the search box, results and selected property (map is reset by the Home button itself).
  function resetAll() {
    debouncedSearch.cancel();
    if (searchController) searchController.abort();
    els.input.value = "";
    els.clear.hidden = true;
    currentResults = [];
    currentTerms = [];
    currentKey = null;
    els.results.innerHTML = "";
    setStatus(els.resultsStatus, "");
    clearSelection();
    if (location.search) history.pushState({}, "", location.pathname);
  }

  async function openUnlinkedFromUrl(consentId) {
    try {
      const fs = await consentsTable.queryFeatures({
        where: `CONSENT_FILE_ID = ${sqlString(consentId)}`,
        outFields: ["CONSENT_FILE_ID", "CONSENT_SITE_NAME", "CONSENT_APPLN_TYPE", CFG.consentKeyField],
        returnGeometry: false
      });
      if (!fs.features.length) {
        setStatus(els.resultsStatus, `No consent found with number ${consentId}.`, true);
        return;
      }
      const c = fs.features[0].attributes;
      const v = fs.features.map((f) => f.attributes[CFG.consentKeyField]).find(Boolean);
      const attrs = {
        _unlinked: true,
        _consentId: c.CONSENT_FILE_ID,
        _valuationNote: v ? `${v} (no matching property)` : "Not specified",
        _consentMatches: [{ fileId: c.CONSENT_FILE_ID, site: tidySiteName(c.CONSENT_SITE_NAME), type: c.CONSENT_APPLN_TYPE, on: "id" }],
        _ownMatch: false
      };
      if (!els.results.children.length) {
        renderResults([attrs], [], 1);
        setStatus(els.resultsStatus, "1 consent with no linked property.");
      }
      selectProperty(attrs, { updateUrl: false, scrollToTop: false });
    } catch (err) {
      console.error(err);
    }
  }

  window.addEventListener("popstate", loadFromUrl);
  loadFromUrl();
})();
