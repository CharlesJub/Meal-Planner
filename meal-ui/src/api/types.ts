export type Recipe = {
  id: number
  name: string
  cuisine?: string | null
  servings?: number | null
}

export type Ingredient = {
  name: string
  quantity?: number | null
  unit?: string | null
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

export type IngredientFormRow = {
  name: string
  quantity: string
  unit: string
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

export type CreateRecipePayload = {
  name: string
  cuisine_id: number | null
  servings: number
  instructions: string
  source: string
  ingredients: {
    name: string
    quantity: number
    unit: string
  }[]
}