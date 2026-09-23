#!/usr/bin/env python3
"""Per-council ward boundary files for the ward drill-down.

Reads the ONS ward and county electoral division boundaries committed under
councils/sources/, and writes one small file per council to data/wards/:

  data/wards/<code>.json    {"code", "source", "wards": [{"id", "name",
                             "alt", "g": geometry}]}
  data/wards/index.json     {"<code>": [[id, name, alt], ...]}  - names only,
                             read by the weekly build to match councillors
                             to wards

Which geography a council gets:
  * districts, unitaries, met and London boroughs, Scotland, Wales - wards,
    joined on the ward file's own council code (LADyyCD).
  * county councils (E10) and councils made by reorganisation (LGR-*) -
    county electoral divisions. ONS publishes these without a county code, so
    each division is placed in the county that contains it.
  * Northern Ireland is left out: its councils elect by District Electoral
    Area, not by ward.

The source files are the ONS "BSC" (super generalised) cut, which is plenty for
a single council filling a map panel. Coordinates are rounded to 4 dp (~11 m).
Nothing here touches the network; to move to a new year, replace the two files
in councils/sources/ (any names starting WD_ and CED_) and the next run picks
them up.

Source: Office for National Statistics licensed under the Open Government
Licence v3.0. Contains OS data (c) Crown copyright and database right.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sys

DP = 4

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_boundaries import dissolve  # noqa: E402  (stdlib topological union)


def _latest(pattern: str) -> str | None:
    files = sorted(glob.glob(pattern))
    return files[-1] if files else None


def _field(props: dict, rx: str):
    for k in props:
        if re.fullmatch(rx, k, re.I):
            return k
    return None


def _round(obj):
    if isinstance(obj, float):
        return round(obj, DP)
    if isinstance(obj, list):
        return [_round(x) for x in obj]
    return obj


def _clean_ring(ring):
    out = []
    for pt in ring:
        p = [round(pt[0], DP), round(pt[1], DP)]
        if not out or out[-1] != p:
            out.append(p)
    if len(out) >= 2 and out[0] != out[-1]:
        out.append(out[0])
    return out if len(out) >= 4 else None


def _area(ring):
    return sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(ring, ring[1:])) / 2


def _wind(rings):
    """d3 draws on the sphere and needs outer rings clockwise, holes
    anticlockwise - the opposite of RFC 7946. Wound wrong, a ward fills the
    whole globe outside itself, so enforce it whatever the source did."""
    out = []
    for i, r in enumerate(rings):
        cw = _area(r) < 0
        out.append(r if cw == (i == 0) else r[::-1])
    return out


def _clean_geom(g):
    if not g:
        return None
    if g["type"] == "Polygon":
        rings = [r for r in (_clean_ring(r) for r in g["coordinates"]) if r]
        return {"type": "Polygon", "coordinates": _wind(rings)} if rings else None
    if g["type"] == "MultiPolygon":
        polys = []
        for poly in g["coordinates"]:
            rings = [r for r in (_clean_ring(r) for r in poly) if r]
            if rings:
                polys.append(_wind(rings))
        if not polys:
            return None
        if len(polys) == 1:
            return {"type": "Polygon", "coordinates": polys[0]}
        return {"type": "MultiPolygon", "coordinates": polys}
    return None


def _outer_rings(g):
    polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
    return [p[0] for p in polys if p]


def _inside(ring, x, y):
    inside = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        if (y1 > y) != (y2 > y):
            if x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
                inside = not inside
    return inside


def _in_geom(g, x, y):
    return any(_inside(r, x, y) for r in _outer_rings(g))


def _bbox(g):
    xs, ys = [], []
    for r in _outer_rings(g):
        for x, y in r:
            xs.append(x)
            ys.append(y)
    return min(xs), min(ys), max(xs), max(ys)


def _vertices(g, limit=40):
    pts = [pt for r in _outer_rings(g) for pt in r[:-1]]
    step = max(1, len(pts) // limit)
    return pts[::step]


def assign_divisions(divisions, counties):
    """Place each division in the county containing it. Tries the division's
    ONS label point first; failing that (a coastal division whose point sits
    just outside a generalised county outline), a vote of its own vertices."""
    boxes = {c["code"]: _bbox(c["g"]) for c in counties}

    def hits(x, y):
        return [c["code"] for c in counties
                if boxes[c["code"]][0] <= x <= boxes[c["code"]][2]
                and boxes[c["code"]][1] <= y <= boxes[c["code"]][3]
                and _in_geom(c["g"], x, y)]

    out, unplaced = {}, []
    for d in divisions:
        h = hits(d["x"], d["y"]) if d["x"] is not None else []
        if len(h) != 1:
            votes = {}
            for x, y in _vertices(d["g"]):
                for code in hits(x, y):
                    votes[code] = votes.get(code, 0) + 1
            h = [max(votes, key=votes.get)] if votes else []
        if h:
            out.setdefault(h[0], []).append(d)
        else:
            unplaced.append(d["name"])
    return out, unplaced


def load_features(path, code_rx, name_rx, alt_rx=None, parent_rx=None):
    data = json.load(open(path, encoding="utf-8"))
    feats = data["features"]
    if not feats:
        return []
    p0 = feats[0]["properties"]
    fc, fn = _field(p0, code_rx), _field(p0, name_rx)
    fa = _field(p0, alt_rx) if alt_rx else None
    fp = _field(p0, parent_rx) if parent_rx else None
    fx, fy = _field(p0, "LONG"), _field(p0, "LAT")
    if not fc or not fn:
        raise SystemExit(f"{path}: no code/name fields in {list(p0)}")
    out = []
    for f in feats:
        p = f["properties"]
        g = _clean_geom(f.get("geometry"))
        if not g:
            continue
        alt = (p.get(fa) or "").strip() if fa else ""
        out.append({
            "id": p[fc], "name": (p[fn] or "").strip(),
            "alt": alt if alt and alt != (p[fn] or "").strip() else "",
            "parent": p.get(fp) if fp else None,
            "x": p.get(fx), "y": p.get(fy), "g": g,
        })
    return out


def _write(path, obj):
    """Write JSON only if it changed, so git sees no churn on quiet days."""
    text = json.dumps(obj, separators=(",", ":"), ensure_ascii=False)
    if not os.path.exists(path) or open(path, encoding="utf-8").read() != text:
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sources", required=True)
    ap.add_argument("--data", required=True)
    a = ap.parse_args()

    # Tolerate the folder's capitalisation (sources / Sources): GitHub's
    # runners are case-sensitive, the web uploader keeps whatever you typed.
    if not os.path.isdir(a.sources):
        parent, want = os.path.split(os.path.normpath(a.sources))
        for name in (os.listdir(parent or ".") if os.path.isdir(parent or ".") else []):
            if name.lower() == want.lower() and os.path.isdir(os.path.join(parent, name)):
                a.sources = os.path.join(parent, name)
                break

    wd_path = _latest(os.path.join(a.sources, "WD_*.geojson"))
    ced_path = _latest(os.path.join(a.sources, "CED_*.geojson"))
    if not wd_path:
        print("no ward source file - skipping ward boundaries", file=sys.stderr)
        return 0

    wards = load_features(wd_path, r"WD\d{2}CD", r"WD\d{2}NM",
                          alt_rx=r"WD\d{2}NMW", parent_rx=r"LAD\d{2}CD")
    divisions = load_features(ced_path, r"CED\d{2}CD", r"CED\d{2}NM") if ced_path else []

    lower = json.load(open(os.path.join(a.data, "boundaries-lower.json")))["features"]
    upper = json.load(open(os.path.join(a.data, "boundaries-upper.json")))["features"]

    by_council: dict[str, dict] = {}
    for w in wards:
        if (w["parent"] or "").startswith("N"):
            continue                      # NI elects by DEA, not ward
        by_council.setdefault(w["parent"], {"source": os.path.basename(wd_path),
                                            "wards": []})["wards"].append(w)

    # Divisions go to county councils and to reorganised councils, which have
    # no LAD code in the ward file yet.
    seen, targets = set(), []
    for f in upper + lower:
        code = f["properties"].get("code") or ""
        if code in seen:
            continue
        if code.startswith("E10") or code.startswith("LGR-"):
            seen.add(code)
            targets.append({"code": code, "g": f["geometry"]})
    placed, unplaced = assign_divisions(divisions, targets) if divisions else ({}, [])
    for code, ds in placed.items():
        by_council[code] = {"source": os.path.basename(ced_path), "wards": ds}

    out_dir = os.path.join(a.data, "wards")
    os.makedirs(out_dir, exist_ok=True)
    index, outlines, failed = {}, {}, []
    for code, entry in sorted(by_council.items()):
        ws = sorted(entry["wards"], key=lambda w: w["name"])
        index[code] = [[w["id"], w["name"], w["alt"]] for w in ws]
        # The council's outline at the wards' own resolution: the union of its
        # wards. The national boundary files are the coarsest ONS cut, so their
        # edges don't meet the wards; this one does, exactly.
        outline = dissolve([w["g"] for w in ws])
        if outline:
            polys = [outline["coordinates"]] if outline["type"] == "Polygon" else outline["coordinates"]
            polys = [_wind(p) for p in polys]
            outline = ({"type": "Polygon", "coordinates": polys[0]} if len(polys) == 1
                       else {"type": "MultiPolygon", "coordinates": polys})
            outlines[code] = outline
        else:
            failed.append(code)
        doc = {"code": code, "source": entry["source"], "outline": outline,
               "wards": [{"id": w["id"], "name": w["name"], "alt": w["alt"],
                          "g": w["g"]} for w in ws]}
        _write(os.path.join(out_dir, f"{code}.json"), doc)
    _write(os.path.join(out_dir, "index.json"), index)

    # One file of detailed outlines per map, for the faded neighbours around
    # a council in the ward view. A council with no outline here keeps its
    # national boundary.
    for tier, feats in (("lower", lower), ("upper", upper)):
        codes = {f["properties"].get("code") for f in feats}
        _write(os.path.join(out_dir, f"outlines-{tier}.json"),
               {c: g for c, g in sorted(outlines.items()) if c in codes})
    if failed:
        print(f"  outlines: {len(failed)} councils could not be merged: {failed[:10]}",
              file=sys.stderr)

    n_w = sum(len(v["wards"]) for v in by_council.values())
    print(f"  wards: {len(by_council)} councils, {n_w} wards/divisions"
          + (f"; {len(unplaced)} divisions not placed: {unplaced[:10]}" if unplaced else ""),
          file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
