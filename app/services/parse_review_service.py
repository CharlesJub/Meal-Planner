from app.ingredient_normalization import normalize_ingredient_name
from app.models import Ingredient


def build_parse_review(db, parsed_recipe: dict) -> dict:
    ingredient_reviews = []

    for ingredient in parsed_recipe.get("ingredients", []):
        quantity = ingredient.get("quantity")
        unit = ingredient.get("unit")
        name = ingredient.get("name", "")
        flags = []

        if quantity is None:
            flags.append("missing_quantity")
        if unit in (None, ""):
            flags.append("missing_unit")

        matched_ingredient = None
        if name:
            normalized_name = normalize_ingredient_name(name.strip().lower())
            matched_ingredient = (
                db.query(Ingredient).filter(Ingredient.name == normalized_name).first()
            )

        if matched_ingredient is None:
            flags.append("missing_macro_source")
        else:
            has_complete_macros = all(
                value is not None
                for value in (
                    matched_ingredient.calories_per_unit,
                    matched_ingredient.protein_per_unit,
                    matched_ingredient.carbs_per_unit,
                    matched_ingredient.fat_per_unit,
                )
            )
            if not has_complete_macros:
                flags.append("missing_macro_data")

        ingredient_reviews.append(
            {
                "name": name,
                "quantity": quantity,
                "unit": unit,
                "flags": flags,
                "needs_review": len(flags) > 0,
                "suggested_status": "needs_review" if flags else "auto_matched",
            }
        )

    unparsed_lines = parsed_recipe.get("unparsed_lines", [])
    needs_review = any(item["needs_review"] for item in ingredient_reviews) or bool(
        unparsed_lines
    )

    return {
        "needs_human_review": needs_review,
        "ingredient_reviews": ingredient_reviews,
        "unparsed_lines": unparsed_lines,
        "summary": {
            "ingredient_count": len(ingredient_reviews),
            "ingredients_needing_review": sum(
                1 for item in ingredient_reviews if item["needs_review"]
            ),
            "unparsed_line_count": len(unparsed_lines),
        },
    }
