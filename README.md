# Senedd Nowcast — client-side build

Forecasts the *next* Senedd election (the one after May 2026) under the new 16-constituency,
96-seat closed-list D'Hondt system. Same J-curve strong/weak transition method as the GB
nowcast, minus tactical voting: D'Hondt list PR doesn't waste votes the way first-past-the-post
does, so there's no vote-efficiency squeeze to model. Runs entirely in the browser.

## Files

```
senedd_nowcast.html            ← the page — needs a local server (fetches data/*.json)
senedd_nowcast.standalone.html ← same page, data + engine inlined — just double-click to open
squarespace_embed_senedd.html  ← iframe embed snippet, same pattern as the GB nowcast / councils
build/
  senedd.browser.js            ← the engine bundle the page loads (auto-generated)
  senedd.js                    ← engine source (edit this) — CONFIG block at top
  build_bundle.js              ← run `node build_bundle.js` to regenerate senedd.browser.js
  build_standalone.js          ← run `node build_standalone.js` (from inside build/) to
                                  regenerate senedd_nowcast.standalone.html after any change
  validate.js                  ← `node validate.js` — feeds the actual 2026 result back in and
                                  checks the engine reproduces it exactly (16/16 constituencies)
  data/
    seats.json                 ← 16 constituencies: 2026 baseline vote shares + votes cast
    config_data.json           ← national_base_2026 (the Wales-wide 2026 result)
    central.json                ← your central-projection inputs (the headline projection)
    boundaries.geojson          ← 16 constituency boundaries (from your SENC_MAY_2026_WA_BSC
                                    shapefile export), properties trimmed to {code, name}
    hex.geojson                 ← 96-hex cartogram, 6 hexes per constituency (one per seat)
    validation_2026winners.json ← actual 2026 winners per constituency, for validate.js only
                                    (not loaded by the page)
```

The page loads D3 v7 from `https://d3js.org/d3.v7.min.js` for the map (same CDN the GB nowcast
already uses), so it needs that reachable — same as your other pages. If `boundaries.geojson`
fails to load for any reason, the map panel just hides itself; everything else still works.

## Styling

The stylesheet is deliberately not a lookalike of the GB nowcast — it is the GB nowcast's, copied
rule for rule out of `electionmaps_nowcast.html`: the same custom properties (including the same
`--accent: #004d4d`), the same inlined Inter variable font, and the same `.panel` / `.btn` /
`.section-h` / `.sld` slider / `.headline` / `.totstrip` / `.mc` / `.table-wrap` / `#tip` rules,
with GB's class names kept so the two files can be diffed against each other. The custom-scenario
controls are GB's slider rows (coloured thumb, party-coloured filled track, number box beside it),
not plain number fields, and the seat cards, simulation panel and hover card use GB's markup
verbatim. `textColorFor()` keeps GB's 0.62 luminance cutoff rather than a rounder 0.60, because
Reform's #2BC5DB sits at 0.602 — the two thresholds disagree about that one party, and at 0.60 its
chip would read black here and white on the GB page. Senedd-only components — the hemicycle, the two-up map, the vote-share bar, the member
dots — sit in their own block at the bottom of the stylesheet and are built from the same tokens.
When the GB page's styling changes, the corresponding block here should be re-copied rather than
re-approximated.

## The model

