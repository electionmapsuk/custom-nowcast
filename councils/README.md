# UK council control — map & dashboard

An interactive map of every UK principal council, coloured by political control,
with the full party-by-party councillor breakdown on hover. Data refreshes itself
every Monday from [Open Council Data UK](https://opencouncildata.co.uk/).

## What's here

```
councils/
  uk-council-control-widget.html   the widget (GitHub Pages serves it; Squarespace iframes it)
  squarespace_embed_councils.html  the code block to paste into Squarespace
  build/
    build_councils.py              weekly scraper -> data/councils.json
    build_boundaries.py            one-off ONS boundary fetch -> data/boundaries-*.json
    parties.py                     canonical party codes, colours and matching rules
    tables.py                      minimal HTML table parser (stdlib only)
    fetch.py                       HTTP helper with retries
    la_registry.csv                mySociety local-authority register (fallback copy)
  data/                            generated - committed by the workflow
    councils.json
    boundaries-lower.json
    boundaries-upper.json
    build-report.json
.github/workflows/update-councils.yml
```

Everything is stdlib Python and vanilla JS + d3 — no build step, no dependencies
to install.

## First run

1. Copy `councils/` and `.github/workflows/update-councils.yml` into the
   `electionmapsuk/custom-nowcast` repo and push.
2. In the repo, go to **Actions → Update council control data → Run workflow**,
   tick **refresh_boundaries**, and run it. This first run downloads the ONS
   boundaries (~30–60s) as well as the council data, and commits all of it.
3. Check `councils/data/build-report.json` — it lists what was parsed, any
   councils it could not match, and any warnings.
4. Paste `squarespace_embed_councils.html` into a Squarespace Code Block.

After that it runs itself at 06:15 UTC every Monday.

## The three data sources, and how they fit together

| Source | Role |
|---|---|
| `councils.php?model=…&y=0` and `nicouncils.php` | **Source of truth.** Open Council Data's own control label — `LAB`, `REF min`, `LD/GRN`, `NOC`, `LAB Mayor` — plus vacancies, seat totals, and every party that has its own column. Maintained live, so by-elections and defections show up within days. |
| `csv2.php?y=YYYY` | Every councillor with their Electoral Commission party code. Used **only** to split the tables' "Oth" column into named parties. |
| `csv3.php` | The party register: Electoral Commission code → Open Council Data's own short party code. Drives all party identification. |

The split matters. The summary tables are live but collapse everything outside
the big five into "Oth". The councillor CSV names every party but is a snapshot,
and in practice runs one to three seats behind the tables on about one council
in six. So the tables' numbers are taken verbatim and the CSV is used only for
proportions inside the Oth bucket, allocated by largest remainder. Every
council's party numbers therefore add up to its live total, exactly.

Party identification goes through `csv3.php` rather than hard-coded Electoral
Commission codes. That is not fussiness: an early version guessed the codes and
put Sinn Féin's councillors in the DUP column and the SDLP's in Labour's.

Geography is joined via [mySociety's local authority
register](https://github.com/mysociety/uk_local_authority_names_and_codes),
then **reconciled against the boundary files actually in `data/`**. If a
council's GSS code isn't in either boundary layer, it is re-matched by name and
the swap is logged in `gssReassigned`. That is what keeps Barnsley and Sheffield
on the map — the register still carries their pre-2018 codes.

### Reorganisation

East and West Surrey were elected in May 2026 but do not take over until 1 April
2027, so for now they overlap Surrey County Council and its eleven districts.
The map treats Surrey as already reorganised: the successors appear on both
layers and the twelve superseded councils drop out of the map and out of every
national total. They are listed in `meta.superseded` and named in the widget's
footer.

ONS has not published boundaries for the new unitaries, so `build_boundaries.py`
dissolves them out of their constituent districts with shapely — East Surrey
from Elmbridge, Epsom & Ewell, Mole Valley, Reigate & Banstead and Tandridge;
West Surrey from Guildford, Runnymede, Spelthorne, Surrey Heath, Waverley and
Woking. They carry provisional codes (`LGR-EASTSURREY`, `LGR-WESTSURREY`) rather
than invented GSS codes. Each merge retires itself automatically: as soon as a
boundary of the same name appears in the ONS layer, the dissolve is skipped and
the official shape is used.

`REORGANISATIONS` in `build_councils.py` and `MERGES` in `build_boundaries.py`
must stay in step — the codes are the join. Adding the next reorganisation is a
matter of adding one entry to each.

Anything the source lists that has no boundary and no successor rule is excluded
from the map and from every national total, and listed in `meta.notShown`.

## Map tiers

Councils in England overlap: a county council and its districts cover the same
ground. So there are two layers.

* **Districts & unitaries** (default) — ONS Local Authority Districts. English
  districts, unitaries, met boroughs and London boroughs, plus all 32 Scottish,
  22 Welsh and 11 NI councils. No gaps, no overlaps.
* **Counties & unitaries** — ONS Counties and Unitary Authorities. The 21 English
  county councils replace their districts; everything else is unchanged.

Combined and strategic authorities are excluded: their members are appointed by
constituent councils rather than directly elected, so "councillors by party"
doesn't mean the same thing.

## Colour

* **Solid fill** — one party holds more than half the seats.
* **Paler wash of the same colour** — that party leads a minority or coalition
  administration, or holds a directly elected mayoralty.
* **Black** (`rgb(20,20,20)`) — no overall control and no stated administration.

The tiles, side panel and legend all count councils the same way the map colours
them: by the party leading the administration, whatever its form. Each tile's
big number is councils run, with outright majorities noted underneath. Only a
council with no administration at all counts as black.

The *Colour: largest party* toggle ignores administrations and just shows who has
the most seats. Where two or more parties are level on seats — nine councils at
the time of writing, two of them three-way — that council is striped in the tied
parties' colours rather than being handed to one of them arbitrarily. Stripes are
drawn as SVG patterns whose transform is rescaled on zoom, and boundary strokes
use `vector-effect: non-scaling-stroke`, so both stay hairline-fine at any
zoom level.

### The hover card

Parties are listed largest first, vacancies last. Each party's bar is split by
when its seats are next up — the soonest cycle in the full party colour, later
ones progressively paler — with the count up at the next election labelled on
the bar. The footer names the cycle (All-out, Halves, Thirds) and the next
polling day.

Those per-cycle counts come from the councillor CSV's Next Election column,
which can run a seat or two behind the live tables, so each party's live seat
total is distributed across its own dates by largest remainder. The segments
always sum to the bar.

Party labels in the chips, control pills and table headers use the ElectionMaps
abbreviations — LAB, CON, LDM, RFM, GRN, SNP, PLC, SF, DUP, SDLP, ALL, UUP, TUV,
UKI, Ind, Oth, Vac — set in `ABBREV` in the widget. Full names are used wherever
there is room.

## Maintenance

* **Weekly data** — automatic, nothing to do.
* **Boundaries** — ONS publishes a new vintage roughly annually, and after local
  government reorganisation. Re-run the workflow with **refresh_boundaries**
  ticked; `build_boundaries.py` finds the newest matching ONS service by itself.
* **If the workflow fails** — it still commits `data/build-report.json` and
  leaves the previous good `councils.json` in place, so the live widget keeps
  working while you look at what changed. The report's `problems` array says
  which validation gate tripped.

Validation gates: at least 350 councils on the map, at most 6 with no boundary
match, a UK councillor total between 15,000 and 23,000, and the Oth bucket
successfully split on all but at most 40 councils.

## Attribution

Councillor data from Open Council Data UK — CC0. Composition tables — CC BY-SA 4.0.
Boundaries © Office for National Statistics, Open Government Licence v3.0;
contains OS data © Crown copyright and database right.
