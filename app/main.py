from fastapi import FastAPI, HTTPException
from sqlalchemy import func

from app.database import SessionLocal
from app.models import Cuisine, Ingredient, Recipe, RecipeIngredient
from app.schemas import RecipeCreate

app = FastAPI()


@app.get("/")
def root():
    return {"message": "Recipe Macro API running"}


@app.get("/random-cuisine")
def random_cuisine():
    # Open session
    db = SessionLocal()

    try:
        # Get a random cuisine, return first result
        cuisine = db.query(Cuisine).order_by(func.random()).first()
        # If a cuisine is found, return it, otherwise return a message
        if cuisine:
            return {"cuisine": cuisine.name}
        else:
            return {"message": "No cuisines found"}
    finally:
        db.close()


@app.post("/recipes")
def create_recipe(recipe_data: RecipeCreate):
    db = SessionLocal()
    try:
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

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@app.get("/recipes/{recipe_id}/macros")
def get_recipe_macros(recipe_id: int):
    db = SessionLocal()

    try:
        recipe = db.query(Recipe).filter_by(id=recipe_id).first()
        if recipe is None:
            raise HTTPException(status_code=404, detail="Recipe not found")

        recipe_ingredients = (
            db.query(RecipeIngredient).filter_by(recipe_id=recipe_id).all()
        )

        ingredient_ids = [ri.ingredient_id for ri in recipe_ingredients]

        ingredients = (
            db.query(Ingredient).filter(Ingredient.id.in_(ingredient_ids)).all()
        )

        ingredient_map = {ingredient.id: ingredient for ingredient in ingredients}

        totals = {
            "calories": 0.0,
            "protein": 0.0,
            "carbs": 0.0,
            "fat": 0.0,
        }

        missing_ingredients = []

        for recipe_ingredient in recipe_ingredients:
            ingredient = ingredient_map[recipe_ingredient.ingredient_id]
            quantity = recipe_ingredient.quantity

            has_missing_macros = (
                ingredient.calories_per_unit is None
                or ingredient.protein_per_unit is None
                or ingredient.carbs_per_unit is None
                or ingredient.fat_per_unit is None
            )

            if has_missing_macros:
                missing_ingredients.append(ingredient.name)
                continue

            totals["calories"] += ingredient.calories_per_unit * quantity
            totals["protein"] += ingredient.protein_per_unit * quantity
            totals["carbs"] += ingredient.carbs_per_unit * quantity
            totals["fat"] += ingredient.fat_per_unit * quantity

        per_serving = {
            "calories": round(totals["calories"] / recipe.servings, 2),
            "protein": round(totals["protein"] / recipe.servings, 2),
            "carbs": round(totals["carbs"] / recipe.servings, 2),
            "fat": round(totals["fat"] / recipe.servings, 2),
        }
        # fix rounding of totals to 2 decimal places
        totals = {k: round(v, 2) for k, v in totals.items()}

        return {
            "recipe_id": recipe.id,
            "recipe_name": recipe.name,
            "servings": recipe.servings,
            "recipe_totals": totals,
            "per_serving": per_serving,
            "missing_ingredients": missing_ingredients,
            "is_complete": len(missing_ingredients) == 0,
        }

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
