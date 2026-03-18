import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate } from "react-router"
import type {
  CreateRecipePayload,
  IngredientMatch,
  IngredientFormRow,
  ParsedParseIssue,
  ParsedRecipe,
  ReviewFlag,
} from "../api/types"
import {
  ApiError,
  createRecipe,
  parseRecipeText,
  searchIngredients,
} from "../api/recipes"
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
      return "Unit needs confirmation"
    case "missing_macro_source":
      return "Needs ingredient match"
    case "missing_macro_data":
      return "Macro data incomplete"
    case "partial_macro_override":
      return "Complete all macro override fields"
    default:
      return flag
  }
}

function formatParseIssueCategory(category: ParsedParseIssue["review_category"]) {
  switch (category) {
    case "parse_failure":
      return "Parse failure"
    case "ingredient_cleanup":
      return "Ingredient cleanup"
    case "informational_note":
      return "Note"
    case "optional_input":
      return "Optional"
    default:
      return "Needs classification"
  }
}

function formatParseIssueSeverity(severity: ParsedParseIssue["severity"]) {
  switch (severity) {
    case "high":
      return "High priority"
    case "medium":
      return "Review soon"
    case "low":
      return "Low priority"
    default:
      return severity
  }
}

function splitIngredientText(rawName: string, normalizedName = "") {
  const originalText = rawName.trim()
  const normalized = normalizedName.trim()

  if (!originalText) {
    return {
      cleanedName: "",
      preparationNotes: "",
      suggestedSearchTerm: "",
    }
  }

  const fallbackParts = originalText
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
  const fallbackName = fallbackParts[0] ?? originalText
  const fallbackNotes = fallbackParts.slice(1).join(", ")

  if (!normalized) {
    return {
      cleanedName: fallbackName,
      preparationNotes: fallbackNotes,
      suggestedSearchTerm: fallbackName,
    }
  }

  const loweredOriginal = originalText.toLowerCase()
  const loweredNormalized = normalized.toLowerCase()

  if (loweredOriginal === loweredNormalized) {
    return {
      cleanedName: originalText,
      preparationNotes: "",
      suggestedSearchTerm: normalized,
    }
  }

  const normalizedIndex = loweredOriginal.indexOf(loweredNormalized)
  if (normalizedIndex >= 0) {
    const before = originalText.slice(0, normalizedIndex).trim()
    const after = originalText.slice(normalizedIndex + normalized.length).trim()
    const detailParts = [before, after]
      .map((part) => part.replace(/^[,;:\-]\s*/, "").trim())
      .filter(Boolean)

    return {
      cleanedName: originalText.slice(normalizedIndex, normalizedIndex + normalized.length),
      preparationNotes: detailParts.join(", "),
      suggestedSearchTerm: normalized,
    }
  }

  return {
    cleanedName: normalized,
    preparationNotes: fallbackNotes,
    suggestedSearchTerm: normalized,
  }
}

function formatMatchOption(match: IngredientMatch) {
  if (match.macro_status === "matched") {
    return `${match.name} - macros ready`
  }
  if (match.macro_status === "incomplete") {
    return `${match.name} - macros incomplete`
  }
  return `${match.name} - no macros yet`
}

function createBlankIngredientRow(name = ""): IngredientFormRow {
  const parsedName = splitIngredientText(name)

  return {
    clientId: nextIngredientRowId(),
    name: parsedName.cleanedName,
    originalText: name.trim(),
    preparationNotes: parsedName.preparationNotes,
    normalizedName: parsedName.suggestedSearchTerm,
    lastSuggestedQuery: "",
    shouldCreateIngredientRecord: false,
    saveMacrosToIngredient: false,
    ingredientId: null,
    quantity: "",
    unit: "",
    correctionStatus: parsedName.cleanedName ? "needs_review" : "auto_matched",
    overrideCaloriesPerUnit: "",
    overrideProteinPerUnit: "",
    overrideCarbsPerUnit: "",
    overrideFatPerUnit: "",
    macroValuesAreManual: false,
    reviewFlags: parsedName.cleanedName ? ["missing_quantity", "missing_unit"] : [],
    matchedIngredient: null,
    candidateIngredients: [],
    isSearching: false,
    isCreatingIngredient: false,
  }
}

