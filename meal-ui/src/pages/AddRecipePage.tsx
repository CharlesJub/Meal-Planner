import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate } from "react-router"
import type { IngredientFormRow } from "../api/types"
import { ApiError, createRecipe, parseRecipeText } from "../api/recipes"
import { getCuisines, type Cuisine } from "../api/cuisines"

type ValidationDetail = {
  type?: string
  loc?: Array<string | number>
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

function AddRecipePage() {
  const navigate = useNavigate()

  const [entryMode, setEntryMode] = useState<"manual" | "paste">("manual")
  const [recipeText, setRecipeText] = useState("")
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
          ? parsedRecipe.ingredients.map((ingredient) => ({
              name: ingredient.name,
              quantity: String(ingredient.quantity),
              unit: ingredient.unit,
            }))
          : [{ name: "", quantity: "", unit: "" }]
      )

      const messages = [
        `Parsed ${parsedRecipe.ingredients.length} ingredient${
          parsedRecipe.ingredients.length === 1 ? "" : "s"
        }.`,
      ]

      if (parsedRecipe.unparsed_lines.length > 0) {
        messages.push(
          `Could not place ${parsedRecipe.unparsed_lines.length} line${
            parsedRecipe.unparsed_lines.length === 1 ? "" : "s"
          } automatically.`
        )
      }

      setParseMessage(messages.join(" "))
      setEntryMode("manual")
    } catch (err) {
      console.error("Recipe parse error:", err)
      setError(getRecipeErrorMessage(err))
    } finally {
      setParsing(false)
    }
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

      const selectedCuisine = cuisines.find(
        (c) => c.id === Number(selectedCuisineId)
      )

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
      console.error("Recipe creation error:", err)
      setError(getRecipeErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1>Add Recipe</h1>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "16px" }}>
          <strong>How do you want to add this recipe?</strong>
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginTop: "10px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => setEntryMode("manual")}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #666",
                background:
                  entryMode === "manual"
                    ? "rgba(100, 150, 255, 0.2)"
                    : "transparent",
              }}
            >
              Fill out the form
            </button>
            <button
              type="button"
              onClick={() => setEntryMode("paste")}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #666",
                background:
                  entryMode === "paste"
                    ? "rgba(100, 150, 255, 0.2)"
                    : "transparent",
              }}
            >
              Paste recipe text
            </button>
          </div>
        </div>

        {entryMode === "paste" && (
          <div
            style={{
              marginBottom: "20px",
              padding: "16px",
              border: "1px solid #444",
              borderRadius: "8px",
              textAlign: "left",
            }}
          >
            <label>Paste the full recipe</label>
            <br />
            <textarea
              rows={12}
              value={recipeText}
              onChange={(e) => setRecipeText(e.target.value)}
              placeholder={
                "Best Chicken Tacos\nServes 4\n1 lb chicken breast\n2 tbsp olive oil\n...\nCook chicken..."
              }
              style={{ width: "100%", boxSizing: "border-box", marginTop: "8px" }}
            />
            <p style={{ marginTop: "8px", whiteSpace: "pre-wrap" }}>
              The first line becomes the title. Ingredient lines work best in the
              format `quantity unit ingredient`.
            </p>
            <div style={{ marginTop: "12px" }}>
              <button type="button" onClick={handleParseRecipe} disabled={parsing}>
                {parsing ? "Parsing..." : "Parse Recipe Text"}
              </button>
            </div>
          </div>
        )}

        {parseMessage && (
          <p style={{ color: "#2e7d32", marginBottom: "16px", whiteSpace: "pre-wrap" }}>
            {parseMessage}
          </p>
        )}

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
