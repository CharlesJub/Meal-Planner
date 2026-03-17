from requests import RequestException

from app.ingredient_normalization import build_ingredient_search_queries
from app.models import Ingredient
from app.usda import choose_usda_match, extract_macros_per_gram, search_usda_foods


def ingredient_has_complete_macros(ingredient: Ingredient) -> bool:
    return (
        ingredient.calories_per_unit is not None
        and ingredient.protein_per_unit is not None
        and ingredient.carbs_per_unit is not None
        and ingredient.fat_per_unit is not None
    )


def enrich_ingredient_macros(ingredient: Ingredient):
    if ingredient_has_complete_macros(ingredient):
        return {
            "ingredient": ingredient.name,
            "usda_match": None,
            "data_type": None,
        }

    match = None
    matched_query = ingredient.name

    for query in build_ingredient_search_queries(ingredient.name):
        results = search_usda_foods(query, prefer_generic=True)
        if not results:
            results = search_usda_foods(query, prefer_generic=False)

        match = choose_usda_match(results, query)
        if match is not None:
            matched_query = query
            break

    if match is None:
        return None

    macros = extract_macros_per_gram(match)
    if macros is None:
        return None

    ingredient.calories_per_unit = macros["calories_per_unit"]
    ingredient.protein_per_unit = macros["protein_per_unit"]
    ingredient.carbs_per_unit = macros["carbs_per_unit"]
    ingredient.fat_per_unit = macros["fat_per_unit"]

    return {
        "ingredient": ingredient.name,
        "usda_match": match.get("description"),
        "data_type": match.get("dataType"),
        "matched_query": matched_query,
    }


def try_enrich_ingredient_macros(ingredient: Ingredient):
    try:
        return enrich_ingredient_macros(ingredient)
    except RequestException:
        return None
