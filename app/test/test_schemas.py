import unittest

from pydantic import ValidationError

from app.schemas import RecipeIngredientInput


class RecipeIngredientInputTests(unittest.TestCase):
    def test_rejects_partial_macro_override_payloads(self):
        with self.assertRaises(ValidationError):
            RecipeIngredientInput(
                name="olive oil",
                override_calories_per_unit=8.0,
                override_protein_per_unit=0.0,
            )

    def test_accepts_complete_macro_override_payloads(self):
        ingredient = RecipeIngredientInput(
            name="olive oil",
            override_calories_per_unit=8.0,
            override_protein_per_unit=0.0,
            override_carbs_per_unit=0.0,
            override_fat_per_unit=0.9,
        )

        self.assertEqual(ingredient.override_calories_per_unit, 8.0)


if __name__ == "__main__":
    unittest.main()
