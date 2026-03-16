import { useEffect, useState } from "react"

type Recipe = {
  id: number
  name: string
  cuisine?: string | null
  servings?: number | null
}

export default function App() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Meal Planner</h1>

      {loading && <p>Loading recipes...</p>}
      {error && <p>Error: {error}</p>}

      {!loading && !error && (
        <>
          <h2>Recipes ({recipes.length})</h2>

          {recipes.length === 0 ? (
            <p>No recipes found.</p>
          ) : (
            <ul>
              {recipes.map((recipe) => (
                <div
                  key={recipe.id}
                  style={{
                    border: "1px solid #ccc",
                    padding: "12px",
                    borderRadius: "6px",
                    marginBottom: "10px",
                  }}
                >
                  <strong>{recipe.name}</strong>
                  <div>{recipe.cuisine}</div>
                  <div>{recipe.servings} servings</div>
                </div>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  )
}