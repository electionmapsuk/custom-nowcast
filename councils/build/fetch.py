"""Tiny HTTP helper: stdlib only, retries, sane UA."""
import gzip
import io
import time
import urllib.error
import urllib.request

UA = ("Mozilla/5.0 (compatible; ElectionMapsUK-council-dashboard/1.0; "
      "+https://electionmaps.uk) council-control data build")


def get(url: str, tries: int = 4, timeout: int = 120) -> bytes:
    last = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": UA,
                "Accept": "*/*",
                "Accept-Encoding": "gzip",
            })
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read()
                if resp.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
                return raw
        except Exception as exc:  # noqa: BLE001 - retry anything transient
            last = exc
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"failed to fetch {url}: {last}")


def get_text(url: str, **kw) -> str:
    return get(url, **kw).decode("utf-8", errors="replace")
