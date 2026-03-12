# 2026-03-10

```plaintext
Small table → ORDER BY RANDOM()
Large table → smarter random selection
```

For long Gen AI chats it is helpful to ask for a Dr. Labarr "where we've been, where we're at, where we're going" just to re-center and make sure you are working towards what you want to.

When I was first learning coding, I would look at other people's work and replicate it. I have tried to replicate that process with GenAI and I think it has been a good way to learn backend. Somethings are just given to you though, unsure of how to balance some generated 'examples' being the exact code being asked for.


### 1. Data modeling first makes everything easier

Starting with the relational model (`cuisines`, `recipes`, `ingredients`, `recipe_ingredients`) clarified the entire system. Once the structure was correct, the API endpoints mostly became a translation layer between request data and database operations.

---

### 2. Separate layers early (API, validation, database)

Using:

* **FastAPI routes** (`main.py`)
* **Pydantic schemas** (`schemas.py`)
* **SQLAlchemy models** (`models.py`)

kept responsibilities clear. Schemas validate inputs, models represent tables, and endpoints handle the business logic.

---

### 3. One user action = one database transaction

For recipe submission, everything happens in one transaction:

<pre class="overflow-visible! px-0!" data-start="772" data-end="859"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute end-1.5 top-1 z-2 md:end-2 md:top-1"></div><div class="pe-11 pt-3"><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼk ͼy"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>create recipe</span><br/><span>create/find ingredients</span><br/><span>create recipe_ingredient rows</span><br/><span>commit once</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

If anything fails, rollback prevents partial data from being written.

---

### 4. `flush()` is how you get IDs before commit

SQLAlchemy does not populate DB-generated IDs until the insert happens.

`db.flush()` sends the insert to the DB so the ID becomes available while the transaction is still open.

This lets you create dependent rows like `recipe_ingredients`.

---

### 5. Avoid the N+1 query pattern

Instead of querying each ingredient individually:

<pre class="overflow-visible! px-0!" data-start="1326" data-end="1391"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute end-1.5 top-1 z-2 md:end-2 md:top-1"></div><div class="pe-11 pt-3"><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼk ͼy"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>recipe_ingredients → ingredient → ingredient → ingredient</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

batch-load them once:

<pre class="overflow-visible! px-0!" data-start="1416" data-end="1523"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute end-1.5 top-1 z-2 md:end-2 md:top-1"></div><div class="pe-11 pt-3"><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼk ͼy"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>load recipe_ingredients</span><br/><span>collect ingredient_ids</span><br/><span>query ingredients WHERE id IN (...)</span><br/><span>build lookup map</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

This reduces database calls and scales better.
