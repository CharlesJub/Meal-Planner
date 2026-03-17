import { Link } from "react-router"
import RecipeDetailPanel from "../components/RecipeDetailPanel"
import type { HomePageProps } from "../types"

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

export default HomePage
