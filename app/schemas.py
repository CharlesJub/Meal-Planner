from typing import List

from pydantic import BaseModel


class RecipeIngredientInput(BaseModel):
    name: str
    quantity: float | None = None
    unit: str | None = None
    correction_status: str | None = None
    override_calories_per_unit: float | None = None
    override_protein_per_unit: float | None = None
    override_carbs_per_unit: float | None = None
    override_fat_per_unit: float | None = None


class RecipeCreate(BaseModel):
    name: str
    cuisine: str
    servings: int
    instructions: str
    source: str | None = None
    ingredients: List[RecipeIngredientInput]


class RecipeParseRequest(BaseModel):
    text: str
