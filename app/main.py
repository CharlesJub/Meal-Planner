import random

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.cuisine_score import (
    get_recent_cuisine_ids,
    get_recipe_counts_by_cuisine,
    score_cuisine,
)
from app.database import get_db
from app.db_init import init_database
from app.models import Cuisine, CuisinePickHistory, Ingredient
from app.parsing import parse_recipe_text
from app.schemas import RecipeCreate, RecipeParseRequest, RecipeUpdate
from app.services.ingredient_macro_service import enrich_ingredient_macros
from app.services.macro_service import get_recipe_macros_logic
from app.services.parse_review_service import build_parse_review
from app.services.recipe_service import (
    create_recipe_logic,
    get_recipe_bundle_or_404,
    get_recipe_logic,
    update_recipe_logic,
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:4000",
        "http://127.0.0.1:4000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_database()


def _serialize_ingredient(ingredient: Ingredient) -> dict:
    macro_values = (
        ingredient.calories_per_unit,
        ingredient.protein_per_unit,
        ingredient.carbs_per_unit,
        ingredient.fat_per_unit,
    )
    if all(value is not None for value in macro_values):
        macro_status = "matched"
    elif any(value is not None for value in macro_values):
        macro_status = "incomplete"
    else:
        macro_status = "unmatched"

    return {
        "id": ingredient.id,
        "name": ingredient.name,
        "unit": ingredient.unit,
        "calories_per_unit": ingredient.calories_per_unit,
        "protein_per_unit": ingredient.protein_per_unit,
        "carbs_per_unit": ingredient.carbs_per_unit,
        "fat_per_unit": ingredient.fat_per_unit,
        "macro_status": macro_status,
    }


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
    return create_recipe_logic(db=db, recipe_data=recipe_data)


@app.get("/recipes/{recipe_id}/macros")
def get_recipe_macros(recipe_id: int, db: Session = Depends(get_db)):
    return get_recipe_macros_logic(db, recipe_id)


@app.get("/recipes")
def get_recipes(db: Session = Depends(get_db)):
    return get_recipe_logic(db)


@app.get("/recipes/{recipe_id}")
def get_recipe(recipe_id: int, db: Session = Depends(get_db)):
    recipe, cuisine, recipe_ingredients, ingredient_map = get_recipe_bundle_or_404(
        db, recipe_id
    )

    return {
        "id": recipe.id,
        "name": recipe.name,
        "cuisine": cuisine.name if cuisine else None,
        "servings": recipe.servings,
        "instructions": recipe.instructions,
        "source": recipe.source,
        "ingredients": [
            {
                "id": ri.id,
                "name": ingredient_map[ri.ingredient_id].name,
                "ingredient_id": ri.ingredient_id,
                "quantity": ri.quantity,
                "unit": ri.unit,
                "correction_status": ri.correction_status,
                "override_calories_per_unit": ri.override_calories_per_unit,
                "override_protein_per_unit": ri.override_protein_per_unit,
                "override_carbs_per_unit": ri.override_carbs_per_unit,
                "override_fat_per_unit": ri.override_fat_per_unit,
            }
            for ri in recipe_ingredients
        ],
    }


@app.put("/recipes/{recipe_id}")
def update_recipe(
    recipe_id: int, recipe_data: RecipeUpdate, db: Session = Depends(get_db)
):
    return update_recipe_logic(db=db, recipe_id=recipe_id, recipe_data=recipe_data)


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
            enriched_ingredient = enrich_ingredient_macros(ingredient)
            if enriched_ingredient is None:
                ingredients_skipped += 1
                continue

            ingredients_updated += 1
            enriched.append(enriched_ingredient)

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
def get_ingredients(search: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Ingredient)

    if search and search.strip():
        normalized_search = search.strip().lower()
        query = query.filter(Ingredient.name.ilike(f"%{normalized_search}%"))

    ingredients = query.order_by(Ingredient.name).limit(25).all()

    return [_serialize_ingredient(ingredient) for ingredient in ingredients]


@app.post("/ingredients")
def create_ingredient(payload: dict, db: Session = Depends(get_db)):
    name = str(payload.get("name", "")).strip().lower()
    if not name:
        raise HTTPException(status_code=400, detail="Ingredient name is required")

    existing = db.query(Ingredient).filter(Ingredient.name == name).first()
    if existing is not None:
        return _serialize_ingredient(existing)

    ingredient = Ingredient(
        name=name,
        unit=(payload.get("unit") or "").strip() or None,
        calories_per_unit=payload.get("calories_per_unit"),
        protein_per_unit=payload.get("protein_per_unit"),
        carbs_per_unit=payload.get("carbs_per_unit"),
        fat_per_unit=payload.get("fat_per_unit"),
    )
    db.add(ingredient)
    db.commit()
    db.refresh(ingredient)

    return _serialize_ingredient(ingredient)


@app.post("/recipes/parse")
def parse_recipe(request: RecipeParseRequest, db: Session = Depends(get_db)):
    result = parse_recipe_text(request.text)

    if result is None:
        raise HTTPException(status_code=400, detail="No text provided")

    result["review"] = build_parse_review(db, result)
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


@app.get("/cuisines")
def get_cuisines(db: Session = Depends(get_db)):
    cuisines = db.query(Cuisine).order_by(Cuisine.name).all()
    return [{"id": c.id, "name": c.name} for c in cuisines]
