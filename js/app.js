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
    propertyFacts: $("property-facts"),
    consentsStatus: $("consents-status"),
    tabs: $("consent-tabs"),
    tabBuilding: $("tab-building"),
    tabResource: $("tab-resource"),
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

  // ---------------------------------------------------------------- helpers
  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
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

  function searchTerms(text) {
    return normalise(text)
      .toUpperCase()
      .replace(/[%_]/g, " ")        // don't let users inject wildcards
      .replace(/,/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  }

  // Every term must appear in at least one search field.
  function buildWhere(terms) {
    return terms.map((t) => {
      const like = sqlString("%" + t + "%");
      return "(" + CFG.searchFields.map((f) => `UPPER(${f}) LIKE ${like}`).join(" OR ") + ")";
    }).join(" AND ");
  }

  function highlight(text, terms) {
    const safe = escapeHtml(text);
    if (!terms.length || !text) return safe;
    const pattern = terms
      .map((t) => escapeHtml(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .sort((a, b) => b.length - a.length)
      .join("|");
    return safe.replace(new RegExp(`(${pattern})`, "gi"), "<mark>$1</mark>");
  }

  // Dates come through as strings like "28-Jan-1993 00:00:00".
  const MONTHS = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
  function parseDate(s) {
    if (!s) return null;
    const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(s);
    if (m) return new Date(+m[3], MONTHS[m[2].toUpperCase()], +m[1]);
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }
  const dateFmt = new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", year: "numeric" });
  function formatDate(s) {
    const d = parseDate(s);
    return d ? dateFmt.format(d) : "";
  }

  function consentTypeInfo(code) {
    const known = CFG.consentTypes[code];
    if (known) return known;
    const category = /^RC/i.test(code || "") ? "resource" : "building";
    return { label: code || "Unknown", category };
  }

  function stageInfo(code) {
    if (!code) return { label: "Unknown", tone: "neutral" };
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
  let selectedValuation = null;

  async function runSearch(text) {
    const terms = searchTerms(text);
    const joined = terms.join("");
    if (searchController) searchController.abort();

    if (joined.length < CFG.minSearchLength) {
      currentResults = [];
      renderResults([], terms, 0);
      setStatus(els.resultsStatus, text.trim() ? `Type at least ${CFG.minSearchLength} characters.` : "");
      return;
    }

    searchController = new AbortController();
    const { signal } = searchController;
    setStatus(els.resultsStatus, "Searching…");

    try {
      const where = buildWhere(terms);
      const [fs, total] = await Promise.all([
        propertyLayer.queryFeatures({
          where,
          outFields: PROPERTY_FIELDS,
          returnGeometry: false,
          orderByFields: ["address", "valuation_id"],
          num: CFG.maxResults
        }, { signal }),
        propertyLayer.queryFeatureCount({ where }, { signal })
      ]);
      const results = sortResults(fs.features.map((f) => f.attributes), terms);
      currentResults = results;
      currentTerms = terms;
      renderResults(results, terms, total);
      loadConsentCounts(results, signal);
    } catch (err) {
      if (isAbort(err)) return;
      console.error(err);
      setStatus(els.resultsStatus, "Sorry, the property search is not available right now. Please try again.", true);
    }
  }

  // Exact/prefix valuation matches first, then natural address order.
  function sortResults(rows, terms) {
    const first = terms[0] || "";
    const rank = (r) => {
      const v = (r.valuation_id || "").toUpperCase();
      if (v === first) return 0;
      if (v.startsWith(first)) return 1;
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
        setStatus(els.resultsStatus, "No properties match your search. Check the spelling or try fewer words.");
      }
      return;
    }
    const shown = rows.length;
    setStatus(els.resultsStatus, total > shown
      ? `Showing ${shown} of ${total.toLocaleString("en-NZ")} matches – add more detail to narrow the list.`
      : `${total} matching ${total === 1 ? "property" : "properties"}.`);

    const frag = document.createDocumentFragment();
    for (const r of rows) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "result-btn";
      btn.dataset.valuation = r.valuation_id;
      if (r.valuation_id === selectedValuation) btn.setAttribute("aria-current", "true");
      const legal = r.m_property_legal_desc || r.m_supplementary_legal_desc || "";
      btn.innerHTML = `
        <span class="result-address">
          <span>${highlight(r.address || "(no address)", terms)}</span>
          <span class="badge-count" data-count-for="${escapeHtml(r.valuation_id)}" hidden></span>
        </span>
        <span class="result-meta">Valuation <span class="val">${highlight(r.valuation_id, terms)}</span></span>
        ${legal ? `<span class="result-meta">${highlight(legal, terms)}</span>` : ""}`;
      btn.addEventListener("click", () => selectProperty(r));
      li.appendChild(btn);
      frag.appendChild(li);
    }
    els.results.appendChild(frag);
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

  async function selectProperty(attrs, { updateUrl = true } = {}) {
    selectedValuation = attrs.valuation_id;
    els.results.querySelectorAll(".result-btn").forEach((b) => {
      if (b.dataset.valuation === selectedValuation) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    });
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set("valuation", selectedValuation);
      history.pushState({ valuation: selectedValuation }, "", url);
    }

    renderPropertySummary(attrs);
    if (detailController) detailController.abort();
    detailController = new AbortController();
    const { signal } = detailController;

    showOnMap(attrs, signal);
    await loadConsents(attrs.valuation_id, signal);

    if (window.matchMedia("(max-width: 860px)").matches) {
      els.detailContent.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderPropertySummary(a) {
    els.detailEmpty.hidden = true;
    els.detailContent.hidden = false;
    els.propertyTitle.textContent = a.address || `Valuation ${a.valuation_id}`;
    const facts = [
      ["Valuation number", a.valuation_id],
      ["Legal description", a.m_property_legal_desc],
      ["Supplementary legal description",
        a.m_supplementary_legal_desc && a.m_supplementary_legal_desc !== a.m_property_legal_desc ? a.m_supplementary_legal_desc : ""],
      ["Certificate of title", a.m_cert_of_title || a.certificate_of_title]
    ].filter(([, v]) => v);
    els.propertyFacts.innerHTML = facts
      .map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`)
      .join("");
    document.title = `[Beta] ${els.propertyTitle.textContent} – consents | Taupō District Council`;
  }

  async function showOnMap(a, signal) {
    selectionLayer.removeAll();
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

  async function loadConsents(valuationId, signal) {
    els.tabs.hidden = true;
    els.panelBuilding.innerHTML = "";
    els.panelResource.innerHTML = "";
    els.panelBuilding.hidden = true;
    els.panelResource.hidden = true;
    setStatus(els.consentsStatus, "Loading consents…");

    let rows;
    try {
      const fs = await consentsTable.queryFeatures({
        where: `${CFG.consentKeyField} = ${sqlString(valuationId)}`,
        outFields: CONSENT_FIELDS,
        returnGeometry: false,
        num: 2000
      }, { signal });
      rows = fs.features.map((f) => f.attributes);
    } catch (err) {
      if (isAbort(err)) return;
      console.error(err);
      setStatus(els.consentsStatus, "Sorry, consent information is not available right now. Please try again.", true);
      return;
    }

    // Newest first
    rows.sort((x, y) =>
      (parseDate(y.CONSENT_LODGED_DATE) || 0) - (parseDate(x.CONSENT_LODGED_DATE) || 0) ||
      String(y.CONSENT_FILE_ID).localeCompare(String(x.CONSENT_FILE_ID)));

    const building = rows.filter((r) => consentTypeInfo(r.CONSENT_APPLN_TYPE).category === "building");
    const resource = rows.filter((r) => consentTypeInfo(r.CONSENT_APPLN_TYPE).category === "resource");

    els.countBuilding.textContent = building.length;
    els.countResource.textContent = resource.length;
    els.panelBuilding.innerHTML = consentTable(building, "building");
    els.panelResource.innerHTML = consentTable(resource, "resource");

    if (!rows.length) {
      setStatus(els.consentsStatus, "No building or resource consents are recorded against this valuation number.");
    } else {
      setStatus(els.consentsStatus,
        `${rows.length} ${rows.length === 1 ? "consent" : "consents"} found: ` +
        `${building.length} building, ${resource.length} resource.`);
    }
    els.tabs.hidden = false;
    selectTab(building.length || !resource.length ? els.tabBuilding : els.tabResource, false);
  }

  function consentTable(rows, kind) {
    if (!rows.length) {
      return `<p class="none">No ${kind} consents are recorded for this property.</p>`;
    }
    const body = rows.map((r) => {
      const type = consentTypeInfo(r.CONSENT_APPLN_TYPE);
      const stage = stageInfo(r.CONSENT_APPLN_STAGE_CODE);
      const lodged = formatDate(r.CONSENT_LODGED_DATE);
      const decided = formatDate(r.CONSENT_DECISION_DATE);
      const closedLabel = r.CONSENT_COMPLETED_DATE ? "Completed" : (r.CONSENT_LAPSED_DATE ? "Lapsed" : "");
      const closed = formatDate(r.CONSENT_COMPLETED_DATE || r.CONSENT_LAPSED_DATE);
      return `<tr>
        <td data-label="Consent">
          <span class="consent-id">${escapeHtml(r.CONSENT_FILE_ID || r.CONSENT_APPLN_ID)}</span>
          <span class="consent-type" title="${escapeHtml(r.CONSENT_APPLN_TYPE)}">${escapeHtml(type.label)}</span>
        </td>
        <td data-label="Description" class="desc">
          ${escapeHtml(r.CONSENT_DESCRIPTION || "")}
          ${r.CONSENT_SITE_NAME ? `<span class="consent-site">Site: ${escapeHtml(r.CONSENT_SITE_NAME)}</span>` : ""}
        </td>
        <td data-label="Status"><span class="status ${stage.tone}">${escapeHtml(stage.label)}</span></td>
        <td data-label="Lodged" class="nowrap">${lodged || "–"}</td>
        <td data-label="Decision" class="nowrap">${decided || "–"}</td>
        <td data-label="${closedLabel || "Completed / lapsed"}" class="nowrap">${closed ? `${closed}${closedLabel === "Lapsed" ? " (lapsed)" : ""}` : "–"}</td>
      </tr>`;
    }).join("");
    return `<div class="table-wrap"><table class="consents">
      <caption class="visually-hidden">${kind === "building" ? "Building" : "Resource"} consents, newest first</caption>
      <thead><tr>
        <th scope="col">Consent</th><th scope="col">Description</th><th scope="col">Status</th>
        <th scope="col">Lodged</th><th scope="col">Decision</th><th scope="col">Completed / lapsed</th>
      </tr></thead>
      <tbody>${body}</tbody></table></div>`;
  }

  // ---------------------------------------------------------------- tabs
  const tabs = [els.tabBuilding, els.tabResource];
  function selectTab(tab, focus = true) {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute("aria-controls")).hidden = !on;
    }
    if (focus) tab.focus();
  }
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => selectTab(t));
    t.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        selectTab(tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]);
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
  const debouncedSearch = debounce(runSearch, CFG.searchDebounceMs);
  els.input.addEventListener("input", () => {
    els.clear.hidden = !els.input.value;
    debouncedSearch(els.input.value);
  });
  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    runSearch(els.input.value);
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
  els.clear.addEventListener("click", () => {
    els.input.value = "";
    els.clear.hidden = true;
    runSearch("");
    els.input.focus();
  });

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
    if (!v) {
      selectedValuation = null;
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
        selectProperty(attrs, { updateUrl: false });
      } else {
        setStatus(els.resultsStatus, `No property found with valuation number ${v}.`, true);
      }
    } catch (err) {
      console.error(err);
    }
  }
  window.addEventListener("popstate", loadFromUrl);
  loadFromUrl();
})();
