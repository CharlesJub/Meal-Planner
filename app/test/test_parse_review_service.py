import unittest
from types import SimpleNamespace

from app.services.parse_review_service import build_parse_review


class QueryStub:
    def __init__(self, match):
        self.match = match

    def filter(self, *_args, **_kwargs):
        return self

    def first(self):
        return self.match


class DbStub:
    def __init__(self, matches):
        self.matches = list(matches)

    def query(self, _model):
        match = self.matches.pop(0) if self.matches else None
        return QueryStub(match)


class ParseReviewServiceTests(unittest.TestCase):
    def test_marks_missing_quantity_unit_and_macro_source_for_review(self):
        parsed_recipe = {
            "ingredients": [
                {"name": "juice of 1 lemon", "quantity": None, "unit": ""},
            ],
            "unparsed_lines": [],
        }

        result = build_parse_review(DbStub([None]), parsed_recipe)

        self.assertTrue(result["needs_human_review"])
        self.assertEqual(result["summary"]["ingredients_needing_review"], 1)
        self.assertEqual(
            result["ingredient_reviews"][0]["flags"],
            ["missing_quantity", "missing_unit", "missing_macro_source"],
        )

    def test_allows_clean_auto_matched_ingredients_to_pass_without_review(self):
        parsed_recipe = {
            "ingredients": [
                {"name": "olive oil", "quantity": 2.0, "unit": "tablespoons"},
            ],
            "unparsed_lines": [],
        }
        ingredient = SimpleNamespace(
            calories_per_unit=8.0,
            protein_per_unit=0.0,
            carbs_per_unit=0.0,
            fat_per_unit=0.9,
        )

        result = build_parse_review(DbStub([ingredient]), parsed_recipe)

        self.assertFalse(result["needs_human_review"])
        self.assertEqual(result["summary"]["ingredients_needing_review"], 0)
        self.assertEqual(result["ingredient_reviews"][0]["flags"], [])
        self.assertEqual(
            result["ingredient_reviews"][0]["suggested_status"], "auto_matched"
        )

    def test_unparsed_lines_alone_trigger_human_review(self):
        parsed_recipe = {
            "ingredients": [],
            "unparsed_lines": ["Salt to taste"],
        }

        result = build_parse_review(DbStub([]), parsed_recipe)

        self.assertTrue(result["needs_human_review"])
        self.assertEqual(result["summary"]["unparsed_line_count"], 1)


if __name__ == "__main__":
    unittest.main()
