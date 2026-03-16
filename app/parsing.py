import re

INGREDIENT_PATTERN = re.compile(r"^\s*(\d+(?:\.\d+)?)\s+([a-zA-Z]+)\s+(.+)$")

SERVINGS_PATTERN = re.compile(r"(?:serves|makes|yield)\s+(\d+)", re.IGNORECASE)


def parse_recipe_text(text: str):
    lines = [line.strip() for line in text.split("\n") if line.strip()]

    if not lines:
        return None

    title = lines[0]

    servings = None
    ingredients = []
    unparsed_lines = []
    instructions_lines = []
    in_instructions = False

    for line in lines[1:]:
        if in_instructions:
            instructions_lines.append(line)
            continue

        servings_match = SERVINGS_PATTERN.search(line)
        if servings_match:
            servings = int(servings_match.group(1))
            continue

        ingredient_match = INGREDIENT_PATTERN.match(line)

        if ingredient_match:
            quantity = float(ingredient_match.group(1))
            unit = ingredient_match.group(2).lower()
            name = ingredient_match.group(3).lower()

            ingredients.append(
                {
                    "name": name,
                    "quantity": quantity,
                    "unit": unit,
                }
            )
        else:
            if ingredients:
                in_instructions = True
                instructions_lines.append(line)
            else:
                unparsed_lines.append(line)

    instructions = " ".join(instructions_lines)

    return {
        "name": title,
        "servings": servings,
        "ingredients": ingredients,
        "unparsed_lines": unparsed_lines,
        "instructions": instructions,
    }
