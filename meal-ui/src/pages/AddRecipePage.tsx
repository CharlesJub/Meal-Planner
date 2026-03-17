import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate } from "react-router"
import type {
  CreateRecipePayload,
  IngredientFormRow,
  ParsedRecipe,
  ReviewFlag,
} from "../api/types"
import { ApiError, createRecipe, parseRecipeText } from "../api/recipes"
import { getCuisines, type Cuisine } from "../api/cuisines"

type AddRecipePageProps = {
  onRecipeCreated: (recipeId: number) => void
}

type ValidationDetail = {
  type?: string
  loc?: Array<string | number>
}

let ingredientRowId = 0

function nextIngredientRowId() {
  ingredientRowId += 1
  return `ingredient-row-${ingredientRowId}`
}

function getRecipeErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (Array.isArray(err.detail)) {
      const missingFields = err.detail
        .filter(
          (detail): detail is ValidationDetail =>
            typeof detail === "object" && detail !== null
        )
        .filter((detail) => detail.type === "missing" && Array.isArray(detail.loc))
        .map((detail) => String(detail.loc?.[detail.loc.length - 1]))

      if (missingFields.includes("cuisine")) {
        return "Please select a cuisine for your recipe."
      }

      if (missingFields.length > 0) {
        return `Missing required fields: ${missingFields.join(", ")}`
      }
    }

    if (typeof err.detail === "string" && err.detail.trim()) {
      return `Error: ${err.detail}`
    }

    return err.message
  }

  return err instanceof Error ? err.message : "Unknown error occurred"
}

function formatReviewFlag(flag: ReviewFlag) {
  switch (flag) {
    case "missing_quantity":
      return "Missing quantity"
    case "missing_unit":
      return "Missing unit"
    case "missing_macro_source":
      return "No macro source"
    case "missing_macro_data":
      return "Macro data incomplete"
    case "partial_macro_override":
      return "Complete all macro override fields"
    default:
      return flag
  }
}

function createBlankIngredientRow(name = ""): IngredientFormRow {
  return {
    clientId: nextIngredientRowId(),
    name,
    quantity: "",
    unit: "",
    correctionStatus: name.trim() ? "needs_review" : "auto_matched",
    overrideCaloriesPerUnit: "",
    overrideProteinPerUnit: "",
    overrideCarbsPerUnit: "",
    overrideFatPerUnit: "",
    reviewFlags: name.trim() ? ["missing_quantity", "missing_unit"] : [],
    needsReview: name.trim().length > 0,
    showMacros: false,
  }
}

