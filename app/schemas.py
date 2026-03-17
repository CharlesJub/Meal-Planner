from typing import List

from pydantic import BaseModel, model_validator


class RecipeIngredientInput(BaseModel):
    name: str
    quantity: float | None = None
    unit: str | None = None
    correction_status: str | None = None
    override_calories_per_unit: float | None = None
    override_protein_per_unit: float | None = None
    override_carbs_per_unit: float | None = None
    override_fat_per_unit: float | None = None

    @model_validator(mode="after")
    def validate_macro_overrides(self):
        override_values = (
            self.override_calories_per_unit,
            self.override_protein_per_unit,
            self.override_carbs_per_unit,
            self.override_fat_per_unit,
        )
        has_any_override = any(value is not None for value in override_values)
        has_all_overrides = all(value is not None for value in override_values)

        if has_any_override and not has_all_overrides:
            raise ValueError(
                "Ingredient macro overrides must include calories, protein, carbs, and fat."
            )

        return self


class RecipeCreate(BaseModel):
    name: str
    cuisine: str
    servings: int
    instructions: str
    source: str | None = None
    ingredients: List[RecipeIngredientInput]


class RecipeUpdate(BaseModel):
    name: str
    servings: int
    instructions: str
    source: str | None = None
    ingredients: List[RecipeIngredientInput]


class RecipeParseRequest(BaseModel):
    text: str
