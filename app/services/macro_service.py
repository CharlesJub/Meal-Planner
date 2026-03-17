from app.services.recipe_service import get_recipe_bundle_or_404


def get_recipe_macros_logic(db, recipe_id: int):
    recipe, _, recipe_ingredients, ingredient_map = get_recipe_bundle_or_404(
        db, recipe_id
    )

    totals = {
        "calories": 0.0,
        "protein": 0.0,
        "carbs": 0.0,
        "fat": 0.0,
    }

    missing_ingredients = []

    for recipe_ingredient in recipe_ingredients:
        ingredient = ingredient_map.get(recipe_ingredient.ingredient_id)

        if ingredient is None:
            missing_ingredients.append(
                f"unknown ingredient id {recipe_ingredient.ingredient_id}"
            )
            continue

        macros = _resolve_macro_values(recipe_ingredient, ingredient)
        has_missing_macros = any(value is None for value in macros.values())

        if has_missing_macros:
            if ingredient.name not in missing_ingredients:
                missing_ingredients.append(ingredient.name)
            continue

        quantity = recipe_ingredient.quantity
        if quantity is None:
            if ingredient.name not in missing_ingredients:
                missing_ingredients.append(ingredient.name)
            continue

        totals["calories"] += macros["calories"] * quantity
        totals["protein"] += macros["protein"] * quantity
        totals["carbs"] += macros["carbs"] * quantity
        totals["fat"] += macros["fat"] * quantity

    per_serving = {
        "calories": totals["calories"] / recipe.servings if recipe.servings else 0.0,
        "protein": totals["protein"] / recipe.servings if recipe.servings else 0.0,
        "carbs": totals["carbs"] / recipe.servings if recipe.servings else 0.0,
        "fat": totals["fat"] / recipe.servings if recipe.servings else 0.0,
    }

    totals = {key: round(value, 2) for key, value in totals.items()}
    per_serving = {key: round(value, 2) for key, value in per_serving.items()}

    return {
        "recipe_id": recipe.id,
        "recipe_name": recipe.name,
        "servings": recipe.servings,
        "recipe_totals": totals,
        "per_serving": per_serving,
        "missing_ingredients": missing_ingredients,
        "is_complete": len(missing_ingredients) == 0,
    }


def _resolve_macro_values(recipe_ingredient, ingredient) -> dict:
    return {
        "calories": (
            recipe_ingredient.override_calories_per_unit
            if recipe_ingredient.override_calories_per_unit is not None
            else ingredient.calories_per_unit
        ),
        "protein": (
            recipe_ingredient.override_protein_per_unit
            if recipe_ingredient.override_protein_per_unit is not None
            else ingredient.protein_per_unit
        ),
        "carbs": (
            recipe_ingredient.override_carbs_per_unit
            if recipe_ingredient.override_carbs_per_unit is not None
            else ingredient.carbs_per_unit
        ),
        "fat": (
            recipe_ingredient.override_fat_per_unit
            if recipe_ingredient.override_fat_per_unit is not None
            else ingredient.fat_per_unit
        ),
    }
