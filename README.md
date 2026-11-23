# consents-search

One page that replaces Taupō District Council's separate building consent and resource consent search pages.

1. Search the **Rateable Property** layer by valuation number, address or legal description. Each word is matched with a case-insensitive wildcard against `valuation_id`, `address`, `m_property_legal_desc`, `m_supplementary_legal_desc` and `m_cert_of_title`.
2. Matches appear in a list as you type. Each one shows how many consents it has.
3. Select a property to see its building and resource consents. The consents table is joined on `valuation_id` = `PROP_Valuation_Reference_Number` (one property to many consents). The parcel is highlighted on the map.

You can also click a parcel on the map. A property can be linked directly with `?valuation=0730200400`, and a search with `?q=tongariro`.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page markup. Loads the ArcGIS Maps SDK for JavaScript (4.34) from js.arcgis.com |
| `js/config.js` | Service URLs, join fields, search fields, and labels for consent type and stage codes |
| `js/app.js` | Search, results, consents, map and deep-link logic |
| `css/styles.css` | Responsive layout: a sidebar on desktop, stacked on narrow screens, with table rows shown as cards on phones |

## Services

- `property/Rateable_Property/FeatureServer/0` (polygons, NZTM)
- `regulatory/consents/FeatureServer/0` (table)

Both are public and send CORS headers, so no API key or proxy is needed. The basemap is Esri `topo-vector`, which also needs no key.

## Running locally

Serve the folder over HTTP, for example `python3 -m http.server`, then open http://localhost:8000.

## Upgrading to SDK 5.x

The code loads modules with `$arcgis.import`, so to upgrade, replace the script tag with
`<script type="module" src="https://js.arcgis.com/5.0/"></script>` and update the CSS URL to match.
