const API_BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000"

async function parseJson(res: Response) {
  const data = await res.json().catch(() => null)

  if (!res.ok) {
    const detail =
      data && typeof data === "object"
        ? JSON.stringify(data)
        : `Request failed: ${res.status}`

    throw new Error(detail)
  }

  return data
}

export async function fetchRecipes() {
  const res = await fetch(`${API_BASE}/recipes`)
  return parseJson(res)
}

export async function fetchRecipeDetail(recipeId: number) {
  const res = await fetch(`${API_BASE}/recipes/${recipeId}`)
  return parseJson(res)
}

export async function fetchRecipeMacros(recipeId: number) {
  const res = await fetch(`${API_BASE}/recipes/${recipeId}/macros`)
  return parseJson(res)
}

type CreateIngredientInput = {
  name: string
  quantity: number
  unit: string
}

type CreateRecipeInput = {
  name: string
  cuisine: string
  servings: number
  instructions: string
  source: string
  ingredients: CreateIngredientInput[]
}

export async function createRecipe(payload: CreateRecipeInput) {
  const res = await fetch(`${API_BASE}/recipes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  return parseJson(res)
}