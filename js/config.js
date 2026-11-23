// Configuration for the Property Consents Search page.
// Edit this file to point at different services or relabel codes;
// app.js should not need to change.
window.CONSENTS_SEARCH_CONFIG = {
  // ArcGIS Maps SDK for JavaScript version loaded in index.html is set there.

  propertyLayerUrl:
    "https://maps.taupodc.govt.nz/server/rest/services/property/Rateable_Property/FeatureServer/0",
  consentsTableUrl:
    "https://maps.taupodc.govt.nz/server/rest/services/regulatory/consents/FeatureServer/0",

  // Join: property[propertyKeyField] === consent[consentKeyField] (1 : many)
  propertyKeyField: "valuation_id",
  consentKeyField: "PROP_Valuation_Reference_Number",

  // Fields searched with a case-insensitive wildcard (LIKE '%term%').
  // The whole search text, as one phrase, must appear in at least one of these fields.
  searchFields: [
    "valuation_id",
    "address",
    "m_property_legal_desc",
    "m_supplementary_legal_desc",
    "m_cert_of_title"
  ],

  minSearchLength: 3,
  searchDebounceMs: 300,
  maxResults: 100,

  basemap: "topo-vector",
  // Initial map view (Taupō District)
  initialCenter: [175.95, -38.75],
  initialZoom: 9,
  // Parcel boundaries are drawn at this scale and closer
  parcelMinScale: 20000,

  // Consent application type codes -> friendly label and category.
  // Anything not listed falls back to prefix: BC* = building, RC* = resource.
  consentTypes: {
    BCCONSENT: { label: "Building consent", category: "building" },
    BCCOA: { label: "Certificate of acceptance", category: "building" },
    BCEXEMPT: { label: "Exemption from building consent", category: "building" },
    BCPIM: { label: "Project information memorandum (PIM)", category: "building" },
    BCICSNEW: { label: "Compliance schedule – new", category: "building" },
    BCICSAMD: { label: "Compliance schedule – amendment", category: "building" },
    BCICPU: { label: "Certificate for public use", category: "building" },
    BCISWMP: { label: "Swimming pool inspection", category: "building" },
    RCCONSENT: { label: "Resource consent", category: "resource" },
    RCLANDUSE: { label: "Land use consent", category: "resource" },
    RCSUBDIVN: { label: "Subdivision consent", category: "resource" },
    RCCERCOMP: { label: "Certificate of compliance", category: "resource" },
    RCEXTTIME: { label: "Extension of time", category: "resource" },
    RCOUTLINE: { label: "Outline plan", category: "resource" },
    RCRIGHTWAY: { label: "Right of way approval", category: "resource" },
    RCVARNCOND: { label: "Variation of conditions", category: "resource" }
  },

  // CONSENT_APPLN_STAGE_CODE -> label shown as the consent status, with a tone for the badge colour
  stages: {
    ISSUED: { label: "Issued", tone: "good" },
    APPROVED: { label: "Approved", tone: "good" },
    COMPLETED: { label: "Completed", tone: "good" },
    CLOSED: { label: "Closed", tone: "neutral" },
    LODGED: { label: "Lodged", tone: "info" },
    RECEIVED: { label: "Received", tone: "info" },
    INPROGRESS: { label: "In progress", tone: "info" },
    MONPROG: { label: "Monitoring in progress", tone: "info" },
    SUSPENDED: { label: "Suspended", tone: "warn" },
    LAPSED: { label: "Lapsed", tone: "warn" },
    WITHDRAWN: { label: "Withdrawn", tone: "neutral" },
    REFUSED: { label: "Refused", tone: "bad" }
  }
};
