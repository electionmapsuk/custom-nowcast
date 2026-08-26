"""Canonical party codes, colours and party matching.

Party identification is driven by Open Council Data's own party register
(csv3.php), which maps every Electoral Commission code to one of their short
codes - the same vocabulary their composition tables use. That register is the
authority; the name rules below are only a fallback for codes it doesn't cover.

Colours follow the ElectionMapsUK Nowcast palette (electionmaps_nowcast.prod.html).
"""

# canonical code -> (display name, colour)
PARTIES = {
    "SF":   ("Sinn Féin",       "#326760"),
    "GRN":  ("Green",                "#00A85A"),
    "SNP":  ("SNP",                  "#e6d62e"),
    "PLC":  ("Plaid Cymru",          "#075d55"),
    "SDLP": ("SDLP",                 "#3A9E84"),
    "LAB":  ("Labour",               "#E4003B"),
    "ALL":  ("Alliance",             "#F6CB2F"),
    "LDM":  ("Liberal Democrat",     "#ff6400"),
    "IND":  ("Independent",          "#888888"),
    "OTH":  ("Other",                "#9ca3af"),
    "UKI":  ("UKIP",                 "#6D3177"),
    "UUP":  ("UUP",                  "#48A5EE"),
    "CON":  ("Conservative",         "#0393D3"),
    "DUP":  ("DUP",                  "#d46a4c"),
    "TUV":  ("TUV",                  "#0C3A6A"),
    "RFM":  ("Reform UK",            "#2BC5DB"),
    "VAC":  ("Vacant",               "#d8d8d4"),
}

# Left-to-right ordering for stacked bars and table columns.
SPECTRUM = ["SF", "GRN", "SNP", "PLC", "SDLP", "LAB", "ALL", "LDM", "IND",
            "OTH", "UKI", "UUP", "CON", "DUP", "TUV", "RFM", "VAC"]

NOC_COLOUR = "rgb(20,20,20)"

# Open Council Data's short party codes (the `code` column of csv3.php)
# -> our canonical codes. This is the primary lookup.
OCD_CODES = {
    "LAB": "LAB", "CON": "CON", "LD": "LDM", "REF": "RFM", "GRN": "GRN",
    "SNP": "SNP", "PC": "PLC", "SF": "SF", "DUP": "DUP", "UUP": "UUP",
    "SDL": "SDLP", "ALI": "ALL", "UKI": "UKI", "IND": "IND", "OTH": "OTH",
    "VAC": "VAC", "TBC": "OTH",
}

# Parties that Open Council Data files under "OTH" but that are worth showing
# separately. Applied only to rows whose register code is OTH.
OTH_REFINEMENTS = [
    ("traditional unionist", "TUV"),
    ("tuv", "TUV"),
]

# Fallback only: used when a councillor's Electoral Commission code is missing
# from the register. Ordered most specific first - "Social Democratic and
# Labour Party" must not be caught by the "labour" rule.
NAME_RULES = [
    ("social democratic and labour", "SDLP"),
    ("sdlp",                         "SDLP"),
    ("sinn",                         "SF"),
    ("democratic unionist",          "DUP"),
    ("d.u.p",                        "DUP"),
    ("ulster unionist",              "UUP"),
    ("traditional unionist",         "TUV"),
    ("alliance party",               "ALL"),
    ("alliance - alliance",          "ALL"),
    ("liberal democrat",             "LDM"),
    ("scottish national",            "SNP"),
    ("plaid",                        "PLC"),
    ("reform uk",                    "RFM"),
    ("uk independence",              "UKI"),
    ("ukip",                         "UKI"),
    ("green",                        "GRN"),
    ("conservative",                 "CON"),
    ("co-operative",                 "LAB"),
    ("labour",                       "LAB"),
    ("independent",                  "IND"),
    ("no description",               "IND"),
    ("vacan",                        "VAC"),
]

# Column headings on Open Council Data's composition tables -> canonical code.
TABLE_COLUMNS = {
    "lab": "LAB", "con": "CON", "ld": "LDM", "grn": "GRN", "ref": "RFM",
    "snp": "SNP", "pc": "PLC", "plaid": "PLC", "sf": "SF", "dup": "DUP",
    "alli": "ALL", "all": "ALL", "uup": "UUP", "sdlp": "SDLP", "sdl": "SDLP",
    "ind": "IND", "ukip": "UKI",
    # buckets, handled separately from the named parties
    "oth": "OTH", "others": "OTH", "other": "OTH", "vac": "VAC",
}

# Tokens appearing in the tables' Control column -> canonical code.
CONTROL_TOKENS = {
    "LAB": "LAB", "CON": "CON", "LD": "LDM", "LIB": "LDM", "LDM": "LDM",
    "GRN": "GRN", "GREEN": "GRN", "REF": "RFM", "RFM": "RFM", "SNP": "SNP",
    "PC": "PLC", "PLAID": "PLC", "IND": "IND", "OTH": "OTH", "SF": "SF",
    "DUP": "DUP", "ALLI": "ALL", "ALL": "ALL", "UUP": "UUP", "SDLP": "SDLP",
    "TUV": "TUV", "UKIP": "UKI",
    # local parties and residents' groups that run councils
    "RA": "IND", "PIP": "OTH", "CIIP": "OTH", "ASPIRE": "OTH",
}


def party_from_name(name: str) -> str:
    """Fallback party resolution from the party's name alone."""
    low = (name or "").strip().lower()
    if not low:
        return "OTH"
    for needle, code in NAME_RULES:
        if needle in low:
            return code
    return "OTH"


def refine_other(name: str) -> str:
    """Pull a few well-known parties back out of the register's OTH bucket."""
    low = (name or "").strip().lower()
    for needle, code in OTH_REFINEMENTS:
        if needle in low:
            return code
    return "OTH"
