# Follow-ups

Open questions and issues to resolve before this page goes live. Newest first within each section.

## Data (for the council / data export)

### Unit and sub-addresses missing from the property layer
*Logged 2026-11-24*

The GIS isn't receiving unit and sub-addresses from CiAnywhere, so the Rateable Property `address` field only has the base street address:
- None of the 26,727 addresses contain a unit (no `1/102 …` style addresses).
- Over 2,000 addresses are shared by more than one valuation, covering at least 5,696 valuations.

Example: valuations **0730164291A** (Flat 1) and **0730164291B** (Flat 2) both show as **102 Lakewood Drive Taupo**.

Effect on the page:
- **Searching by unit:** searching "1/102 Lakewood" finds nothing from the property address. It only works if a consent's site name happens to contain it (e.g. "1/102 Lakewood Drive, Taupo").
- **Results list:** units at the same address look identical in the results list. People have to tell them apart by valuation number and legal description (e.g. "Flat 1 DPS 81750 …").

**To fix:** include unit / sub-address in the GIS address feed from CiAnywhere. Once it's there, the page needs no changes: unit searches will match, and the results list will show the full address.

### Decision type set on consents that haven't been decided
*Logged 2026-11-24*

`CONSENT_DECISION_TYPE_CODE` is filled in on consents that are still Lodged or Current and have no decision date. For example, **BC2026/260888** (6 Ferry Road) has status `C` (Current), stage `INPROGRESS` and decision type `COMPLETED`, with no decision or completed date. The council's system doesn't show a decision for it.

- 1,144 Lodged/Current consents have a decision type set (284 of them `COMPLETED`).
- 32,056 rows have a decision type but no decision date.
- The page currently shows the decision type as an outlined pill under the stage, so BC2026/260888 shows **In progress** and **Completed**, which is misleading.

**To decide:** find out (Sam) what this field means for undecided consents. Options for the page:
1. Hide the decision pill for Lodged (`L`) and Current (`C`) consents (recommended).
2. Remove the decision pill entirely, since the council's system doesn't show it on the summary screen.

### Consents not linked to a property
*Updated 2026-11-24. The page now shows these as "No linked property" results; the data still needs fixing.*

Some consents can't be linked to a property in the Rateable Property layer. The page now lists them at the end of the search results, with "No linked property" in place of the address. Selecting one shows just that consent and returns the map to the home view. They still can't appear under a property or on the map, so the underlying data needs fixing:

- **No valuation number:** 2,593 consents (5,566 rows), mostly from 2020 onwards, have no `PROP_Valuation_Reference_Number`. Example: **BC2026/CA260964** (3/51 Scannell Street). Only 4% (126) have a unit-style site name such as "3/51 …", so missing unit addresses aren't the main cause.
- **Superseded valuation numbers:** some consents are linked only to a valuation number that no longer exists in the property layer. Example: **RC2007/070363** (131 Tiverton Downs Road) is linked to **0739140100**, which appears to have been split into 0739140101, 0739140102 and **0739140103**. The last of these is 131 Tiverton Downs Road itself. Consents on old valuations should probably be carried over to the current ones.
- **Partly linked consents (export gaps):** some consents have one row linked to a valuation and other rows with an empty valuation. Example: RC2007/070363 has 1 linked row and 3 empty ones. That suggests some of the properties a consent relates to couldn't be matched to a valuation during the export. 707 unlinked consents are on more than one row; the extreme case is **BC2025/EX0475**, with 66 rows.

**To do (data):** link consents to current valuation numbers in the export, including carrying them over from superseded valuations. Once linked, they automatically appear under their properties, with no change needed to the page.

### Status Q and A records not found in the council's system
The 1,066 `Q` rows and 2 `A` rows couldn't be found in the council's system. They're probably test-only records. Check them when the real export is set up. The page shows these codes as-is.

### Possible wrong type: RC2026/260315
RC2026/260315 is typed `RCPOSTSUB` (Post-Subdivision), but its description is a liquor licence.

### Legal descriptions may be truncated
`m_property_legal_desc` in the property layer holds 60 characters, and about 400 properties are at or near that limit.

### Test data
The consents service holds test data, so counts and some records differ from the council's system. The beta banner on the page says so.

## Waiting on information

- **RCRIGHTWAY name:** currently "Right of Way" (assumed). Confirm it with a consent such as RC2026/260050.
- **Effective date:** to be added to the service (Sam), then shown as a column.
- **Decision codes `DCCONNREQD` and `DCCONREQD`:** meaning unknown, so they show as raw codes.

## App limitations

- **Speed:** searches take about 1 to 3 seconds. "Contains" searches (`LIKE '%…%'`) can't use the indexes.
- **Result limit:** results are capped at 100 properties (and 2,000 consent rows per search).
- **Phrase search:** word order matters, and abbreviations like Rd, Tce and Hwy don't match Road, Terrace and Highway. They could be expanded.
- **Caching:** GitHub Pages caches `index.html` for up to 10 minutes. CSS and JS are version-stamped (`?v=`), so bump the stamp on every change.
- **ArcGIS SDK:** the page uses 4.34, the last 4.x release, and should move to 5.x. The keyless Esri basemap could change.

## Before going live

### Deploy to the ArcGIS Web Adaptor web servers
Copy the app's files to the web servers behind the **external and internal ArcGIS Web Adaptors**. Both serve the same URL, so the files must go on **both** servers and be kept identical:
- `index.html`
- `css/`
- `js/`
- `assets/`

Docs files (`README.md`, `FOLLOW-UPS.md`, `LICENSE`) aren't needed. Once it's there, it replaces the GitHub Pages copy.

On every update, copy the changed files to both servers, and bump the `?v=` version stamp in `index.html` so browsers fetch the new CSS and JS.

### Repoint the existing website links
Replace the old search links on the council website with the link to this app on the GIS web adaptor servers:
- **Resource consents:** on https://www.taupodc.govt.nz/rules-regulations-and-licenses/resource-consents, the "Search for your resource consent" link.
- **Building consents:** on https://www.taupodc.govt.nz/rules-regulations-and-licenses/building-and-renovations, the "Search for your building consent" link.

The old search pages themselves (`…/resource-consents/search-for-your-resource-consent` and `…/building-and-renovations/search-for-your-building-consent`) could also redirect to the new app, so bookmarks and search engine results still work.

### Other
- No code review and no automated tests.
- No formal accessibility audit.
