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

  // Consent fields also searched. A match here returns the property the
  // consent belongs to, with the matching consent shown under its address.
  consentSearchFields: ["CONSENT_FILE_ID", "CONSENT_SITE_NAME"],
  maxConsentMatches: 2000,

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
  // Anything not listed falls back to prefix: BC* = building, RC* = resource,
  // anything else = "other" (an Other tab appears only when needed).
  // The raw code is always shown above the label.
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
    RCVARNCOND: { label: "Variation of conditions", category: "resource" },
    // Added with the full dataset (labels are best guesses until confirmed)
    BCEXTTIME: { label: "Extension of time", category: "building" },
    BCPIMGF: { label: "PIM – granny flat", category: "building" },
    BCREACTIV: { label: "Reactivation of building consent", category: "building" },
    RC223224C: { label: "Section 223 / 224(c) certificate", category: "resource" },
    RCBLDLNRES: { label: "Building line restriction cancellation", category: "resource" },
    RCCEREXUSE: { label: "Certificate of existing use", category: "resource" },
    RCCOMBINED: { label: "Combined land use and subdivision", category: "resource" },
    RCDEEMBDRY: { label: "Deemed permitted boundary activity", category: "resource" },
    RCPOSTSUB: { label: "Post-subdivision", category: "resource" },
    RCS224CER: { label: "Section 224(c) certificate", category: "resource" }
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
    REFUSED: { label: "Refused", tone: "bad" },
    GRANTED: { label: "Granted", tone: "good" },
    RESOLVED: { label: "Resolved", tone: "good" },
    NOTIFIED: { label: "Notified", tone: "info" },
    HEARING: { label: "Hearing", tone: "info" },
    INFREQUEST: { label: "Further information requested", tone: "info" },
    REMINDISSU: { label: "Reminder issued", tone: "info" },
    APPEALED: { label: "Appealed", tone: "warn" },
    EXPIRED: { label: "Expired", tone: "warn" }
  },

  // CONSENT_STATUS letter -> label. Only used when a consent has no stage code.
  // (P, Q and A all appear as Historic / Archived in the council's system – assumed.)
  statuses: {
    L: { label: "Lodged", tone: "info" },
    C: { label: "Current", tone: "info" },
    D: { label: "Determined", tone: "good" },
    P: { label: "Historic / archived", tone: "neutral" },
    Q: { label: "Historic / archived", tone: "neutral" },
    A: { label: "Historic / archived", tone: "neutral" },
    R: { label: "Rejected", tone: "bad" },
    X: { label: "Cancelled", tone: "neutral" },
    S: { label: "Suspended", tone: "warn" }
  },

  // CONSENT_DECISION_TYPE_CODE -> label and colour, shown as an outlined pill
  // under the status when it adds something (e.g. "Granted" under "Issued").
  // Codes not listed show as-is in grey.
  decisions: {
    GRANTED: { label: "Granted", tone: "good" },
    APPROVED: { label: "Approved", tone: "good" },
    ALLOWED: { label: "Allowed", tone: "good" },
    ISSUED: { label: "Issued", tone: "good" },
    COMPLETED: { label: "Completed", tone: "good" },
    DECLINED: { label: "Declined", tone: "bad" },
    REFUSED: { label: "Refused", tone: "bad" },
    LAPSED: { label: "Lapsed", tone: "warn" },
    EXPIRED: { label: "Expired", tone: "warn" },
    SUSPENDED: { label: "Suspended", tone: "warn" }
  }
};
