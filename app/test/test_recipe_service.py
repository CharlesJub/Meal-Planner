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
            create_ingredient_record=False,
            save_macros_to_ingredient=False,
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

    def test_create_ingredient_record_saves_macros_onto_new_ingredient_when_opted_in(self):
        recipe = SimpleNamespace(id=9)
        ingredient_query = MagicMock()
        ingredient_query.filter_by.return_value.first.return_value = None
        delete_query = MagicMock()
        db = MagicMock()
        db.query.side_effect = [delete_query, ingredient_query]

        ingredient_input = SimpleNamespace(
            name="roasted chicken",
            ingredient_id=None,
            create_ingredient_record=True,
            save_macros_to_ingredient=True,
            unit="lb",
            quantity=2.0,
            correction_status="user_confirmed",
            override_calories_per_unit=110.0,
            override_protein_per_unit=12.0,
            override_carbs_per_unit=0.0,
            override_fat_per_unit=6.0,
        )

        created_ingredients = []

        def capture_add(item):
            if item.__class__.__name__ == "Ingredient":
                item.id = 88
                created_ingredients.append(item)

        db.add.side_effect = capture_add

        with patch("app.services.recipe_service.try_enrich_ingredient_macros") as enrich_mock:
            _replace_recipe_ingredients(
                db=db, recipe=recipe, ingredient_inputs=[ingredient_input]
            )

        self.assertEqual(len(created_ingredients), 1)
        created_ingredient = created_ingredients[0]
        self.assertEqual(created_ingredient.calories_per_unit, 110.0)
        self.assertEqual(created_ingredient.protein_per_unit, 12.0)
        self.assertEqual(created_ingredient.carbs_per_unit, 0.0)
        self.assertEqual(created_ingredient.fat_per_unit, 6.0)
        enrich_mock.assert_called_once_with(created_ingredient)

        added_recipe_ingredient = db.add.call_args_list[-1].args[0]
        self.assertEqual(added_recipe_ingredient.ingredient_id, 88)
        self.assertIsNone(added_recipe_ingredient.override_calories_per_unit)
        self.assertIsNone(added_recipe_ingredient.override_protein_per_unit)
        self.assertIsNone(added_recipe_ingredient.override_carbs_per_unit)
        self.assertIsNone(added_recipe_ingredient.override_fat_per_unit)

    def test_create_ingredient_record_keeps_macros_recipe_specific_by_default(self):
        recipe = SimpleNamespace(id=10)
        ingredient_query = MagicMock()
        ingredient_query.filter_by.return_value.first.return_value = None
        delete_query = MagicMock()
        db = MagicMock()
        db.query.side_effect = [delete_query, ingredient_query]

        ingredient_input = SimpleNamespace(
            name="roasted chicken",
            ingredient_id=None,
            create_ingredient_record=True,
            save_macros_to_ingredient=False,
            unit="lb",
            quantity=2.0,
            correction_status="user_confirmed",
            override_calories_per_unit=110.0,
            override_protein_per_unit=12.0,
            override_carbs_per_unit=0.0,
            override_fat_per_unit=6.0,
        )

        created_ingredients = []

        def capture_add(item):
            if item.__class__.__name__ == "Ingredient":
                item.id = 89
                created_ingredients.append(item)

        db.add.side_effect = capture_add

        with patch("app.services.recipe_service.try_enrich_ingredient_macros") as enrich_mock:
            _replace_recipe_ingredients(
                db=db, recipe=recipe, ingredient_inputs=[ingredient_input]
            )

        self.assertEqual(len(created_ingredients), 1)
        created_ingredient = created_ingredients[0]
        self.assertIsNone(created_ingredient.calories_per_unit)
        self.assertIsNone(created_ingredient.protein_per_unit)
        self.assertIsNone(created_ingredient.carbs_per_unit)
        self.assertIsNone(created_ingredient.fat_per_unit)
        enrich_mock.assert_called_once_with(created_ingredient)

        added_recipe_ingredient = db.add.call_args_list[-1].args[0]
        self.assertEqual(added_recipe_ingredient.override_calories_per_unit, 110.0)
        self.assertEqual(added_recipe_ingredient.override_protein_per_unit, 12.0)
        self.assertEqual(added_recipe_ingredient.override_carbs_per_unit, 0.0)
        self.assertEqual(added_recipe_ingredient.override_fat_per_unit, 6.0)

    def test_save_macros_to_ingredient_updates_existing_match_when_opted_in(self):
        recipe = SimpleNamespace(id=11)
        existing_ingredient = SimpleNamespace(
            id=21,
            unit="gram",
            calories_per_unit=50.0,
            protein_per_unit=2.0,
            carbs_per_unit=1.0,
            fat_per_unit=3.0,
        )
        delete_query = MagicMock()
        explicit_query = MagicMock()
        explicit_query.filter.return_value.first.return_value = existing_ingredient
        db = MagicMock()
        db.query.side_effect = [delete_query, explicit_query]

        ingredient_input = SimpleNamespace(
            name="sweet potatoes",
            ingredient_id=21,
            create_ingredient_record=False,
            save_macros_to_ingredient=True,
            unit="lb",
            quantity=1.0,
            correction_status="user_confirmed",
            override_calories_per_unit=80.0,
            override_protein_per_unit=3.0,
            override_carbs_per_unit=18.0,
            override_fat_per_unit=0.0,
        )

        with patch("app.services.recipe_service.try_enrich_ingredient_macros") as enrich_mock:
            _replace_recipe_ingredients(
                db=db, recipe=recipe, ingredient_inputs=[ingredient_input]
            )

        self.assertEqual(existing_ingredient.calories_per_unit, 80.0)
        self.assertEqual(existing_ingredient.protein_per_unit, 3.0)
        self.assertEqual(existing_ingredient.carbs_per_unit, 18.0)
        self.assertEqual(existing_ingredient.fat_per_unit, 0.0)
        enrich_mock.assert_called_once_with(existing_ingredient)

        added_recipe_ingredient = db.add.call_args_list[-1].args[0]
        self.assertIsNone(added_recipe_ingredient.override_calories_per_unit)
        self.assertIsNone(added_recipe_ingredient.override_protein_per_unit)
        self.assertIsNone(added_recipe_ingredient.override_carbs_per_unit)
        self.assertIsNone(added_recipe_ingredient.override_fat_per_unit)


if __name__ == "__main__":
    unittest.main()
