import { useEffect, useState } from "react"
import { Routes, Route } from "react-router"
import HomePage from "./pages/HomePage"
import AddRecipePage from "./pages/AddRecipePage"
import type { Recipe, RecipeDetail, RecipeMacros } from "./api/types"
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
    if (selectedRecipeId == null) {
      setSelectedRecipeDetail(null)
      setDetailError(null)
      setDetailLoading(false)
      setSelectedRecipeMacros(null)
      setMacrosError(null)
      setMacrosLoading(false)
      return
    }

    let cancelled = false

    async function loadSelectedRecipe(recipeId: number) {
      setDetailLoading(true)
      setMacrosLoading(true)
      setDetailError(null)
      setMacrosError(null)

      const [detailResult, macrosResult] = await Promise.allSettled([
        fetchRecipeDetail(recipeId),
        fetchRecipeMacros(recipeId),
      ])

      if (cancelled) {
        return
      }

      if (detailResult.status === "fulfilled") {
        setSelectedRecipeDetail(detailResult.value)
      } else {
        console.error(detailResult.reason)
        setSelectedRecipeDetail(null)
        setDetailError(
          detailResult.reason instanceof Error
            ? detailResult.reason.message
            : "Unknown error"
        )
      }

      if (macrosResult.status === "fulfilled") {
        setSelectedRecipeMacros(macrosResult.value)
      } else {
        console.error(macrosResult.reason)
        setSelectedRecipeMacros(null)
        setMacrosError(
          macrosResult.reason instanceof Error
            ? macrosResult.reason.message
            : "Unknown error"
        )
      }

      setDetailLoading(false)
      setMacrosLoading(false)
    }

    loadSelectedRecipe(selectedRecipeId)

    return () => {
      cancelled = true
    }
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
