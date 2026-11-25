# Follow-ups

Open questions and issues to resolve before this page goes live. Newest first within each section.

## Raised with Benny and Sam
*2026-11-25*. These export changes have been requested; details are in the sections below.

| # | Request | Unblocks |
| --- | --- | --- |
| 1 | **Effective date** field in the consents table | The "Effective:" line on consent cards (set `effectiveDateField` in `js/config.js`) |
| 2 | **Descriptions alongside codes:** application type (required), and ideally stage, status and decision | Replacing the hand-maintained name lists in `js/config.js` |
| 3 | **Unit / sub-addresses** in the Rateable Property address | Telling flats apart; searching "1/122 Lakewood" |
| 4 | **Tidied search fields** (`address_search`, `legal_search`, `site_search`) | Exact comma/space-insensitive search; removing the comma workaround |
| 5 | **Regular refresh from production** of the four extracts in `\\virapp05\cia\in\gis` | Real data; removing the beta banner |

Not raised yet (still open below): linking consents to current valuations (no valuation / superseded / partly linked), tidying consent site names, address format consistency, trimming addresses, legal description length, and the questions for the consents team (decision type on undecided consents, status vs stage, Current + Granted, lapsed date meaning, Q/A records, `DCCONNREQD`/`DCCONREQD`, RC2026/260315, RCRIGHTWAY name).

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
- *Updated 2026-11-25:* the consent cards now show the decision on the **Determined** line, as the council's system does ("Determined: 17 Mar 2026 – Issued"). By decision, the line is shown when **either** the decision date or the decision type has a value. So BC2026/260888 shows **"Determined: Completed"** (no date) while its status is still Current / In progress, which is misleading.

**To follow up:**
- **Ask Sam / the consents team** what this field means for undecided consents (a default per application type?).
- **Then revisit the page rule.** Options:
  - only show the Determined line when there's a decision **date**, matching the council system's summary,
  - or hide the decision for Lodged (`L`) and Current (`C`) consents.

Related questions for the consents team, based on the data:
- Is `CONSENT_STATUS` set automatically from the stage, or set separately? (Status follows stage almost exactly: Rejected is always REFUSED, Suspended always SUSPENDED, Determined almost always ISSUED.)
- For resource consents, does Current + Granted (13,167 rows) mean granted and still active?
- Does `CONSENT_LAPSED_DATE` on active consents mean the date the consent *will* lapse, or the date it did? (Some Issued/In progress consents have one; 14 pool registrations have future dates.)

### Consents not linked to a property
*Updated 2026-11-24. The page now shows these as "No linked property" results; the data still needs fixing.*

Some consents can't be linked to a property in the Rateable Property layer. The page now lists them at the end of the search results, with "No linked property" in place of the address. Selecting one shows just that consent and returns the map to the home view. They still can't appear under a property or on the map, so the underlying data needs fixing:

- **No valuation number:** 2,593 consents (5,566 rows), mostly from 2020 onwards, have no `PROP_Valuation_Reference_Number`. Example: **BC2026/CA260964** (3/51 Scannell Street). Only 4% (126) have a unit-style site name such as "3/51 …", so missing unit addresses aren't the main cause.
- **Superseded valuation numbers:** some consents are linked only to a valuation number that no longer exists in the property layer. Example: **RC2007/070363** (131 Tiverton Downs Road) is linked to **0739140100**, which appears to have been split into 0739140101, 0739140102 and **0739140103**. The last of these is 131 Tiverton Downs Road itself. Consents on old valuations should probably be carried over to the current ones. Searching an old valuation number (e.g. 0739140100) now lists the consents still on it, as "No linked property".
- **Partly linked consents (export gaps):** some consents have one row linked to a valuation and other rows with an empty valuation. Example: RC2007/070363 has 1 linked row and 3 empty ones. That suggests some of the properties a consent relates to couldn't be matched to a valuation during the export. 707 unlinked consents are on more than one row; the extreme case is **BC2025/EX0475**, with 66 rows.

**To do (data):** link consents to current valuation numbers in the export, including carrying them over from superseded valuations. Once linked, they automatically appear under their properties, with no change needed to the page.

### Status Q and A records not found in the council's system
The 1,066 `Q` rows and 2 `A` rows couldn't be found in the council's system. They're probably test-only records. Check them when the real export is set up. The page shows these codes as-is.

### Possible wrong type: RC2026/260315
RC2026/260315 is typed `RCPOSTSUB` (Post-Subdivision), but its description is a liquor licence.

### Legal descriptions may be truncated
`m_property_legal_desc` in the property layer holds 60 characters, and about 400 properties are at or near that limit.

### CiAnywhere data cleaning suggestions (search quality)
*Logged 2026-11-24*

