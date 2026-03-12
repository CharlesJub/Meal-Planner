- ## Tomorrow's Next Steps

  - [X] **Low-hanging fruit:** Implement `GET /recipes`

    - Return basic fields:
      - `id`
      - `name`
      - `cuisine_id`
      - `servings`
    - Purpose:
      - Easier inspection of stored recipes
      - No need to guess recipe IDs for testing
    - Estimated time: ~10–15 minutes
  - [X] **Implement `GET /recipes/{id}`**

    - Return a full recipe object including:
      - recipe metadata
      - ingredient list with quantities
      - instructions
      - source
    - Purpose:
      - Endpoint a frontend would actually display
      - Makes stored recipes inspectable
    - Estimated time: ~30–40 minutes
  - [ ] **Add `cuisine_name` to recipe responses**

    - When returning recipes, include the readable cuisine name instead of just `cuisine_id`
    - Example output:
      ```json
      {
        "id": 1,
        "name": "Chicken Shawarma",
        "cuisine": "Middle Eastern",
        "servings": 3
      }
      ```
    - Purpose:
      - More user-friendly API
      - Matches how a frontend would want the data
