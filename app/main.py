from fastapi import FastAPI
from sqlalchemy import func

from app.database import SessionLocal
from app.models import Cuisine

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
