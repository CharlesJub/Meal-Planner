import unittest
import sys
from types import SimpleNamespace
from unittest.mock import MagicMock
from unittest.mock import patch

sys.modules.setdefault("fastapi", MagicMock(HTTPException=Exception))

from app.services.macro_service import get_recipe_macros_logic


class MacroServiceTests(unittest.TestCase):
    def test_skips_unquantified_ingredients_in_macro_totals(self):
        recipe = SimpleNamespace(id=7, name="MUSSAKHAN", servings=4)
        recipe_ingredients = [
            SimpleNamespace(ingredient_id=1, quantity=2.0),
            SimpleNamespace(ingredient_id=2, quantity=None),
        ]
        ingredient_map = {
            1: SimpleNamespace(
                name="olive oil",
                calories_per_unit=100.0,
                protein_per_unit=0.0,
                carbs_per_unit=0.0,
                fat_per_unit=10.0,
            ),
            2: SimpleNamespace(
                name="sea salt and freshly ground black pepper",
                calories_per_unit=0.0,
                protein_per_unit=0.0,
                carbs_per_unit=0.0,
                fat_per_unit=0.0,
            ),
        }

        with patch(
            "app.services.macro_service.get_recipe_bundle_or_404",
            return_value=(recipe, None, recipe_ingredients, ingredient_map),
        ):
            result = get_recipe_macros_logic(db=object(), recipe_id=7)

        self.assertEqual(
            result["recipe_totals"],
            {"calories": 200.0, "protein": 0.0, "carbs": 0.0, "fat": 20.0},
        )
        self.assertEqual(
            result["per_serving"],
            {"calories": 50.0, "protein": 0.0, "carbs": 0.0, "fat": 5.0},
        )
        self.assertIn(
            "sea salt and freshly ground black pepper",
            result["missing_ingredients"],
        )
        self.assertFalse(result["is_complete"])


if __name__ == "__main__":
    unittest.main()