1. **Baseline.** Each of the 16 constituencies' fixed baseline is its actual list-vote shares
   from the 7 May 2026 Senedd election (extracted from ITV News Wales' results and cross-checked
   seat-for-seat against the declared D'Hondt outcome — see `validate.js`).
2. **J-curve strong/weak split per constituency**, identical formula and parameters to the GB
   nowcast's `CONFIG.jcurve` (pivot 0.32, floor 0.10, ceiling 0.90 etc.), including the Green-only
   soft-vote penalty in Con/Reform-strong areas. "Weak" = soft/transferable vote, "Strong" =
   locked-in core.
3. **Swing to your central projection + calibration**, so the Wales-wide total matches your
   input exactly — same mechanism as `swingEngine()` in the GB engine, just with one region
   (there's no England/Scotland/London split to do; Wales *is* the region).
4. **No tactical voting stage.** Deliberately omitted — see above.
5. **No MRP blend.** There's no Senedd-specific MRP data to blend in (unlike GB's YouGov/MiC).
   If a Welsh MRP becomes available later, it could be added the same way the GB engine does it.
6. **D'Hondt seat allocation**, 6 seats per constituency, from the final swung vote shares —
   the actual method the Senedd uses. `dhondt()` returns both the party seat `counts` and `order`
   — the sequence the six seats were actually awarded in (e.g. `['PLC','RFM','LAB','PLC','RFM','PLC']`),
   which is what `constituencyResults[].members` holds. Everything that displays elected members
   (the hex cartogram's six-hex clusters, the constituency table's member dots, the hover card's
   numbered seat strip) reads that array in order, so seat 1 is the first seat D'Hondt awarded,
   seat 6 the last.

Validation: feeding the engine the actual 2026 national result reproduces the actual 2026 seat
outcome in every one of the 16 constituencies. That's the sanity check — run `node validate.js`.

## Simulation (largest-party odds)

The page also runs a Monte Carlo simulation client-side — 2,500 runs automatically for the central
projection, and 1,000 on demand for a custom scenario (press "Run simulations"; the same
auto-central / button-driven-custom split the GB nowcast uses, so dragging a slider never triggers
a re-simulation per frame). Both counts live in `MC.simsCentral` / `MC.simsCustom` at the top of
the page script. They're set where they are because the simulation blocks the main thread while it
runs: 1,000 runs takes ~170ms and 2,500 ~430ms on a desktop browser, so the central figure is
affordable as a one-off on load but would not be if it re-ran on every keystroke — which is the
whole reason custom mode is button-driven. If you raise these much further, move the loop into a
worker or chunk it the way the GB page's `runMC()` does. Same method as the GB nowcast's
central-projection simulation (`build_central_mc.js`), adapted for D'Hondt:

1. Each run draws a shared national swing factor Z, then perturbs LAB/CON/RFM/LDM/GRN/PLC's vote
   shares with a normal draw correlated to Z (`MC.sigma` = 1.5pp, `MC.rho` = 0.5) — LAB/GRN/LDM/PLC
   move one way, CON/RFM the other (`MC.sign`), on the view that Plaid draws disproportionately from
   the same left-of-centre pool as Labour/Greens/Lib Dems rather than swinging independently of them.
2. The perturbed national shares run through the ordinary engine (J-curve, swing, calibration) to get
   each constituency's swung share.
3. Each constituency then gets its own independent local draw per party (`MC.localSigma`) added to
   its share before D'Hondt allocates that run's 6 seats. This is the one place the Senedd version
   deliberately differs from the GB engine's 0.04: the new 16 constituencies each pair two of the old
   32 Welsh Westminster seats together, roughly doubling the electorate per constituency, so purely
   idiosyncratic local variation should average out more across the larger area. `MC.localSigma` is
   scaled down by ~1/√2 to 0.028. If a future boundary change alters that ratio, rescale accordingly.
4. Seat totals across all runs give each party's probability of being the largest party, plus a
   5th–95th percentile seat range — shown in the "Largest party odds" panel and on each seat card
   (the `.rng` line, same as the GB nowcast's seat cards).
   Majority odds are deliberately not shown: under a 96-seat PR system a single-party majority is a
   rare enough outcome that the number would be 0% almost all the time and tell the reader nothing.

`SeneddEngine.runSeneddNowcast()` takes an optional `cfg.localNoise` callback (a function returning
one random draw, called once per party per constituency) purely for this — leaving it unset (the
normal central/custom render path) is a no-op, so the deterministic point-estimate output is
byte-for-byte unchanged. The simulation itself lives in `runSimulations()` in `senedd_nowcast.html`,
not in the engine — it's driving logic, not model logic.

## Voting intention (polling average + LOESS trendline)

The bottom section is a port of the GB polling widget (`uk-polling-widget.html`) — same tricube
LOESS, same two-pass bisquare outlier suppression, same accuracy and frequency weighting, same
election-anchor trick. There is no separate "voting intention" cards block: the National vote share
panel higher up already shows the headline numbers, so the polling section starts at the trendline. What differs is only what Wales requires: the six Senedd parties, the
7 May 2026 result as both the anchor point and the change baseline, and 2 May 2030 (first Thursday
of May) as the next election for the "till next election" view. The GB widget's own `:root`,
`#polling-widget-wrapper` scope and `.top-card` are dropped — it reuses this page's
`.panel` / `.section-h` / `.totstrip` / `.tot` / `.btn` / `.mtb`, so the voting-intention cards are
literally the same component as the seat cards. There is no header block, per the page layout.

**The data lives in `POLLS`**, at the top of the polling `<script>` in `senedd_nowcast.html`. One
object per poll:

```js
{ pollster:'Name', start:'YYYY-MM-DD', end:'YYYY-MM-DD', weight:62,
  PLC:33, RFM:28, LAB:13, CON:10, GRN:7, LDM:5 }
```

`weight` is the pollster's accuracy score 0–100; use `null` for a pollster with no track record and
it scores 50 and shows a grey circle. `end` may be omitted for single-day fieldwork. Unlike the GB
widget there is no Google Apps Script fetch — the rows are inline, so the standalone build works
without a network round-trip. Add polls to the array and re-run `node build_standalone.js`.

**`SAMPLE_DATA`** sits directly above `POLLS`. Setting it `true` puts an amber "sample data"
banner on the page; it is `false` now that real polls are in. Both current polls carry
`weight: null`, because there is no accuracy score for Welsh Senedd polling under the new system
yet — null scores 50, draws a grey circle and weights every pollster equally. Put real 0–100
scores in once there's a track record to score against.

**The default smoothing window is 56 days, not GB's 35.** Welsh Senedd polling is sparse enough
that a 35-day window often contains a single poll, which would let one fieldwork run swing both the
trendline and — since the central projection reads off it — the seat projection with it. 56 days
keeps at least a couple of polls in the kernel. The Advanced panel still slides from 7 to 84 days.

**The central projection defaults to the polling average.** `exportDefaultAverage()` at the bottom
of the polling script computes the default-settings LOESS average at parse time — pure data, no
DOM, so it runs before the main script's `DOMContentLoaded` handler — and leaves it on
`window.__SENEDD_POLL_AVG__`. `start()` picks it up as `central`, so the custom-scenario sliders
open on the current voting intention and "Reset" returns to it. `build/data/central.json` is now
only the fallback for when there are no polls at all. Note this is deliberately the *default*
average: changing the Advanced filters redraws the chart but does not move the seat projection
underneath the reader.

The page has no title or standfirst of its own — like the GB nowcast, its masthead is just the
mode pill, right-aligned, and the heading lives in the Squarespace page that embeds it. (The
`<title>` tag stays, since it only ever shows in a browser tab.)

The **National vote share** panel is six `.tot` cards — one per party, largest first, each with its
change against the actual 7 May 2026 result. It replaced a stacked bar with a faint 2026 bar
underneath and a legend: the bar showed composition well but made per-party change almost
unreadable, which is the thing worth reading. Cards being the same component as the seat cards, the
two panels now answer the same question in the same shape, one in votes and one in seats.

Those cards won't match the custom-scenario sliders exactly, and the Custom scenario panel carries
a note saying why. The mechanism is `withOthersTarget()`: it takes the ratio of the entered mains
total to the 2026 mains total (97.8%), divides the 2026 "others" share by that ratio raised to
`CONFIG.othersExponent`, and normalises the result to 100%.

**That exponent is 3, reduced from the GB engine's 10.** At 10 the response was violent and
unbounded: an entered total of 60% sent "others" to 83% and left Plaid on 2 seats, and — worse —
the direction of the error flipped at about 72%, so below that the parties came out *lower* than
entered rather than higher. 72% is reachable (the total line only warns below 80%), so a visitor
could cross it without obvious warning. At 3 the response is monotonic down to about 30%: a 60%
total gives "others" 14% and Plaid 39 seats.

Two things are worth knowing about this parameter. First, `validate.js` does not constrain it at
all — at the 2026 input the ratio is 1, so *every* exponent reproduces 2026 exactly. It passes at
1, 2, 3, 4, 6 and 10 alike. Second, nothing visible changes at realistic inputs: the central
projection returns identical seats (PLC 43, RFM 32, LAB 11, CON 7, LDM 2, GRN 1) at every exponent
from 1 to 10, and "others" moves only from 2.3% to 2.6%. The change buys well-behaved tails, not a
different answer.

If the sliders should instead be read as literal vote shares, the alternative is a residual —
`others = 1 − (entered mains)`, clamped. That reproduces 2026 exactly for a real reason rather than
by construction (the 2026 shares sum to 100), makes the cards match the sliders precisely, and
gives "others" 3.7% here against the two current polls' own 5% and 2%. It was not adopted because
it moves a seat (CON 7 / RFM 32 becomes CON 6 / RFM 33) and hands the reader control of "others"
through a total they aren't really curating.

Chart.js and its date adapter load from jsDelivr, the same way D3 loads from its CDN, so the
trendline needs that reachable; everything else on the page works without it.

## Updating

- **Change the central projection:** edit `build/data/central.json` (LAB/CON/RFM/LDM/GRN/PLC,
  plain percentages). No code change, no rebuild needed for `senedd_nowcast.html` — it's fetched
  at runtime. `senedd_nowcast.standalone.html` has the old numbers baked in until you re-run
  `node build_standalone.js`.
- **After a new Senedd election:** rebuild `seats.json` / `config_data.json` from the new result,
  the same way this one was built from May 2026 (per-constituency vote totals → shares).
- **Tune the model:** everything lives in the `CONFIG` object at the top of `senedd.js`. After
  editing, run `node build_bundle.js` (regenerates the browser bundle) then, if you want the
  standalone file to pick it up too, `node build_standalone.js`.

## Opening it locally

`senedd_nowcast.html` fetches its data files, so browsers block that over `file://` — either
serve the folder (`python3 -m http.server` from inside `senedd/`) or just open
`senedd_nowcast.standalone.html` directly, which has everything except the map's D3 library
inlined. Re-run `node build_standalone.js` (from inside `build/`) any time you change
`senedd_nowcast.html`, the engine, or any data file — it doesn't update itself.

## Custom mode

Visitors set Wales-wide LAB/CON/RFM/LDM/GRN/PLC shares on the same slider rows the GB nowcast
uses — drag the slider or type in the number box beside it, either one drives the other. Sliders
are greyed and disabled until "Switch to custom scenario" is pressed, again matching GB. Free
entry: the live total is a guide, the engine normalises internally. "Reset" restores the headline
numbers and drops back to the central projection. Scenarios are shareable via URL
(`?lab=..&con=..&rfm=..&ldm=..&grn=..&plc=..`).

## Hemicycle

96 dots, four concentric rows across a 270° horseshoe, seated by **seat count** — left-bloc
parties largest to smallest outward from the left edge, right-bloc parties largest to smallest
outward from the right edge, smallest parties meeting in the middle (`seatOrder()`, the same shape
as the GB nowcast's `barOrder()`). The blocs are `LEFT_BLOC` = GRN/LAB/PLC/LDM and `RIGHT_BLOC` =
CON/RFM, with the Lib Dems on the left as in the GB nowcast's `LEAN` map, which leaves only OTH in
the middle. A side effect of strict largest-to-smallest: the *smallest* left party ends up sitting
next to the right bloc, so on the current projection the single Green seat is adjacent to the
Conservatives. That's inherent to ordering by size rather than by spectrum, and it's what GB does
too. This is deliberately not the order used elsewhere on the page:
the vote-share bar and the constituency table order by vote share (`dynamicOrder()`), because they
show votes, while the chamber shows seats. Under PR the two can disagree — a party can out-poll
another and still win fewer seats — so the chamber would misrepresent itself if seated by votes. Seats fill in **angular** order — sweeping round the arc like a clock hand, inner row
first where two seats share an angle — so each party is one contiguous wedge. Sorting the seat
positions by x instead is only correct for a flat 180° hemicycle: past 180° the horseshoe curls
back on itself, the lower-left and upper-left seats share x values, and the party blocks come out
visibly scrambled. If the arc is ever widened or narrowed, that sort stays correct as written.

## Map

Four modes, the same set as the GB nowcast's map (`.mmb` buttons), applied to whichever view(s)
are showing:

- **Projection** — leading party in the current projection.
- **2026 Result** — leading party in the actual 7 May 2026 result. There's no separate results
  file behind this: feeding the engine the 2026 national result reproduces the 2026 constituency
  outcome in all 16 (that's exactly what `validate.js` checks), so the page runs the engine once
  at startup on the 2026 baseline and uses that. It doubles as the source for the seat-card deltas
  and the Changes comparison, so all three can never disagree with each other.
- **Changes** — constituencies whose projected leading party differs from 2026, coloured by the
  new leader; grey where unchanged. The caption states the count, because an all-grey map is a
  real answer here rather than a broken one — under the current central projection *no*
  constituency changes leading party, and without the count that looks like a bug.
- **Margin** — projected leading party shaded by how often it actually finishes top across the
  simulations, the same probability-based shading the GB nowcast uses (`winBand`: Safe 95%+,
  Likely 75–95, Lean 55–75, Tilt under 55), in GB's `MARGINCOL` shades so a "Safe Reform" seat is
  the same colour on both maps. This is better than a raw lead-over-second margin here: under a
  volatile six-party PR race an identical lead can be comfortable in one seat and precarious in
  another, and only the simulations know which. Where no simulation has run yet — a custom
  scenario before the button is pressed — it falls back to the lead-over-second band (`bandOf`),
  exactly as GB's `classOf()` does. The hover card carries the matching "Finishes top" line from
  the same run. One deliberate hair's-breadth deviation from GB: the band is taken from the
  *rounded* percentage the card prints, so a raw 94.86% shows "95%" and shades Safe rather than
  printing 95% while shading Likely, which the legend defines as 75–95.

Only **2026 Result** changes the hex map, where it swaps in that year's actual six members per
constituency. Changes and Margin both compare two *leading parties*, which is a constituency-level
idea with no per-seat equivalent, so the hex map keeps showing the projection in those modes and
the caption says so rather than leaving the two maps silently out of step.

Two views, toggled at the top of the map panel:

- **Boundary** — real constituency shapes (`build/data/boundaries.geojson`), coloured by leading
  party. Joined to the model output by constituency name.
- **Hex — by seat** — a 96-hex cartogram (`build/data/hex.geojson`), 6 hexes per constituency,
  each individually coloured by one of that constituency's 6 D'Hondt-elected members. The hexes in
  a cluster take the members in **D'Hondt allocation order** — the first hex is the seat awarded
  first, the sixth the seat awarded last — so the cluster reads as the count actually ran rather
  than as a party-grouped block. (Which physical hex sits where within the cluster is still the
  source file's own layout; D'Hondt allocates seats to parties, not to sub-areas, so there's no
  real seat-to-geography mapping to preserve.) It gives a clean visual read on composition,
  including seats a leading-party choropleth would hide (e.g. a lone Green or Lib Dem seat inside
  a Plaid-dominated constituency).

Hex borders are drawn at two weights: thin lines between the six hexes inside one constituency,
thick ones between constituencies. The thick set is derived from the hex topology in
`hexBoundaries()`, not from a lookup table — an edge shared by two hexes of the same constituency
is internal and left to the hexes' own stroke; every other edge (a border with another
constituency, or the outer edge of the map) goes into one `.hexb` overlay path drawn on top.
The source hexes share vertices exactly, so matching edges by rounded endpoint coordinates is
reliable: 114 internal, 124 cross-constituency, 196 outer. Because that overlay sits above the
hexes, hex hover is an opacity change rather than a dark stroke, which the overlay would cover.

Both hover with the same card, styled like the GB nowcast's: dark header block with the
constituency name, a strip of six numbered squares (the seats in D'Hondt order, coloured by the
party that won each), the quota line, then vote-share bars with the change against that
constituency's actual 2026 result, and the logo footer.

**Quota for 6th seat** is the vote share it took to win the final seat there — the effective
threshold in that constituency, and the number that says how close the last seat actually was.
Under D'Hondt the last seat awarded is by definition the one with the lowest winning quotient, and
a party's final seat came in at `share / seats`, so the quota is just the lowest `share / seats`
across every party holding a seat. (`test_quota.js`-style check: recomputing the allocation
step-by-step and taking the 6th winning quotient gives the identical number in all 16.) Read it
against the bars below — a party sitting just under the quota is one that nearly took a seat. Hovering a **hex** additionally names the
specific seat — "(Seat 3)" in the title and a ringed square 3 in the strip — since one hex is one
seat; the boundary map covers a whole constituency, so it singles out no seat. In custom mode the
card carries the same purple "User Input" badge the GB nowcast uses. The logo is inlined into the
standalone build by `build_standalone.js` (it looks for `logo.png` in `senedd/` then the parent
folder); without one the footer falls back to plain "electionmapsuk" text, same as the GB page
served un-built.
`boundaries.geojson` coordinates are rounded to 5dp (~1m) to keep the file small. `hex.geojson`
came from a pasted export where one Cardiff-area hex (id `CP6`) was mislabelled to "Caerdydd
Ffynnon Taf" instead of "Caerdydd Penarth" — every other `CP`-prefixed hex, and every other
constituency, was Penarth/correctly-6-per-constituency, so I corrected that one to restore the
6-hexes-per-constituency invariant the model needs. Worth a quick check against your source if
that wasn't intentional.

If either GeoJSON fails to load, that view just doesn't show up — the toggle only appears when
both are available, and the map panel only fully hides if neither loads.
