import unittest

from app.parsing import parse_recipe_text

ULTIMATE_CHICKEN_SOUP = """Ultimate Chicken Soup
This nourishing and healing chicken soup recipe is loaded with poached chicken, carrots, parsnips, celery, leek, onion, garlic and fresh herbs. It's a great cold weather soup! Watch the video below to see how I make it in my kitchen.
Prep Time10 minutes mins
Cook Time20 minutes mins
Total Time30 minutes mins
Course: Soup
Cuisine: American
Keyword: chicken soup, chicken soup recipe
Servings: 4 servings
Author: Lisa Bryan
Equipment

    Le Creuset Dutch Oven My favorite soup pot!

Ingredients

    2 tablespoons extra virgin olive oil
    4 medium carrots peeled and sliced
    3 parsnips peeled and sliced
    3 celery ribs sliced
    1/2 medium onion diced
    1 leek halved lengthwise, sliced, and rinsed
    4 garlic cloves minced
    1 teaspoon kosher salt
    1/2 teaspoon freshly ground black pepper
    2 boneless skinless chicken breasts
    2 sprigs fresh thyme
    2 sprigs fresh tarragon
    1 bay leaf
    5 cups low-sodium chicken broth
    1/4 cup roughly chopped fresh parsley

Instructions

    Saute the veggies. Heat the oil in a large pot on medium heat. Add the carrots, parsnips, celery, leek, and onion to the pot and cook for 4 to 5 minutes, stirring frequently. Add the garlic, salt, and pepper, and stir for another minute.
    Poach the chicken. Add the thyme, tarragon, bay leaf, chicken, and broth. Bring to a boil, then reduce the heat to low and cover the pot. Simmer the soup for 15 minutes, or until the chicken is fully cooked.
    Shred the chicken. With tongs, remove the chicken to a cutting board and then gently shred the chicken with two forks. Place the shredded chicken back into the pot and simmer for an additional 1 to 2 minutes.
    Serve. Remove the sprigs of thyme, tarragon and the bay leaf. Stir in the parsley, and garnish with additional fresh parsley and black pepper before serving.

Notes

    Those of you with an eagle eye may have noticed I added the garlic first in the video above. While that's not detrimental, I do believe the steps listed above are best - so follow those.
    For the shredded chicken hack (using a stand mixer) that I mention in the video, check out my shredded chicken recipe.
"""

CHICKEN_SHAWARMA = """Chicken shawarma
Serve these juicy, lemony chicken pieces in warm flatbreads
with some tahini sauce, crunchy pickles and a few slices of
fresh tomato and cucumber. If you don’t have a griddle pan,
you can also cook them under a grill preheated to a medium
setting.
Serves 4
800g skinless chicken thigh fillets, cut into 2cm chunks
finely grated zest and juice of 1 unwaxed lemon
1 garlic clove, crushed
1/4 teaspoon ground turmeric
1/2 teaspoon ground allspice
1/2 teaspoon ground cumin
3 tablespoons light olive oil
sea salt and freshly ground black pepper
Place the chicken in a large bowl and add all the ingredients,
seasoning with 1 teaspoon salt and 1/2 teaspoon pepper. Mix
well, then cover and marinate in the fridge for at least 2 hours.
When you are ready to cook, place a large ridged griddle pan
over a medium-high heat.
When the pan is hot, place the chicken on it and cook for
around 3 minutes on each side until the pieces are just
cooked through. Transfer to a plate, cover with foil and leave
to rest for a few minutes before serving.
"""


SIMPLE_RECIPE = """Weeknight Eggs
Serves 2
2 eggs
1 tbsp butter
Salt to taste
Cook the eggs in butter and season before serving.
"""

