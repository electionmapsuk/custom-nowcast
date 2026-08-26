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
        return 1

    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"boundaries-{key}.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, separators=(",", ":"))
    print(f"  wrote {path} - {n} areas, {os.path.getsize(path)/1e6:.2f} MB "
          f"(source: {service})", file=sys.stderr)
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "..", "data"))
    ap.add_argument("--tier", choices=["lower", "upper", "both"], default="both")
    args = ap.parse_args()
    out = os.path.abspath(args.out)
    rc = 0
    for key in (["lower", "upper"] if args.tier == "both" else [args.tier]):
        rc |= build_layer(key, out)
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
