import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { ApiError, updateRecipe } from "../api/recipes"
import type {
  IngredientFormRow,
  RecipeDetail,
  RecipeDetailPanelProps,
  ReviewFlag,
  UpdateRecipePayload,
} from "../api/types"

let ingredientRowId = 0

function nextIngredientRowId() {
  ingredientRowId += 1
  return `detail-ingredient-row-${ingredientRowId}`
}

function createBlankIngredientRow(): IngredientFormRow {
  return {
    clientId: nextIngredientRowId(),
    name: "",
    ingredientId: null,
    quantity: "",
    unit: "",
    correctionStatus: "auto_matched",
    overrideCaloriesPerUnit: "",
    overrideProteinPerUnit: "",
    overrideCarbsPerUnit: "",
    overrideFatPerUnit: "",
    reviewFlags: [],
    needsReview: false,
    showMacros: false,
    matchedIngredient: null,
    candidateIngredients: [],
    searchTerm: "",
    searchResults: [],
    isSearching: false,
    isCreatingIngredient: false,
  }
}

function getRecipeErrorMessage(err: unknown): string {
  if (err instanceof ApiError && typeof err.detail === "string" && err.detail.trim()) {
    return `Error: ${err.detail}`
  }

  return err instanceof Error ? err.message : "Unknown error occurred"
}

function buildIngredientRow(ingredient: NonNullable<RecipeDetail["ingredients"]>[number]): IngredientFormRow {
  return {
    clientId: nextIngredientRowId(),
    name: ingredient.name ?? "",
    ingredientId: ingredient.ingredient_id ?? ingredient.id ?? null,
    quantity:
      ingredient.quantity == null || Number.isNaN(ingredient.quantity)
        ? ""
        : String(ingredient.quantity),
    unit: ingredient.unit ?? "",
    correctionStatus: ingredient.correction_status ?? "auto_matched",
    overrideCaloriesPerUnit:
      ingredient.override_calories_per_unit == null
        ? ""
        : String(
            ingredient.override_calories_per_unit * (ingredient.quantity ?? 0)
          ),
    overrideProteinPerUnit:
      ingredient.override_protein_per_unit == null
        ? ""
        : String(
            ingredient.override_protein_per_unit * (ingredient.quantity ?? 0)
          ),
    overrideCarbsPerUnit:
      ingredient.override_carbs_per_unit == null
        ? ""
        : String(ingredient.override_carbs_per_unit * (ingredient.quantity ?? 0)),
    overrideFatPerUnit:
      ingredient.override_fat_per_unit == null
        ? ""
        : String(ingredient.override_fat_per_unit * (ingredient.quantity ?? 0)),
    reviewFlags: [],
    needsReview: false,
    showMacros:
      ingredient.override_calories_per_unit != null ||
      ingredient.override_protein_per_unit != null ||
      ingredient.override_carbs_per_unit != null ||
      ingredient.override_fat_per_unit != null,
    matchedIngredient: null,
    candidateIngredients: [],
    searchTerm: ingredient.name ?? "",
    searchResults: [],
    isSearching: false,
    isCreatingIngredient: false,
  }
}

function getMacroOverrideValues(row: IngredientFormRow) {
  return [
    row.overrideCaloriesPerUnit.trim(),
    row.overrideProteinPerUnit.trim(),
    row.overrideCarbsPerUnit.trim(),
    row.overrideFatPerUnit.trim(),
  ]
}

function hasAnyMacroOverride(row: IngredientFormRow) {
  return getMacroOverrideValues(row).some((value) => value !== "")
}

function hasCompleteMacroOverride(row: IngredientFormRow) {
  return getMacroOverrideValues(row).every((value) => value !== "")
}

function getRowFlags(row: IngredientFormRow): ReviewFlag[] {
  const flags = new Set<ReviewFlag>()

  if (!row.quantity.trim()) {
    flags.add("missing_quantity")
  }
  if (!row.unit.trim()) {
    flags.add("missing_unit")
  }
  if (hasAnyMacroOverride(row) && !hasCompleteMacroOverride(row)) {
    flags.add("partial_macro_override")
  }

  return Array.from(flags)
}

function formatReviewFlag(flag: ReviewFlag) {
  switch (flag) {
    case "missing_quantity":
      return "Missing quantity"
    case "missing_unit":
      return "Missing unit"
    case "partial_macro_override":
      return "Complete all macro override fields"
    default:
      return flag
  }
}

function toOptionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)
  return Number.isNaN(parsed) ? null : parsed
}

function getIngredientQuantity(row: IngredientFormRow): number | null {
  const quantity = toOptionalNumber(row.quantity)
  if (quantity == null || quantity <= 0) {
    return null
  }
  return quantity
}

