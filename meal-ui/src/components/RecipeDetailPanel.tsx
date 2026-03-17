type Ingredient = {
  name: string
  quantity?: number | null
  unit?: string | null
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

type RecipeDetail = {
  id: number
  name: string
  cuisine?: string | null
  servings?: number | null
  instructions?: string | null
  source?: string | null
  ingredients?: Ingredient[]
}

type RecipeDetailPanelProps = {
  selectedRecipeId: number | null
  selectedRecipeDetail: RecipeDetail | null
  detailLoading: boolean
  detailError: string | null
  selectedRecipeMacros: RecipeMacros | null
  macrosLoading: boolean
  macrosError: string | null
  onClearSelection: () => void
}

export default function RecipeDetailPanel({
  selectedRecipeId,
  selectedRecipeDetail,
  detailLoading,
  detailError,
  selectedRecipeMacros,
  macrosLoading,
  macrosError,
  onClearSelection,
}: RecipeDetailPanelProps) {
  if (selectedRecipeId == null) {
    return null
  }

  return (
    <section
      style={{
        border: "1px solid #666",
        borderRadius: "8px",
        padding: "20px",
        marginBottom: "20px",
        textAlign: "left",
        maxWidth: "700px",
        marginLeft: "auto",
        marginRight: "auto",
      }}
    >
      {detailLoading && <p>Loading recipe details...</p>}
      {detailError && <p>Error loading details: {detailError}</p>}

      {!detailLoading && !detailError && selectedRecipeDetail && (
        <>
          <h2 style={{ marginTop: 0 }}>{selectedRecipeDetail.name}</h2>

          {selectedRecipeDetail.cuisine && (
            <div>Cuisine: {selectedRecipeDetail.cuisine}</div>
          )}

          {selectedRecipeDetail.servings != null && (
            <div>Servings: {selectedRecipeDetail.servings}</div>
          )}

          {selectedRecipeDetail.source && (
            <div>Source: {selectedRecipeDetail.source}</div>
          )}

          <div style={{ marginTop: "16px" }}>
            <strong>Macros (per serving)</strong>

            {macrosLoading && <p>Loading macros...</p>}
            {macrosError && <p>Error loading macros: {macrosError}</p>}

            {!macrosLoading && !macrosError && selectedRecipeMacros && (
                <>
                <div
                    style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(120px, 1fr))",
                    gap: "10px",
                    marginTop: "8px",
                    }}
                >
                    <div
                    style={{
                        border: "1px solid #666",
                        borderRadius: "6px",
                        padding: "10px",
                    }}
                    >
                    <div style={{ fontSize: "0.9rem", opacity: 0.8 }}>Calories</div>
                    <div style={{ fontWeight: "bold" }}>
                        {selectedRecipeMacros.per_serving.calories.toFixed(0)}
                    </div>
                    </div>

                    <div
                    style={{
                        border: "1px solid #666",
                        borderRadius: "6px",
                        padding: "10px",
                    }}
                    >
                    <div style={{ fontSize: "0.9rem", opacity: 0.8 }}>Protein</div>
                    <div style={{ fontWeight: "bold" }}>
                        {selectedRecipeMacros.per_serving.protein.toFixed(1)} g
                    </div>
                    </div>

                    <div
                    style={{
                        border: "1px solid #666",
                        borderRadius: "6px",
                        padding: "10px",
                    }}
                    >
                    <div style={{ fontSize: "0.9rem", opacity: 0.8 }}>Carbs</div>
                    <div style={{ fontWeight: "bold" }}>
                        {selectedRecipeMacros.per_serving.carbs.toFixed(1)} g
                    </div>
                    </div>

                    <div
                    style={{
                        border: "1px solid #666",
                        borderRadius: "6px",
                        padding: "10px",
                    }}
                    >
                    <div style={{ fontSize: "0.9rem", opacity: 0.8 }}>Fat</div>
                    <div style={{ fontWeight: "bold" }}>
                        {selectedRecipeMacros.per_serving.fat.toFixed(1)} g
                    </div>
                    </div>
                </div>

                <div style={{ marginTop: "8px", fontSize: "0.9rem", opacity: 0.8 }}>
                    {selectedRecipeMacros.is_complete
                    ? "Macro calculation complete"
                    : "Some ingredients are missing macro data"}
                </div>

                {selectedRecipeMacros.missing_ingredients.length > 0 && (
                    <div style={{ marginTop: "8px" }}>
                    <strong>Missing macro data for:</strong>
                    <ul style={{ marginTop: "6px", paddingLeft: "20px" }}>
                        {selectedRecipeMacros.missing_ingredients.map((ingredientName) => (
                        <li key={ingredientName}>{ingredientName}</li>
                        ))}
                    </ul>
                    </div>
                )}
                </>
            )}
            </div>

          {selectedRecipeDetail.ingredients &&
            selectedRecipeDetail.ingredients.length > 0 && (
              <div style={{ marginTop: "12px" }}>
                <strong>Ingredients</strong>
                <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
                  {selectedRecipeDetail.ingredients.map((ingredient, index) => (
                    <li key={index}>
                      {ingredient.quantity != null ? `${ingredient.quantity} ` : ""}
                      {ingredient.unit ? `${ingredient.unit} ` : ""}
                      {ingredient.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {selectedRecipeDetail.instructions && (
            <div style={{ marginTop: "12px" }}>
              <strong>Instructions</strong>
              <p>{selectedRecipeDetail.instructions}</p>
            </div>
          )}

          <button onClick={onClearSelection} style={{ marginTop: "12px" }}>
            Clear selection
          </button>
        </>
      )}
    </section>
  )
}