function buildIngredientRow(
  ingredient: ParsedRecipe["ingredients"][number],
  review:
    | ParsedRecipe["review"]["ingredient_reviews"][number]
    | undefined
): IngredientFormRow {
  return {
    clientId: nextIngredientRowId(),
    name: ingredient.name ?? "",
    quantity:
      ingredient.quantity == null || Number.isNaN(ingredient.quantity)
        ? ""
        : String(ingredient.quantity),
    unit: ingredient.unit ?? "",
    correctionStatus: review?.suggested_status ?? "auto_matched",
    overrideCaloriesPerUnit: "",
    overrideProteinPerUnit: "",
    overrideCarbsPerUnit: "",
    overrideFatPerUnit: "",
    reviewFlags: review?.flags ?? [],
    needsReview: review?.needs_review ?? false,
    showMacros: false,
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
  const flags = new Set<ReviewFlag>(
    row.reviewFlags.filter(
      (flag) => flag !== "missing_quantity" && flag !== "missing_unit"
    )
  )

  if (!row.quantity.trim()) {
    flags.add("missing_quantity")
  }
  if (!row.unit.trim()) {
    flags.add("missing_unit")
  }

  if (hasAnyMacroOverride(row) && !hasCompleteMacroOverride(row)) {
    flags.add("partial_macro_override")
  } else {
    flags.delete("partial_macro_override")
    if (hasCompleteMacroOverride(row)) {
      flags.delete("missing_macro_source")
      flags.delete("missing_macro_data")
    }
  }

  return Array.from(flags)
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

function AddRecipePage({ onRecipeCreated }: AddRecipePageProps) {
  const navigate = useNavigate()

  const [recipeText, setRecipeText] = useState("")
  const [name, setName] = useState("")
  const [selectedCuisineId, setSelectedCuisineId] = useState("")
  const [servings, setServings] = useState("")
  const [instructions, setInstructions] = useState("")
  const [source, setSource] = useState("")
  const [ingredients, setIngredients] = useState<IngredientFormRow[]>([
    createBlankIngredientRow(),
  ])
  const [unparsedLines, setUnparsedLines] = useState<string[]>([])
  const [reviewSummary, setReviewSummary] =
    useState<ParsedRecipe["review"]["summary"] | null>(null)
  const [needsHumanReview, setNeedsHumanReview] = useState(false)
  const [hasParsedDraft, setHasParsedDraft] = useState(false)
  const [cuisines, setCuisines] = useState<Cuisine[]>([])
  const [cuisineError, setCuisineError] = useState<string | null>(null)
  const [parseMessage, setParseMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function loadCuisines() {
      try {
        setCuisineError(null)
        const data = await getCuisines()
        setCuisines(data)
      } catch (err) {
        console.error(err)
        setCuisineError(
          err instanceof Error ? err.message : "Failed to load cuisines"
        )
      }
    }

    loadCuisines()
  }, [])

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

  function addIngredientRow(name = "") {
    setIngredients((prev) => [...prev, createBlankIngredientRow(name)])
  }

  function removeIngredientRow(clientId: string) {
    setIngredients((prev) => prev.filter((ingredient) => ingredient.clientId !== clientId))
  }

  function buildParseMessage(parsedRecipe: ParsedRecipe) {
    const ingredientCount = parsedRecipe.ingredients.length
    const reviewCount =
      parsedRecipe.review.summary.ingredients_needing_review +
      parsedRecipe.review.summary.unparsed_line_count

    const messages = [
      `Parsed ${ingredientCount} ingredient${ingredientCount === 1 ? "" : "s"}.`,
    ]

    if (reviewCount > 0) {
      messages.push(
        `${reviewCount} item${reviewCount === 1 ? "" : "s"} still need attention.`
      )
    } else {
      messages.push("This draft looks ready to save.")
    }

    return messages.join(" ")
  }

  async function handleParseRecipe() {
    if (!recipeText.trim()) {
      setError("Paste a recipe before parsing")
      return
    }

    try {
      setParsing(true)
      setError(null)
      setParseMessage(null)

      const parsedRecipe = await parseRecipeText(recipeText)

      setName(parsedRecipe.name ?? "")
      setServings(
        parsedRecipe.servings != null ? String(parsedRecipe.servings) : ""
      )
      setInstructions(parsedRecipe.instructions ?? "")
      setIngredients(
        parsedRecipe.ingredients.length > 0
          ? parsedRecipe.ingredients.map((ingredient, index) =>
              buildIngredientRow(
                ingredient,
                parsedRecipe.review.ingredient_reviews[index]
              )
            )
          : [createBlankIngredientRow()]
      )
      setUnparsedLines(parsedRecipe.review.unparsed_lines)
      setReviewSummary(parsedRecipe.review.summary)
      setNeedsHumanReview(parsedRecipe.review.needs_human_review)
      setParseMessage(buildParseMessage(parsedRecipe))
      setHasParsedDraft(true)
    } catch (err) {
      console.error("Recipe parse error:", err)
      setError(getRecipeErrorMessage(err))
    } finally {
      setParsing(false)
    }
  }

  function handleConvertUnparsedLine(line: string) {
    addIngredientRow(line)
    setUnparsedLines((prev) => prev.filter((candidate) => candidate !== line))
  }

  function handleIgnoreUnparsedLine(line: string) {
    setUnparsedLines((prev) => prev.filter((candidate) => candidate !== line))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!name.trim()) {
      setError("Recipe name required")
      return
    }

    if (!selectedCuisineId) {
      setError("Please select a cuisine for your recipe.")
      return
    }

    if (!servings.trim() || Number(servings) <= 0) {
      setError("Servings must be greater than 0")
      return
    }

    if (!instructions.trim()) {
      setError("Instructions required")
      return
    }

    const nonEmptyIngredients = ingredients.filter(
      (ingredient) => ingredient.name.trim() !== ""
    )

    if (nonEmptyIngredients.length === 0) {
      setError("At least one ingredient is required")
      return
    }

    if (
      nonEmptyIngredients.some(
        (ingredient) =>
          hasAnyMacroOverride(ingredient) && !hasCompleteMacroOverride(ingredient)
      )
    ) {
      setError("Complete all four macro override fields for any ingredient you override.")
      return
    }

    if (
      nonEmptyIngredients.some(
        (ingredient) =>
          hasAnyMacroOverride(ingredient) && getIngredientQuantity(ingredient) == null
      )
    ) {
      setError(
        "Enter a quantity greater than 0 before adding full-ingredient macro overrides."
      )
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      const selectedCuisine = cuisines.find(
        (cuisine) => cuisine.id === Number(selectedCuisineId)
      )

      const payload: CreateRecipePayload = {
        name: name.trim(),
        cuisine: selectedCuisine ? selectedCuisine.name : "",
        servings: Number(servings),
        instructions: instructions.trim(),
        source: source.trim(),
        ingredients: nonEmptyIngredients.map((ingredient) => {
          const macroOverridePayload = buildMacroOverridePayload(ingredient)

          if (macroOverridePayload == null) {
            throw new Error(
              "Enter a quantity greater than 0 before adding full-ingredient macro overrides."
            )
          }

          return {
            name: ingredient.name.trim(),
            quantity: toOptionalNumber(ingredient.quantity),
            unit: ingredient.unit.trim() || null,
            correction_status: resolveCorrectionStatus(ingredient),
            ...macroOverridePayload,
          }
        }),
      }

      const createdRecipe = await createRecipe(payload)
      onRecipeCreated(createdRecipe.recipe_id)
      navigate("/")
    } catch (err) {
      console.error("Recipe creation error:", err)
      setError(getRecipeErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const displayIngredients = [...ingredients].sort((a, b) => {
    const aNeedsReview = getRowFlags(a).length > 0
    const bNeedsReview = getRowFlags(b).length > 0

    if (aNeedsReview === bNeedsReview) {
      return 0
    }

    return aNeedsReview ? -1 : 1
  })

  const ingredientsNeedingReview = displayIngredients.filter(
    (ingredient) => getRowFlags(ingredient).length > 0
  ).length
  const unresolvedItemsCount = ingredientsNeedingReview + unparsedLines.length

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">Recipe Intake</p>
          <h1>Review a parsed recipe before saving</h1>
          <p className="page-copy">
            Paste the recipe, review only the rows that need help, then save the
            draft with any unresolved items clearly marked.
          </p>
        </div>
        <Link className="text-link" to="/">
          Back to recipes
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="recipe-editor-layout">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Step 1</p>
              <h2>Paste recipe text</h2>
            </div>
            <button type="button" onClick={handleParseRecipe} disabled={parsing}>
              {parsing ? "Parsing..." : "Parse Recipe"}
            </button>
          </div>

          <div className="field-grid field-grid-two">
            <label className="field">
              <span>Cuisine</span>
              <select
                value={selectedCuisineId}
                onChange={(e) => setSelectedCuisineId(e.target.value)}
              >
                <option value="">
                  {cuisines.length > 0 ? "Select a cuisine" : "No cuisines available"}
                </option>
                {cuisines.map((cuisine) => (
                  <option key={cuisine.id} value={cuisine.id}>
                    {cuisine.name}
                  </option>
                ))}
              </select>
              {cuisineError && <small className="error-text">{cuisineError}</small>}
            </label>

            <label className="field">
              <span>Source</span>
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Cookbook / website / notes"
              />
            </label>
          </div>

          <label className="field">
            <span>Paste the full recipe</span>
            <textarea
              rows={12}
              value={recipeText}
              onChange={(e) => setRecipeText(e.target.value)}
              placeholder={
                "Best Chicken Tacos\nServes 4\n1 lb chicken breast\n2 tbsp olive oil\n...\nCook chicken..."
              }
            />
            <small>
              The parser does best when ingredient lines look like{" "}
              <code>quantity unit ingredient</code>.
            </small>
          </label>

          {parseMessage && <p className="notice success-text">{parseMessage}</p>}
        </section>

        <section className={`panel ${hasParsedDraft ? "" : "panel-muted"}`}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Step 2</p>
              <h2>Review draft</h2>
            </div>
            {reviewSummary && (
              <div className="review-summary">
                <strong>{ingredientsNeedingReview}</strong>
                <span>ingredient row{ingredientsNeedingReview === 1 ? "" : "s"} need review</span>
              </div>
            )}
          </div>

          {!hasParsedDraft ? (
            <p className="muted-copy">
              Parse a recipe first and the editable draft will appear here.
            </p>
          ) : (
            <>
              <div className="notice">
                {needsHumanReview || unresolvedItemsCount > 0
                  ? `This recipe still has ${unresolvedItemsCount} unresolved item${
                      unresolvedItemsCount === 1 ? "" : "s"
                    }. You can still save it.`
                  : "Everything looks reviewed and ready to save."}
              </div>

              <div className="field-grid field-grid-two">
                <label className="field">
                  <span>Name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="field">
                  <span>Servings</span>
                  <input
                    type="number"
                    min="1"
                    value={servings}
                    onChange={(e) => setServings(e.target.value)}
                  />
                </label>
              </div>

              <label className="field">
                <span>Instructions</span>
                <textarea
                  rows={8}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </label>

              <div className="section-heading">
                <div>
                  <h3>Ingredients</h3>
                  <p>
                    Flagged rows are sorted to the top so you can fix only what
                    matters.
                  </p>
                </div>
                <button type="button" onClick={() => addIngredientRow()}>
                  Add ingredient
                </button>
              </div>

              <div className="ingredient-list">
                {displayIngredients.map((ingredient) => {
                  const rowFlags = getRowFlags(ingredient)
                  const needsReview = rowFlags.length > 0

                  return (
                    <article
                      key={ingredient.clientId}
                      className={`ingredient-card ${needsReview ? "needs-review" : ""}`}
                    >
                      <div className="ingredient-card-header">
                        <div>
                          <strong>{ingredient.name.trim() || "New ingredient"}</strong>
                          <div className="badge-row">
                            {rowFlags.map((flag) => (
                              <span key={flag} className="flag-badge">
                                {formatReviewFlag(flag)}
                              </span>
                            ))}
                            {!needsReview && (
                              <span className="flag-badge flag-badge-complete">
                                Reviewed
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => removeIngredientRow(ingredient.clientId)}
                          disabled={ingredients.length === 1}
                        >
                          Remove
                        </button>
                      </div>

                      <div className="field-grid ingredient-grid">
                        <label className="field">
                          <span>Name</span>
                          <input
                            value={ingredient.name}
                            onChange={(e) =>
                              updateIngredient(
                                ingredient.clientId,
                                "name",
                                e.target.value
                              )
                            }
                            placeholder="Chicken breast"
                          />
                        </label>

                        <label className="field">
                          <span>Quantity</span>
                          <input
                            type="number"
                            step="any"
                            value={ingredient.quantity}
                            onChange={(e) =>
                              updateIngredient(
                                ingredient.clientId,
                                "quantity",
                                e.target.value
                              )
                            }
                            placeholder="1"
                          />
                        </label>

                        <label className="field">
                          <span>Unit</span>
                          <input
                            value={ingredient.unit}
                            onChange={(e) =>
                              updateIngredient(
                                ingredient.clientId,
                                "unit",
                                e.target.value
                              )
                            }
                            placeholder="lb"
                          />
                        </label>

                        <label className="field">
                          <span>Status</span>
                          <select
                            value={ingredient.correctionStatus}
                            onChange={(e) =>
                              updateIngredient(
                                ingredient.clientId,
                                "correctionStatus",
                                e.target.value
                              )
                            }
                          >
                            <option value="needs_review">Needs review</option>
                            <option value="auto_matched">Auto matched</option>
                            <option value="user_confirmed">User confirmed</option>
                            <option value="user_overridden">User overridden</option>
                            <option value="unresolved">Unresolved</option>
                          </select>
                        </label>
                      </div>

                      <div className="macro-panel">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() =>
                            updateIngredient(
                              ingredient.clientId,
                              "showMacros",
                              !ingredient.showMacros
                            )
                          }
                        >
                          {ingredient.showMacros
                            ? "Hide macro overrides"
                            : "Add macro overrides"}
                        </button>

                        {ingredient.showMacros && (
                          <div className="field-grid field-grid-four">
                            <label className="field">
                              <span>Calories </span>
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
                              />
                            </label>
                            <label className="field">
                              <span>Protein </span>
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
                              />
                            </label>
                            <label className="field">
                              <span>Carbs </span>
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
                              />
                            </label>
                            <label className="field">
                              <span>Fat </span>
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
                              />
                            </label>
                          </div>
                        )}
                        {ingredient.showMacros && (
                          <p className="muted-copy">
                            Enter totals for the whole ingredient row. We will convert
                            them automatically when the recipe is saved.
                          </p>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>

              <div className="section-heading">
                <div>
                  <h3>Unparsed lines</h3>
                  <p>Convert anything useful into an ingredient row or ignore it for now.</p>
                </div>
              </div>

              {unparsedLines.length === 0 ? (
                <p className="muted-copy">No loose lines remain.</p>
              ) : (
                <div className="unparsed-list">
                  {unparsedLines.map((line, index) => (
                    <div key={`${line}-${index}`} className="unparsed-item">
                      <p>{line}</p>
                      <div className="inline-actions">
                        <button
                          type="button"
                          onClick={() => handleConvertUnparsedLine(line)}
                        >
                          Convert to ingredient
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => handleIgnoreUnparsedLine(line)}
                        >
                          Ignore for now
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <footer className="save-bar">
          <div>
            <strong>Save recipe</strong>
            <p>
              Required fields must be filled in, but unresolved ingredients can
              still be saved as <code>unresolved</code>.
            </p>
          </div>
          <div className="inline-actions">
            <Link className="ghost-link" to="/">
              Cancel
            </Link>
            <button type="submit" disabled={submitting || !hasParsedDraft}>
              {submitting ? "Saving..." : "Save recipe"}
            </button>
          </div>
        </footer>

        {error && <p className="error-text form-error">{error}</p>}
      </form>
    </div>
  )
}

export default AddRecipePage
