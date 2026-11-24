# Follow-ups

Open questions and issues to resolve before this page goes live. Newest first within each section.

## Data (for the council / data export)

### Decision type set on consents that haven't been decided
*Logged 2026-11-24*

`CONSENT_DECISION_TYPE_CODE` is filled in on consents that are still Lodged or Current and have no decision date. For example, **BC2026/260888** (6 Ferry Road) has status `C` (Current), stage `INPROGRESS` and decision type `COMPLETED`, with no decision or completed date. The council's system doesn't show a decision for it.

- 1,144 Lodged/Current consents have a decision type set (284 of them `COMPLETED`).
- 32,056 rows have a decision type but no decision date.
- The page currently shows the decision type as an outlined pill under the stage, so BC2026/260888 shows **In progress** and **Completed**, which is misleading.

**To decide:** find out (Sam) what this field means for undecided consents. Options for the page:
1. Hide the decision pill for Lodged (`L`) and Current (`C`) consents (recommended).
2. Remove the decision pill entirely, since the council's system doesn't show it on the summary screen.

### Consents with no valuation number
2,593 consents (5,566 rows), mostly from 2020 onwards, have no `PROP_Valuation_Reference_Number`. They never appear under a property, and searching their consent number finds nothing. Either fix the export, or show them in search as standalone "no linked property" results.

### Valuation numbers not in the property layer
Some consents have valuation numbers that don't exist in the Rateable Property layer, so they can't be shown.

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

- Host it on the council website instead of GitHub Pages.
- No code review and no automated tests.
- No formal accessibility audit.
