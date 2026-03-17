import type {
  CreateRecipePayload,
  Recipe,
  RecipeDetail,
  RecipeMacros,
} from "./types"

const API_BASE_URL = "/api"

export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(message: string, status: number, detail: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.detail = detail
  }
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  fallbackMessage = "Request failed"
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, init)
  const isJson = res.headers.get("content-type")?.includes("application/json")
  const data = isJson ? await res.json() : null

  if (!res.ok) {
    const detail = data && typeof data === "object" ? data.detail : data
    throw new ApiError(fallbackMessage, res.status, detail)
  }

  return data as T
}

export async function fetchRecipes(): Promise<Recipe[]> {
  return requestJson<Recipe[]>("/recipes", undefined, "Failed to fetch recipes")
}

export async function fetchRecipeDetail(recipeId: number): Promise<RecipeDetail> {
  return requestJson<RecipeDetail>(
    `/recipes/${recipeId}`,
    undefined,
    "Failed to fetch recipe detail"
  )
}

export async function fetchRecipeMacros(recipeId: number): Promise<RecipeMacros> {
  return requestJson<RecipeMacros>(
    `/recipes/${recipeId}/macros`,
    undefined,
    "Failed to fetch recipe macros"
  )
}

export async function createRecipe(
  payload: CreateRecipePayload
): Promise<{ message: string; recipe_id: number; recipe_name: string }> {
  return requestJson<{ message: string; recipe_id: number; recipe_name: string }>(
    "/recipes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Failed to create recipe"
  )
}

export type Cuisine = {
  id: number
  name: string
}
