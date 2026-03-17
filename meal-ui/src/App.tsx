import { useEffect, useState, FormEvent } from "react"
import { Routes, Route, Link, useNavigate } from "react-router"
import RecipeDetailPanel from "./RecipeDetailPanel"

type Recipe = {
  id: number
  name: string
  cuisine?: string | null
  servings?: number | null
}

type Ingredient = {
  name: string
  quantity?: number | null
  unit?: string | null
}

type RecipeDetail = {
  id: number
  name: string
  cuisine?: string | null
  servings?: number | null
  instructions?: string | null
  source?: string | null
  ingredients?: Ingredient[]
}

type MacroSet = {
  calories: number
  protein: number
  carbs: number
  fat: number
}

type RecipeMacros = {
  recipe_id: number
  recipe_name: string
  servings: number
  recipe_totals: MacroSet
  per_serving: MacroSet
  missing_ingredients: string[]
  is_complete: boolean
}

type HomePageProps = {
  recipes: Recipe[]
  loading: boolean
  error: string | null
  selectedRecipeId: number | null
  setSelectedRecipeId: React.Dispatch<React.SetStateAction<number | null>>
  selectedRecipeDetail: RecipeDetail | null
  detailLoading: boolean
  detailError: string | null
  selectedRecipeMacros: RecipeMacros | null
  macrosLoading: boolean
  macrosError: string | null
}

type IngredientFormRow = {
  name: string
  quantity: string
  unit: string
}