function resolveCorrectionStatus(row: IngredientFormRow): string {
  const flags = getRowFlags(row)

  if (hasCompleteMacroOverride(row)) {
    return "user_overridden"
  }
  if (row.correctionStatus && row.correctionStatus !== "needs_review") {
    return row.correctionStatus
  }
  if (flags.length > 0) {
    return "unresolved"
  }
  return "user_confirmed"
}

function buildMacroOverridePayload(row: IngredientFormRow) {
  if (!hasCompleteMacroOverride(row)) {
    return {
      override_calories_per_unit: null,
      override_protein_per_unit: null,
      override_carbs_per_unit: null,
      override_fat_per_unit: null,
    }
  }

  const quantity = getIngredientQuantity(row)
  if (quantity == null) {
    return null
  }

  return {
    override_calories_per_unit:
      Number(row.overrideCaloriesPerUnit.trim()) / quantity,
    override_protein_per_unit:
      Number(row.overrideProteinPerUnit.trim()) / quantity,
    override_carbs_per_unit: Number(row.overrideCarbsPerUnit.trim()) / quantity,
    override_fat_per_unit: Number(row.overrideFatPerUnit.trim()) / quantity,
  }
}

function buildPayload(detail: RecipeDetail, ingredients: IngredientFormRow[]): UpdateRecipePayload {
  const nonEmptyIngredients = ingredients.filter((ingredient) => ingredient.name.trim() !== "")

  return {
    name: detail.name.trim(),
    servings: Number(detail.servings),
    instructions: detail.instructions?.trim() ?? "",
    source: detail.source?.trim() ?? "",
    ingredients: nonEmptyIngredients.map((ingredient) => {
      const macroOverridePayload = buildMacroOverridePayload(ingredient)

      if (macroOverridePayload == null) {
        throw new Error(
          "Enter a quantity greater than 0 before adding full-ingredient macro overrides."
        )
      }

      return {
        name: ingredient.name.trim(),
        ingredient_id: ingredient.ingredientId,
        quantity: toOptionalNumber(ingredient.quantity),
        unit: ingredient.unit.trim() || null,
        correction_status: resolveCorrectionStatus(ingredient),
        ...macroOverridePayload,
      }
    }),
  }
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
  onRecipeUpdated,
  onRecalculateMacros,
}: RecipeDetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<RecipeDetail | null>(null)
  const [ingredients, setIngredients] = useState<IngredientFormRow[]>([])
  const [saving, setSaving] = useState(false)
  const [refreshingMacros, setRefreshingMacros] = useState(false)
  const [editorError, setEditorError] = useState<string | null>(null)

  function resetEditorState(detail: RecipeDetail) {
    setDraft(detail)
    setIngredients(
      detail.ingredients?.length
        ? detail.ingredients.map(buildIngredientRow)
        : [createBlankIngredientRow()]
    )
  }

  useEffect(() => {
    if (!selectedRecipeDetail) {
      setDraft(null)
      setIngredients([])
      setIsEditing(false)
      setEditorError(null)
      return
    }

    resetEditorState(selectedRecipeDetail)
    setIsEditing(false)
    setEditorError(null)
  }, [selectedRecipeDetail])

  if (selectedRecipeId == null) {
    return null
  }

  function updateDraftField(field: keyof RecipeDetail, value: string) {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  function updateIngredient(
    clientId: string,
    field: keyof IngredientFormRow,
    value: string | boolean
  ) {
    setIngredients((prev) =>
      prev.map((ingredient) =>
        ingredient.clientId === clientId
          ? { ...ingredient, [field]: value }
          : ingredient
      )
    )
  }

  function addIngredientRow() {
    setIngredients((prev) => [...prev, createBlankIngredientRow()])
  }

  function removeIngredientRow(clientId: string) {
    setIngredients((prev) => prev.filter((ingredient) => ingredient.clientId !== clientId))
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!selectedRecipeId || !draft) {
      return
    }

    if (!draft.name?.trim()) {
      setEditorError("Recipe name required")
      return
    }

    if (!draft.servings || Number(draft.servings) <= 0) {
      setEditorError("Servings must be greater than 0")
      return
    }

    if (!draft.instructions?.trim()) {
      setEditorError("Instructions required")
      return
    }

    const nonEmptyIngredients = ingredients.filter((ingredient) => ingredient.name.trim() !== "")

    if (nonEmptyIngredients.length === 0) {
      setEditorError("At least one ingredient is required")
      return
    }

    if (
      nonEmptyIngredients.some(
        (ingredient) =>
          hasAnyMacroOverride(ingredient) && !hasCompleteMacroOverride(ingredient)
      )
    ) {
      setEditorError("Complete all four macro override fields for any ingredient you override.")
      return
    }

    if (
      nonEmptyIngredients.some(
        (ingredient) =>
          hasAnyMacroOverride(ingredient) && getIngredientQuantity(ingredient) == null
      )
    ) {
      setEditorError(
        "Enter a quantity greater than 0 before adding full-ingredient macro overrides."
      )
      return
    }

    try {
      setSaving(true)
      setEditorError(null)
      await updateRecipe(selectedRecipeId, buildPayload(draft, ingredients))
      await onRecipeUpdated(selectedRecipeId)
      setIsEditing(false)
    } catch (err) {
      console.error(err)
      setEditorError(getRecipeErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleRecalculateMacros() {
    if (!selectedRecipeId) {
      return
    }

    try {
      setRefreshingMacros(true)
      setEditorError(null)
      await onRecalculateMacros(selectedRecipeId)
    } catch (err) {
      console.error(err)
      setEditorError(getRecipeErrorMessage(err))
    } finally {
      setRefreshingMacros(false)
    }
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

      {!detailLoading && !detailError && selectedRecipeDetail && draft && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ marginTop: 0, marginBottom: "4px" }}>{selectedRecipeDetail.name}</h2>
              {selectedRecipeDetail.cuisine && <div>Cuisine: {selectedRecipeDetail.cuisine}</div>}
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button type="button" onClick={handleRecalculateMacros} disabled={refreshingMacros}>
                {refreshingMacros ? "Recalculating..." : "Recalculate macros"}
              </button>
              <button type="button" onClick={() => setIsEditing((prev) => !prev)}>
                {isEditing ? "Cancel edit" : "Edit recipe"}
              </button>
              <button onClick={onClearSelection}>Clear selection</button>
            </div>
          </div>

          {selectedRecipeDetail.source && <div style={{ marginTop: "8px" }}>Source: {selectedRecipeDetail.source}</div>}
          {selectedRecipeDetail.servings != null && <div>Servings: {selectedRecipeDetail.servings}</div>}

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
                  <div style={{ border: "1px solid #666", borderRadius: "6px", padding: "10px" }}>
                    <div style={{ fontSize: "0.9rem", opacity: 0.8 }}>Calories</div>
                    <div style={{ fontWeight: "bold" }}>
                      {selectedRecipeMacros.per_serving.calories.toFixed(0)}
                    </div>
                  </div>

                  <div style={{ border: "1px solid #666", borderRadius: "6px", padding: "10px" }}>
                    <div style={{ fontSize: "0.9rem", opacity: 0.8 }}>Protein</div>
                    <div style={{ fontWeight: "bold" }}>
                      {selectedRecipeMacros.per_serving.protein.toFixed(1)} g
                    </div>
                  </div>

                  <div style={{ border: "1px solid #666", borderRadius: "6px", padding: "10px" }}>
                    <div style={{ fontSize: "0.9rem", opacity: 0.8 }}>Carbs</div>
                    <div style={{ fontWeight: "bold" }}>
                      {selectedRecipeMacros.per_serving.carbs.toFixed(1)} g
                    </div>
                  </div>

                  <div style={{ border: "1px solid #666", borderRadius: "6px", padding: "10px" }}>
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

          {isEditing ? (
            <form onSubmit={handleSave} style={{ marginTop: "20px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(180px, 1fr))",
                  gap: "12px",
                }}
              >
                <label>
                  <div>Name</div>
                  <input
                    value={draft.name}
                    onChange={(e) => updateDraftField("name", e.target.value)}
                    style={{ width: "100%" }}
                  />
                </label>
                <label>
                  <div>Servings</div>
                  <input
                    type="number"
                    min="1"
                    value={draft.servings ?? ""}
                    onChange={(e) => updateDraftField("servings", e.target.value)}
                    style={{ width: "100%" }}
                  />
                </label>
              </div>

              <label style={{ display: "block", marginTop: "12px" }}>
                <div>Source</div>
                <input
                  value={draft.source ?? ""}
                  onChange={(e) => updateDraftField("source", e.target.value)}
                  style={{ width: "100%" }}
                />
              </label>

              <label style={{ display: "block", marginTop: "12px" }}>
                <div>Instructions</div>
                <textarea
                  rows={6}
                  value={draft.instructions ?? ""}
                  onChange={(e) => updateDraftField("instructions", e.target.value)}
                  style={{ width: "100%" }}
                />
              </label>

              <div
                style={{
                  marginTop: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <strong>Ingredients</strong>
                <button type="button" onClick={addIngredientRow}>
                  Add row
                </button>
              </div>

              <div style={{ display: "grid", gap: "12px", marginTop: "12px" }}>
                {ingredients.map((ingredient) => {
                  const rowFlags = getRowFlags(ingredient)

                  return (
                    <article
                      key={ingredient.clientId}
                      style={{
                        border: "1px solid #666",
                        borderRadius: "6px",
                        padding: "12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "12px",
                          flexWrap: "wrap",
                          alignItems: "flex-start",
                        }}
                      >
                        <div>
                          <strong>{ingredient.name.trim() || "New ingredient"}</strong>
                          {rowFlags.length > 0 && (
                            <div style={{ marginTop: "6px", fontSize: "0.9rem" }}>
                              {rowFlags.map((flag) => (
                                <div key={flag}>{formatReviewFlag(flag)}</div>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeIngredientRow(ingredient.clientId)}
                          disabled={ingredients.length === 1}
                        >
                          Remove
                        </button>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4, minmax(120px, 1fr))",
                          gap: "12px",
                          marginTop: "12px",
                        }}
                      >
                        <label>
                          <div>Name</div>
                          <input
                            value={ingredient.name}
                            onChange={(e) =>
                              updateIngredient(ingredient.clientId, "name", e.target.value)
                            }
                            style={{ width: "100%" }}
                          />
                        </label>
                        <label>
                          <div>Quantity</div>
                          <input
                            type="number"
                            step="any"
                            value={ingredient.quantity}
                            onChange={(e) =>
                              updateIngredient(ingredient.clientId, "quantity", e.target.value)
                            }
                            style={{ width: "100%" }}
                          />
                        </label>
                        <label>
                          <div>Unit</div>
                          <input
                            value={ingredient.unit}
                            onChange={(e) =>
                              updateIngredient(ingredient.clientId, "unit", e.target.value)
                            }
                            style={{ width: "100%" }}
                          />
                        </label>
                        <label>
                          <div>Status</div>
                          <select
                            value={ingredient.correctionStatus}
                            onChange={(e) =>
                              updateIngredient(
                                ingredient.clientId,
                                "correctionStatus",
                                e.target.value
                              )
                            }
                            style={{ width: "100%" }}
                          >
                            <option value="needs_review">Needs review</option>
                            <option value="auto_matched">Auto matched</option>
                            <option value="user_confirmed">User confirmed</option>
                            <option value="user_overridden">User overridden</option>
                            <option value="unresolved">Unresolved</option>
                          </select>
                        </label>
                      </div>

                      <div style={{ marginTop: "12px" }}>
                        <button
                          type="button"
                          onClick={() =>
                            updateIngredient(
                              ingredient.clientId,
                              "showMacros",
                              !ingredient.showMacros
                            )
                          }
                        >
                          {ingredient.showMacros ? "Hide macro overrides" : "Edit macro overrides"}
                        </button>
                      </div>

                      {ingredient.showMacros && (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(4, minmax(120px, 1fr))",
                            gap: "12px",
                            marginTop: "12px",
                          }}
                        >
                          <label>
                            <div>Calories</div>
                            <input
                              type="number"
                              step="any"
                              value={ingredient.overrideCaloriesPerUnit}
                              onChange={(e) =>
                                updateIngredient(
                                  ingredient.clientId,
                                  "overrideCaloriesPerUnit",
                                  e.target.value
                                )
                              }
                              style={{ width: "100%" }}
                            />
                          </label>
                          <label>
                            <div>Protein</div>
                            <input
                              type="number"
                              step="any"
                              value={ingredient.overrideProteinPerUnit}
                              onChange={(e) =>
                                updateIngredient(
                                  ingredient.clientId,
                                  "overrideProteinPerUnit",
                                  e.target.value
                                )
                              }
                              style={{ width: "100%" }}
                            />
                          </label>
                          <label>
                            <div>Carbs</div>
                            <input
                              type="number"
                              step="any"
                              value={ingredient.overrideCarbsPerUnit}
                              onChange={(e) =>
                                updateIngredient(
                                  ingredient.clientId,
                                  "overrideCarbsPerUnit",
                                  e.target.value
                                )
                              }
                              style={{ width: "100%" }}
                            />
                          </label>
                          <label>
                            <div>Fat</div>
                            <input
                              type="number"
                              step="any"
                              value={ingredient.overrideFatPerUnit}
                              onChange={(e) =>
                                updateIngredient(
                                  ingredient.clientId,
                                  "overrideFatPerUnit",
                                  e.target.value
                                )
                              }
                              style={{ width: "100%" }}
                            />
                          </label>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>

              <div style={{ display: "flex", gap: "8px", marginTop: "16px", flexWrap: "wrap" }}>
                <button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedRecipeDetail) {
                      resetEditorState(selectedRecipeDetail)
                    }
                    setEditorError(null)
                    setIsEditing(false)
                  }}
                >
                  Cancel
                </button>
              </div>

              {editorError && <p style={{ color: "#b42318" }}>{editorError}</p>}
            </form>
          ) : (
            <>
              {selectedRecipeDetail.ingredients && selectedRecipeDetail.ingredients.length > 0 && (
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

              {editorError && <p style={{ color: "#b42318" }}>{editorError}</p>}
            </>
          )}
        </>
      )}
    </section>
  )
}
