import type { Recipe, RecipeDetail, RecipeMacros, Ingredient } from "./types"

const API_BASE_URL = "/api"


export async function fetchRecipes(): Promise<Recipe[]> {
  const url = `${API_BASE_URL}/recipes`
  console.log('Fetching recipes from:', url)
  
  try {
    const res = await fetch(url)
    console.log('Fetch response status:', res.status)
    
    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`)
    }
    
    const data = await res.json()
    console.log('Fetched recipes:', data.length, 'items')
    return data
  } catch (error) {
    console.error('Error fetching recipes:', error)
    throw error
  }
}

export async function fetchRecipeDetail(recipeId: number): Promise<RecipeDetail> {
  const res = await fetch(`${API_BASE_URL}/recipes/${recipeId}`)
  if (!res.ok) {
    throw new Error(`Detail request failed: ${res.status}`)
  }
  return await res.json()
}

export async function fetchRecipeMacros(recipeId: number): Promise<RecipeMacros> {
  const res = await fetch(`${API_BASE_URL}/recipes/${recipeId}/macros`)
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
  const url = `${API_BASE_URL}/recipes`
  console.log('Creating recipe at:', url, 'with payload:', payload)
  
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
    
    console.log('Create recipe response status:', res.status)
    
    let data
    try {
      data = await res.json()
      console.log('Create recipe response data:', data)
    } catch (jsonError) {
      console.error('Failed to parse response as JSON:', jsonError)
      // If response is not JSON, create a generic error
      data = { detail: `Server error: ${res.status} ${res.statusText}` }
    }

    if (!res.ok) {
      console.error('Recipe creation failed:', data)
      throw new Error(JSON.stringify(data))
    }

    return data
  } catch (error) {
    console.error('Error in createRecipe:', error)
    throw error
  }
}

export type Cuisine = {
  id: number
  name: string
}
