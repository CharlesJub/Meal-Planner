export type Recipe = {
  id: number
  name: string
  cuisine?: string | null
  servings?: number | null
}

export type Ingredient = {
  id?: number
  name: string
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
  quantity: string
  unit: string
  correctionStatus: string
  overrideCaloriesPerUnit: string
  overrideProteinPerUnit: string
  overrideCarbsPerUnit: string
  overrideFatPerUnit: string
  reviewFlags: ReviewFlag[]
  needsReview: boolean
  showMacros: boolean
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
}

export type CreateRecipePayload = {
  name: string
  cuisine: string
  servings: number
  instructions: string
  source: string
  ingredients: {
    name: string
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
  flags: ReviewFlag[]
  needs_review: boolean
  suggested_status: string
}

export type ParsedRecipeReview = {
  needs_human_review: boolean
  ingredient_reviews: ParsedIngredientReview[]
  unparsed_lines: string[]
  summary: {
    ingredient_count: number
    ingredients_needing_review: number
    unparsed_line_count: number
  }
}

export type ParsedRecipe = {
  name: string
  servings?: number | null
  ingredients: ParsedRecipeIngredient[]
  unparsed_lines: string[]
  instructions: string
  review: ParsedRecipeReview
}
