"""Minimal HTML table extractor (stdlib html.parser).

Returns every <table> on a page as a list of rows, each row a list of cell
strings. Cell text is whitespace-collapsed; <br> becomes a space. Anchors are
kept so we can pick up per-council links where they exist.
"""
import re
from html.parser import HTMLParser

_WS = re.compile(r"\s+")


class _TableParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables = []          # list of list-of-rows
        self._tstack = []         # stack of tables being built
        self._row = None
        self._cell = None
        self._cell_href = None
        self._rows_href = None

    # -- structure ------------------------------------------------------
    def handle_starttag(self, tag, attrs):
        if tag == "table":
            self._tstack.append({"rows": [], "hrefs": []})
        elif tag == "tr" and self._tstack:
            self._row = []
            self._rows_href = []
        elif tag in ("td", "th") and self._row is not None:
            self._cell = []
            self._cell_href = None
        elif tag == "a" and self._cell is not None:
            for k, v in attrs:
                if k == "href":
                    self._cell_href = v
        elif tag == "br" and self._cell is not None:
            self._cell.append(" ")

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._cell is not None:
            self._row.append(_WS.sub(" ", "".join(self._cell)).strip())
            self._rows_href.append(self._cell_href)
            self._cell = None
            self._cell_href = None
        elif tag == "tr" and self._row is not None:
            if self._tstack:
                self._tstack[-1]["rows"].append(self._row)
                self._tstack[-1]["hrefs"].append(self._rows_href)
            self._row = None
            self._rows_href = None
        elif tag == "table" and self._tstack:
            t = self._tstack.pop()
            self.tables.append(t)

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.append(data)


def parse_tables(html: str):
    p = _TableParser()
    p.feed(html)
    p.close()
    # Any table left unclosed (malformed markup) still gets returned.
    while p._tstack:
        p.tables.append(p._tstack.pop())
    return p.tables


def largest_table(html: str):
    """The table with the most rows - the composition table on every
    opencouncildata listing page."""
    tables = parse_tables(html)
    if not tables:
        return None
    return max(tables, key=lambda t: len(t["rows"]))
