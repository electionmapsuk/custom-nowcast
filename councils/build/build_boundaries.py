#!/usr/bin/env python3
"""Fetch UK council boundaries from the ONS Open Geography Portal.

Two layers are produced:
  boundaries-lower.json   Local Authority Districts (BUC) - districts,
                          unitaries, met boroughs, London boroughs, Scottish
                          and Welsh councils, NI districts. No gaps.
  boundaries-upper.json   Counties and Unitary Authorities (BUC) - county
                          council areas replace their districts; everything
                          else is unchanged.

BUC = "Ultra Generalised Clipped", the smallest ONS publishes, which is the
right resolution for a national choropleth. Coordinates are rounded to 4 dp
(~11 m) and properties stripped to code + name to keep the payload small.

Boundaries change roughly annually, so this only needs re-running when ONS
publishes a new vintage - the weekly data refresh does not touch it.

Source: Office for National Statistics licensed under the Open Government
Licence v3.0. Contains OS data (c) Crown copyright and database right.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from fetch import get_text  # noqa: E402

ORG = "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services"

MONTHS = {m: i for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july",
     "august", "september", "october", "november", "december"], start=1)}

LAYERS = {
    "lower": dict(
        pattern=re.compile(r"^Local_Authority_Districts?_.*_BUC", re.I),
        code=re.compile(r"^LAD\d{2}CD$", re.I),
        name=re.compile(r"^LAD\d{2}NM$", re.I),
        expect=(330, 400),
    ),
    "upper": dict(
        pattern=re.compile(r"^Counties_and_Unitary_Authorities_.*_BUC", re.I),
        code=re.compile(r"^CTYUA\d{2}CD$", re.I),
        name=re.compile(r"^CTYUA\d{2}NM$", re.I),
        expect=(200, 260),
    ),
}


def vintage(service_name: str):
    """Sort key from a service name like Local_Authority_Districts_May_2025_..."""
    low = service_name.lower()
    year = 0
    m = re.search(r"_(\d{4})_", low)
    if m:
        year = int(m.group(1))
    month = 0
    for name, num in MONTHS.items():
        if f"_{name}_" in low:
            month = num
            break
    ver = 0
    v = re.search(r"_v(\d+)", low)
    if v:
        ver = int(v.group(1))
    return (year, month, ver)


def find_service(pattern: re.Pattern) -> str:
    meta = json.loads(get_text(ORG + "?f=json"))
    names = [s["name"].split("/")[-1] for s in meta.get("services", [])
             if s.get("type") == "FeatureServer"]
    matches = [n for n in names if pattern.search(n)]
    if not matches:
        raise RuntimeError(f"no ONS service matching {pattern.pattern}")
    best = max(matches, key=vintage)
    print(f"  service: {best}", file=sys.stderr)
    return best


def layer_fields(service: str):
    meta = json.loads(get_text(f"{ORG}/{service}/FeatureServer/0?f=json"))
    return [f["name"] for f in meta.get("fields", [])], meta.get("maxRecordCount", 1000)


def fetch_features(service: str, code_field: str, name_field: str, page: int):
    url = (f"{ORG}/{service}/FeatureServer/0/query?where=1%3D1"
           f"&outFields={code_field},{name_field}&outSR=4326&f=geojson"
           f"&resultRecordCount={page}&resultOffset=")
    feats, offset = [], 0
    while True:
        chunk = json.loads(get_text(url + str(offset)))
        got = chunk.get("features", [])
        feats.extend(got)
        exceeded = chunk.get("properties", {}).get("exceededTransferLimit") or \
            chunk.get("exceededTransferLimit")
        print(f"    +{len(got)} (total {len(feats)})", file=sys.stderr)
        if not got or not exceeded:
            break
        offset += len(got)
        if offset > 5000:
            raise RuntimeError("pagination runaway")
    return feats


def round_coords(obj, dp=4):
    if isinstance(obj, (int, float)):
        return round(obj, dp)
    if isinstance(obj, list):
        return [round_coords(x, dp) for x in obj]
    return obj


# Councils created by local government reorganisation that ONS has not yet
# published a boundary for. Their shape is dissolved from the districts they
# replace. Each entry retires itself automatically as soon as a boundary with
# the same name appears in the ONS layer.
MERGES = [
    {
        "code": "LGR-EASTSURREY",
        "name": "East Surrey",
        "parts": ["Elmbridge", "Epsom and Ewell", "Mole Valley",
                  "Reigate and Banstead", "Tandridge"],
        "replaces_upper": ["Surrey"],
    },
    {
        "code": "LGR-WESTSURREY",
        "name": "West Surrey",
        "parts": ["Guildford", "Runnymede", "Spelthorne", "Surrey Heath",
                  "Waverley", "Woking"],
        "replaces_upper": ["Surrey"],
    },
]


def _norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower().replace("&", " and "))


def apply_merges(lower, upper):
    """Dissolve the constituent districts into their successor unitaries.

    The successor replaces its parts on the lower-tier layer and the county it
    supersedes on the upper-tier layer, so neither layer gains an overlap.
    """
    from shapely.geometry import mapping, shape
    from shapely.ops import unary_union

    lower_by_name = {_norm(f["properties"]["name"]): f for f in lower}
    have_lower = {_norm(f["properties"]["name"]) for f in lower}
    have_upper = {_norm(f["properties"]["name"]) for f in upper}
    drop_lower, drop_upper, made = set(), set(), []

    for m in MERGES:
        key = _norm(m["name"])
        if key in have_lower or key in have_upper:
            print(f"  {m['name']}: ONS now publishes this - merge skipped",
                  file=sys.stderr)
            continue
        parts = []
        for part in m["parts"]:
            f = lower_by_name.get(_norm(part))
            if f is None:
                print(f"FAIL: {m['name']} needs {part!r}, not in the layer",
                      file=sys.stderr)
                return None
            parts.append(shape(f["geometry"]))
            drop_lower.add(_norm(part))
        geom = unary_union(parts).buffer(0)
        feat = {"type": "Feature",
                "properties": {"code": m["code"], "name": m["name"]},
                "geometry": {"type": geom.geom_type,
                             "coordinates": round_coords(
                                 mapping(geom)["coordinates"])}}
        made.append(feat)
        for name in m.get("replaces_upper", []):
            drop_upper.add(_norm(name))
        print(f"  merged {m['name']} from {len(parts)} districts "
              f"({geom.geom_type})", file=sys.stderr)

    if not made:
        return lower, upper
    lower = [f for f in lower if _norm(f["properties"]["name"]) not in drop_lower] + made
    upper = [f for f in upper if _norm(f["properties"]["name"]) not in drop_upper] + made
    return lower, upper


def build_layer(key: str, out_dir: str) -> int:
    spec = LAYERS[key]
    print(f"{key} tier:", file=sys.stderr)
    service = find_service(spec["pattern"])
    fields, page = layer_fields(service)
    code_field = next((f for f in fields if spec["code"].match(f)), None)
    name_field = next((f for f in fields if spec["name"].match(f)), None)
    if not code_field or not name_field:
        raise RuntimeError(f"{service}: no code/name field in {fields}")
    feats = fetch_features(service, code_field, name_field, min(page or 1000, 1000))

    out = {"type": "FeatureCollection", "features": []}
    seen = set()
    for f in feats:
        props = f.get("properties") or {}
        code = props.get(code_field)
        if not code or code in seen:
            continue
        seen.add(code)
        geom = f.get("geometry")
        if not geom:
            continue
        geom = {"type": geom["type"], "coordinates": round_coords(geom["coordinates"])}
        out["features"].append({
            "type": "Feature",
            "properties": {"code": code, "name": props.get(name_field)},
            "geometry": geom,
        })

    lo, hi = spec["expect"]
    n = len(out["features"])
    if not (lo <= n <= hi):
        print(f"FAIL: {key} tier has {n} features, expected {lo}-{hi}", file=sys.stderr)
        return None
    print(f"  {n} areas from {service}", file=sys.stderr)
    return out["features"]


def write_layer(key: str, feats: list, out_dir: str) -> int:
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"boundaries-{key}.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump({"type": "FeatureCollection", "features": feats}, fh,
                  separators=(",", ":"))
    print(f"  wrote {path} - {len(feats)} areas, "
          f"{os.path.getsize(path)/1e6:.2f} MB", file=sys.stderr)
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "..", "data"))
    args = ap.parse_args()
    out = os.path.abspath(args.out)

    lower = build_layer("lower", out)
    upper = build_layer("upper", out)
    if lower is None or upper is None:
        return 1

    merged = apply_merges(lower, upper)
    if merged is None:
        return 1
    lower, upper = merged

    return write_layer("lower", lower, out) | write_layer("upper", upper, out)


if __name__ == "__main__":
    raise SystemExit(main())