The page ignores commas and extra spaces when searching, but the ArcGIS server can't clean the data itself (its SQL has no `REPLACE`). So the page tries a few spellings of the search instead: as typed and without commas (all fields), and, **for the property address only**, with ", " at one word gap. So a search without commas doesn't match consent site names or legal descriptions that contain commas, e.g. "1 ngaio place wairakei" doesn't find the site name "1 Ngaio Place, Wairakei". Those fields could be added to `commaFields` at a small speed cost. Cleaning the data in the CiAnywhere → GIS export would make search exact, simpler and faster:

1. **Add tidied search fields** to the property layer and consents table, e.g. `address_search`, `legal_search` and `site_search`: uppercase, commas removed, single spaces, trimmed, macrons removed (ō → o). The page would then search those fields with the cleaned text. That handles any number of commas and any spacing, and the spelling workaround could be removed. **This is the main recommendation**, especially as property addresses are expected to include commas in future.
2. **Tidy consent site names** at source:
   - 18,244 rows have a space before the comma and none after (e.g. " Storey Place ,Taupo"),
   - 487 rows have double spaces,
   - some have leading spaces.
   The page tidies these for display, but searches against the raw text.
3. **Trim property addresses:** 4 addresses have leading or trailing spaces.
4. **Make address formats consistent** between property addresses and consent site names. For example, the site name "463 Broadlands Road, Taupo Ward" doesn't match the rating address "463 Broadlands Road Taupo".
5. **Include unit / sub-addresses** (see "Unit and sub-addresses missing" above).

Limits of the current page-side workaround, which the tidied fields would remove:
- **One comma only:** a full address typed without commas won't match data with two commas (e.g. "Unit 1, 102 Lakewood Drive, Taupo"). Partial searches still do.
- **Only the ", " format:** a comma typed with a space before it and none after (" ,Taupo") is matched only if it's typed that way.
- **Slower long searches:** long searches check more spellings, so they can take slightly longer.

### Source data from CiAnywhere is out of date (test data)
*Logged 2026-11-24*

The CSV extracts from CiAnywhere that feed this app and the GIS haven't been refreshed for a while, so they may not reflect production data yet. They're in `\\virapp05\cia\in\gis`:

| File | Feeds | Last modified | Size |
| --- | --- | --- | --- |
| `building_and_resource_consents.csv` | This app's consents table (`regulatory/consents`) | 21/11/2026 10:21 am | 48,719 KB |
| `ra_properties.csv` | GIS in general (rating / property) | 19/11/2026 11:01 pm | 804 KB |
| `ra_valuation.csv` | GIS in general (valuations) | 19/11/2026 11:01 pm | 634 KB |
| `rg_property_records.csv` | GIS in general (property records) | 19/11/2026 11:01 pm | 4,423 KB |

Signs of this already seen on the page:
- RC2026/CE260018 is Lodged in the data but Current in CiAnywhere.
- The Q and A status records can't be found in CiAnywhere.
- Counts differ from CiAnywhere.

Several of the data issues above may also partly come from stale or test extracts. The beta banner on the page warns that it uses test data.

**To do:**
- **Refresh schedule:** set up a regular refresh of all four extracts from production CiAnywhere (e.g. nightly), and make sure the services republish from them.
- **Re-check the data issues:** once production data is flowing, re-check the issues in this section, and remove the beta banner when the data can be relied on.

## Waiting on information

- **RCRIGHTWAY name:** currently "Right of Way" (assumed). Confirm it with a consent such as RC2026/260050.
- **Effective date:** to be added to the service (Sam). Every consent card shows an empty "Effective:" line until then. When it's added, set `effectiveDateField` in `js/config.js` to the field name, and the card shows the date (or no line when it's blank).
- **Descriptions alongside the codes (Sam):** the export should include descriptive names next to each code. That means the application type description (e.g. `CONSENT_APPLN_TYPE` = `BCCONSENT` plus a description field = "Building Consent"), and ideally the stage, status and decision descriptions too. The page currently keeps its own code → name list in `js/config.js`, which has to be updated by hand whenever CiAnywhere adds or renames a type. With descriptions in the data, the page would show them directly. The phone view shows only the description ("Application: Building Consent"); desktop shows the code and the description.
- **Decision codes `DCCONNREQD` and `DCCONREQD`:** meaning unknown, so they show as raw codes.

## App limitations

- **Speed:** searches take about 1 to 3 seconds. "Contains" searches (`LIKE '%…%'`) can't use the indexes.
- **Result limit:** results are capped at 100 properties (and 2,000 consent rows per search).
- **Phrase search:** word order matters, and abbreviations like Rd, Tce and Hwy don't match Road, Terrace and Highway. They could be expanded.
- **Commas and spaces:** extra spaces and typed commas are ignored. Commas in the data are only handled for the property address (one comma). See "CiAnywhere data cleaning suggestions".
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
