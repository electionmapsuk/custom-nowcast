#!/usr/bin/env python3
"""Build councils.json for the ElectionMapsUK council-control dashboard.

Sources (both CC0 / CC BY-SA, Open Council Data UK):
  * https://opencouncildata.co.uk/councils.php?model=..&y=0   live composition
    tables - authoritative for CONTROL and vacancies
  * https://opencouncildata.co.uk/csv2.php?y=YYYY             every councillor,
    with Electoral Commission party code - gives the full party breakdown that
    the summary tables collapse into "Oth"

Geography join uses mySociety's local authority register, which carries an
`open-council-data-id` column, so councils are matched by identifier first and
by name only as a fallback.

Writes:
  data/councils.json        the dashboard payload
  data/build-report.json    always written: counts, warnings, unmatched names

Exit code is non-zero if validation fails, but the report is still written so a
failed CI run can be diagnosed from the committed artefact.
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
from parties import (CONTROL_TOKENS, NOC_COLOUR, PARTIES, SPECTRUM,  # noqa: E402
                     TABLE_COLUMNS, party_from_row)
from tables import largest_table  # noqa: E402

BASE = "https://opencouncildata.co.uk/"

# model code -> (url, our label for the group)
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

warnings: list[str] = []


def warn(msg: str) -> None:
    warnings.append(msg)
    print("WARN:", msg, file=sys.stderr)


def norm(s: str) -> str:
    """Normalise a council name for matching."""
    s = (s or "").lower()
    s = s.replace("&", " and ")
    for suffix in (" city council", " borough council", " district council",
                   " county council", " council", " city", " borough",
                   " district", " metropolitan", " unitary", " authority"):
        if s.endswith(suffix):
            s = s[: -len(suffix)]
    s = re.sub(r"[^a-z0-9]", "", s)
    return s


# ---------------------------------------------------------------- control ---

def parse_control(label: str, seats: dict, total: int):
    """Turn opencouncildata's control string into structured fields.

    Examples seen in the wild:
      "LAB"            outright majority
      "REF min"        largest party running a minority administration
      "LD/GRN"         coalition
      "NOC"            no overall control, no stated administration
    """
    raw = (label or "").strip()
    up = raw.upper()
    kind = "majority"
    if not raw or up in ("NOC", "NONE", "-", "?"):
        kind = "noc"
        parts: list[str] = []
    else:
        if "MIN" in up.split():
            kind = "minority"
        body = re.sub(r"\bMIN\b", "", up).strip()
        tokens = [t.strip() for t in re.split(r"[/+]", body) if t.strip()]
        parts = []
        for t in tokens:
            code = CONTROL_TOKENS.get(t)
            if code is None:
                code = CONTROL_TOKENS.get(t.replace(" ", ""))
            if code:
                parts.append(code)
            elif t:
                warn(f"unrecognised control token {t!r} in {raw!r}")
        if kind == "majority" and len(parts) > 1:
            kind = "coalition"
        if not parts:
            kind = "noc"

    lead = parts[0] if parts else None
    # Sanity: an outright majority should really hold more than half the seats.
    if kind == "majority" and lead and total:
        held = seats.get(lead, 0)
        if held * 2 <= total:
            kind = "minority"
    if lead is None and seats:
        # NOC - still record the largest party for the "largest party" view.
        contested = {k: v for k, v in seats.items() if k != "VAC"}
        if contested:
            top = max(contested.values())
            tied = [k for k, v in contested.items() if v == top]
            lead = tied[0] if len(tied) == 1 else None
    return {"label": raw or "NOC", "type": kind, "parties": parts, "lead": lead}


def largest_party(seats: dict):
    contested = {k: v for k, v in seats.items() if k != "VAC" and v > 0}
    if not contested:
        return None, False
    top = max(contested.values())
    tied = [k for k, v in contested.items() if v == top]
    return tied[0], len(tied) > 1


# ------------------------------------------------------- composition pages ---

def scrape_compositions() -> dict:
    """council-name -> {group, control_label, summary seats, total, vacant}"""
    out: dict[str, dict] = {}
    for model, url, group in COMPOSITION_PAGES:
        html = get_text(url)
        table = largest_table(html)
        if not table or len(table["rows"]) < 3:
            warn(f"no composition table found on {url}")
            continue
        rows = table["rows"]
        # Find the header row: the one containing "Council" and "Total".
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
        # Map each column index to a canonical party code (or special).
        col_map: dict[int, str] = {}
        name_col = control_col = total_col = None
        for i, h in enumerate(header):
            if h == "council":
                name_col = i
            elif h == "control":
                control_col = i
            elif h.startswith("total"):
                total_col = i
            elif h in TABLE_COLUMNS:
                col_map[i] = TABLE_COLUMNS[h]
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
            if not name or name.lower() == "council":
                continue
            try:
                total = int(re.sub(r"[^0-9]", "", r[total_col]) or 0)
            except ValueError:
                continue
            if total <= 0:
                continue
            seats: dict[str, int] = {}
            for i, code in col_map.items():
                if i >= len(r):
                    continue
                digits = re.sub(r"[^0-9]", "", r[i])
                if digits:
                    n = int(digits)
                    if n:
                        seats[code] = seats.get(code, 0) + n
            control_label = r[control_col].strip() if control_col is not None and control_col < len(r) else ""
            key = norm(name)
            if key in out:
                warn(f"duplicate council {name!r} ({group} and {out[key]['group']})")
                continue
            out[key] = {
                "ocdName": name,
                "group": group,
                "model": model,
                "controlLabel": control_label,
                "summarySeats": seats,
                "total": total,
                "vacant": seats.get("VAC", 0),
            }
        print(f"  {group:16s} {len(out) - n_before:3d} councils", file=sys.stderr)
    return out


# ------------------------------------------------------------ councillors ---

def scrape_councillors(year: int):
    """council-name -> {party code -> count}, plus next-election dates."""
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
    names: dict[str, str] = {}
    nxt: dict[str, Counter] = defaultdict(Counter)
    rows = 0
    for r in reader:
        if len(r) <= c_party:
            continue
        council = r[c_council].strip()
        if not council:
            continue
        rows += 1
        key = norm(council)
        names.setdefault(key, council)
        code = party_from_row(r[c_code] if c_code is not None and c_code < len(r) else "",
                              r[c_party])
        seats[key][code] += 1
        if c_next is not None and c_next < len(r) and r[c_next].strip():
            nxt[key][r[c_next].strip()] += 1
    print(f"  councillor CSV: {rows} rows, {len(seats)} councils", file=sys.stderr)
    return seats, names, nxt, rows


# --------------------------------------------------------------- registry ---

def load_registry(local_path: str):
    try:
        text = get_text(REGISTRY_URL)
        print("  registry: fetched from mySociety", file=sys.stderr)
    except Exception as exc:  # noqa: BLE001
        warn(f"registry fetch failed ({exc}); using bundled copy")
        with open(local_path, encoding="utf-8") as f:
            text = f.read()
    rows = list(csv.DictReader(io.StringIO(text)))
    current = [r for r in rows if r.get("current-authority", "").strip().lower() == "true"]
    # Councils with elected members only - drop combined/strategic authorities.
    current = [r for r in current if r.get("local-authority-type") not in ("COMB", "SRA")]

    by_ocd: dict[str, dict] = {}
    by_name: dict[str, dict] = {}
    for r in current:
        ocd = (r.get("open-council-data-id") or "").strip()
        if ocd:
            by_ocd[ocd.split(".")[0]] = r
        for candidate in [r.get("official-name"), r.get("nice-name")] + \
                (r.get("alt-names") or "").split(","):
            k = norm(candidate or "")
            if k:
                by_name.setdefault(k, r)
    return current, by_ocd, by_name


TYPE_TIER = {
    "CTY": "upper",   # county councils - upper tier only
    "NMD": "lower",   # non-metropolitan districts - lower tier only
    "UA": "both", "MD": "both", "LBO": "both", "CC": "both",
    "SCO": "both", "WPA": "both", "NID": "both",
}


# ------------------------------------------------------------------ build ---

def build(year: int, out_dir: str) -> int:
    print("Fetching composition tables...", file=sys.stderr)
    comps = scrape_compositions()
    print("Fetching councillor CSV...", file=sys.stderr)
    detail, det_names, nxt, csv_rows = scrape_councillors(year)
    print("Loading local authority register...", file=sys.stderr)
    registry, by_ocd, by_name = load_registry(os.path.join(HERE, "la_registry.csv"))

    councils = []
    unmatched_geo, unmatched_detail = [], []
    used_gss = set()

    for key, c in sorted(comps.items(), key=lambda kv: kv[1]["ocdName"]):
        reg = by_name.get(key)
        if reg is None:
            # second chance: try the raw name and a couple of common variants
            for variant in (norm(c["ocdName"] + " council"),
                            norm(c["ocdName"].replace(" and ", " & "))):
                reg = by_name.get(variant)
                if reg:
                    break
        if reg is None:
            unmatched_geo.append(c["ocdName"])

        seats = dict(detail.get(key, {}))
        has_detail = bool(seats)
        if not has_detail:
            unmatched_detail.append(c["ocdName"])
            seats = dict(c["summarySeats"])
        else:
            # The councillor CSV lists filled seats only; carry vacancies over
            # from the summary table so the totals reconcile.
            if c["vacant"]:
                seats["VAC"] = c["vacant"]

        filled = sum(v for k, v in seats.items() if k != "VAC")
        stated = c["total"] - c["vacant"]
        if has_detail and stated and abs(filled - stated) > 0:
            warn(f"{c['ocdName']}: {filled} councillors in CSV vs {stated} in table")

        control = parse_control(c["controlLabel"], seats, c["total"])
        lead, tied = largest_party(seats)

        next_election = None
        if key in nxt and nxt[key]:
            next_election = nxt[key].most_common(1)[0][0]

        gss = (reg.get("gss-code") if reg else "") or ""
        if gss:
            if gss in used_gss:
                warn(f"duplicate GSS code {gss} for {c['ocdName']}")
            used_gss.add(gss)

        la_type = (reg.get("local-authority-type") if reg else "") or ""
        councils.append({
            "gss": gss,
            "name": (reg.get("nice-name") if reg else c["ocdName"]) or c["ocdName"],
            "ocdName": c["ocdName"],
            "type": la_type,
            "typeName": (reg.get("local-authority-type-name") if reg else c["group"]) or c["group"],
            "tier": TYPE_TIER.get(la_type, "lower"),
            "nation": (reg.get("nation") if reg else "") or "",
            "region": (reg.get("region") if reg else "") or "",
            "control": control,
            "largest": lead,
            "largestTied": tied,
            "total": c["total"],
            "vacant": c["vacant"],
            "seats": {k: v for k, v in seats.items() if v},
            "detail": has_detail,
            "nextElection": next_election,
        })

    party_totals: Counter = Counter()
    control_totals: Counter = Counter()
    for c in councils:
        for p, n in c["seats"].items():
            party_totals[p] += n
        ct = c["control"]
        if ct["type"] == "noc" or not ct["parties"]:
            control_totals["NOC"] += 1
        elif ct["type"] == "majority":
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
        "councilsParsed": len(councils),
        "councilsWithGss": sum(1 for c in councils if c["gss"]),
        "councilsWithDetail": sum(1 for c in councils if c["detail"]),
        "byGroup": dict(Counter(c["typeName"] for c in councils)),
        "byNation": dict(Counter(c["nation"] for c in councils)),
        "partyTotals": dict(party_totals.most_common()),
        "controlTotals": dict(control_totals.most_common()),
        "unmatchedGeography": unmatched_geo,
        "unmatchedDetail": unmatched_detail,
        "warnings": warnings[:400],
        "warningCount": len(warnings),
    }
    with open(os.path.join(out_dir, "build-report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=1)

    # ---- validation gate -------------------------------------------------
    problems = []
    if len(councils) < 350:
        problems.append(f"only {len(councils)} councils parsed (expected ~382)")
    if report["councilsWithGss"] < len(councils) - 5:
        problems.append(f"{len(councils) - report['councilsWithGss']} councils without a GSS code")
    total_cllrs = payload["meta"]["councillors"]
    if not (15000 < total_cllrs < 23000):
        problems.append(f"councillor total {total_cllrs} outside the plausible 15k-23k range")
    if report["councilsWithDetail"] < len(councils) * 0.9:
        problems.append("fewer than 90% of councils have a full party breakdown")
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