CHICKEN_SHAWARMA = """Chicken shawarma
Serve these juicy, lemony chicken pieces in warm flatbreads
with some tahini sauce, crunchy pickles and a few slices of
fresh tomato and cucumber. If you don't have a griddle pan,
you can also cook them under a grill preheated to a medium
setting.
Serves 4
800g skinless chicken thigh fillets, cut into 2cm chunks
finely grated zest and juice of 1 unwaxed lemon
1 garlic clove, crushed
1/4 teaspoon ground turmeric
1/2 teaspoon ground allspice
1/2 teaspoon ground cumin
3 tablespoons light olive oil
sea salt and freshly ground black pepper
Place the chicken in a large bowl and add all the ingredients,
seasoning with 1 teaspoon salt and 1/2 teaspoon pepper. Mix
well, then cover and marinate in the fridge for at least 2 hours.
When you are ready to cook, place a large ridged griddle pan
over a medium-high heat.
When the pan is hot, place the chicken on it and cook for
around 3 minutes on each side until the pieces are just
cooked through. Transfer to a plate, cover with foil and leave
to rest for a few minutes before serving.
"""

MUSSAKHAN = """MUSSAKHAN
Mussakhan is a classic Palestinian dish eaten in villages
throughout the region. Traditionally the meat is laid out on a
giant piece of bread with the flavoursome roasting juices
poured over it, so that they seep into the dough. This platter is
then placed on the table for everyone to pull off sections of
bread and chicken: a wonderful sharing meal. As it can be
challenging to find such large pieces of flatbread in most
shops, I’ve suggested using individual naan breads instead…
but, of course, if you can, seek out traditional sheets of Arabic
taboon bread from Middle Eastern stores. If you are avoiding
gluten, the chicken is just as delicious on its own, or served
with rice or a salad.
Serves 4
1kg chicken thighs and drumsticks, skin on
3 tablespoons extra virgin olive oil, plus more to serve
½ teaspoon ground cumin
½ teaspoon ground allspice
¼ teaspoon ground cinnamon
1 ½ tablespoons sumac, plus more to dust
juice of 1 lemon
4 garlic cloves, crushed
sea salt and freshly ground black pepper
2 large red onions (about 500g), finely sliced into half-moons
2 tablespoons pine nuts
1 tablespoon light olive oil
naan or Arabic taboon bread, to serve
chopped parsley leavesSlash the flesh of each piece of chicken diagonally a few
times, around 2cm apart, and then place the meat in a large
bowl or plastic food container.
Pour over the extra virgin olive oil, spices, lemon juice, garlic, 1
½ teaspoons salt and ¼ teaspoon pepper and rub this into
the meat. Add the red onions and toss everything together
well. Cover and leave to marinate in the fridge for 1–3 hours.
When you are ready to cook the chicken, preheat the oven to
190°C/fan 170°C/Gas 5.
Transfer the meat to a baking tray and roast for about 35
minutes, or until the chicken juices run clear when pierced at
their thickest part. Once the chicken is cooked, cover in foil
and leave to rest while you prepare the toppings.
Fry the pine nuts in the light olive oil for a minute or so until
they turn golden brown, then tip on to kitchen paper to drain.
To serve, toast the naan or taboon bread and then place the
chicken and red onion on top. Finish with a smattering of
pine nuts, sumac and chopped parsley. Drizzle over any
remaining roasting juices so they soak into the bread, then
sprinkle over a little more extra virgin olive oil."""


