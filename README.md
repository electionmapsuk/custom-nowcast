# ElectionMapsUK Nowcast — client-side build

The whole model now runs in the browser. No Google Apps Script backend, no server round-trip — the page fetches static data and computes all 632 seats locally on every slider change.

## Files

```
electionmaps_nowcast.html      ← the page (drop into a Squarespace code block / embed)
build/
  nowcast.browser.js           ← the engine bundle the page loads (auto-generated)
  nowcast.js                   ← engine source (edit this) — CONFIG block at top
  tactical.js                  ← tactical-voting transfer matrices (edit this)
  build_bundle.js              ← run `node build_bundle.js` to regenerate nowcast.browser.js
  extract_seats.py             ← run on each MRP refresh to rebuild data/seats.json
  validate.js                  ← `node validate.js` checks output vs the workbook
  data/
    seats.json                 ← 632 seats: 2024 base, electorate, turnout, region, YouGov+MiC MRP
    central.json               ← your central-projection inputs (the headline projection)
    config_data.json           ← MRP national baselines, regional 2024 aggregates, vote pools
```

## How it validates

| | LAB | CON | RFM | LDM | GRN | SNP | PLC | MIN |
|---|---|---|---|---|---|---|---|---|
| engine vs your workbook | 80 | 63 | 285 | 84 | 47 | 45 | 13 | 9 | (95.9% of seats match) |
| GE2024 preset vs real 2024 | 410 | 113 | 4 | 78 | 4 | 7 | 4 | 6 | (actual: 411/121/5/72/4/9/4) |

Feeding the engine the 2024 result reproduces the 2024 election — the best sanity check there is.

## Deploying on Squarespace

Squarespace can't host data files, so serve the three data files + the bundle from your GitHub raw (same repo as your GeoJSON: `electionmapsuk/custom-nowcast`):

1. Upload `nowcast.browser.js` and the three `data/*.json` files to the repo.
2. In `electionmaps_nowcast.html`, set:
   - `DATA_BASE` to `https://raw.githubusercontent.com/electionmapsuk/custom-nowcast/refs/heads/main/data/`
   - the `<script src>` to the raw URL of `nowcast.browser.js`
3. Paste the HTML into a Squarespace code block.

(Locally it works as-is: open `electionmaps_nowcast.html` from a small web server — `python3 -m http.server` in this folder — because browsers block `fetch` over `file://`.)

## Updating

- **Change the central projection:** edit `data/central.json` (or repoint it at a published Google Sheet later). No code change.
- **Refresh MRPs (every ~3–4 months):** re-run `extract_seats.py` on the new workbook → new `seats.json`; update the `baselines` in `nowcast.js` CONFIG from the MRP sheets.
- **Tune the model:** everything lives in the `CONFIG` object at the top of `nowcast.js` and the matrices in `tactical.js`. After editing, run `node build_bundle.js` to regenerate the browser bundle.

## What's in the engine

1. Regional allocation of your national inputs (England-ex-London as residual; Scotland/Wales/London direct).
2. J-curve strong/weak split per seat (Green penalty in the transition model only).
3. Regional swing + calibration to your targets.
4. Tactical voting — clarity-weighted transfer matrices, incumbent shields, cross-bloc hijack, national vote conservation (`tactical.js`).
5. MRP swings (YouGov + More In Common) off their own baselines, per nation, blended `0.67 / 0.165 / 0.165` with MRPs scaled by `(1−RES)`.
6. Winner, seat totals, Speaker held, Workers/Independent (WPB) split where it won in 2024.
7. Soft bloc bumpers (off by default in effect — calibration already protects bloc vote shares).

## Custom mode

Visitors edit GB-wide shares (incl. Restore) plus SNP-in-Scotland and Plaid-in-Wales. Free entry — the live total is a guide; the engine normalises internally. Regional non-nationalist shares track the GB inputs. "Reset to Central Projection" restores your headline numbers. Scenarios are shareable via URL.
