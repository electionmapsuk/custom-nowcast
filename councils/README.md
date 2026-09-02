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

Because Oth is a residual rather than a party, the build report lists what is
actually inside it: `othBucket` counts the CSV's own party names for every
councillor that ended up there, commonest first. That is the place to look
before promoting a smaller party to a column of its own — a name there with a
workable number of councillors is one `OTH_REFINEMENTS` in `parties.py` can
pull out, which then needs a colour in `PARTIES` and a slot in `SPECTRUM`.
Everything downstream — table columns, legend, hover card — derives itself from
the parties that hold seats, so nothing else has to change.

Restore Britain is the first party promoted this way (register id 522,
`PP18382`, which Open Council Data files under `OTH`). It appears wherever it
holds seats, ordered to the right of Reform, under the code `RES`. Great
Yarmouth First (id 530, `PP18235`) is folded in with it — ten councillors, nine
on Norfolk County Council and one on Great Yarmouth Borough — so `RES` counts
both.

Two things limit how fine that can go. The tables give a per-council Oth
*total* and the CSV only gives proportions inside it, so a party's seats on any
one council are allocated by largest remainder and can land a seat either side
of the truth. And it depends on `csv3.php` carrying the party's Electoral
Commission code; a newly registered party often is not there yet, which is what
`NAME_RULES` is the backstop for.

That first limit bites hardest on a party gaining defectors. A councillor who
crosses to Restore Britain only enters the Oth bucket once Open Council Data
moves them there in the composition table; until then the table still counts
them under their old party, and since the tables are the source of truth the
promoted party cannot exceed its council's Oth total. On a late-August snapshot
`councillors.php` listed 25 Restore Britain councillors while the tables' Oth
columns had room for 21 — Burnley and West Northamptonshire had an Oth of zero,
so the party showed nothing there at all. It is an undercount that closes on its
own as the tables catch up. Comparing `othBucket` (raw CSV counts) against
`partyTotals` in the build report measures exactly how far behind it is.

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

### Gaps in the source

Open Council Data does not carry the Isles of Scilly, so it is added by hand
from `EXTRA_COUNCILS` in `build_councils.py`: sixteen members, all independents,
elected all-out every four years (last May 2025, next 3 May 2029). It goes
through the same registry join and boundary reconciliation as everything else,
and is skipped automatically if the source ever starts listing it. Anything
added this way is named in the report's `addedManually`.

### Tables

Northern Ireland's parties share no columns with Great Britain's, so the two get
their own tables rather than one very wide, mostly empty one. Each table's
columns are derived from the parties that actually hold seats in it.

## Map tiers

Councils in England overlap: a county council and its districts cover the same
ground. So there are two layers, drawn side by side rather than behind a toggle.

* **Districts & unitaries** — ONS Local Authority Districts. English districts,
  unitaries, met boroughs and London boroughs, plus all 32 Scottish, 22 Welsh
  and 11 NI councils. No gaps, no overlaps.
* **Counties & unitaries** — ONS Counties and Unitary Authorities. The 21 English
  county councils replace their districts; everything else is unchanged.

A **DC / CC / Both** toggle switches between them (districts, counties, or
both side by side); Both is the default. On one tier the map spans the full width and is drawn taller, and the
projection is refitted from scratch — which is why switching resets the view to
the whole UK. A pinned council survives the switch.

The two maps share one zoom transform, so panning or zooming either lines the
other up on the same ground — the point being to read one against the other.
Hovering either fills the same side panel; pinning a council marks it on both
maps where it appears on both. Below 640px they stack. The legend and the table
count each council once across both layers, which is why their totals match the
tiles rather than the number of shapes on either map.

Combined and strategic authorities are excluded: their members are appointed by
constituent councils rather than directly elected, so "councillors by party"
doesn't mean the same thing.

## Colour

* **Solid fill** — one party holds more than half the seats, **or** holds a
  directly elected mayoralty. A mayor holds the executive whatever the chamber
  looks like, so the mayoralty outranks the seat arithmetic: Newham is solid
  Labour on 26 of 66 seats because Labour holds the mayoralty, and Hackney reads
  "GRN mayor" rather than "GRN majority" even though the Greens have both.
* **Paler wash of the same colour** — that party leads a minority or coalition
  administration.
* **Black** (`rgb(20,20,20)`) — no overall control and no stated administration.

### When the label and the arithmetic disagree

Open Council Data sometimes records the coalition that formed rather than the
seat arithmetic. Dorset is labelled `LD/GRN` while the Lib Dems hold 42 of 82 —
an outright majority on their own. So if any single party holds more than half of
every seat, that council is shown as their majority whatever the label says, and
the source's own string is kept in `control.sourceLabel`. A directly elected
mayor still outranks it.