function buildIngredientRow(
  ingredient: ParsedRecipe["ingredients"][number],
  review:
    | ParsedRecipe["review"]["ingredient_reviews"][number]
    | undefined
): IngredientFormRow {
  const parsedName = splitIngredientText(
    ingredient.name ?? "",
    review?.normalized_name ?? ""
  )

  return {
    clientId: nextIngredientRowId(),
    name: parsedName.cleanedName,
    originalText: ingredient.name ?? "",
    preparationNotes: parsedName.preparationNotes,
    normalizedName: review?.normalized_name?.trim() ?? parsedName.suggestedSearchTerm,
    lastSuggestedQuery:
      review?.matched_ingredient != null ||
      (review?.candidate_ingredients?.length ?? 0) > 0
        ? review?.normalized_name?.trim() ?? parsedName.suggestedSearchTerm
        : "",
    shouldCreateIngredientRecord: false,
    saveMacrosToIngredient: false,
    ingredientId: review?.matched_ingredient?.id ?? null,
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
    macroValuesAreManual: false,
    reviewFlags: review?.flags ?? [],
    matchedIngredient: review?.matched_ingredient ?? null,
    candidateIngredients: review?.matched_ingredient
      ? [
          review.matched_ingredient,
          ...(review?.candidate_ingredients ?? []).filter(
            (candidate) => candidate.id !== review.matched_ingredient?.id
          ),
        ]
      : review?.candidate_ingredients ?? [],
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

function getIngredientMacroTotals(row: IngredientFormRow) {
  const quantity = getIngredientQuantity(row)
  if (quantity == null || row.matchedIngredient == null) {
    return null
  }

  const {
    calories_per_unit,
    protein_per_unit,
    carbs_per_unit,
    fat_per_unit,
  } = row.matchedIngredient

  if (
    calories_per_unit == null ||
    protein_per_unit == null ||
    carbs_per_unit == null ||
    fat_per_unit == null
  ) {
    return null
  }

  return {
    calories: calories_per_unit * quantity,
    protein: protein_per_unit * quantity,
    carbs: carbs_per_unit * quantity,
    fat: fat_per_unit * quantity,
  }
}

function getMacroInputValue(
  row: IngredientFormRow,
  field: "calories" | "protein" | "carbs" | "fat"
) {
  if (row.macroValuesAreManual) {
    switch (field) {
      case "calories":
        return row.overrideCaloriesPerUnit
      case "protein":
        return row.overrideProteinPerUnit
      case "carbs":
        return row.overrideCarbsPerUnit
      case "fat":
        return row.overrideFatPerUnit
    }
  }

  const matchedTotals = getIngredientMacroTotals(row)
  if (matchedTotals == null) {
    return ""
  }

  const value = matchedTotals[field]
  return Number.isFinite(value) ? String(Number(value.toFixed(2))) : ""
}

function hasAnyMacroOverride(row: IngredientFormRow) {
  if (!row.macroValuesAreManual) {
    return false
  }
  return getMacroOverrideValues(row).some((value) => value !== "")
}

function hasCompleteMacroOverride(row: IngredientFormRow) {
  if (!row.macroValuesAreManual) {
    return false
  }
  return getMacroOverrideValues(row).every((value) => value !== "")
}

function getRowFlags(row: IngredientFormRow): ReviewFlag[] {
  const flags = new Set<ReviewFlag>(
    row.reviewFlags.filter(
      (flag) =>
        ![
          "missing_quantity",
          "missing_unit",
          "missing_macro_source",
          "missing_macro_data",
          "partial_macro_override",
        ].includes(flag)
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
  }

  if (!hasCompleteMacroOverride(row)) {
    if (row.matchedIngredient == null) {
      flags.add("missing_macro_source")
    } else if (row.matchedIngredient.macro_status !== "matched") {
      flags.add("missing_macro_data")
    }
  }

  return Array.from(flags)
}

function resolveCorrectionStatus(row: IngredientFormRow): string {
  const flags = getRowFlags(row)
  const isCreatingReusableIngredient =
    row.shouldCreateIngredientRecord &&
    row.saveMacrosToIngredient &&
    hasCompleteMacroOverride(row)

  if (hasCompleteMacroOverride(row)) {
    if (isCreatingReusableIngredient || row.saveMacrosToIngredient) {
      return "user_confirmed"
    }
    return "user_overridden"
  }
  if (row.ingredientId != null) {
    if (
      row.correctionStatus === "auto_matched" &&
      row.matchedIngredient?.id === row.ingredientId
    ) {
      return flags.length > 0 ? "unresolved" : "auto_matched"
    }
    return flags.length > 0 ? "unresolved" : "user_confirmed"
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
  const [parseIssues, setParseIssues] = useState<ParsedParseIssue[]>([])
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

  useEffect(() => {
    const rowsNeedingSuggestions = ingredients.filter((ingredient) => {
      const query = ingredient.normalizedName.trim()

      return (
        query.length > 0 &&
        ingredient.matchedIngredient == null &&
        !ingredient.isSearching &&
        ingredient.lastSuggestedQuery !== query
      )
    })

    if (rowsNeedingSuggestions.length === 0) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      rowsNeedingSuggestions.forEach((ingredient) => {
        void loadIngredientSuggestions(ingredient.clientId, ingredient.normalizedName)
      })
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [ingredients])

  function updateIngredient(
    clientId: string,
    field: keyof IngredientFormRow,
    value: string | boolean
  ) {
    setIngredients((prev) =>
      prev.map((ingredient) =>
        ingredient.clientId !== clientId
          ? ingredient
          : field === "name"
            ? {
                ...ingredient,
                name: String(value),
                normalizedName: String(value).trim().toLowerCase(),
                lastSuggestedQuery: "",
                shouldCreateIngredientRecord: false,
                saveMacrosToIngredient: false,
                ingredientId: null,
                matchedIngredient: null,
                candidateIngredients: [],
                isSearching: false,
                correctionStatus: "needs_review",
              }
            : field === "quantity"
                  ? { ...ingredient, quantity: String(value) }
                : field === "unit"
                    ? { ...ingredient, unit: String(value) }
                    : field === "saveMacrosToIngredient"
                      ? {
                          ...ingredient,
                          saveMacrosToIngredient: Boolean(value),
                        }
                    : field === "overrideCaloriesPerUnit"
                        ? {
                            ...ingredient,
                            overrideCaloriesPerUnit: String(value),
                            macroValuesAreManual: true,
                          }
                        : field === "overrideProteinPerUnit"
                          ? {
                              ...ingredient,
                              overrideProteinPerUnit: String(value),
                              macroValuesAreManual: true,
                            }
                          : field === "overrideCarbsPerUnit"
                            ? {
                                ...ingredient,
                                overrideCarbsPerUnit: String(value),
                                macroValuesAreManual: true,
                              }
                            : field === "overrideFatPerUnit"
                              ? {
                                  ...ingredient,
                                  overrideFatPerUnit: String(value),
                                  macroValuesAreManual: true,
                                }
                              : ingredient
      )
    )
  }

  function clearIngredientMatch(clientId: string) {
    setIngredients((prev) =>
      prev.map((ingredient) =>
        ingredient.clientId === clientId
            ? {
              ...ingredient,
              shouldCreateIngredientRecord: false,
              saveMacrosToIngredient: false,
              ingredientId: null,
              matchedIngredient: null,
              correctionStatus: "needs_review",
              macroValuesAreManual: false,
            }
          : ingredient
      )
    )
  }

  function applyIngredientMatch(clientId: string, match: IngredientMatch) {
    setIngredients((prev) =>
      prev.map((ingredient) =>
        ingredient.clientId === clientId
            ? {
              ...ingredient,
              shouldCreateIngredientRecord: false,
              saveMacrosToIngredient: false,
              ingredientId: match.id,
              matchedIngredient: match,
              name: ingredient.name || match.name,
              normalizedName: match.name,
              candidateIngredients: [
                match,
                ...ingredient.candidateIngredients.filter(
                  (candidate) => candidate.id !== match.id
                ),
              ],
              correctionStatus: "user_confirmed",
              macroValuesAreManual: false,
            }
          : ingredient
      )
    )
  }

  async function loadIngredientSuggestions(clientId: string, query: string) {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      return
    }

    setIngredients((prev) =>
      prev.map((ingredient) =>
        ingredient.clientId === clientId
          ? { ...ingredient, isSearching: true, lastSuggestedQuery: trimmedQuery }
          : ingredient
      )
    )

    try {
      const results = await searchIngredients(trimmedQuery)
      setIngredients((prev) =>
        prev.map((ingredient) =>
          ingredient.clientId === clientId &&
          ingredient.normalizedName.trim() === trimmedQuery &&
          ingredient.matchedIngredient == null
            ? {
                ...ingredient,
                candidateIngredients: results,
                isSearching: false,
              }
            : ingredient.clientId === clientId
              ? { ...ingredient, isSearching: false }
              : ingredient
        )
      )
    } catch (err) {
      console.error("Ingredient search error:", err)
      setError(getRecipeErrorMessage(err))
      setIngredients((prev) =>
        prev.map((ingredient) =>
          ingredient.clientId === clientId
            ? { ...ingredient, isSearching: false }
            : ingredient
        )
      )
    }
  }

  function handleIngredientMatchChange(row: IngredientFormRow, value: string) {
    if (value === "__create__") {
      setIngredients((prev) =>
        prev.map((ingredient) =>
          ingredient.clientId === row.clientId
            ? {
                ...ingredient,
                shouldCreateIngredientRecord: true,
                saveMacrosToIngredient: false,
                ingredientId: null,
                matchedIngredient: null,
                correctionStatus: "needs_review",
              }
            : ingredient
        )
      )
      return
    }

    if (value === "") {
      clearIngredientMatch(row.clientId)
      return
    }

    const match = row.candidateIngredients.find(
      (candidate) => String(candidate.id) === value
    )

    if (match) {
      applyIngredientMatch(row.clientId, match)
    }
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
      parsedRecipe.review.summary.parse_issue_counts_by_severity.high +
      parsedRecipe.review.summary.parse_issue_counts_by_severity.medium

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
      setParseIssues(parsedRecipe.review.parse_issues)
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

  function handleConvertParseIssue(issue: ParsedParseIssue) {
    addIngredientRow(issue.raw_line)
    setParseIssues((prev) => prev.filter((candidate) => candidate !== issue))
  }

  function handleIgnoreParseIssue(issue: ParsedParseIssue) {
    setParseIssues((prev) => prev.filter((candidate) => candidate !== issue))
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
            ingredient_id: ingredient.ingredientId,
            create_ingredient_record: ingredient.shouldCreateIngredientRecord,
            save_macros_to_ingredient: ingredient.saveMacrosToIngredient,
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
  const blockingParseIssues = parseIssues.filter(
    (issue) => issue.severity === "high" || issue.severity === "medium"
  )
  const unresolvedItemsCount = ingredientsNeedingReview + blockingParseIssues.length
  const lowPriorityParseIssues = parseIssues.filter((issue) => issue.severity === "low")

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
                <strong>{ingredientsNeedingReview + blockingParseIssues.length}</strong>
                <span>
                  blocking item
                  {ingredientsNeedingReview + blockingParseIssues.length === 1 ? "" : "s"} in review
                </span>
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
                    Rows that still need attention stay at the top.
                  </p>
                </div>
                <button type="button" onClick={() => addIngredientRow()}>
                  Add ingredient
                </button>
              </div>

              <div className="ingredient-list">
                {displayIngredients.map((ingredient) => {
                  const rowFlags = getRowFlags(ingredient)
                  const visibleFlags = rowFlags.filter(
                    (flag) =>
                      flag !== "missing_macro_source" &&
                      flag !== "missing_macro_data"
                  )
                  const needsReview = rowFlags.length > 0

                  return (
                    <article
                      key={ingredient.clientId}
                      className={`ingredient-card ${needsReview ? "needs-review" : ""}`}
                    >
                      <div className="ingredient-card-header">
                        <div>
                          <strong>{ingredient.name.trim() || "New ingredient"}</strong>
                          {ingredient.originalText.trim() &&
                            ingredient.originalText.trim() !== ingredient.name.trim() && (
                              <p className="ingredient-source-text">
                                Original text: {ingredient.originalText.trim()}
                              </p>
                            )}
                          {visibleFlags.length > 0 && (
                            <div className="badge-row">
                              {visibleFlags.map((flag) => (
                                <span key={flag} className="flag-badge">
                                  {formatReviewFlag(flag)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          className="text-link"
                          onClick={() => removeIngredientRow(ingredient.clientId)}
                          disabled={ingredients.length === 1}
                        >
                          Remove
                        </button>
                      </div>

                      <div className="field-grid ingredient-grid">
                        <label className="field">
                          <span>Ingredient name</span>
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
                          <span>Preparation/details</span>
                          <input
                            value={ingredient.preparationNotes}
                            readOnly
                            placeholder="No extra details"
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
                      </div>

                      <div className="match-panel">
                        <label className="field">
                          <span>Ingredient match</span>
                          <select
                            value={
                              ingredient.shouldCreateIngredientRecord
                                ? "__create__"
                                : ingredient.ingredientId == null
                                ? ""
                                : String(ingredient.ingredientId)
                            }
                            onChange={(e) =>
                              handleIngredientMatchChange(
                                ingredient,
                                e.target.value
                              )
                            }
                          >
                            <option value="">
                              {ingredient.isSearching
                                ? "Loading ingredient matches..."
                                : "No ingredient match selected"}
                            </option>
                            {ingredient.candidateIngredients.map((candidate) => (
                              <option key={candidate.id} value={String(candidate.id)}>
                                {formatMatchOption(candidate)}
                              </option>
                            ))}
                            <option value="__create__">Create new ingredient record</option>
                          </select>
                        </label>
                        <p className="muted-copy">
                          Matching links this row to a reusable ingredient record for
                          macro autofill.
                        </p>
                        {ingredient.matchedIngredient == null && !ingredient.isSearching && (
                          <p className="muted-copy">
                            {ingredient.shouldCreateIngredientRecord
                              ? "This row will create a reusable ingredient record when you save. If you fill in all macros below, they will be saved onto that ingredient."
                              : "No match selected yet. The last option creates a new reusable ingredient record, not just a recipe row."}
                          </p>
                        )}
                      </div>

                      <div className="macro-panel">
                        <div className="match-panel-header">
                          <div>
                            <strong>Macros for this row</strong>
                            <p className="muted-copy">
                              {ingredient.shouldCreateIngredientRecord
                                ? ingredient.saveMacrosToIngredient
                                  ? "These values will be saved as the default macros on the new ingredient record when you save the recipe."
                                  : "These values only apply to this recipe row unless you choose to save them to the ingredient record."
                                : ingredient.ingredientId != null
                                  ? ingredient.saveMacrosToIngredient
                                    ? "These values will update the default macros on the matched ingredient when you save the recipe."
                                    : ingredient.macroValuesAreManual
                                      ? "These values only override this recipe row. The matched ingredient will not change."
                                      : "These totals come from the matched ingredient when enough macro data is available."
                                  : "These values only apply to this recipe row unless you choose to save them to the ingredient record."}
                            </p>
                          </div>
                          <span
                            className={`flag-badge ${
                              ingredient.macroValuesAreManual
                                ? ""
                                : "flag-badge-complete"
                            }`}
                          >
                            {ingredient.macroValuesAreManual
                              ? "Manual override"
                              : "Using matched macros"}
                          </span>
                        </div>

                        {ingredient.macroValuesAreManual && (
                          <label className="macro-save-toggle">
                            <input
                              type="checkbox"
                              checked={ingredient.saveMacrosToIngredient}
                              onChange={(e) =>
                                updateIngredient(
                                  ingredient.clientId,
                                  "saveMacrosToIngredient",
                                  e.target.checked
                                )
                              }
                            />
                            <span>
                              {ingredient.shouldCreateIngredientRecord
                                ? "Save these as the default macros for the new ingredient"
                                : ingredient.ingredientId != null
                                  ? "Save these as the default macros for the matched ingredient"
                                  : "Save these as the default macros if this becomes an ingredient record"}
                            </span>
                          </label>
                        )}

                        <div className="field-grid field-grid-four">
                          <label className="field">
                            <span>Calories </span>
                            <input
                              type="number"
                              step="any"
                              value={getMacroInputValue(ingredient, "calories")}
                              onChange={(e) =>
                                updateIngredient(
                                  ingredient.clientId,
                                  "overrideCaloriesPerUnit",
                                  e.target.value
                                )
                              }
                              placeholder="0"
                            />
                          </label>
                          <label className="field">
                            <span>Protein </span>
                            <input
                              type="number"
                              step="any"
                              value={getMacroInputValue(ingredient, "protein")}
                              onChange={(e) =>
                                updateIngredient(
                                  ingredient.clientId,
                                  "overrideProteinPerUnit",
                                  e.target.value
                                )
                              }
                              placeholder="0"
                            />
                          </label>
                          <label className="field">
                            <span>Carbs </span>
                            <input
                              type="number"
                              step="any"
                              value={getMacroInputValue(ingredient, "carbs")}
                              onChange={(e) =>
                                updateIngredient(
                                  ingredient.clientId,
                                  "overrideCarbsPerUnit",
                                  e.target.value
                                )
                              }
                              placeholder="0"
                            />
                          </label>
                          <label className="field">
                            <span>Fat </span>
                            <input
                              type="number"
                              step="any"
                              value={getMacroInputValue(ingredient, "fat")}
                              onChange={(e) =>
                                updateIngredient(
                                  ingredient.clientId,
                                  "overrideFatPerUnit",
                                  e.target.value
                                )
                              }
                              placeholder="0"
                            />
                          </label>
                        </div>

                        <div className="inline-actions">
                          {ingredient.macroValuesAreManual ? (
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() =>
                                setIngredients((prev) =>
                                  prev.map((row) =>
                                    row.clientId === ingredient.clientId
                                      ? {
                                          ...row,
                                          macroValuesAreManual: false,
                                          saveMacrosToIngredient: false,
                                          overrideCaloriesPerUnit: "",
                                          overrideProteinPerUnit: "",
                                          overrideCarbsPerUnit: "",
                                          overrideFatPerUnit: "",
                                        }
                                      : row
                                  )
                                )
                              }
                            >
                              Reset to matched macros
                            </button>
                          ) : (
                            <p className="muted-copy">
                              Change any value above to start a manual override.
                            </p>
                          )}
                        </div>

                        <p className="muted-copy">
                          Enter totals for the whole ingredient row. We convert them
                          automatically when the recipe is saved.
                        </p>
                      </div>
                    </article>
                  )
                })}
              </div>

              <div className="section-heading">
                <div>
                  <h3>Parse issues</h3>
                  <p>
                    High and medium items stay in focus. Low-priority notes can be left alone or converted if useful.
                  </p>
                </div>
              </div>

              {parseIssues.length === 0 ? (
                <p className="muted-copy">No parse issues remain.</p>
              ) : (
                <div className="unparsed-list">
                  {blockingParseIssues.map((issue, index) => (
                    <div
                      key={`${issue.raw_line}-${issue.line_number ?? index}-${issue.issue_type}`}
                      className={`unparsed-item parse-issue-card parse-issue-card-${issue.severity}`}
                    >
                      <div className="parse-issue-header">
                        <div className="badge-row">
                          <span className={`flag-badge parse-issue-badge parse-issue-badge-${issue.severity}`}>
                            {formatParseIssueSeverity(issue.severity)}
                          </span>
                          <span className="flag-badge parse-issue-badge-neutral">
                            {formatParseIssueCategory(issue.review_category)}
                          </span>
                          <span className="flag-badge parse-issue-badge-neutral">
                            {issue.section}
                            {issue.line_number != null ? ` line ${issue.line_number}` : ""}
                          </span>
                        </div>
                        <p className="parse-issue-reason">{issue.reason}</p>
                      </div>
                      <p>{issue.raw_line}</p>
                      <div className="inline-actions">
                        <button
                          type="button"
                          onClick={() => handleConvertParseIssue(issue)}
                        >
                          Convert to ingredient
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => handleIgnoreParseIssue(issue)}
                        >
                          Ignore for now
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {lowPriorityParseIssues.length > 0 && (
                <>
                  <div className="section-heading">
                    <div>
                      <h3>Low-priority notes</h3>
                      <p>These usually do not block saving and are mostly here for context.</p>
                    </div>
                  </div>

                  <div className="unparsed-list">
                    {lowPriorityParseIssues.map((issue, index) => (
                      <div
                        key={`${issue.raw_line}-${issue.line_number ?? index}-${issue.issue_type}-low`}
                        className="unparsed-item parse-issue-card parse-issue-card-low"
                      >
                        <div className="parse-issue-header">
                          <div className="badge-row">
                            <span className="flag-badge parse-issue-badge parse-issue-badge-low">
                              {formatParseIssueSeverity(issue.severity)}
                            </span>
                            <span className="flag-badge parse-issue-badge-neutral">
                              {formatParseIssueCategory(issue.review_category)}
                            </span>
                            <span className="flag-badge parse-issue-badge-neutral">
                              {issue.section}
                              {issue.line_number != null ? ` line ${issue.line_number}` : ""}
                            </span>
                          </div>
                          <p className="parse-issue-reason">{issue.reason}</p>
                        </div>
                        <p>{issue.raw_line}</p>
                        <div className="inline-actions">
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => handleConvertParseIssue(issue)}
                          >
                            Convert anyway
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => handleIgnoreParseIssue(issue)}
                          >
                            Dismiss note
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
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
