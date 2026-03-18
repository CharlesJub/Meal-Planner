export type Recipe = {
  id: number
  name: string
  cuisine?: string | null
  servings?: number | null
}

export type Ingredient = {
  id?: number
  name: string
  ingredient_id?: number | null
  quantity?: number | null
  unit?: string | null
  correction_status?: string | null
  override_calories_per_unit?: number | null
  override_protein_per_unit?: number | null
  override_carbs_per_unit?: number | null
  override_fat_per_unit?: number | null
}

export type RecipeDetail = {
  id: number
  name: string
  cuisine?: string | null
  servings?: number | null
  instructions?: string | null
  source?: string | null
  ingredients?: Ingredient[]
}

export type ReviewFlag =
  | "missing_quantity"
  | "missing_unit"
  | "missing_macro_source"
  | "missing_macro_data"
  | "partial_macro_override"

export type IngredientFormRow = {
  clientId: string
  name: string
  originalText: string
  preparationNotes: string
  normalizedName: string
  lastSuggestedQuery: string
  shouldCreateIngredientRecord: boolean
  saveMacrosToIngredient: boolean
  ingredientId: number | null
  quantity: string
  unit: string
  correctionStatus: string
  overrideCaloriesPerUnit: string
  overrideProteinPerUnit: string
  overrideCarbsPerUnit: string
  overrideFatPerUnit: string
  macroValuesAreManual: boolean
  reviewFlags: ReviewFlag[]
  matchedIngredient: IngredientMatch | null
  candidateIngredients: IngredientMatch[]
  isSearching: boolean
  isCreatingIngredient: boolean
}

export type IngredientMatch = {
  id: number
  name: string
  unit?: string | null
  calories_per_unit?: number | null
  protein_per_unit?: number | null
  carbs_per_unit?: number | null
  fat_per_unit?: number | null
  macro_status: "matched" | "unmatched" | "incomplete"
}

export type MacroSet = {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type RecipeMacros = {
  recipe_id: number
  recipe_name: string
  servings: number
  recipe_totals: MacroSet
  per_serving: MacroSet
  missing_ingredients: string[]
  is_complete: boolean
}

export type HomePageProps = {
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
  onRecipeUpdated: (recipeId: number) => Promise<void>
  onRecalculateMacros: (recipeId: number) => Promise<void>
}

export type RecipeDetailPanelProps = {
  selectedRecipeId: number | null
  selectedRecipeDetail: RecipeDetail | null
  detailLoading: boolean
  detailError: string | null
  selectedRecipeMacros: RecipeMacros | null
  macrosLoading: boolean
  macrosError: string | null
  onClearSelection: () => void
  onRecipeUpdated: (recipeId: number) => Promise<void>
  onRecalculateMacros: (recipeId: number) => Promise<void>
}

export type CreateRecipePayload = {
  name: string
  cuisine: string
  servings: number
  instructions: string
  source: string
  ingredients: {
    name: string
    ingredient_id: number | null
    create_ingredient_record: boolean
    save_macros_to_ingredient: boolean
    quantity: number | null
    unit: string | null
    correction_status: string
    override_calories_per_unit: number | null
    override_protein_per_unit: number | null
    override_carbs_per_unit: number | null
    override_fat_per_unit: number | null
  }[]
}

export type UpdateRecipePayload = {
  name: string
  servings: number
  instructions: string
  source: string
  ingredients: {
    name: string
    ingredient_id: number | null
    create_ingredient_record: boolean
    save_macros_to_ingredient: boolean
    quantity: number | null
    unit: string | null
    correction_status: string
    override_calories_per_unit: number | null
    override_protein_per_unit: number | null
    override_carbs_per_unit: number | null
    override_fat_per_unit: number | null
  }[]
}

export type ParsedRecipeIngredient = {
  name: string
  quantity: number | null
  unit: string | null
}

export type ParsedIngredientReview = {
  name: string
  quantity: number | null
  unit: string | null
  normalized_name?: string | null
  matched_ingredient: IngredientMatch | null
  candidate_ingredients: IngredientMatch[]
  macro_status: "matched" | "unmatched" | "incomplete"
  flags: ReviewFlag[]
  needs_review: boolean
  suggested_status: string
}

export type ParseIssueSeverity = "high" | "medium" | "low"

export type ParseIssueCategory =
  | "parse_failure"
  | "ingredient_cleanup"
  | "informational_note"
  | "optional_input"
  | "unknown"

export type ParsedParseIssue = {
  raw_line: string
  line_number: number | null
  section: string
  issue_type: string
  reason: string
  review_category: ParseIssueCategory
  severity: ParseIssueSeverity
}

export type ParsedRecipeReview = {
  needs_human_review: boolean
  ingredient_reviews: ParsedIngredientReview[]
  unparsed_lines: string[]
  parse_issues: ParsedParseIssue[]
  summary: {
    ingredient_count: number
    ingredients_needing_review: number
    unparsed_line_count: number
    parse_issue_count: number
    parse_issue_counts_by_severity: Record<ParseIssueSeverity, number>
    parse_issue_counts_by_category: Record<string, number>
  }
}

export type ParsedRecipe = {
  name: string
  servings?: number | null
  ingredients: ParsedRecipeIngredient[]
  unparsed_lines: string[]
  parse_issues: ParsedParseIssue[]
  instructions: string
  review: ParsedRecipeReview
}