Two things never trigger it. **Ind and Oth are seat buckets, not parties** — a
council can have several unrelated independent groups, so the bucket holding half
the seats says nothing about whether one group does; that rules out Boston,
Castle Point and Pembrokeshire. And **Northern Ireland is exempt**, because its
councils are all recorded as NOC by design: they do not form single-party
administrations, so Sinn Féin holding 21 of 40 in Fermanagh and Omagh is not a
statement about who runs it.

That leaves Dorset as the only council currently overridden. Every override is
listed in the report's `controlOverrides`. Nothing runs the other way: no council
was labelled a majority without actually holding one.

`parse_control` therefore tests for a mayor first, then for an outright majority,
and emits a separate `majority` boolean so a genuine seat majority stays
distinguishable from a mayoral one. The tiles' "N with a majority" sub-line counts real seat majorities,
which is why it can be lower than the number of solid councils on the map.

Selecting a party — by legend chip or tile — dims by whatever the map is
currently coloured by, so in *Largest party* mode it isolates the councils that
party leads on seats, not the ones it runs.

The two places that name the administration in words — the hover card's pill and
the table's Control column — are always coloured by control, whichever mode the
map is in. Only the map, the legend and the dimming follow the toggle.

The tiles, side panel and legend all count councils the same way the map colours
them: by the party leading the administration, whatever its form. Each tile's
big number is councils run, with outright majorities noted underneath. Only a
council with no administration at all counts as black. The strip shows the six
parties running the most councils plus NOC — six rather than five so the Greens
make it, and the layout steps down to four, three and two columns as the screen
narrows.

The *Largest party* toggle ignores administrations and just shows who has
the most seats. Where two or more parties are level on seats — nine councils at
the time of writing, two of them three-way — that council is striped in the tied
parties' colours rather than being handed to one of them arbitrarily. Stripes are
drawn as SVG patterns whose transform is rescaled on zoom, and boundary strokes
use `vector-effect: non-scaling-stroke`, so both stay hairline-fine at any
zoom level.

### The hover card

Parties are listed largest first, vacancies last, and every bar carries a black
rule at the number of seats needed for a majority. The bars share one scale that
always runs at least one seat past that rule, so the line is visible on every
council — a party sitting well short of it is reading as exactly that.

On a council that elects by thirds or halves, each party's bar is split by when
its seats are next up: the seats furthest from re-election sit leftmost in the
full party colour, the ones up next sit rightmost in the palest shade, and each
band is labelled with its own seat count where it is wide enough to fit (a
tooltip carries it either way). All-out councils get a single unlabelled band —
the total is already in the right-hand column. The footer names the cycle
(All-out, Halves, Thirds) and the next polling day.

Those per-cycle counts come from the councillor CSV's Next Election column,
which can run a seat or two behind the live tables, so each party's live seat
total is distributed across its own dates by largest remainder. The segments
always sum to the bar.

The national bar draws every party as its own coloured segment, but its key
names only the parties above one per cent, and folds everything else into a
single Oth figure — Restore Britain and the Northern Ireland parties among them,
whatever their size, since they are listed in `KEY_ROLLUP`. So the key's numbers
add up to the councillor total exactly; vacancies are the one thing left out,
being seats rather than a party. Hovering the Oth entry names what is inside it.

Every party label on screen — tiles, legend, side panel, national bar key, card
chips, control pills and table headers — uses the ElectionMaps abbreviations,
with the full name on the element's `title` for hover. The downloaded CSV keeps
full party names in its header, since a data file has no key to read them
against. Party labels use the ElectionMaps abbreviations — LAB, CON, LDM, RFM, GRN, SNP, PLC, SF, DUP, SDLP, ALL, UUP, TUV,
UKI, Ind, Oth, Vac — set in `ABBREV` in the widget. Full names are used wherever
there is room.

## Maintenance

* **Weekly data** — automatic, nothing to do.
* **Embed height** — the widget measures its own content and posts the height to
  the page that frames it, which sizes the iframe to match; the height in the
  embed's `style` is only a fallback for before the first message arrives. It
  measures `#cc-app`'s bottom edge rather than the document, deliberately:
  `documentElement.scrollHeight` is floored at the viewport, so once the iframe
  has been sized to fit it reports the frame's own height straight back, and
  every round trip adds the parent's padding again until the frame grows without
  limit.
* **After changing the widget** — bump the `?v=` number on the iframe URL in
  `squarespace_embed_councils.html` and re-paste it into the Squarespace Code
  Block. GitHub Pages lets browsers reuse the widget's HTML for a while, so
  without a bump a returning visitor can run today's data through last week's
  code — which looks exactly like the data having failed to update. Data
  refreshes need no bump; those are fetched at runtime.
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
