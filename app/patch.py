# app/update_ingredient_macros.py
from app.database import SessionLocal
from app.models import Ingredient

db = SessionLocal()

try:
    updates = {
        "chicken breast": {
            "calories_per_unit": 1.2,
            "protein_per_unit": 0.23,
            "carbs_per_unit": 0.0,
            "fat_per_unit": 0.02,
        },
        "greek yogurt": {
            "calories_per_unit": 0.59,
            "protein_per_unit": 0.10,
            "carbs_per_unit": 0.036,
            "fat_per_unit": None,
        },
    }

    for name, macros in updates.items():
        ingredient = db.query(Ingredient).filter_by(name=name).first()
        if ingredient:
            ingredient.calories_per_unit = macros["calories_per_unit"]
            ingredient.protein_per_unit = macros["protein_per_unit"]
            ingredient.carbs_per_unit = macros["carbs_per_unit"]
            ingredient.fat_per_unit = macros["fat_per_unit"]

    db.commit()
    print("Ingredient macros updated")

finally:
    db.close()
