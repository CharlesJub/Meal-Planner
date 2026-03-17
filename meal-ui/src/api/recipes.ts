import type { Recipe, RecipeDetail, RecipeMacros, Ingredient } from "../types"

export async function fetchRecipes(): Promise<Recipe[]> {
  const res = await fetch("http://127.0.0.1:8000/recipes")
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`)
  }
  return await res.json()
}

export async function fetchRecipeDetail(recipeId: number): Promise<RecipeDetail> {
  const res = await fetch(`http://127.0.0.1:8000/recipes/${recipeId}`)
  if (!res.ok) {
    throw new Error(`Detail request failed: ${res.status}`)
  }
  return await res.json()
}

export async function fetchRecipeMacros(recipeId: number): Promise<RecipeMacros> {
  const res = await fetch(`http://127.0.0.1:8000/recipes/${recipeId}/macros`)
  if (!res.ok) {
    throw new Error(`Macros request failed: ${res.status}`)
  }
  return await res.json()
}

export interface CreateRecipePayload {
  name: string
  cuisine: string
  servings: number
  instructions: string
  source: string
  ingredients: Ingredient[]
}

export async function createRecipe(payload: CreateRecipePayload): Promise<any> {
  const res = await fetch("http://127.0.0.1:8000/recipes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  const data = await res.json()

  if (!res.ok) {
    console.error(data)
    throw new Error(JSON.stringify(data))
  }

  return data
}