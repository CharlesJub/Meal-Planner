from random import random

from sqlalchemy import func

from app.models import Cuisine, CuisinePickHistory, Recipe


def score_cuisine(recipe_count: int, recently_picked: bool) -> int:
    score = 0

    if recipe_count == 0:
        score += 10
    elif recipe_count == 1:
        score += 7
    elif recipe_count == 2:
        score += 5
    elif recipe_count <= 4:
        score += 3

    if recently_picked:
        score -= 100

    # Add a small random factor to help break ties
    # score += random.randint(0, 2)

    return score


def get_recent_cuisine_ids(db, limit=3):
    recent_picks = (
        db.query(CuisinePickHistory.cuisine_id)
        .order_by(CuisinePickHistory.picked_at.desc())
        .limit(limit)
        .all()
    )

    return {pick[0] for pick in recent_picks}


def get_recipe_counts_by_cuisine(db):

    counts = (
        db.query(Cuisine.id, func.count(Recipe.id))
        .outerjoin(Recipe, Recipe.cuisine_id == Cuisine.id)
        .group_by(Cuisine.id)
        .all()
    )

    return {cuisine_id: count for cuisine_id, count in counts}
