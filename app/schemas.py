from typing import List

from pydantic import BaseModel


class RecipeIngredientInput(BaseModel):
    name: str
    quantity: float | None = None
    unit: str | None = None


class RecipeCreate(BaseModel):
    name: str
    cuisine: str
    servings: int
    instructions: str
    source: str | None = None
    ingredients: List[RecipeIngredientInput]


class RecipeParseRequest(BaseModel):
    text: str
