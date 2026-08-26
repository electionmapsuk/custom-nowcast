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
    parties.py                     party codes, colours, name/PP-code matching
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

## The two data sources, and why both

| Source | Gives us |
|---|---|
| `councils.php?model=…&y=0` (and `nicouncils.php`) | Open Council Data's **own control label** — `LAB`, `REF min`, `LD/GRN`, `NOC` — plus vacancies. These tables are maintained live, so by-elections and defections show up within days. |
| `csv2.php?y=YYYY` | Every councillor with their Electoral Commission party code, which is where the **full party breakdown** comes from. The summary tables collapse everything outside the big five into "Oth"; the CSV does not. |

The two are cross-checked: if a council's councillor count in the CSV disagrees
with the total in the summary table, it lands in `build-report.json` as a warning.

Geography is joined via [mySociety's local authority
register](https://github.com/mysociety/uk_local_authority_names_and_codes),
which carries an `open-council-data-id` column, so councils match on identifier
rather than on fuzzy name comparison. Names are only a fallback.

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
* **Diagonal stripes** — that party leads a minority or coalition administration.
* **Grey** — no overall control with no stated administration.

The *Colour: largest party* toggle ignores administrations and just shows who has
the most seats.

## Maintenance

* **Weekly data** — automatic, nothing to do.
* **Boundaries** — ONS publishes a new vintage roughly annually, and after local
  government reorganisation. Re-run the workflow with **refresh_boundaries**
  ticked; `build_boundaries.py` finds the newest matching ONS service by itself.
* **If the workflow fails** — it still commits `data/build-report.json` and
  leaves the previous good `councils.json` in place, so the live widget keeps
  working while you look at what changed. The report's `problems` array says
  which validation gate tripped.

Validation gates: at least 350 councils parsed, at most 5 without a GSS code,
a UK councillor total between 15,000 and 23,000, and a full party breakdown for
at least 90% of councils.

## Attribution

Councillor data from Open Council Data UK — CC0. Composition tables — CC BY-SA 4.0.
Boundaries © Office for National Statistics, Open Government Licence v3.0;
contains OS data © Crown copyright and database right.
