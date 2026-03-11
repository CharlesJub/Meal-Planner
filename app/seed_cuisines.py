from app.database import SessionLocal
from app.models import Cuisine

cuisines = [
    "Vietnamese",
    "Japanese",
    "Middle Eastern",
    "Chinese",
    "Indian",
    "Korean",
    "Thai",
    "Mediterranean",
    "American",
    "Mexican",
    "Italian",
    "French",
    "Spanish",
    "Greek",
    "Caribbean",
    "African",
    "Latin American",
]

db = SessionLocal()

try:
    for name in cuisines:
        existing = db.query(Cuisine).filter(name == name).first()

        if not existing:
            db.add(Cuisine(name=name))

    db.commit()

    print("Cuisines seeded")
except:
    db.rollback()
    print("Error seeding cuisines")
    raise
finally:
    db.close()
