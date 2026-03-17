import { useEffect, useState } from "react"
import { Routes, Route } from "react-router"
import HomePage from "./pages/HomePage"
import AddRecipePage from "./pages/AddRecipePage"
import type { Recipe, RecipeDetail, RecipeMacros } from "./types"
import { fetchRecipes, fetchRecipeDetail, fetchRecipeMacros } from "./api/recipes"

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
        const json = await fetchRecipes()
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

        const json = await fetchRecipeDetail(recipeId)
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

      const json = await fetchRecipeMacros(recipeId)
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