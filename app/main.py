import random

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.cuisine_score import (
    get_recent_cuisine_ids,
    get_recipe_counts_by_cuisine,
    score_cuisine,
)
from app.database import SessionLocal, get_db
from app.models import Cuisine, CuisinePickHistory, Ingredient, Recipe, RecipeIngredient
from app.parsing import parse_recipe_text
from app.schemas import RecipeCreate, RecipeParseRequest
from app.usda import choose_usda_match, extract_macros_per_gram, search_usda_foods

app = FastAPI()


@app.get("/")
def root():
    return {"message": "Recipe Macro API running"}


@app.get("/random-cuisine")
def random_cuisine(db: Session = Depends(get_db)):

    # Get a random cuisine, return first result
    cuisine = db.query(Cuisine).order_by(func.random()).first()
    # If a cuisine is found, return it, otherwise return a message
    if cuisine:
        return {"cuisine": cuisine.name}
    else:
        return {"message": "No cuisines found"}


@app.post("/recipes")
def create_recipe(recipe_data: RecipeCreate, db: Session = Depends(get_db)):
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


@app.get("/recipes/{recipe_id}/macros")
def get_recipe_macros(recipe_id: int, db: Session = Depends(get_db)):
    recipe = db.query(Recipe).filter_by(id=recipe_id).first()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")

    recipe_ingredients = (
        db.query(RecipeIngredient).filter(RecipeIngredient.recipe_id == recipe_id).all()
    )

    ingredient_ids = [ri.ingredient_id for ri in recipe_ingredients]

    ingredients = db.query(Ingredient).filter(Ingredient.id.in_(ingredient_ids)).all()

    ingredient_map = {ingredient.id: ingredient for ingredient in ingredients}

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


@app.get("/recipes")
def get_recipes(db: Session = Depends(get_db)):
    results = db.query(Recipe, Cuisine).join(Cuisine).all()

    return [
        {
            "id": recipe.id,
            "name": recipe.name,
            "cuisine_id": cuisine.name,
            "servings": recipe.servings,
        }
        for recipe, cuisine in results
    ]


@app.get("/recipes/{recipe_id}")
def get_recipe(recipe_id: int, db: Session = Depends(get_db)):

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

    ingredients = db.query(Ingredient).filter(Ingredient.id.in_(ingredient_ids)).all()

    ingredient_map = {ingredient.id: ingredient for ingredient in ingredients}

    return {
        "id": recipe.id,
        "name": recipe.name,
        "cuisine": cuisine.name if cuisine else None,
        "servings": recipe.servings,
        "instructions": recipe.instructions,
        "source": recipe.source,
        "ingredients": [
            {
                "name": ingredient_map[ri.ingredient_id].name,
                "quantity": ri.quantity,
                "unit": ri.unit,
            }
            for ri in recipe_ingredients
        ],
    }


@app.post("/ingredients/enrich")
def enrich_ingredients(db: Session = Depends(get_db)):
    ingredients = (
        db.query(Ingredient)
        .filter(
            (Ingredient.calories_per_unit.is_(None))
            | (Ingredient.protein_per_unit.is_(None))
            | (Ingredient.carbs_per_unit.is_(None))
            | (Ingredient.fat_per_unit.is_(None))
        )
        .all()
    )

    ingredients_updated = 0
    ingredients_skipped = 0
    enriched = []

    try:
        for ingredient in ingredients:
            results = search_usda_foods(ingredient.name, prefer_generic=True)

            if not results:
                results = search_usda_foods(ingredient.name, prefer_generic=False)

            match = choose_usda_match(results, ingredient.name)
            if match is None:
                ingredients_skipped += 1
                continue

            macros = extract_macros_per_gram(match)
            if macros is None:
                ingredients_skipped += 1
                continue

            ingredient.calories_per_unit = macros["calories_per_unit"]
            ingredient.protein_per_unit = macros["protein_per_unit"]
            ingredient.carbs_per_unit = macros["carbs_per_unit"]
            ingredient.fat_per_unit = macros["fat_per_unit"]

            ingredients_updated += 1
            enriched.append(
                {
                    "ingredient": ingredient.name,
                    "usda_match": match.get("description"),
                    "data_type": match.get("dataType"),
                }
            )

        db.commit()

        return {
            "ingredients_updated": ingredients_updated,
            "ingredients_skipped": ingredients_skipped,
            "enriched": enriched,
        }

    except Exception:
        db.rollback()
        raise


@app.get("/ingredients")
def get_ingredients(db: Session = Depends(get_db)):
    ingredients = db.query(Ingredient).all().order_by(Ingredient.name).all()

    return [
        {
            "id": ingredient.id,
            "name": ingredient.name,
            "unit": ingredient.unit,
            "calories_per_unit": ingredient.calories_per_unit,
            "protein_per_unit": ingredient.protein_per_unit,
            "carbs_per_unit": ingredient.carbs_per_unit,
            "fat_per_unit": ingredient.fat_per_unit,
        }
        for ingredient in ingredients
    ]


@app.post("/recipes/parse")
def parse_recipe(request: RecipeParseRequest):
    result = parse_recipe_text(request.text)

    if result is None:
        raise HTTPException(status_code=400, detail="No text provided")

    return result


@app.post("/cuisines/smart-pick")
def smart_pick_cuisine(db: Session = Depends(get_db)):
    cuisines = db.query(Cuisine).all()
    if not cuisines:
        raise HTTPException(status_code=404, detail="No cuisines found")

    recent_ids = get_recent_cuisine_ids(db, limit=3)
    recipe_counts = get_recipe_counts_by_cuisine(db)

    scored_cuisines = []
    for cuisine in cuisines:
        recipe_count = recipe_counts.get(cuisine.id, 0)
        recently_picked = cuisine.id in recent_ids
        score = score_cuisine(recipe_count, recently_picked)

        scored_cuisines.append(
            {
                "id": cuisine.id,
                "name": cuisine.name,
                "score": score,
                "recipe_count": recipe_count,
                "recently_picked": recently_picked,
            }
        )

    scored_cuisines.sort(key=lambda c: c["score"], reverse=True)

    top_candidates = scored_cuisines[:3]
    chosen = random.choice(top_candidates)

    pick = CuisinePickHistory(cuisine_id=chosen["id"])
    db.add(pick)
    db.commit()

    return {
        "selected_cuisine": chosen["name"],
        "score": chosen["score"],
        "recipe_count": chosen["recipe_count"],
        "recently_picked": chosen["recently_picked"],
        "top_candidates": [
            {
                "cuisine": c["name"],
                "score": c["score"],
                "recipe_count": c["recipe_count"],
                "recently_picked": c["recently_picked"],
            }
            for c in top_candidates
        ],
    }
