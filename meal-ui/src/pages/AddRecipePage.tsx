import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate } from "react-router"
import type { IngredientFormRow } from "../api/types"
import { createRecipe } from "../api/recipes"
import { getCuisines, type Cuisine } from "../api/cuisines"

function AddRecipePage() {
  const navigate = useNavigate()

  const [name, setName] = useState("")
  const [selectedCuisineId, setSelectedCuisineId] = useState("")
  const [servings, setServings] = useState("")
  const [instructions, setInstructions] = useState("")
  const [source, setSource] = useState("")
  const [ingredients, setIngredients] = useState<IngredientFormRow[]>([
    { name: "", quantity: "", unit: "" },
  ])
  const [cuisines, setCuisines] = useState<Cuisine[]>([])
  const [cuisineError, setCuisineError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
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

    if (!selectedCuisineId || selectedCuisineId === "") {
      setError("Please select a cuisine for your recipe.")
      return
    }

    if (!servings.trim() || Number(servings) <= 0) {
      setError("Servings must be greater than 0")
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

      const selectedCuisine = cuisines.find(c => c.id === Number(selectedCuisineId))
      
      const payload = {
        name: name.trim(),
        cuisine: selectedCuisine ? selectedCuisine.name : "",
        servings: Number(servings),
        instructions: instructions.trim(),
        source: source.trim(),
        ingredients: cleanedIngredients,
      }

      await createRecipe(payload)

      navigate("/")
    } catch (err) {
      console.error('Recipe creation error:', err)
      
      // Try to parse the error response for better user feedback
      if (err instanceof Error) {
        try {
          // The error message should be a JSON string from the API
          const errorData = JSON.parse(err.message)
          console.log('Parsed error data:', errorData)
          
          if (errorData.detail && Array.isArray(errorData.detail)) {
            const missingFields = errorData.detail
              .filter((d: any) => d.type === 'missing')
              .map((d: any) => d.loc[d.loc.length - 1])
            
            if (missingFields.includes('cuisine')) {
              setError("Please select a cuisine for your recipe.")
            } else if (missingFields.length > 0) {
              setError(`Missing required fields: ${missingFields.join(', ')}`)
            } else {
              setError("Failed to create recipe. Please check your input and try again.")
            }
          } else if (errorData.detail) {
            // Handle non-array error details
            setError(`Error: ${errorData.detail}`)
          } else {
            setError("Failed to create recipe. Please check your input and try again.")
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError)
          // If JSON parsing fails, just show the original error message
          setError(err.message || "Failed to create recipe. Please try again.")
        }
      } else {
        setError("Unknown error occurred")
      }
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
          {cuisineError && (
            <p style={{ color: "red", marginTop: "6px" }}>{cuisineError}</p>
          )}
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