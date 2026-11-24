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
  // The consent's own valuation number is included so consents on superseded
  // valuation numbers (no longer in the property layer) can still be found.
  consentSearchFields: ["CONSENT_FILE_ID", "CONSENT_SITE_NAME", "PROP_Valuation_Reference_Number"],
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
    // Building – names as shown in the council's consenting system
    BCCOA: { label: "Certificate of Acceptance", category: "building" },
    BCCONSENT: { label: "Building Consent", category: "building" },
    BCEXEMPT: { label: "Exempt Building Work", category: "building" },
    BCEXTTIME: { label: "Extension of Time to Commence or Complete Building Work", category: "building" },
    BCICPU: { label: "Certificate for Public Use (CPU)", category: "building" },
    BCICSAMD: { label: "Compliance Schedule - Amendment (Form 11)", category: "building" },
    BCICSNEW: { label: "Compliance Schedule - New", category: "building" },
    BCISWMP: { label: "Registration of Swimming Pools", category: "building" },
    BCPIM: { label: "Project Information Memorandum", category: "building" },
    BCPIMGF: { label: "PIM - Granny Flat", category: "building" },
    BCREACTIV: { label: "Re-activate", category: "building" },
    // Resource
    RC223224C: { label: "Combined 223/224C", category: "resource" },
    RCBLDLNRES: { label: "Building Line Restriction", category: "resource" },
    RCCERCOMP: { label: "Certificate of Compliance (Section 139)", category: "resource" },
    RCCEREXUSE: { label: "Existing Use Certificate (Section 139A)", category: "resource" },
    RCCOMBINED: { label: "Combined Land Use and Subdivision Consent", category: "resource" },
    RCCONSENT: { label: "Resource Consent", category: "resource" },   // not in the current data; unconfirmed
    RCDEEMBDRY: { label: "Deemed Permitted Boundary Activity (Section 87BA)", category: "resource" },
    RCEXTTIME: { label: "Extension of Time (Section 125)", category: "resource" },
    RCLANDUSE: { label: "Land Use Consent", category: "resource" },
    RCOUTLINE: { label: "Outline Plan", category: "resource" },
    RCPOSTSUB: { label: "Post-Subdivision", category: "resource" },
    RCRIGHTWAY: { label: "Right of Way", category: "resource" },       // assumed; to be confirmed
    RCS224CER: { label: "Compliance Certificate (Section 224)", category: "resource" },
    RCSUBDIVN: { label: "Subdivision Consent", category: "resource" },
    RCVARNCOND: { label: "Variation to Consent Notice Condition (Section 221)", category: "resource" }
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

  // CONSENT_STATUS letter -> label, as shown in the council's system (confirmed
  // against example consents). Only used when a consent has no stage code.
  // Q and A couldn't be matched to live consents, so they show the raw code.
  statuses: {
    L: { label: "Lodged", tone: "info" },
    C: { label: "Current", tone: "info" },
    D: { label: "Determined", tone: "good" },
    P: { label: "Historic / Archived", tone: "neutral" },
    Q: { label: "Q", tone: "neutral" },
    A: { label: "A", tone: "neutral" },
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