class ParseRecipeTextTests(unittest.TestCase):
    def test_parses_structured_recipe_with_sections_and_unicode_style_fractions(self):
        result = parse_recipe_text(ULTIMATE_CHICKEN_SOUP)

        self.assertIsNotNone(result)
        self.assertEqual(result["name"], "Ultimate Chicken Soup")
        self.assertEqual(result["servings"], 4)
        self.assertEqual(len(result["ingredients"]), 15)
        self.assertEqual(
            result["ingredients"][0],
            {
                "name": "extra virgin olive oil",
                "quantity": 2.0,
                "unit": "tablespoons",
            },
        )
        self.assertEqual(
            result["ingredients"][4],
            {
                "name": "onion diced",
                "quantity": 0.5,
                "unit": "medium",
            },
        )
        self.assertEqual(
            result["ingredients"][6],
            {
                "name": "garlic minced",
                "quantity": 4.0,
                "unit": "cloves",
            },
        )
        self.assertIn("Saute the veggies.", result["instructions"])
        self.assertIn("Serve. Remove the sprigs", result["instructions"])
        self.assertIn(
            "This nourishing and healing chicken soup recipe is loaded with poached chicken, carrots, parsnips, celery, leek, onion, garlic and fresh herbs. It's a great cold weather soup! Watch the video below to see how I make it in my kitchen.",
            result["unparsed_lines"],
        )
        self.assertIn(
            "Those of you with an eagle eye may have noticed I added the garlic first in the video above. While that's not detrimental, I do believe the steps listed above are best - so follow those.",
            result["unparsed_lines"],
        )
        self.assertTrue(result["parse_issues"])
        self.assertEqual(result["parse_issues"][0]["line_number"], 2)
        self.assertEqual(result["parse_issues"][0]["section"], "intro")
        self.assertEqual(result["parse_issues"][0]["issue_type"], "unclassified_line")
        self.assertEqual(
            result["parse_issues"][0]["review_category"], "informational_note"
        )
        self.assertEqual(result["parse_issues"][0]["severity"], "low")

    def test_keeps_basic_fallback_parsing_for_simple_recipe_text(self):
        result = parse_recipe_text(SIMPLE_RECIPE)

        self.assertIsNotNone(result)
        self.assertEqual(result["name"], "Weeknight Eggs")
        self.assertEqual(result["servings"], 2)
        self.assertEqual(
            result["ingredients"],
            [
                {"name": "eggs", "quantity": 2.0, "unit": ""},
                {"name": "butter", "quantity": 1.0, "unit": "tbsp"},
            ],
        )
        self.assertIn("Salt to taste", result["unparsed_lines"])
        self.assertEqual(
            result["parse_issues"],
            [
                {
                    "raw_line": "Salt to taste",
                    "line_number": 5,
                    "section": "ingredients",
                    "issue_type": "unparsed_ingredient_line",
                    "reason": "Line was treated as ingredient content but did not match ingredient parsing heuristics.",
                    "review_category": "optional_input",
                    "severity": "low",
                }
            ],
        )
        self.assertIn(
            "Cook the eggs in butter and season before serving.",
            result["instructions"],
        )

    def test_parses_chicken_shawarma_recipe(self):
        result = parse_recipe_text(CHICKEN_SHAWARMA)

        self.assertIsNotNone(result)
        self.assertEqual(result["name"], "Chicken shawarma")
        self.assertEqual(result["servings"], 4)
        self.assertGreaterEqual(len(result["ingredients"]), 5)
        self.assertEqual(
            result["ingredients"][0],
            {
                "name": "skinless chicken thigh fillets, cut into 2cm chunks",
                "quantity": 800.0,
                "unit": "g",
            },
        )
        self.assertEqual(
            result["ingredients"][2],
            {
                "name": "ground turmeric",
                "quantity": 0.25,
                "unit": "teaspoon",
            },
        )
        self.assertIn(
            "Place the chicken in a large bowl and add all the ingredients,",
            result["instructions"],
        )
        self.assertIn(
            "When the pan is hot, place the chicken on it and cook for",
            result["instructions"],
        )

    def test_parses_mussakhan_recipe(self):
        result = parse_recipe_text(MUSSAKHAN)

        self.assertIsNotNone(result)
        self.assertEqual(result["name"], "MUSSAKHAN")
        self.assertEqual(result["servings"], 4)
        self.assertGreaterEqual(len(result["ingredients"]), 14)
        self.assertIn(
            {"name": "juice of 1 lemon", "quantity": None, "unit": ""},
            result["ingredients"],
        )
        self.assertIn(
            {
                "name": "sea salt and freshly ground black pepper",
                "quantity": None,
                "unit": "",
            },
            result["ingredients"],
        )
        self.assertIn(
            {"name": "chopped parsley leaves", "quantity": None, "unit": ""},
            result["ingredients"],
        )
        self.assertIn("place the meat in a large", result["instructions"].lower())


if __name__ == "__main__":
    unittest.main()
