from fastapi import Depends, FastAPI, HTTPException

from app.models import Cuisine, CuisinePickHistory, Ingredient, Recipe, RecipeIngredient


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
        ingredient_name = ingredient_input.name.strip().lower()

        ingredient = db.query(Ingredient).filter_by(name=ingredient_name).first()

        if ingredient is None:
            ingredient = Ingredient(
                name=ingredient_name,
                unit=ingredient_input.unit.strip(),
            )
            db.add(ingredient)
            db.flush()

        recipe_ingredient = RecipeIngredient(
            recipe_id=recipe.id,
            ingredient_id=ingredient.id,
            quantity=ingredient_input.quantity,
            unit=ingredient_input.unit.strip(),
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