function HomePage({
  recipes,
  loading,
  error,
  selectedRecipeId,
  setSelectedRecipeId,
  selectedRecipeDetail,
  detailLoading,
  detailError,
  selectedRecipeMacros,
  macrosLoading,
  macrosError,
}: HomePageProps) {
  const sortedRecipes = [...recipes].sort((a, b) =>
    a.name.localeCompare(b.name)
  )

  return (
    <div>
      <h1>Meal Planner</h1>

      <div style={{ marginBottom: "16px" }}>
        <Link to="/recipes/new">Add Recipe</Link>
      </div>

      <RecipeDetailPanel
        selectedRecipeId={selectedRecipeId}
        selectedRecipeDetail={selectedRecipeDetail}
        detailLoading={detailLoading}
        detailError={detailError}
        selectedRecipeMacros={selectedRecipeMacros}
        macrosLoading={macrosLoading}
        macrosError={macrosError}
        onClearSelection={() => setSelectedRecipeId(null)}
      />

      {loading && <p>Loading recipes...</p>}
      {error && <p>Error: {error}</p>}

      {!loading && !error && (
        <>
          <h2>Recipes ({recipes.length})</h2>

          {recipes.length === 0 ? (
            <p>No recipes found.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {sortedRecipes.map((recipe) => (
                <li
                  key={recipe.id}
                  onClick={() => setSelectedRecipeId(recipe.id)}
                  className={`recipe-card ${
                    selectedRecipeId === recipe.id ? "selected" : ""
                  }`}
                  style={{
                    padding: "12px",
                    borderRadius: "6px",
                    marginBottom: "10px",
                    cursor: "pointer",
                  }}
                >
                  <strong>{recipe.name}</strong>
                  {recipe.cuisine && <div>{recipe.cuisine}</div>}
                  {recipe.servings != null && (
                    <div>{recipe.servings} servings</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function AddRecipePage() {
  const navigate = useNavigate()

  const [name, setName] = useState("")
  const [cuisine, setCuisine] = useState("")
  const [servings, setServings] = useState("")
  const [instructions, setInstructions] = useState("")
  const [source, setSource] = useState("")
  const [ingredients, setIngredients] = useState<IngredientFormRow[]>([
    { name: "", quantity: "", unit: "" },
  ])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  

  function updateIngredient(
    index: number,
    field: keyof IngredientFormRow,
    value: string
  ) {
    setIngredients((prev) =>
      prev.map((ingredient, i) =>
        i === index ? { ...ingredient, [field]: value } : ingredient
      )
    )
  }

  function addIngredientRow() {
    setIngredients((prev) => [
      ...prev,
      { name: "", quantity: "", unit: "" },
    ])
  }

  function removeIngredientRow(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!name.trim()) {
      setError("Recipe name required")
      return
    }

    const cleanedIngredients = ingredients
      .filter((ingredient) => ingredient.name.trim() !== "")
      .map((ingredient) => ({
        name: ingredient.name.trim(),
        quantity:
          ingredient.quantity.trim() === ""
            ? 0
            : Number(ingredient.quantity),
        unit: ingredient.unit.trim(),
      }))

    if (cleanedIngredients.length === 0) {
      setError("At least one ingredient is required")
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      const payload = {
        name: name.trim(),
        cuisine: cuisine.trim(),
        servings: Number(servings),
        instructions: instructions.trim(),
        source: source.trim(),
        ingredients: cleanedIngredients,
      }

      const res = await fetch("http://127.0.0.1:8000/recipes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        console.error(data)
        throw new Error(JSON.stringify(data))
      }

      navigate("/")
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1>Add Recipe</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Name</label>
          <br />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Chicken tacos"
          />
        </div>

        <div>
          <label>Cuisine</label>
          <br />
          <input
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
            placeholder="Mexican"
          />
        </div>

        <div>
          <label>Servings</label>
          <br />
          <input
            type="number"
            min="1"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            placeholder="4"
          />
        </div>

        <div>
          <label>Source</label>
          <br />
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Cookbook / website / notes"
          />
        </div>

        <div>
          <label>Instructions</label>
          <br />
          <textarea
            rows={6}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>

        <div style={{ marginTop: "16px" }}>
          <h2>Ingredients</h2>

          {ingredients.map((ingredient, index) => (
            <div
              key={index}
              style={{
                marginBottom: "12px",
                padding: "12px",
                border: "1px solid #444",
                borderRadius: "6px",
              }}
            >
              <div>
                <label>Ingredient Name</label>
                <br />
                <input
                  value={ingredient.name}
                  onChange={(e) =>
                    updateIngredient(index, "name", e.target.value)
                  }
                  placeholder="Chicken breast"
                />
              </div>

              <div>
                <label>Quantity</label>
                <br />
                <input
                  type="number"
                  step="any"
                  value={ingredient.quantity}
                  onChange={(e) =>
                    updateIngredient(index, "quantity", e.target.value)
                  }
                  placeholder="1"
                />
              </div>

              <div>
                <label>Unit</label>
                <br />
                <input
                  value={ingredient.unit}
                  onChange={(e) =>
                    updateIngredient(index, "unit", e.target.value)
                  }
                  placeholder="lb"
                />
              </div>

              {ingredients.length > 1 && (
                <div style={{ marginTop: "8px" }}>
                  <button
                    type="button"
                    onClick={() => removeIngredientRow(index)}
                  >
                    Remove Ingredient
                  </button>
                </div>
              )}
            </div>
          ))}

          <button type="button" onClick={addIngredientRow}>
            Add Another Ingredient
          </button>
        </div>

        <div style={{ marginTop: "16px" }}>
          <button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Create Recipe"}
          </button>
        </div>

        {error && (
          <p style={{ color: "red", marginTop: "10px", whiteSpace: "pre-wrap" }}>
            {error}
          </p>
        )}
      </form>

      <div style={{ marginTop: "16px" }}>
        <Link to="/">Back to recipes</Link>
      </div>
    </div>
  )
}

export default function App() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null)

  const [selectedRecipeDetail, setSelectedRecipeDetail] =
    useState<RecipeDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [selectedRecipeMacros, setSelectedRecipeMacros] =
    useState<RecipeMacros | null>(null)
  const [macrosLoading, setMacrosLoading] = useState(false)
  const [macrosError, setMacrosError] = useState<string | null>(null)

  useEffect(() => {
    async function loadRecipes() {
      try {
        const res = await fetch("http://127.0.0.1:8000/recipes")
        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`)
        }

        const json = await res.json()
        setRecipes(json)
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    loadRecipes()
  }, [])

  useEffect(() => {
    async function loadRecipeDetail(recipeId: number) {
      try {
        setDetailLoading(true)
        setDetailError(null)

        const res = await fetch(`http://127.0.0.1:8000/recipes/${recipeId}`)
        if (!res.ok) {
          throw new Error(`Detail request failed: ${res.status}`)
        }

        const json = await res.json()
        setSelectedRecipeDetail(json)
      } catch (err) {
        console.error(err)
        setDetailError(err instanceof Error ? err.message : "Unknown error")
        setSelectedRecipeDetail(null)
      } finally {
        setDetailLoading(false)
      }
    }

    if (selectedRecipeId == null) {
      setSelectedRecipeDetail(null)
      setDetailError(null)
      return
    }

    loadRecipeDetail(selectedRecipeId)
  }, [selectedRecipeId])

  useEffect(() => {
    async function loadRecipeMacros(recipeId: number) {
      try {
        setMacrosLoading(true)
        setMacrosError(null)

        const res = await fetch(
          `http://127.0.0.1:8000/recipes/${recipeId}/macros`
        )
        if (!res.ok) {
          throw new Error(`Macros request failed: ${res.status}`)
        }

        const json = await res.json()
        setSelectedRecipeMacros(json)
      } catch (err) {
        console.error(err)
        setMacrosError(err instanceof Error ? err.message : "Unknown error")
        setSelectedRecipeMacros(null)
      } finally {
        setMacrosLoading(false)
      }
    }

    if (selectedRecipeId == null) {
      setSelectedRecipeMacros(null)
      setMacrosError(null)
      return
    }

    loadRecipeMacros(selectedRecipeId)
  }, [selectedRecipeId])

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", flex: 1 }}>
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              recipes={recipes}
              loading={loading}
              error={error}
              selectedRecipeId={selectedRecipeId}
              setSelectedRecipeId={setSelectedRecipeId}
              selectedRecipeDetail={selectedRecipeDetail}
              detailLoading={detailLoading}
              detailError={detailError}
              selectedRecipeMacros={selectedRecipeMacros}
              macrosLoading={macrosLoading}
              macrosError={macrosError}
            />
          }
        />
        <Route path="/recipes/new" element={<AddRecipePage />} />
      </Routes>
    </main>
  )
}