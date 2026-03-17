import unittest

from app.ingredient_normalization import (
    build_ingredient_search_queries,
    normalize_ingredient_name,
)


class IngredientNormalizationTests(unittest.TestCase):
    def test_normalizes_noisy_instructional_names(self):
        self.assertEqual(
            normalize_ingredient_name("skinless chicken thigh fillets, cut into 2cm chunks"),
            "chicken thigh",
        )
        self.assertEqual(
            normalize_ingredient_name("garlic crushed"),
            "garlic",
        )
        self.assertEqual(
            normalize_ingredient_name("light olive oil"),
            "olive oil",
        )
        self.assertEqual(
            normalize_ingredient_name("ground cumin"),
            "cumin",
        )

    def test_builds_progressively_simpler_search_queries(self):
        queries = build_ingredient_search_queries(
            "skinless chicken thigh fillets, cut into 2cm chunks"
        )

        self.assertEqual(
            queries,
            [
                "skinless chicken thigh fillets, cut into 2cm chunks",
                "skinless chicken thigh fillets",
                "chicken thigh",
                "chicken",
            ],
        )


if __name__ == "__main__":
    unittest.main()
