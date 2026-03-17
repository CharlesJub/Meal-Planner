import unittest
import sys
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

sys.modules.setdefault("fastapi", MagicMock(HTTPException=Exception))

from app.services.recipe_service import _replace_recipe_ingredients, update_recipe_logic


class UpdateRecipeLogicTests(unittest.TestCase):
    def test_updates_recipe_fields_and_replaces_ingredients(self):
        recipe = SimpleNamespace(
            id=4,
            name="Old Name",
            instructions="Old instructions",
            servings=2,
            source="Old source",
        )
        recipe_data = SimpleNamespace(
            name="New Name ",
            instructions="New instructions",
            servings=6,
            source="New source",
            ingredients=[SimpleNamespace(name="chicken")],
        )

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = recipe

        with patch("app.services.recipe_service._replace_recipe_ingredients") as replace_mock:
            result = update_recipe_logic(db=db, recipe_id=4, recipe_data=recipe_data)

        self.assertEqual(recipe.name, "New Name")
        self.assertEqual(recipe.instructions, "New instructions")
        self.assertEqual(recipe.servings, 6)
        self.assertEqual(recipe.source, "New source")
        replace_mock.assert_called_once_with(
            db=db, recipe=recipe, ingredient_inputs=recipe_data.ingredients
        )
        db.commit.assert_called_once()
        self.assertEqual(
            result,
            {"message": "Recipe updated", "recipe_id": 4, "recipe_name": "New Name"},
        )

    def test_replace_recipe_ingredients_honors_explicit_ingredient_id(self):
        recipe = SimpleNamespace(id=7)
        explicit_ingredient = SimpleNamespace(id=21, unit="gram")
        ingredient_input = SimpleNamespace(
            name="sweet potatoes",
            ingredient_id=21,
            unit="lb",
            quantity=1.0,
            correction_status="user_confirmed",
            override_calories_per_unit=None,
            override_protein_per_unit=None,
            override_carbs_per_unit=None,
            override_fat_per_unit=None,
        )

        delete_query = MagicMock()
        explicit_query = MagicMock()
        explicit_query.filter.return_value.first.return_value = explicit_ingredient
        db = MagicMock()
        db.query.side_effect = [delete_query, explicit_query]

        with patch("app.services.recipe_service.try_enrich_ingredient_macros") as enrich_mock:
            _replace_recipe_ingredients(
                db=db, recipe=recipe, ingredient_inputs=[ingredient_input]
            )

        enrich_mock.assert_called_once_with(explicit_ingredient)
        added_recipe_ingredient = db.add.call_args_list[-1].args[0]
        self.assertEqual(added_recipe_ingredient.ingredient_id, 21)
        self.assertEqual(added_recipe_ingredient.unit, "lb")


if __name__ == "__main__":
    unittest.main()
