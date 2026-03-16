import { useEffect, useState } from "react"
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

  const sortedRecipes = [...recipes].sort((a, b) =>
    a.name.localeCompare(b.name)
  )

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

        const res = await fetch(`http://127.0.0.1:8000/recipes/${recipeId}/macros`)
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
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Meal Planner</h1>

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
                  className={`recipe-card ${selectedRecipeId === recipe.id ? "selected" : ""}`}
                  style={{
                    padding: "12px",
                    borderRadius: "6px",
                    marginBottom: "10px",
                    cursor: "pointer",
                  }}
                >
                  <strong>{recipe.name}</strong>
                  {recipe.cuisine && <div>{recipe.cuisine}</div>}
                  {recipe.servings != null && <div>{recipe.servings} servings</div>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  )
}