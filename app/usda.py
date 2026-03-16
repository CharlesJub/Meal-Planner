import requests

from app.config import USDA_API_KEY

USDA_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search"


def search_usda_foods(query: str, prefer_generic: bool = True):
    payload = {
        "query": query,
        "pageSize": 10,
    }

    if prefer_generic:
        payload["dataType"] = ["Foundation", "SR Legacy"]

    response = requests.post(
        USDA_SEARCH_URL,
        params={"api_key": USDA_API_KEY},
        json=payload,
        timeout=10,
    )
    response.raise_for_status()

    data = response.json()
    return data.get("foods", [])


def choose_usda_match(results, ingredient_name: str):
    if not results:
        return None

    ingredient_name = ingredient_name.strip().lower()
    tokens = [token for token in ingredient_name.split() if token]

    bad_words = {
        "breaded",
        "fried",
        "grilled",
        "roasted",
        "cooked",
        "uncooked",
        "tenders",
        "nuggets",
        "patty",
        "glazed",
        "smoked",
        "seasoned",
        "flavored",
        "flavor",
        "sweetened",
        "prepared",
        "honey",
        "mesquite",
        "sliced",
    }

    good_words = {
        "raw",
        "plain",
        "meat only",
    }

    def score(food):
        description = (food.get("description") or "").strip().lower()

        # Require all input tokens to appear
        if not all(token in description for token in tokens):
            return float("-inf")

        score = 0

        # Strong reward for exact/simple descriptions
        if description == ingredient_name:
            score += 100
        if description.startswith(ingredient_name):
            score += 20

        # Reward generic USDA-style foods
        data_type = (food.get("dataType") or "").lower()
        if data_type == "foundation":
            score += 20
        elif data_type == "sr legacy":
            score += 10

        # Penalize processed / branded formatting
        if "," in description:
            score -= 8
        if "(" in description or ")" in description:
            score -= 12

        for word in bad_words:
            if word in description:
                score -= 15

        for word in good_words:
            if word in description:
                score += 8

        # Prefer shorter descriptions after all other scoring
        score -= len(description) * 0.05

        return score

    best = max(results, key=score)
    if score(best) == float("-inf"):
        return None

    return best


def extract_macros_per_gram(food: dict):
    nutrients = food.get("foodNutrients", [])
    if not nutrients:
        return None

    calories = None
    protein = None
    carbs = None
    fat = None

    for nutrient in nutrients:
        nutrient_number = str(nutrient.get("nutrientNumber", "")).strip()
        value = nutrient.get("value")

        if value is None:
            continue

        if nutrient_number == "208":
            calories = value
        elif nutrient_number == "957" and calories is None:
            calories = value
        elif nutrient_number == "958" and calories is None:
            calories = value
        elif nutrient_number == "203":
            protein = value
        elif nutrient_number == "205":
            carbs = value
        elif nutrient_number == "204":
            fat = value

    if calories is None or protein is None or carbs is None or fat is None:
        return None

    return {
        "calories_per_unit": calories / 100,
        "protein_per_unit": protein / 100,
        "carbs_per_unit": carbs / 100,
        "fat_per_unit": fat / 100,
    }


def main():
    results = search_usda_foods(
        "chicken breast, skinless, boneless", prefer_generic=True
    )
    match = choose_usda_match(results, "chicken breast")

    print(match.get("description"))
    print(match.get("dataType"))
    for n in match.get("foodNutrients", []):
        print(n.get("nutrientNumber"), n.get("nutrientName"), n.get("value"))

    macros = extract_macros_per_gram(match)
    print(macros)


if __name__ == "__main__":
    main()
