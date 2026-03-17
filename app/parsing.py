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


def parse_recipe_text(text: str):
    raw_lines = [normalize_line(line) for line in text.splitlines()]
    lines = [line for line in raw_lines if line]

    if not lines:
        return None

    title = lines[0]
    servings = None
    ingredients = []
    unparsed_lines = []
    instructions_lines = []
    current_section = "intro"
    saw_explicit_ingredients_section = False

    for line in lines[1:]:
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
            continue

        ingredient = parse_ingredient_line(line)

        if current_section == "ingredients":
            if ingredient is not None:
                ingredients.append(ingredient)
            else:
                if saw_explicit_ingredients_section:
                    unparsed_lines.append(line)
                elif is_instruction_line(line):
                    current_section = "instructions"
                    instructions_lines.append(line)
                else:
                    unparsed_lines.append(line)
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

    instructions = finalize_instruction_lines(instructions_lines)

    return {
        "name": title,
        "servings": servings,
        "ingredients": ingredients,
        "unparsed_lines": unparsed_lines,
        "instructions": instructions,
    }
