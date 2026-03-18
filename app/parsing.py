import re
from fractions import Fraction


FRACTION_MAP = {
    "¼": "1/4",
    "½": "1/2",
    "¾": "3/4",
    "⅐": "1/7",
    "⅑": "1/9",
    "⅒": "1/10",
    "⅓": "1/3",
    "⅔": "2/3",
    "⅕": "1/5",
    "⅖": "2/5",
    "⅗": "3/5",
    "⅘": "4/5",
    "⅙": "1/6",
    "⅚": "5/6",
    "⅛": "1/8",
    "⅜": "3/8",
    "⅝": "5/8",
    "⅞": "7/8",
}

SECTION_ALIASES = {
    "ingredients": "ingredients",
    "ingredient": "ingredients",
    "instructions": "instructions",
    "instruction": "instructions",
    "directions": "instructions",
    "method": "instructions",
    "preparation": "instructions",
    "equipment": "equipment",
    "tools": "equipment",
    "notes": "notes",
    "note": "notes",
}

IGNORED_METADATA_PREFIXES = (
    "prep time",
    "cook time",
    "total time",
    "course",
    "cuisine",
    "keyword",
    "keywords",
    "author",
)

INSTRUCTION_PREFIXES = (
    "add ",
    "arrange ",
    "bake ",
    "blend ",
    "boil ",
    "bring ",
    "broil ",
    "combine ",
    "cook ",
    "cover ",
    "drizzle ",
    "fry ",
    "garnish ",
    "grill ",
    "heat ",
    "marinate ",
    "mix ",
    "place ",
    "poach ",
    "pour ",
    "preheat ",
    "reduce ",
    "remove ",
    "saute ",
    "season ",
    "serve ",
    "slash ",
    "shred ",
    "simmer ",
    "stir ",
    "transfer ",
    "whisk ",
    "when ",
)

SERVINGS_PATTERN = re.compile(
    r"(?:servings?|serves|yield|yields|makes)\s*:?\s*(\d+(?:\.\d+)?)",
    re.IGNORECASE,
)
LEADING_BULLET_PATTERN = re.compile(r"^\s*(?:[-*•]+|\d+\.)\s*")
QUANTITY_PATTERN = re.compile(
    r"^\s*(\d+\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?)"
)
UNIT_ALIASES = {
    "tablespoon",
    "tablespoons",
    "tbsp",
    "tbsps",
    "teaspoon",
    "teaspoons",
    "tsp",
    "tsps",
    "cup",
    "cups",
    "pint",
    "pints",
    "quart",
    "quarts",
    "gallon",
    "gallons",
    "ounce",
    "ounces",
    "oz",
    "lb",
    "lbs",
    "pound",
    "pounds",
    "gram",
    "grams",
    "g",
    "kilogram",
    "kilograms",
    "kg",
    "milliliter",
    "milliliters",
    "ml",
    "liter",
    "liters",
    "l",
    "pinch",
    "pinches",
    "dash",
    "dashes",
    "clove",
    "cloves",
    "sprig",
    "sprigs",
    "rib",
    "ribs",
    "small",
    "medium",
    "large",
    "can",
    "cans",
    "package",
    "packages",
    "pkg",
    "pkgs",
    "slice",
    "slices",
    "stalk",
    "stalks",
}


