# ElectionMapsUK Nowcast — Build-Ready Plan

**Goal:** Replace the Google Apps Script backend behind your current forecaster with an **in-browser JavaScript engine**, so the map/table/coalition UI you already have keeps working but recalculates instantly and scales to any traffic. You publish one **central projection**; visitors build their own **custom** projection by entering national vote shares (plus SNP-in-Scotland and Plaid-in-Wales).

This version reflects your answers and my full reverse-engineering of the *Restore Nowcast* workbook.

---

## Decisions locked in

- **Custom inputs:** GB-wide LAB/CON/RFM/LDM/GRN/RES shares, plus SNP (Scotland only) and Plaid Cymru (Wales only). Nothing else.
- **Slider/entry behaviour:** **Free entry** — users type any numbers; show a live "Total = X%" readout, no forced auto-normalisation. (The engine normalises internally, exactly as the sheet does, so totals needn't sum to 100.)
- **Engine:** runs **client-side in JS**. No server round-trip.
- **MRPs respond to input:** each MRP (YouGov, More In Common) is swung off **its own national baseline** toward your inputs using the **same J-curve engine**, then blended. They are *not* fixed anchors. The MRP swings do **not** pass through the tactical-vote engine.
- **Everything tunable:** as many model variables as possible exposed in one editable config block (J-curve params, Green penalty weights, blend weights, vote pools, MRP baselines, calibration exponents, tactical matrix) — see the config section below.
- **Restore (RES):** included as a full party, using your estimated 2024 baseline with Restore standing. The MRPs contain no Restore, so they're scaled by `(1−RES)` in the blend to make room for it.
- **Bloc protection (new in v1):** lightweight **soft bumpers** keep a bloc (Left `{LAB,GRN,LDM}`, Right `{CON,RFM,RES}`) from being over-squeezed — they only engage past a deadband and pull back partway, so RFM+RES surging split the right rather than collapsing the left, without otherwise distorting the swing. Mechanism below.
- **Turnout:** differential turnout is *capability-ready* but defaults to fixed 2024 turnout — no values invented until a real turnout relationship is sourced.
- **Normalisation cleanup:** the model currently re-normalises too often (with some roll-over reference quirks); the port collapses this to clean, single normalisation points.
- **Party taxonomy:** `MIN` = the single largest "other" party in a seat; `WPB` is broken out as its own entity **only** in seats where WPB was the largest non-major in 2024; `OTH` = all remaining small parties/candidates combined.
- **MRP refresh:** ~every 3–4 months → `seats.json` is rebuilt on that cadence by re-running the extraction script.
- **Hosting:** Squarespace → the whole thing ships as a single self-contained HTML/JS **code-injection block** (same as your current embed). Squarespace can't host data files, so the per-seat data is either inlined into the JS bundle or fetched from your GitHub raw (where your GeoJSON already lives).

---

## The model, fully decoded (your "J-curve strong transition model")

Only your **inputs** (national + SNP/PLC) move; everything below is a deterministic transform of those inputs plus fixed per-seat data. That's why it ports cleanly.

**Stage 1 — Regional allocation (`per region`).** Your GB-wide shares are converted to votes against fixed turnout pools (GB ≈ 28.03m, Scotland 2.41m, Wales 1.32m, London 3.33m) and England-excl-London is taken as the residual. SNP/PLC are injected at the Scotland/Wales level. Output: a target vote-share vector per region.

**Stage 2 — Per-seat J-curve split (`Calc England/Scotland/Wales/London`).** Each seat starts from its **fixed 2024 baseline** shares. For each party:

```
RawWeak = if Base < 0.40 : 0.30 + (0.40 − Base) × 1.2
          else            : 0.30 + (Base − 0.40) × 0.1
Weak    = Base × clamp(Floor, 0.90, RawWeak)        # Floor = 0.10 (0.05 for LibDem)
Strong  = Base − Weak
```
**Green** weak vote additionally subtracts a tactical penalty: `RightPenalty = Con×0.9 + Ref×0.15` and `SatPenalty = Base×0.45` (Floor for Green = 0.05). This reflects the Greens' shifting base — away from shire protest votes and toward city-centre / student / Muslim-area concentration — so their soft vote behaves differently where Con/Reform are strong. "Weak" = soft/transferable vote; "Strong" = locked-in core. This penalty applies in the **transition model only**, not the MRP swings.

**Stage 3 — Apply the regional swing per seat.** Using the region's average Strong (`RegionalStrong`), average Weak, your target share, and a multiplier `LW_Mult = max(0, Target − RegionalStrong) / RegionalWeak`:

```
if Target ≥ RegionalStrong : Final = Strong + Weak × LW_Mult     # party rising → reactivate weak vote
else                       : Final = Strong × (Target / RegionalStrong)  # party falling → erode the core
```
Then normalise, and calibrate each seat so the region's aggregate exactly equals your input target.

**Stage 4 — Tactical voting (`Tactical Vote`).** Per-seat redistribution between parties (the matrix in the workbook), producing the "Strong Transition Model + TV" shares.

**Stage 5 — MRP blend (`Add MRP Data`).** The J-curve engine of Stages 2–3 is **reused twice more** — once on the YouGov per-seat baseline (national baseline shares: LAB 21.1 / CON 17.1 / RFM 27.1 / LDM 15.1 / GRN 11.4 …) and once on More In Common (LAB 19.5 / CON 21.2 / RFM 27.7 …) — each swung toward *your inputs*. These two swings use the **plain** J-curve (no Green penalty) and do **not** go through tactical voting. Each seat's final share is then:
```
final[p] = 0.67 × TransitionTV[p]  +  0.165 × (1−RES) × YouGovSwung[p]  +  0.165 × (1−RES) × MICSwung[p]
final[RES] = TransitionTV[RES]      # MRPs carry no Restore, so RES comes wholly from the transition model
```
The `(1−RES)` factor shrinks both MRP contributions to leave room for the Restore vote the MRPs don't model. Because the MRPs now swing with your inputs rather than sitting fixed, custom projections stay responsive across the whole slider range (no ⅓ "stickiness").

**Stage 6 — Winner & totals (`Output`).** Max share wins each seat; national totals by count, plus majority/margin and the Safe/Likely/Lean/Tilt bands and hex colours (reused as-is). Taxonomy: `MIN` carries the largest "other" party per seat; `WPB` is split out as its own line only where it was the largest non-major in 2024; `OTH` aggregates the rest.

**Validation approach (not exact reproduction).** Since v1 deliberately changes behaviour (bloc protection + cleaned normalisation), it *won't* and *needn't* match the current projection exactly. Instead I'll: (1) first stand up a **faithful port** and confirm it lands in the right neighbourhood of the current numbers (**RFM 296, LAB 82, LDM 81, CON 56, SNP 48, GRN 46, PLC 14, MIN 7, RES 1** = 632) — this proves the engine is wired correctly; then (2) switch on bloc protection and the normalisation cleanup as **separate, individually-inspectable passes**, sanity-checking the RFM+RES stress scenario you raised (the left bloc should hold up rather than collapse). Each change is reviewed on its own so you can see exactly what moved and why.

---

## Architecture

```
Google Sheet (you) ──Apps Script doGet──► central.json  ─┐
                                                          ├─► nowcast.js (engine) ─► winners + totals ─► existing UI
seats.json (fixed: 2024 base, electorate, turnout,        │                              ▲
            YouGov MRP, MIC MRP, TV matrix, region) ──────┘                       custom sliders
```

- **`seats.json`** — fixed per-seat data, built once by a Python script from the workbook; rebuilt every ~3–4 months when MRP updates. Inlined into the bundle or served from your GitHub raw.
- **`central.json`** — your live central inputs. Keep your existing Apps Script, but slim its `doGet` to just return the 8 input numbers (no heavy calc), so you still edit the headline projection in a Google Sheet without touching code.
- **`nowcast.js`** — the engine, built around one generic `jCurveSwing(perSeatBaselines, regionalTargets, config)` function that is called **three times** (transition model off 2024 baselines *with* Green penalty + tactical voting; YouGov and More In Common off their own baselines, plain J-curve, no TV) and then blended. Top-level `runNowcast(inputs)` returns the exact object shape your current front-end already consumes: `{ aggregateSeats: [...8 counts], individualSeatResults: [{seatName, winner, winner2024, shares, shareChanges}] }`. **This is a drop-in replacement for the `fetch(WEB_APP_URL)` call** — the map, table, coalition builder, share-URL and dropdown code stay untouched.

**Two modes, one engine:** *Central* loads `central.json` and runs the engine on page load. *Custom* re-runs the same engine on input change (sub-millisecond for 632 seats; no spinner needed). "Reset to central" restores your projection. Your existing share-URL feature already encodes inputs, so custom scenarios remain shareable.

---

## Modelling approach: keep the matrix central, make elasticity pluggable

The J-curve is kept for v1 (it's tuned and it works), but the architecture treats it as **one swappable component**, not the foundation:

- **Primary mechanism = the vote-transition matrix.** When national shares move from baseline to target, the change is expressed as party→party *flows*. This unifies "swing" and "tactical voting" into one coherent step and is the right frame for a fragmented FPTP system where outcomes turn on vote efficiency, not uniform swing.
- **Elasticity function = pluggable.** The J-curve answers only "how much local vote is in play and where does it reactivate." It's exposed behind a single interface (`elasticity(base, target, party, config)`) so alternatives — proportional swing, constant-elasticity, or a covariate-driven seat-level version — can be dropped in and **backtested against the 2024 result** without touching the rest of the engine.
- **Bloc protection = soft bumpers, not hard rails.** The renormalise-everything step is what lets two surging right parties tax the whole field. Rather than *pinning* bloc totals (too heavy-handed), the engine lets the normal swing run freely and only intervenes when a bloc is squeezed past a **deadband**: if a bloc's provisional total falls more than the deadband below its bloc-level target, it's pulled partway back by a tunable **strength** (0–1, low). Within the deadband nothing happens. So the bumpers only engage near the gutter — RFM+RES can still genuinely gain, but they can't proportionally collapse the left beyond the guardrail. Needs only a **bloc assignment** (structural, editable), no fabricated transition fractions. Blocs — Left: `{LAB, GRN, LDM}`, Right: `{CON, RFM, RES}`, Nationalist: `{SNP, PLC}`, neutral: `{OTH, MIN, WPB}`.
- **Don't over-parameterise.** When you later move to an explicit transition matrix, it's full **N×N over all parties including SNP and Plaid**, defaulting to the **identity matrix (no flow)**. Cells switch on **only** where there's real evidence — no invented values. The bloc structure above is the coarse, defensible version of that matrix until sourced data exists. Sources to populate it later: British Election Study panel (flow of the vote), and published switching/transition tables from YouGov, More in Common, Survation, Find Out Now.
- **Future accuracy lever (not v1):** per-seat elasticity from covariates (incumbency, prior marginality, demographics). Bigger payoff than tuning the J-curve, but needs data — slot it into the same `elasticity()` interface when ready.

## Editable config (the part you'll actually tune)

Everything below lives in one `CONFIG` object at the top of `nowcast.js`, commented, so you can change the model's behaviour without touching engine code:

```js
const CONFIG = {
  // J-curve weak/strong split (the "strong transition model")
  jcurve: { pivot: 0.40, baseMult: 0.30, leftSlope: 1.2, rightSlope: 0.1,
            floor: 0.10, ceiling: 0.90 },

  // Green-only tactical penalty (transition model only)
  greenPenalty: { floor: 0.05, conWeight: 0.9, refWeight: 0.15, satWeight: 0.45 },

  // Final blend: transition model vs the two MRPs
  blend: { transition: 0.67, yougov: 0.165, moreInCommon: 0.165 },
  scaleMRPbyRestore: true,        // apply (1−RES) to MRP contributions

  // Regional turnout pools used to split GB-wide input into regions
  pools: { gb: 28028812, scotland: 2414810, wales: 1319076, london: 3333200 },

  // "Others" calibration exponents — empirically tuned, not derived. Free to retune.
  othersExponent: { transition: 10, mrp: 8 },

  // Bloc protection: preserve left/right bloc totals (the RFM+RES substitution fix).
  // Editable assignment; confirm Lib Dem placement.
  blocs: {
    left:       ['LAB','GRN','LDM'],
    right:      ['CON','RFM','RES'],
    nationalist:['SNP','PLC'],
    neutral:    ['MIN','OTH','WPB'],
  },
  // Soft bumpers: only pull a bloc back if it's squeezed > deadband below target,
  // and only by `strength` of the way. strength:0 disables entirely.
  blocProtection: { strength: 0.4, deadband: 0.03 },

  // Differential turnout: capability present, off by default. No invented values.
  turnout: { differential: false, model: null },   // e.g. null until a sourced relationship exists

  // National baselines each model swings FROM (editable when you refresh data)
  baselines: {
    yougov:       { LAB: 0.211, CON: 0.171, RFM: 0.271, LDM: 0.151, GRN: 0.114, SNP: 0.293, PLC: 0.205 },
    moreInCommon: { LAB: 0.195, CON: 0.212, RFM: 0.277, LDM: 0.132, GRN: 0.122, SNP: 0.255, PLC: 0.160 },
  },

  // Safe/Likely/Lean/Tilt thresholds + party hex colours (reused from your sheet)
  bands: { safe: 0.15, likely: 0.10, lean: 0.05 },

  // Vote-transition / tactical matrix: full N×N over ALL parties incl SNP, PLC.
  // Defaults to identity (no flow). Populate cells only from sourced data.
  parties: ['LAB','CON','RFM','LDM','GRN','RES','SNP','PLC','OTH'],
  transitionMatrix: 'identity',   // or a {from: {to: fraction}} object once sourced
};
```

Per-party J-curve floors and any per-party overrides can be promoted into this block too if you want seat-level control later. The point: model logic is data, not buried in formulas.

## Build sequence

1. **Phase A — Extract `seats.json`.** Python script reading the workbook → per seat: name, ONS code, region/nation, 2024 MP+winner, 2024 baseline shares, electorate, turnout, YouGov MRP, More In Common MRP, tactical-vote matrix. Re-runnable on each MRP refresh. *(~½ day)*
2. **Phase B — Port the engine (faithful first).** Implement Stages 1–6 in JS as pure functions with the `CONFIG` block. Build in Node, validate stage-by-stage against the workbook's cached values, confirm it lands near RFM 296 … RES 1. *(the core — 1–2 days)*
3. **Phase B2 — Switch on improvements.** Add bloc protection and the normalisation cleanup as separate passes; review each on its own, stress-test the RFM+RES scenario. *(short)*
4. **Phase C — Slim the Apps Script** to return `central.json`; one clean Google Sheet tab for your central inputs. *(short)*
4. **Phase D — Wire the engine into your existing HTML:** swap the `fetch` for `runNowcast`, add the free-entry "Total = X%" readout, add RES + a Scotland/Wales note next to SNP/PLC inputs, "Reset to central" button. *(short — the UI already exists)*
5. **Phase E — Integrate on Squarespace & verify:** paste the code block, re-confirm central mode matches the workbook in-browser, mobile pass. *(short)*

The make-or-break step is **Phase B** (engine correctness); B2 is where the modelling improvements land, and everything after is presentation.

---

## Open items / nice-to-haves

- **Tactical-vote matrix:** I can extract it from the workbook, but if you send your canonical TV matrix I'll use that as the source of truth (avoids any export-frozen-value risk).
- **MRP refreshes** become a two-step edit: rebuild `seats.json` (new per-seat MRP shares) and update the `baselines` block in `CONFIG` (new national headline for each MRP). Both come straight from the MRP sheets.
- **Northern Ireland:** your current UI injects fixed NI seats (DUP 5, Alliance 1, etc.) client-side; the engine keeps that behaviour unchanged.
