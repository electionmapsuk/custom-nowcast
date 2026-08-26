"""Canonical party codes, colours and name/PP-code matching.

Colours follow the ElectionMapsUK Nowcast palette (see electionmaps_nowcast.prod.html).
"""

# code -> (display name, colour, sort position on the left/right spectrum)
PARTIES = {
    "SF":   ("Sinn Féin",        "#326760"),
    "GRN":  ("Green",                 "#00A85A"),
    "SNP":  ("SNP",                   "#e6d62e"),
    "PLC":  ("Plaid Cymru",           "#075d55"),
    "SDLP": ("SDLP",                  "#3A9E84"),
    "LAB":  ("Labour",                "#E4003B"),
    "ALL":  ("Alliance",              "#F6CB2F"),
    "LDM":  ("Liberal Democrat",      "#ff6400"),
    "RA":   ("Residents/Local",       "#7fb3a8"),
    "IND":  ("Independent",           "#888888"),
    "OTH":  ("Other",                 "#9ca3af"),
    "UUP":  ("UUP",                   "#48A5EE"),
    "CON":  ("Conservative",          "#0393D3"),
    "DUP":  ("DUP",                   "#d46a4c"),
    "TUV":  ("TUV",                   "#0C3A6A"),
    "RFM":  ("Reform UK",             "#2BC5DB"),
    "VAC":  ("Vacant",                "#d8d8d4"),
}

# Left-to-right ordering used for stacked bars and table column order.
SPECTRUM = ["SF", "GRN", "SNP", "PLC", "SDLP", "LAB", "ALL", "LDM", "RA",
            "IND", "OTH", "UUP", "CON", "DUP", "TUV", "RFM", "VAC"]

# Colour used when no single party controls the council.
NOC_COLOUR = "#b9b9b3"

# Electoral Commission party codes -> canonical code. Authoritative when present.
PP_CODES = {
    "PP53": "LAB",    # Labour Party
    "PP52": "CON",    # Conservative and Unionist
    "PP90": "LDM",    # Liberal Democrats
    "PP7931": "RFM",  # Reform UK
    "PP63": "GRN",    # Green Party (England and Wales)
    "PP130": "GRN",   # Scottish Greens
    "PP102": "SNP",   # Scottish National Party
    "PP77": "PLC",    # Plaid Cymru
    "PP39": "DUP",    # Democratic Unionist Party
    "PP112": "SF",    # Sinn Fein
    "PP84": "UUP",    # Ulster Unionist Party
    "PP101": "SDLP",  # SDLP
    "PP103": "ALL",   # Alliance Party
    "PP2543": "TUV",  # Traditional Unionist Voice
    "PP6423": "LAB",  # Labour and Co-operative
    "PP32": "LAB",    # Co-operative Party
}

# Substring rules applied to the party name, in order, when the PP code is unknown.
# Lower-cased comparison.
NAME_RULES = [
    ("labour",                 "LAB"),
    ("co-operative",           "LAB"),
    ("conservative",           "CON"),
    ("liberal democrat",       "LDM"),
    ("reform uk",              "RFM"),
    ("green",                  "GRN"),
    ("scottish national",      "SNP"),
    ("plaid",                  "PLC"),
    ("sinn",                   "SF"),
    ("democratic unionist",    "DUP"),
    ("ulster unionist",        "UUP"),
    ("social democratic and labour", "SDLP"),
    ("alliance party",         "ALL"),
    ("traditional unionist",   "TUV"),
    ("residents",              "RA"),
    ("ratepayer",              "RA"),
    ("independent",            "IND"),
    ("no description",         "IND"),
    ("vacan",                  "VAC"),
]

# Column headings used on opencouncildata's composition tables -> canonical code.
TABLE_COLUMNS = {
    "lab": "LAB", "con": "CON", "ld": "LDM", "grn": "GRN", "ref": "RFM",
    "snp": "SNP", "pc": "PLC", "plaid": "PLC", "oth": "OTH", "others": "OTH",
    "vac": "VAC", "sf": "SF", "dup": "DUP", "alli": "ALL", "uup": "UUP",
    "sdlp": "SDLP", "ind": "IND",
}

# Control-label tokens used by opencouncildata -> canonical code.
CONTROL_TOKENS = {
    "LAB": "LAB", "CON": "CON", "LD": "LDM", "LIB": "LDM", "GRN": "GRN",
    "GREEN": "GRN", "REF": "RFM", "SNP": "SNP", "PC": "PLC", "PLAID": "PLC",
    "IND": "IND", "RA": "RA", "OTH": "OTH", "SF": "SF", "DUP": "DUP",
    "ALLI": "ALL", "UUP": "UUP", "SDLP": "SDLP", "TUV": "TUV",
}


def party_from_row(pp_code: str, name: str) -> str:
    """Resolve a councillor row to a canonical party code."""
    pp = (pp_code or "").strip().upper()
    if pp in PP_CODES:
        return PP_CODES[pp]
    low = (name or "").strip().lower()
    if not low:
        return "OTH"
    for needle, code in NAME_RULES:
        if needle in low:
            return code
    return "OTH"
