"""Canonical party codes, colours and party matching.

Party identification is driven by Open Council Data's own party register
(csv3.php), which maps every Electoral Commission code to one of their short
codes - the same vocabulary their composition tables use. That register is the
authority; the name rules below are only a fallback for codes it doesn't cover.

Colours follow the ElectionMapsUK Nowcast palette (electionmaps_nowcast.prod.html).
"""
import re

# canonical code -> (display name, colour)
PARTIES = {
    "SF":   ("Sinn Féin",       "#326760"),
    "GRN":  ("Green",                "#00A85A"),
    "SNP":  ("SNP",                  "#e6d62e"),
    "PLC":  ("Plaid Cymru",          "#075d55"),
    "SDLP": ("SDLP",                 "#FF0000"),
    "LAB":  ("Labour",               "#E4003B"),
    "ALL":  ("Alliance",             "#F6CB2F"),
    "LDM":  ("Liberal Democrat",     "#ff6400"),
    "IND":  ("Independent",          "#858585"),
    "OTH":  ("Other",                "#484848"),
    "UKI":  ("UKIP",                 "#6D3177"),
    "UUP":  ("UUP",                  "#48A5EE"),
    "CON":  ("Conservative",         "#4167d1"),
    "DUP":  ("DUP",                  "#d46a4c"),
    "TUV":  ("TUV",                  "#0C3A6A"),
    "RFM":  ("Reform UK",            "#17B9D1"),
    "RES":  ("Restore Britain",      "#051e40"),
    # smaller parties taken out of OCD's OTH bucket (ElectionMaps tags)
    "ASP":  ("Aspire",               "#c54e0a"),
    "YRP":  ("Your Party",           "#ff3131"),
    "WPB":  ("Workers Party",        "#0b5394"),
    "LIB":  ("Liberal Party",        "#e77500"),
    "SDP":  ("SDP",                  "#d25469"),
    # local parties and residents' groups: one shared pink, except those big
    # enough to have been given their own colour
    "LOC":  ("Localist",             "#E28CDB"),
    "NIP":  ("Newham Independents",  "#F3EB51"),
    "CIP":  ("Canvey Island Independents", "#333333"),
    "VAC":  ("Vacant",               "#dfdfdb"),
}

# Left-to-right ordering for stacked bars and table columns.
SPECTRUM = ["SF", "YRP", "WPB", "GRN", "SNP", "PLC", "SDLP", "LAB", "ASP",
            "ALL", "LDM", "LIB", "IND", "LOC", "NIP", "CIP", "OTH", "SDP", "UKI",
            "UUP", "CON",
            "DUP", "TUV", "RFM", "RES", "VAC"]

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
    ("restore britain", "RES"),
    # Great Yarmouth First sits with Restore Britain (OCD register id 530,
    # PP18235); its ten councillors are counted as theirs.
    ("great yarmouth first", "RES"),
    ("aspire", "ASP"),
    ("your party", "YRP"),
    ("workers party", "WPB"),
    ("workers' party", "WPB"),
    # "liberal party" is not a substring of "Liberal Democrats", and "social
    # democratic party" is not one of "Social Democratic and Labour Party"
    ("liberal party", "LIB"),
    ("social democratic party", "SDP"),
    # localists with a colour of their own (see LOCALIST below)
    ("newham independents", "NIP"),
    ("canvey island independent", "CIP"),
]

# Any other named group filed under OTH or IND is a localist (LOC) - a
# residents' association, a borough's own independents' party - unless its
# name is one of the generic independent labels, or it is one of the small
# parties below that stand beyond a single area. Those stay OTH.
GENERIC_INDEPENDENT = re.compile(
    r"(the )?(independents?|independent ?/ ?others?|others?|non[- ]?aligned|unaligned|"
    r"no description|none|independent group|independent network|independent candidate)")
NOT_LOCAL = [
    "mebyon kernow", "gwlad", "propel", "advance uk", "alba party", "british unionist",
    "trade unionist and socialist", "tusc", "party of women", "national flood prevention",
    "heritage party", "english democrat", "christian peoples", "christian party",
    "communist", "monster raving loony", "scottish family", "breakthrough party",
    "yorkshire party", "freedom alliance", "reclaim", "britain first",
    "women's equality", "rejoin", "animal welfare", "true & fair", "homeland",
    "english constitution", "socialist party", "socialist labour", "scottish socialist",
    "north east party", "northern independence", "climate party", "libertarian",
    "british national party", "national front", "patriotic alternative", "volt",
    "alliance for democracy and freedom", "scottish libertarian", "abolish the scottish",
    "independence for scotland", "sovereignty", "democrats and veterans", "veterans",
]

# Fallback only: used when a councillor's Electoral Commission code is missing
# from the register. Ordered most specific first - "Social Democratic and
# Labour Party" must not be caught by the "labour" rule.
NAME_RULES = [
    ("restore britain",              "RES"),
    ("great yarmouth first",         "RES"),
    ("social democratic and labour", "SDLP"),
    ("sdlp",                         "SDLP"),
    ("social democratic party",      "SDP"),
    ("aspire",                       "ASP"),
    ("your party",                   "YRP"),
    ("workers party",                "WPB"),
    ("workers' party",               "WPB"),
    ("liberal party",                "LIB"),
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
    "TUV": "TUV", "UKIP": "UKI", "RES": "RES",
    # local parties and residents' groups that run councils
    "RA": "LOC", "PIP": "LOC", "CIIP": "CIP", "CIP": "CIP", "ASPIRE": "ASP", "LOC": "LOC",
    "ASP": "ASP", "YRP": "YRP", "WPB": "WPB", "SDP": "SDP",
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
    """The code for a councillor OCD files as OTH or IND: a promoted party,
    LOC for a named local group, or "OTH" for no change (the caller keeps
    IND for a plain independent)."""
    low = (name or "").strip().lower()
    for needle, code in OTH_REFINEMENTS:
        if needle in low:
            return code
    if not low or GENERIC_INDEPENDENT.fullmatch(low.rstrip(".")):
        return "OTH"
    if any(n in low for n in NOT_LOCAL):
        return "OTH"
    return "LOC"
