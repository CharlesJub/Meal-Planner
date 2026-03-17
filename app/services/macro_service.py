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

        has_missing_macros = (
            ingredient.calories_per_unit is None
            or ingredient.protein_per_unit is None
            or ingredient.carbs_per_unit is None
            or ingredient.fat_per_unit is None
        )

        if has_missing_macros:
            if ingredient.name not in missing_ingredients:
                missing_ingredients.append(ingredient.name)
            continue

        quantity = recipe_ingredient.quantity
        if quantity is None:
            if ingredient.name not in missing_ingredients:
                missing_ingredients.append(ingredient.name)
            continue

        totals["calories"] += ingredient.calories_per_unit * quantity
        totals["protein"] += ingredient.protein_per_unit * quantity
        totals["carbs"] += ingredient.carbs_per_unit * quantity
        totals["fat"] += ingredient.fat_per_unit * quantity

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
