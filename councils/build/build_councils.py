#!/usr/bin/env python3
"""Build councils.json for the ElectionMapsUK council-control dashboard.

Sources (Open Council Data UK):
  * councils.php?model=..&y=0 / nicouncils.php  live composition tables.
    These are the SOURCE OF TRUTH for control, vacancies, seat totals and every
    party that has its own column.
  * csv2.php?y=YYYY   every councillor with an Electoral Commission party code.
    Used only to split the tables' "Oth" bucket into named parties, so the
    per-council numbers always add up to the live total.
  * csv3.php          the party register: Electoral Commission code -> Open
    Council Data's own short party code. Drives all party identification.

Geography comes from mySociety's local authority register (which carries an
`open-council-data-id` column) and is then reconciled against the ONS boundary
files actually in data/, so a council whose GSS code has been re-issued is
re-matched by name rather than silently dropping off the map.

Writes:
  data/councils.json        the dashboard payload
  data/build-report.json    always written: counts, warnings, anything dropped
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import io
import json
import os
import re
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from fetch import get_text  # noqa: E402
from parties import (CONTROL_TOKENS, NOC_COLOUR, OCD_CODES, PARTIES,  # noqa: E402
                     SPECTRUM, TABLE_COLUMNS, party_from_name, refine_other)
from tables import largest_table  # noqa: E402

BASE = "https://opencouncildata.co.uk/"

COMPOSITION_PAGES = [
    ("C", BASE + "councils.php?model=C&y=0", "county"),
    ("D", BASE + "councils.php?model=D&y=0", "district"),
    ("M", BASE + "councils.php?model=M&y=0", "metropolitan"),
    ("U", BASE + "councils.php?model=U&y=0", "unitary"),
    ("L", BASE + "councils.php?model=L&y=0", "london"),
    ("S", BASE + "councils.php?model=S&y=0", "scotland"),
    ("W", BASE + "councils.php?model=W&y=0", "wales"),
    ("N", BASE + "nicouncils.php?y=0", "northern-ireland"),
]

REGISTRY_URL = ("https://raw.githubusercontent.com/mysociety/"
                "uk_local_authority_names_and_codes/main/data/packages/"
                "uk_la_future/uk_local_authorities_future.csv")

# Rows that are page furniture, not councils.
FOOTER_RE = re.compile(r"^(total|totals|sum|all councils|average)\b|:$", re.I)

warnings: list[str] = []
_warned_once: set[str] = set()


def warn(msg: str, once_key: str | None = None) -> None:
    if once_key is not None:
        if once_key in _warned_once:
            return
        _warned_once.add(once_key)
    warnings.append(msg)
    print("WARN:", msg, file=sys.stderr)


def norm(s: str) -> str:
    s = (s or "").lower().replace("&", " and ")
    for suffix in (" city council", " borough council", " district council",
                   " county council", " council", " city", " borough",
                   " district", " metropolitan", " unitary", " authority"):
        if s.endswith(suffix):
            s = s[: -len(suffix)]
    return re.sub(r"[^a-z0-9]", "", s)


# ------------------------------------------------------------ party register --

def load_party_register() -> dict:
    """Electoral Commission code -> canonical party code."""
    text = get_text(BASE + "csv3.php")
    reader = csv.DictReader(io.StringIO(text))
    fields = [f.strip().lower() for f in (reader.fieldnames or [])]

    def find(*names):
        for n in names:
            if n in fields:
                return (reader.fieldnames or [])[fields.index(n)]
        return None

    f_ref = find("elec comm ref", "elec comm code", "code ec", "ec ref")
    f_code = find("code")
    f_name = find("name")
    if not f_ref or not f_code:
        raise RuntimeError(f"unexpected csv3.php columns: {reader.fieldnames}")

    out: dict[str, str] = {}
    unknown: Counter = Counter()
    n = 0
    for row in reader:
        ref = (row.get(f_ref) or "").strip().upper()
        short = (row.get(f_code) or "").strip().upper()
        name = (row.get(f_name) or "").strip()
        if not ref:
            continue
        n += 1
        code = OCD_CODES.get(short)
        if code is None:
            unknown[short] += 1
            code = party_from_name(name)
        elif code == "OTH":
            code = refine_other(name)
        out[ref] = code
    if unknown:
        warn(f"party register had short codes we don't map: {dict(unknown)}")
    print(f"  party register: {n} parties, {len(out)} codes", file=sys.stderr)
    return out


# ---------------------------------------------------------------- control ----

def parse_control(label: str, seats: dict, total: int) -> dict:
    """Structure Open Council Data's control string.

    Seen in the wild: "LAB", "REF min", "LD/GRN", "NOC", "LAB Mayor", "TBC".
    """
    raw = (label or "").strip()
    up = raw.upper()

    if not raw or up in ("NOC", "NONE", "-", "?"):
        return {"label": raw or "NOC", "type": "noc", "parties": [],
                "lead": _largest(seats)[0], "mayor": False}
    if up == "TBC":
        return {"label": "TBC", "type": "noc", "parties": [],
                "lead": _largest(seats)[0], "mayor": False}

    mayor = bool(re.search(r"\bMAYOR\b", up))
    minority = bool(re.search(r"\bMIN\b", up))
    body = re.sub(r"\b(MAYOR|MIN)\b", " ", up).strip()

    parts: list[str] = []
    for tok in [t.strip() for t in re.split(r"[/+,]", body) if t.strip()]:
        code = CONTROL_TOKENS.get(tok) or CONTROL_TOKENS.get(tok.replace(" ", ""))
        if code:
            if code not in parts:
                parts.append(code)
        else:
            warn(f"unrecognised control token {tok!r} (e.g. in {raw!r})",
                 once_key="ctrl:" + tok)
            if "OTH" not in parts:
                parts.append("OTH")

    if not parts:
        return {"label": raw, "type": "noc", "parties": [],
                "lead": _largest(seats)[0], "mayor": mayor}

    if minority:
        kind = "minority"
    elif len(parts) > 1:
        kind = "coalition"
    else:
        held = seats.get(parts[0], 0)
        kind = "majority" if total and held * 2 > total else "minority"
    if mayor and kind != "majority":
        kind = "mayoral"

    return {"label": raw, "type": kind, "parties": parts,
            "lead": parts[0], "mayor": mayor}


def _largest(seats: dict):
    contested = {k: v for k, v in seats.items() if k != "VAC" and v > 0}
    if not contested:
        return None, False
    top = max(contested.values())
    tied = [k for k, v in contested.items() if v == top]
    return (tied[0] if len(tied) == 1 else None), len(tied) > 1


# ------------------------------------------------------- composition pages ---

def scrape_compositions() -> dict:
    out: dict[str, dict] = {}
    for model, url, group in COMPOSITION_PAGES:
        html = get_text(url)
        table = largest_table(html)
        if not table or len(table["rows"]) < 3:
            warn(f"no composition table found on {url}")
            continue
        rows = table["rows"]

        head_idx = None
        for i, r in enumerate(rows[:6]):
            low = [c.strip().lower() for c in r]
            if "council" in low and any(c.startswith("total") for c in low):
                head_idx = i
                break
        if head_idx is None:
            warn(f"no header row on {url} (first row: {rows[0][:12]})")
            continue
        header = [c.strip().lower() for c in rows[head_idx]]

        named: dict[int, str] = {}     # columns that are a specific party
        oth_col = vac_col = name_col = control_col = total_col = None
        for i, h in enumerate(header):
            if h == "council":
                name_col = i
            elif h == "control":
                control_col = i
            elif h.startswith("total"):
                total_col = i
            elif h in ("oth", "others", "other"):
                oth_col = i
            elif h == "vac":
                vac_col = i
            elif h in TABLE_COLUMNS:
                named[i] = TABLE_COLUMNS[h]
            elif h:
                warn(f"unmapped column {h!r} on {url}")
        if name_col is None or total_col is None:
            warn(f"missing council/total column on {url}")
            continue

        n_before = len(out)
        for r in rows[head_idx + 1:]:
            if len(r) <= total_col:
                continue
            name = r[name_col].strip()
            if not name or name.lower() == "council" or FOOTER_RE.search(name):
                continue

            def cell(i):
                if i is None or i >= len(r):
                    return 0
                digits = re.sub(r"[^0-9]", "", r[i])
                return int(digits) if digits else 0

            total = cell(total_col)
            if total <= 0:
                continue
            explicit = {}
            for i, code in named.items():
                n = cell(i)
                if n:
                    explicit[code] = explicit.get(code, 0) + n
            oth = cell(oth_col)
            vac = cell(vac_col)

            stated = sum(explicit.values()) + oth + vac
            if stated != total:
                warn(f"{name}: table row sums to {stated}, states {total}")

            key = norm(name)
            if key in out:
                warn(f"duplicate council {name!r} ({group} and {out[key]['group']})")
                continue
            out[key] = {
                "ocdName": name,
                "group": group,
                "model": model,
                "controlLabel": (r[control_col].strip()
                                 if control_col is not None and control_col < len(r) else ""),
                "explicit": explicit,
                "explicitCodes": set(named.values()),
                "oth": oth,
                "vacant": vac,
                "total": total,
            }
        print(f"  {group:16s} {len(out) - n_before:3d} councils", file=sys.stderr)
    return out


# ------------------------------------------------------------ councillors ----

def scrape_councillors(year: int, register: dict):
    url = f"{BASE}csv2.php?y={year}"
    text = get_text(url)
    reader = csv.reader(io.StringIO(text))
    header = next(reader, None)
    if not header:
        raise RuntimeError(f"empty CSV at {url}")
    low = [h.strip().lower() for h in header]

    def col(*names):
        for n in names:
            if n in low:
                return low.index(n)
        return None

    c_council = col("council")
    c_party = col("party name", "party")
    c_code = col("electoral commission party code", "party code")
    c_next = col("next election")
    if c_council is None or c_party is None:
        raise RuntimeError(f"unexpected CSV columns at {url}: {header}")

    seats: dict[str, Counter] = defaultdict(Counter)
    nxt: dict[str, Counter] = defaultdict(Counter)
    cycle: dict[str, dict[str, Counter]] = defaultdict(lambda: defaultdict(Counter))
    rows = unmatched_codes = 0
    for r in reader:
        if len(r) <= c_party:
            continue
        council = r[c_council].strip()
        if not council:
            continue
        rows += 1
        key = norm(council)
        ref = (r[c_code].strip().upper() if c_code is not None and c_code < len(r) else "")
        code = register.get(ref)
        if code is None:
            unmatched_codes += 1
            code = party_from_name(r[c_party])
        seats[key][code] += 1
        if c_next is not None and c_next < len(r):
            iso = parse_date(r[c_next])
            if iso:
                nxt[key][iso] += 1
                cycle[key][code][iso] += 1
    if unmatched_codes:
        warn(f"{unmatched_codes} councillor rows had a party code missing from "
             f"the register; fell back to name matching")
    print(f"  councillor CSV: {rows} rows, {len(seats)} councils", file=sys.stderr)
    return seats, nxt, cycle, rows


_ISO = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")
_DMY = re.compile(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$")


def parse_date(raw: str):
    """Normalise a Next Election cell to an ISO date, or None."""
    v = (raw or "").strip()
    if not v:
        return None
    if _ISO.match(v):
        return v
    m = _DMY.match(v)
    if m:
        return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"
    if re.match(r"^\d{4}$", v):          # bare year
        return f"{v}-05-01"
    return None


def split_other(oth: int, csv_other: dict) -> dict:
    """Split the table's Oth bucket across the parties the CSV found there,
    using largest-remainder rounding so the pieces sum to exactly `oth`."""
    if oth <= 0:
        return {}
    tot = sum(csv_other.values())
    if not tot:
        return {"OTH": oth}
    quotas = {k: oth * v / tot for k, v in csv_other.items()}
    alloc = {k: int(q) for k, q in quotas.items()}
    left = oth - sum(alloc.values())
    for k in sorted(quotas, key=lambda k: (-(quotas[k] - alloc[k]), k))[:left]:
        alloc[k] += 1
    return {k: v for k, v in alloc.items() if v}


def election_cycle(seats: dict, party_dates: dict, fallback: str | None, today: str):
    """When each party's seats are next up.

    The councillor CSV carries a next-election date per councillor, which is what
    makes a thirds/halves council legible. Those counts can be a seat or two
    behind the live tables, so each party's live seat total is distributed across
    its own dates by largest remainder - the segments always sum to the bar.
    """
    out: dict[str, dict] = {}
    for party, total in seats.items():
        if party == "VAC" or not total:
            continue
        dates = {d: n for d, n in (party_dates.get(party) or {}).items() if d >= today}
        if not dates:
            if fallback:
                out.setdefault(fallback, {})[party] = total
            continue
        for d, n in split_other(total, dates).items():
            out.setdefault(d, {})[party] = out.get(d, {}).get(party, 0) + n
    return [{"date": d, "seats": out[d]} for d in sorted(out)]


# --------------------------------------------------------------- registry ----

def load_registry(local_path: str):
    try:
        text = get_text(REGISTRY_URL)
        print("  registry: fetched from mySociety", file=sys.stderr)
    except Exception as exc:  # noqa: BLE001
        warn(f"registry fetch failed ({exc}); using bundled copy")
        with open(local_path, encoding="utf-8") as f:
            text = f.read()
    rows = list(csv.DictReader(io.StringIO(text)))
    current = [r for r in rows
               if r.get("current-authority", "").strip().lower() == "true"
               and r.get("local-authority-type") not in ("COMB", "SRA")]
    by_name: dict[str, dict] = {}
    for r in current:
        for candidate in [r.get("official-name"), r.get("nice-name")] + \
                (r.get("alt-names") or "").split(","):
            k = norm(candidate or "")
            if k:
                by_name.setdefault(k, r)
    return current, by_name


# Councils elected but not yet vested, which supersede existing authorities.
# Mirrors MERGES in build_boundaries.py - the codes must match.
REORGANISATIONS = [
    {"name": "East Surrey", "gss": "LGR-EASTSURREY",
     "type": "UA", "typeName": "Unitary authority", "tier": "both",
     "nation": "England", "region": "South East",
     "replaces": ["Elmbridge", "Epsom and Ewell", "Mole Valley",
                  "Reigate and Banstead", "Tandridge", "Surrey"]},
    {"name": "West Surrey", "gss": "LGR-WESTSURREY",
     "type": "UA", "typeName": "Unitary authority", "tier": "both",
     "nation": "England", "region": "South East",
     "replaces": ["Guildford", "Runnymede", "Spelthorne", "Surrey Heath",
                  "Waverley", "Woking"]},
]
SUCCESSORS = {norm(r["name"]): r for r in REORGANISATIONS}
SUPERSEDED = {norm(n): r["name"] for r in REORGANISATIONS for n in r["replaces"]}


TYPE_TIER = {
    "CTY": "upper", "NMD": "lower",
    "UA": "both", "MD": "both", "LBO": "both", "CC": "both",
    "SCO": "both", "WPA": "both", "NID": "both",
}


def load_boundaries(out_dir: str):
    """code set and name -> code map from the boundary files actually in use."""
    codes: set[str] = set()
    by_name: dict[str, str] = {}
    for tier in ("lower", "upper"):
        path = os.path.join(out_dir, f"boundaries-{tier}.json")
        if not os.path.exists(path):
            warn(f"boundary file missing: {path} - geography not reconciled")
            continue
        with open(path, encoding="utf-8") as f:
            g = json.load(f)
        for feat in g.get("features", []):
            p = feat.get("properties") or {}
            if p.get("code"):
                codes.add(p["code"])
                if p.get("name"):
                    by_name.setdefault(norm(p["name"]), p["code"])
    return codes, by_name


# ------------------------------------------------------------------ build ----

def build(year: int, out_dir: str) -> int:
    print("Fetching party register...", file=sys.stderr)
    register = load_party_register()
    print("Fetching composition tables...", file=sys.stderr)
    comps = scrape_compositions()
    print("Fetching councillor CSV...", file=sys.stderr)
    detail, nxt, cycle, csv_rows = scrape_councillors(year, register)
    print("Loading local authority register...", file=sys.stderr)
    _registry, by_name = load_registry(os.path.join(HERE, "la_registry.csv"))
    print("Loading boundaries for reconciliation...", file=sys.stderr)
    bcodes, bnames = load_boundaries(out_dir)

    councils, not_shown, regssed, split_failed = [], [], [], []
    superseded, no_cycle = [], []
    today = dt.date.today().isoformat()

    for key, c in sorted(comps.items(), key=lambda kv: kv[1]["ocdName"]):
        if key in SUPERSEDED:
            superseded.append({"name": c["ocdName"], "total": c["total"],
                               "replacedBy": SUPERSEDED[key]})
            continue
        reg = by_name.get(key)
        if reg is None:
            for variant in (norm(c["ocdName"] + " council"),
                            norm(c["ocdName"].replace(" and ", " & "))):
                reg = by_name.get(variant)
                if reg:
                    break

        # --- seats: live table is truth, CSV only splits the Oth bucket ---
        csv_seats = dict(detail.get(key, {}))
        csv_other = {k: v for k, v in csv_seats.items()
                     if k not in c["explicitCodes"] and k != "VAC"}
        allocated = split_other(c["oth"], csv_other)
        has_detail = bool(c["oth"] == 0 or (csv_other and "OTH" not in allocated))
        if c["oth"] and not csv_other:
            split_failed.append(c["ocdName"])

        seats = dict(c["explicit"])
        for k, v in allocated.items():
            seats[k] = seats.get(k, 0) + v
        if c["vacant"]:
            seats["VAC"] = c["vacant"]

        if sum(seats.values()) != c["total"]:
            warn(f"{c['ocdName']}: seats sum to {sum(seats.values())} "
                 f"but total is {c['total']}")

        control = parse_control(c["controlLabel"], seats, c["total"])
        lead, tied = _largest(seats)

        succ = SUCCESSORS.get(key)
        gss = (succ["gss"] if succ else (reg.get("gss-code") if reg else "")) or ""
        if succ and bcodes and gss not in bcodes:
            warn(f"{c['ocdName']}: no boundary for {gss} - rebuild boundaries")
        if bcodes and gss not in bcodes and not succ:
            alt = bnames.get(key) or bnames.get(norm(c["ocdName"]))
            if alt:
                regssed.append(f"{c['ocdName']}: {gss or 'none'} -> {alt}")
                gss = alt
            else:
                not_shown.append({"name": c["ocdName"], "type": c["group"],
                                  "total": c["total"],
                                  "reason": "no boundary for this council"})
                continue

        la_type = (succ["type"] if succ else (reg.get("local-authority-type") if reg else "")) or ""
        future = sorted(d for d in (nxt.get(key) or {}) if d >= today)
        next_election = future[0] if future else None
        cyc = election_cycle({k: v for k, v in seats.items() if v},
                             cycle.get(key) or {}, next_election, today)
        if not cyc:
            no_cycle.append(c["ocdName"])

        councils.append({
            "gss": gss,
            "name": (succ["name"] if succ else
                     (reg.get("nice-name") if reg else c["ocdName"])) or c["ocdName"],
            "ocdName": c["ocdName"],
            "type": la_type,
            "typeName": (succ["typeName"] if succ else
                         (reg.get("local-authority-type-name") if reg else c["group"])) or c["group"],
            "tier": (succ["tier"] if succ else TYPE_TIER.get(la_type, "lower")),
            "nation": (succ["nation"] if succ else (reg.get("nation") if reg else "")) or "",
            "region": (succ["region"] if succ else (reg.get("region") if reg else "")) or "",
            "control": control,
            "largest": lead,
            "largestTied": tied,
            "total": c["total"],
            "vacant": c["vacant"],
            "seats": {k: v for k, v in seats.items() if v},
            "detail": has_detail,
            "nextElection": next_election,
            "cycle": cyc,
        })

    seen_gss: Counter = Counter(c["gss"] for c in councils)
    for g, n in seen_gss.items():
        if n > 1:
            warn(f"GSS {g} used by {n} councils")

    party_totals: Counter = Counter()
    control_totals: Counter = Counter()
    for c in councils:
        for p, n in c["seats"].items():
            party_totals[p] += n
        ct = c["control"]
        if ct["type"] == "majority" and ct["parties"]:
            control_totals[ct["parties"][0]] += 1
        else:
            control_totals["NOC"] += 1

    payload = {
        "meta": {
            "generated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
            "year": year,
            "source": "Open Council Data UK",
            "sourceUrl": BASE,
            "licence": "Councillor data CC0; compositions CC BY-SA 4.0",
            "councils": len(councils),
            "councillors": sum(v for k, v in party_totals.items() if k != "VAC"),
            "vacancies": party_totals.get("VAC", 0),
            "partyTotals": dict(party_totals.most_common()),
            "controlTotals": dict(control_totals.most_common()),
            "notShown": not_shown,
            "superseded": superseded,
        },
        "parties": {k: {"name": v[0], "colour": v[1]} for k, v in PARTIES.items()},
        "spectrum": SPECTRUM,
        "nocColour": NOC_COLOUR,
        "councils": councils,
    }

    os.makedirs(out_dir, exist_ok=True)
    report = {
        "generated": payload["meta"]["generated"],
        "year": year,
        "csvRows": csv_rows,
        "councilsParsed": len(comps),
        "councilsOnMap": len(councils),
        "councilsWithSplitDetail": sum(1 for c in councils if c["detail"]),
        "byGroup": dict(Counter(c["typeName"] for c in councils)),
        "byNation": dict(Counter(c["nation"] for c in councils)),
        "councillors": payload["meta"]["councillors"],
        "partyTotals": dict(party_totals.most_common()),
        "controlTotals": dict(control_totals.most_common()),
        "notShown": not_shown,
        "superseded": superseded,
        "noElectionCycle": no_cycle,
        "gssReassigned": regssed,
        "othNotSplit": split_failed,
        "warnings": warnings[:400],
        "warningCount": len(warnings),
    }

    problems = []
    if len(councils) < 350:
        problems.append(f"only {len(councils)} councils on the map (expected ~380)")
    if len(not_shown) > 6:
        problems.append(f"{len(not_shown)} councils had no boundary match")
    total_cllrs = payload["meta"]["councillors"]
    if not (15000 < total_cllrs < 23000):
        problems.append(f"councillor total {total_cllrs} outside the plausible range")
    if len(split_failed) > 40:
        problems.append(f"{len(split_failed)} councils could not have Oth split")
    report["problems"] = problems

    with open(os.path.join(out_dir, "build-report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=1)

    if problems:
        for p in problems:
            print("FAIL:", p, file=sys.stderr)
        return 1

    with open(os.path.join(out_dir, "councils.json"), "w", encoding="utf-8") as f:
        json.dump(payload, f, separators=(",", ":"))
    print(f"Wrote {out_dir}/councils.json - {len(councils)} councils, "
          f"{total_cllrs} councillors, {len(warnings)} warnings", file=sys.stderr)
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=dt.date.today().year)
    ap.add_argument("--out", default=os.path.join(HERE, "..", "data"))
    args = ap.parse_args()
    return build(args.year, os.path.abspath(args.out))


if __name__ == "__main__":
    raise SystemExit(main())
