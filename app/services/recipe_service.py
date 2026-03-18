from fastapi import HTTPException

from app.ingredient_normalization import normalize_ingredient_name
from app.models import Cuisine, Ingredient, Recipe, RecipeIngredient
from app.services.ingredient_macro_service import try_enrich_ingredient_macros


def create_recipe_logic(*, db, recipe_data):
    existing_recipe = (
        db.query(Recipe)
        .filter(Recipe.name == recipe_data.name.strip())
        .filter(Recipe.source == recipe_data.source)
        .first()
    )

    if existing_recipe is not None:
        raise HTTPException(status_code=409, detail="Recipe already exists")

    cuisine_name = recipe_data.cuisine.strip()
    cuisine = db.query(Cuisine).filter_by(name=cuisine_name).first()
    if cuisine is None:
        raise HTTPException(status_code=404, detail="Cuisine not found")

    recipe = Recipe(
        name=recipe_data.name.strip(),
        cuisine_id=cuisine.id,
        instructions=recipe_data.instructions,
        servings=recipe_data.servings,
        source=recipe_data.source,
    )
    db.add(recipe)
    db.flush()

    _replace_recipe_ingredients(db=db, recipe=recipe, ingredient_inputs=recipe_data.ingredients)

    db.commit()

    return {
        "message": "Recipe created",
        "recipe_id": recipe.id,
        "recipe_name": recipe.name,
    }


def get_recipe_logic(db):
    results = db.query(Recipe, Cuisine).join(Cuisine).all()

    return [
        {
            "id": recipe.id,
            "name": recipe.name,
            "cuisine": cuisine.name,
            "servings": recipe.servings,
        }
        for recipe, cuisine in results
    ]


def update_recipe_logic(*, db, recipe_id: int, recipe_data):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")

    recipe.name = recipe_data.name.strip()
    recipe.instructions = recipe_data.instructions
    recipe.servings = recipe_data.servings
    recipe.source = recipe_data.source

    _replace_recipe_ingredients(db=db, recipe=recipe, ingredient_inputs=recipe_data.ingredients)

    db.commit()

    return {
        "message": "Recipe updated",
        "recipe_id": recipe.id,
        "recipe_name": recipe.name,
    }


def _resolve_correction_status(
    *,
    quantity,
    requested_status: str | None,
    override_macros: dict,
) -> str:
    normalized_status = (requested_status or "").strip()
    if normalized_status:
        return normalized_status

    has_override = any(value is not None for value in override_macros.values())
    if has_override:
        return "user_overridden"
    if quantity is None:
        return "unresolved"
    return "auto_matched"


def _has_complete_macro_values(override_macros: dict) -> bool:
    return all(value is not None for value in override_macros.values())


def _apply_macros_to_ingredient_record(*, ingredient, override_macros: dict) -> bool:
    if not _has_complete_macro_values(override_macros):
        return False

    ingredient.calories_per_unit = override_macros["calories"]
    ingredient.protein_per_unit = override_macros["protein"]
    ingredient.carbs_per_unit = override_macros["carbs"]
    ingredient.fat_per_unit = override_macros["fat"]
    return True


def _replace_recipe_ingredients(*, db, recipe, ingredient_inputs):
    (
        db.query(RecipeIngredient)
        .filter(RecipeIngredient.recipe_id == recipe.id)
        .delete(synchronize_session=False)
    )

    for ingredient_input in ingredient_inputs:
        raw_ingredient_name = ingredient_input.name.strip().lower()
        ingredient_name = normalize_ingredient_name(raw_ingredient_name)
        ingredient_unit = (ingredient_input.unit or "").strip() or None
        override_macros = {
            "calories": ingredient_input.override_calories_per_unit,
            "protein": ingredient_input.override_protein_per_unit,
            "carbs": ingredient_input.override_carbs_per_unit,
            "fat": ingredient_input.override_fat_per_unit,
        }

        ingredient = None
        explicit_ingredient_id = getattr(ingredient_input, "ingredient_id", None)
        should_create_ingredient_record = bool(
            getattr(ingredient_input, "create_ingredient_record", False)
        )
        save_macros_to_ingredient = bool(
            getattr(ingredient_input, "save_macros_to_ingredient", False)
        )

        if explicit_ingredient_id is not None:
            ingredient = (
                db.query(Ingredient)
                .filter(Ingredient.id == explicit_ingredient_id)
                .first()
            )

        if ingredient is None:
            ingredient = db.query(Ingredient).filter_by(name=ingredient_name).first()

        if ingredient is None:
            ingredient = Ingredient(
                name=ingredient_name,
                unit=ingredient_unit,
            )
            db.add(ingredient)
            db.flush()
        elif ingredient.unit is None and ingredient_unit is not None:
            ingredient.unit = ingredient_unit

        ingredient_macros_created = False
        if save_macros_to_ingredient and (
            should_create_ingredient_record or explicit_ingredient_id is not None
        ):
            ingredient_macros_created = _apply_macros_to_ingredient_record(
                ingredient=ingredient,
                override_macros=override_macros,
            )

        try_enrich_ingredient_macros(ingredient)

        recipe_override_macros = (
            {
                "calories": None,
                "protein": None,
                "carbs": None,
                "fat": None,
            }
            if ingredient_macros_created
            else override_macros
        )

        recipe_ingredient = RecipeIngredient(
            recipe_id=recipe.id,
            ingredient_id=ingredient.id,
            quantity=ingredient_input.quantity,
            unit=ingredient_unit,
            correction_status=_resolve_correction_status(
                quantity=ingredient_input.quantity,
                requested_status=ingredient_input.correction_status,
                override_macros=recipe_override_macros,
            ),
            override_calories_per_unit=recipe_override_macros["calories"],
            override_protein_per_unit=recipe_override_macros["protein"],
            override_carbs_per_unit=recipe_override_macros["carbs"],
            override_fat_per_unit=recipe_override_macros["fat"],
        )
        db.add(recipe_ingredient)


def get_recipe_bundle_or_404(db, recipe_id: int):
    result = (
        db.query(Recipe, Cuisine).join(Cuisine).filter(Recipe.id == recipe_id).first()
    )

    if result is None:
        raise HTTPException(status_code=404, detail="Recipe not found")

    recipe, cuisine = result
    recipe_ingredients = (
        db.query(RecipeIngredient).filter(RecipeIngredient.recipe_id == recipe_id).all()
    )
    ingredient_ids = [ri.ingredient_id for ri in recipe_ingredients]
    ingredients = (
        db.query(Ingredient).filter(Ingredient.id.in_(ingredient_ids)).all()
        if ingredient_ids
        else []
    )
    ingredient_map = {ingredient.id: ingredient for ingredient in ingredients}

    return recipe, cuisine, recipe_ingredients, ingredient_map
