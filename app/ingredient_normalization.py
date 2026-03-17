import re


LEADING_DESCRIPTOR_WORDS = {
    "fresh",
    "freshly",
    "finely",
    "roughly",
    "ground",
    "light",
    "extra",
    "virgin",
    "skinless",
    "boneless",
    "low-sodium",
    "low",
    "sodium",
    "kosher",
}

PREPARATION_WORDS = {
    "cut",
    "chunks",
    "chunk",
    "crushed",
    "minced",
    "diced",
    "sliced",
    "peeled",
    "rinsed",
    "halved",
    "lengthwise",
    "chopped",
    "ground",
}

TRAILING_NOUNS_TO_DROP = {
    "fillets",
    "fillet",
    "ribs",
    "rib",
    "sprigs",
    "sprig",
    "cloves",
    "clove",
}

PHRASE_REPLACEMENTS = (
    ("extra virgin olive oil", "olive oil"),
    ("light olive oil", "olive oil"),
    ("low-sodium chicken broth", "chicken broth"),
    ("skinless chicken thigh fillets", "chicken thigh"),
    ("skinless chicken thighs", "chicken thigh"),
    ("skinless chicken breasts", "chicken breast"),
    ("boneless skinless chicken breasts", "chicken breast"),
    ("boneless skinless chicken thighs", "chicken thigh"),
)


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _drop_comma_suffixes(text: str) -> str:
    return text.split(",", 1)[0].strip()


def _drop_leading_descriptors(tokens: list[str]) -> list[str]:
    while tokens and tokens[0] in LEADING_DESCRIPTOR_WORDS:
        tokens = tokens[1:]
    return tokens


def _drop_trailing_preparation(tokens: list[str]) -> list[str]:
    while tokens and tokens[-1] in PREPARATION_WORDS:
        tokens = tokens[:-1]
    return tokens


def _drop_trailing_nouns(tokens: list[str]) -> list[str]:
    if len(tokens) >= 2 and tokens[-1] in TRAILING_NOUNS_TO_DROP:
        tokens = tokens[:-1]
    return tokens


def normalize_ingredient_name(name: str) -> str:
    normalized = _normalize_whitespace(name.lower())
    normalized = normalized.replace("don't", "do not")
    normalized = _drop_comma_suffixes(normalized)

    for original, replacement in PHRASE_REPLACEMENTS:
        normalized = normalized.replace(original, replacement)

    tokens = re.findall(r"[a-zA-Z\-]+", normalized)
    tokens = _drop_leading_descriptors(tokens)
    tokens = _drop_trailing_preparation(tokens)
    tokens = _drop_trailing_nouns(tokens)

    if not tokens:
        return _normalize_whitespace(name.lower())

    normalized = " ".join(tokens)

    singular_map = {
        "breasts": "breast",
        "thighs": "thigh",
        "cloves": "clove",
    }
    normalized_tokens = [singular_map.get(token, token) for token in normalized.split()]
    return " ".join(normalized_tokens)


def build_ingredient_search_queries(name: str) -> list[str]:
    queries = []

    def add_query(query: str):
        cleaned = _normalize_whitespace(query.lower())
        if cleaned and cleaned not in queries:
            queries.append(cleaned)

    add_query(name)
    add_query(_drop_comma_suffixes(name.lower()))

    normalized = normalize_ingredient_name(name)
    add_query(normalized)

    if normalized.startswith("ground "):
        add_query(normalized.removeprefix("ground "))

    if normalized.startswith("chicken thigh"):
        add_query("chicken thigh")
        add_query("chicken")

    if normalized.startswith("chicken breast"):
        add_query("chicken breast")
        add_query("chicken")

    if normalized.endswith(" oil"):
        add_query(normalized.split()[-2] + " oil" if len(normalized.split()) >= 2 else normalized)

    return queries