def normalize_line(line: str) -> str:
    normalized = line.replace("\xa0", " ")
    for fraction_char, replacement in FRACTION_MAP.items():
        normalized = normalized.replace(fraction_char, f" {replacement} ")

    normalized = LEADING_BULLET_PATTERN.sub("", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip()


def parse_quantity(raw_quantity: str) -> float | None:
    raw_quantity = raw_quantity.strip()
    if not raw_quantity:
        return None

    try:
        parts = raw_quantity.split()
        total = 0.0
        for part in parts:
            if "/" in part:
                total += float(Fraction(part))
            else:
                total += float(part)
        return total
    except (ValueError, ZeroDivisionError):
        return None


def parse_ingredient_line(line: str):
    quantity_match = QUANTITY_PATTERN.match(line)
    if not quantity_match:
        return None

    quantity_raw = quantity_match.group(1)
    quantity = parse_quantity(quantity_raw)
    if quantity is None:
        return None

    remainder = line[quantity_match.end() :].strip(" -,:;")
    if not remainder:
        return None

    tokens = remainder.split()
    unit = ""
    name_tokens = tokens

    if tokens and tokens[0].lower().rstrip(".,") in UNIT_ALIASES:
        unit = tokens[0].lower().rstrip(".,")
        name_tokens = tokens[1:]
    elif len(tokens) >= 2 and tokens[1].lower().rstrip(".,") in UNIT_ALIASES:
        unit = tokens[1].lower().rstrip(".,")
        name_tokens = [tokens[0], *tokens[2:]]

    name = " ".join(name_tokens).strip(" ,.;:").lower()
    if not name:
        return None

    return {
        "name": name,
        "quantity": quantity,
        "unit": unit,
    }


def extract_section_header(line: str) -> str | None:
    cleaned = line.strip().rstrip(":").lower()
    return SECTION_ALIASES.get(cleaned)


def maybe_extract_servings(line: str) -> int | None:
    match = SERVINGS_PATTERN.search(line)
    if not match:
        return None

    value = float(match.group(1))
    return int(value) if value.is_integer() else int(round(value))


def is_metadata_line(line: str) -> bool:
    lowered = line.lower()
    return lowered.startswith(IGNORED_METADATA_PREFIXES)


def finalize_instruction_lines(lines: list[str]) -> str:
    cleaned_lines = [line.strip() for line in lines if line.strip()]
    return "\n".join(cleaned_lines)


def is_instruction_line(line: str) -> bool:
    lowered = line.lower()
    return lowered.startswith(INSTRUCTION_PREFIXES)


def split_embedded_instruction(line: str) -> tuple[str, str] | None:
    lowered = line.lower()
    matches = []

    for prefix in INSTRUCTION_PREFIXES:
        search_start = 1 if lowered.startswith(prefix) else 0
        index = lowered.find(prefix, search_start)
        if index > 0:
            matches.append(index)

    if not matches:
        return None

    split_index = min(matches)
    ingredient_part = line[:split_index].strip(" ,.;:")
    instruction_part = line[split_index:].strip()
    if not ingredient_part or not instruction_part:
        return None

    return ingredient_part, instruction_part


def is_likely_bare_ingredient_line(line: str) -> bool:
    lowered = line.lower()
    if "to taste" in lowered:
        return False
    if is_instruction_line(line):
        return False
    if line.endswith((".", "!", "?")):
        return False
    if len(line.split()) > 8:
        return False
    return True


def parse_bare_ingredient_line(line: str):
    name = line.strip(" ,.;:").lower()
    if not name:
        return None

    return {
        "name": name,
        "quantity": None,
        "unit": "",
    }


def build_parse_issue(
    *,
    line: str,
    line_number: int,
    section: str,
    issue_type: str,
    reason: str,
) -> dict:
    classification = classify_parse_issue(
        line=line,
        section=section,
        issue_type=issue_type,
    )
    return {
        "raw_line": line,
        "line_number": line_number,
        "section": section,
        "issue_type": issue_type,
        "reason": reason,
        "review_category": classification["review_category"],
        "severity": classification["severity"],
    }


def classify_parse_issue(*, line: str, section: str, issue_type: str) -> dict:
    lowered = line.lower()

    if section == "notes" or issue_type == "note":
        return {
            "review_category": "informational_note",
            "severity": "low",
        }

    if any(
        phrase in lowered
        for phrase in ("to taste", "for serving", "to serve", "optional", "to garnish")
    ):
        return {
            "review_category": "optional_input",
            "severity": "low",
        }

    if issue_type == "unparsed_ingredient_line":
        return {
            "review_category": "parse_failure",
            "severity": "high",
        }

    if section == "intro" and issue_type == "unclassified_line":
        return {
            "review_category": "informational_note",
            "severity": "low",
        }

    return {
        "review_category": "unknown",
        "severity": "medium",
    }


def parse_recipe_text(text: str):
    raw_lines = [normalize_line(line) for line in text.splitlines()]
    lines = [line for line in raw_lines if line]

    if not lines:
        return None

    title = lines[0]
    servings = None
    ingredients = []
    unparsed_lines = []
    parse_issues = []
    instructions_lines = []
    current_section = "intro"
    saw_explicit_ingredients_section = False

    for line_number, line in enumerate(lines[1:], start=2):
        section = extract_section_header(line)
        if section is not None:
            current_section = section
            if section == "ingredients":
                saw_explicit_ingredients_section = True
            continue

        servings_value = maybe_extract_servings(line)
        if servings_value is not None and servings is None:
            servings = servings_value
            continue

        if is_metadata_line(line):
            continue

        if current_section == "equipment":
            continue

        if current_section == "notes":
            unparsed_lines.append(line)
            parse_issues.append(
                build_parse_issue(
                    line=line,
                    line_number=line_number,
                    section=current_section,
                    issue_type="note",
                    reason="Captured note text outside structured recipe fields.",
                )
            )
            continue

        embedded_instruction = split_embedded_instruction(line)
        if embedded_instruction is not None and current_section != "instructions":
            ingredient_line, instruction_line = embedded_instruction
            bare_ingredient = (
                parse_ingredient_line(ingredient_line)
                or (
                    parse_bare_ingredient_line(ingredient_line)
                    if current_section == "ingredients"
                    and not saw_explicit_ingredients_section
                    and is_likely_bare_ingredient_line(ingredient_line)
                    else None
                )
            )
            if bare_ingredient is not None:
                ingredients.append(bare_ingredient)
                current_section = "instructions"
                instructions_lines.append(instruction_line)
                continue

        ingredient = parse_ingredient_line(line)

        if current_section == "ingredients":
            if ingredient is not None:
                ingredients.append(ingredient)
            else:
                if (
                    not saw_explicit_ingredients_section
                    and is_likely_bare_ingredient_line(line)
                ):
                    ingredients.append(parse_bare_ingredient_line(line))
                elif saw_explicit_ingredients_section:
                    unparsed_lines.append(line)
                    parse_issues.append(
                        build_parse_issue(
                            line=line,
                            line_number=line_number,
                            section=current_section,
                            issue_type="unparsed_ingredient_line",
                            reason="Line appeared in ingredients section but could not be parsed as an ingredient.",
                        )
                    )
                elif is_instruction_line(line):
                    current_section = "instructions"
                    instructions_lines.append(line)
                else:
                    unparsed_lines.append(line)
                    parse_issues.append(
                        build_parse_issue(
                            line=line,
                            line_number=line_number,
                            section=current_section,
                            issue_type="unparsed_ingredient_line",
                            reason="Line was treated as ingredient content but did not match ingredient parsing heuristics.",
                        )
                    )
            continue

        if current_section == "instructions":
            instructions_lines.append(line)
            continue

        if ingredient is not None:
            ingredients.append(ingredient)
            current_section = "ingredients"
            continue

        if ingredients:
            current_section = "instructions"
            instructions_lines.append(line)
        else:
            unparsed_lines.append(line)
            parse_issues.append(
                build_parse_issue(
                    line=line,
                    line_number=line_number,
                    section=current_section,
                    issue_type="unclassified_line",
                    reason="Line could not be classified before any ingredients were detected.",
                )
            )

    instructions = finalize_instruction_lines(instructions_lines)

    return {
        "name": title,
        "servings": servings,
        "ingredients": ingredients,
        "unparsed_lines": unparsed_lines,
        "parse_issues": parse_issues,
        "instructions": instructions,
    }
