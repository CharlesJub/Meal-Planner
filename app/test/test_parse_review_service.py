import unittest
from types import SimpleNamespace

from app.services.parse_review_service import build_parse_review


class QueryStub:
    def __init__(self, match, candidates=None):
        self.match = match
        self.candidates = candidates or []

    def filter(self, *_args, **_kwargs):
        return self

    def order_by(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def first(self):
        return self.match

    def all(self):
        return self.candidates


class DbStub:
    def __init__(self, match=None, candidates=None):
        self.match = match
        self.candidates = candidates or []

    def query(self, _model):
        return QueryStub(self.match, self.candidates)


class ParseReviewServiceTests(unittest.TestCase):
    def test_marks_missing_quantity_unit_and_macro_source_for_review(self):
        parsed_recipe = {
            "ingredients": [
                {"name": "juice of 1 lemon", "quantity": None, "unit": ""},
            ],
            "unparsed_lines": [],
        }

        result = build_parse_review(DbStub(), parsed_recipe)

        self.assertTrue(result["needs_human_review"])
        self.assertEqual(result["summary"]["ingredients_needing_review"], 1)
        self.assertEqual(
            result["ingredient_reviews"][0]["flags"],
            ["missing_quantity", "missing_unit", "missing_macro_source"],
        )
        self.assertEqual(result["ingredient_reviews"][0]["macro_status"], "unmatched")
        self.assertIsNone(result["ingredient_reviews"][0]["matched_ingredient"])

    def test_allows_clean_auto_matched_ingredients_to_pass_without_review(self):
        parsed_recipe = {
            "ingredients": [
                {"name": "olive oil", "quantity": 2.0, "unit": "tablespoons"},
            ],
            "unparsed_lines": [],
        }
        ingredient = SimpleNamespace(
            id=11,
            name="olive oil",
            unit="tablespoon",
            calories_per_unit=8.0,
            protein_per_unit=0.0,
            carbs_per_unit=0.0,
            fat_per_unit=0.9,
        )

        result = build_parse_review(DbStub(match=ingredient), parsed_recipe)

        self.assertFalse(result["needs_human_review"])
        self.assertEqual(result["summary"]["ingredients_needing_review"], 0)
        self.assertEqual(result["ingredient_reviews"][0]["flags"], [])
        self.assertEqual(
            result["ingredient_reviews"][0]["suggested_status"], "auto_matched"
        )
        self.assertEqual(
            result["ingredient_reviews"][0]["matched_ingredient"]["id"], 11
        )
        self.assertEqual(result["ingredient_reviews"][0]["macro_status"], "matched")

    def test_unparsed_lines_alone_trigger_human_review(self):
        parsed_recipe = {
            "ingredients": [],
            "unparsed_lines": ["Salt to taste"],
        }

        result = build_parse_review(DbStub(), parsed_recipe)

        self.assertTrue(result["needs_human_review"])
        self.assertEqual(result["summary"]["unparsed_line_count"], 1)

    def test_returns_candidate_matches_for_manual_correction(self):
        parsed_recipe = {
            "ingredients": [
                {"name": "sweet potatoes", "quantity": 2.0, "unit": "lb"},
            ],
            "unparsed_lines": [],
        }
        candidate = SimpleNamespace(
            id=5,
            name="sweet potato raw",
            unit="gram",
            calories_per_unit=0.86,
            protein_per_unit=0.02,
            carbs_per_unit=0.2,
            fat_per_unit=0.0,
        )

        result = build_parse_review(DbStub(candidates=[candidate]), parsed_recipe)

        self.assertEqual(
            result["ingredient_reviews"][0]["candidate_ingredients"][0]["name"],
            "sweet potato raw",
        )


if __name__ == "__main__":
    unittest.main()
