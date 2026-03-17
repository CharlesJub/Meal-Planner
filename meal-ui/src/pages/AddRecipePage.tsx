import { useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate } from "react-router"
import type { IngredientFormRow } from "../types"
import { createRecipe } from "../api/recipes"

function AddRecipePage() {
  const navigate = useNavigate()

  const [name, setName] = useState("")
  const [cuisine, setCuisine] = useState("")
  const [servings, setServings] = useState("")
  const [instructions, setInstructions] = useState("")
  const [source, setSource] = useState("")
  const [ingredients, setIngredients] = useState<IngredientFormRow[]>([
    { name: "", quantity: "", unit: "" },
  ])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function updateIngredient(
    index: number,
    field: keyof IngredientFormRow,
    value: string
  ) {
    setIngredients((prev) =>
      prev.map((ingredient, i) =>
        i === index ? { ...ingredient, [field]: value } : ingredient
      )
    )
  }

  function addIngredientRow() {
    setIngredients((prev) => [
      ...prev,
      { name: "", quantity: "", unit: "" },
    ])
  }

  function removeIngredientRow(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!name.trim()) {
      setError("Recipe name required")
      return
    }

    const cleanedIngredients = ingredients
      .filter((ingredient) => ingredient.name.trim() !== "")
      .map((ingredient) => ({
        name: ingredient.name.trim(),
        quantity:
          ingredient.quantity.trim() === ""
            ? 0
            : Number(ingredient.quantity),
        unit: ingredient.unit.trim(),
      }))

    if (cleanedIngredients.length === 0) {
      setError("At least one ingredient is required")
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      const payload = {
        name: name.trim(),
        cuisine: cuisine.trim(),
        servings: Number(servings),
        instructions: instructions.trim(),
        source: source.trim(),
        ingredients: cleanedIngredients,
      }

      await createRecipe(payload)

      navigate("/")
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1>Add Recipe</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Name</label>
          <br />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Chicken tacos"
          />
        </div>

        <div>
          <label>Cuisine</label>
          <br />
          <input
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
            placeholder="Mexican"
          />
        </div>

        <div>
          <label>Servings</label>
          <br />
          <input
            type="number"
            min="1"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            placeholder="4"
          />
        </div>

        <div>
          <label>Source</label>
          <br />
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Cookbook / website / notes"
          />
        </div>

        <div>
          <label>Instructions</label>
          <br />
          <textarea
            rows={6}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>

        <div style={{ marginTop: "16px" }}>
          <h2>Ingredients</h2>

          {ingredients.map((ingredient, index) => (
            <div
              key={index}
              style={{
                marginBottom: "12px",
                padding: "12px",
                border: "1px solid #444",
                borderRadius: "6px",
              }}
            >
              <div>
                <label>Ingredient Name</label>
                <br />
                <input
                  value={ingredient.name}
                  onChange={(e) =>
                    updateIngredient(index, "name", e.target.value)
                  }
                  placeholder="Chicken breast"
                />
              </div>

              <div>
                <label>Quantity</label>
                <br />
                <input
                  type="number"
                  step="any"
                  value={ingredient.quantity}
                  onChange={(e) =>
                    updateIngredient(index, "quantity", e.target.value)
                  }
                  placeholder="1"
                />
              </div>

              <div>
                <label>Unit</label>
                <br />
                <input
                  value={ingredient.unit}
                  onChange={(e) =>
                    updateIngredient(index, "unit", e.target.value)
                  }
                  placeholder="lb"
                />
              </div>

              {ingredients.length > 1 && (
                <div style={{ marginTop: "8px" }}>
                  <button
                    type="button"
                    onClick={() => removeIngredientRow(index)}
                  >
                    Remove Ingredient
                  </button>
                </div>
              )}
            </div>
          ))}

          <button type="button" onClick={addIngredientRow}>
            Add Another Ingredient
          </button>
        </div>

        <div style={{ marginTop: "16px" }}>
          <button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Create Recipe"}
          </button>
        </div>

        {error && (
          <p style={{ color: "red", marginTop: "10px", whiteSpace: "pre-wrap" }}>
            {error}
          </p>
        )}
      </form>

      <div style={{ marginTop: "16px" }}>
        <Link to="/">Back to recipes</Link>
      </div>
    </div>
  )
}

export default AddRecipePage
