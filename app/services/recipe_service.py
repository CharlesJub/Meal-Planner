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

    for ingredient_input in recipe_data.ingredients:
        raw_ingredient_name = ingredient_input.name.strip().lower()
        ingredient_name = normalize_ingredient_name(raw_ingredient_name)
        ingredient_unit = (ingredient_input.unit or "").strip() or None

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

        try_enrich_ingredient_macros(ingredient)

        recipe_ingredient = RecipeIngredient(
            recipe_id=recipe.id,
            ingredient_id=ingredient.id,
            quantity=ingredient_input.quantity,
            unit=ingredient_unit,
        )
        db.add(recipe_ingredient)

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
