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
