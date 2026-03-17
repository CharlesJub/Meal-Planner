import sqlite3
from pathlib import Path

from app.database import engine
from app.models import Base


def init_database():
    Base.metadata.create_all(bind=engine)
    _ensure_nullable_ingredient_fields()


def _ensure_nullable_ingredient_fields():
    if engine.url.get_backend_name() != "sqlite":
        return

    database_path = engine.url.database
    if not database_path:
        return

    db_file = Path(database_path)
    if not db_file.is_absolute():
        db_file = (Path.cwd() / db_file).resolve()

    if not db_file.exists():
        return

    with sqlite3.connect(db_file) as conn:
        if not _requires_nullable_migration(conn):
            return

        conn.execute("PRAGMA foreign_keys = OFF")

        conn.execute(
            """
            CREATE TABLE ingredients_new (
                id INTEGER PRIMARY KEY,
                name VARCHAR NOT NULL UNIQUE,
                unit VARCHAR,
                calories_per_unit FLOAT,
                protein_per_unit FLOAT,
                carbs_per_unit FLOAT,
                fat_per_unit FLOAT
            )
            """
        )
        conn.execute(
            """
            INSERT INTO ingredients_new (
                id, name, unit, calories_per_unit, protein_per_unit, carbs_per_unit, fat_per_unit
            )
            SELECT
                id, name, NULLIF(unit, ''), calories_per_unit, protein_per_unit, carbs_per_unit, fat_per_unit
            FROM ingredients
            """
        )
        conn.execute("DROP TABLE ingredients")
        conn.execute("ALTER TABLE ingredients_new RENAME TO ingredients")

        conn.execute(
            """
            CREATE TABLE recipe_ingredients_new (
                id INTEGER PRIMARY KEY,
                recipe_id INTEGER NOT NULL,
                ingredient_id INTEGER NOT NULL,
                quantity FLOAT,
                unit VARCHAR,
                FOREIGN KEY(recipe_id) REFERENCES recipes (id),
                FOREIGN KEY(ingredient_id) REFERENCES ingredients (id)
            )
            """
        )
        conn.execute(
            """
            INSERT INTO recipe_ingredients_new (id, recipe_id, ingredient_id, quantity, unit)
            SELECT id, recipe_id, ingredient_id, quantity, NULLIF(unit, '')
            FROM recipe_ingredients
            """
        )
        conn.execute("DROP TABLE recipe_ingredients")
        conn.execute("ALTER TABLE recipe_ingredients_new RENAME TO recipe_ingredients")

        conn.execute("PRAGMA foreign_keys = ON")
        conn.commit()


def _requires_nullable_migration(conn: sqlite3.Connection) -> bool:
    ingredient_columns = {
        row[1]: row[3] for row in conn.execute("PRAGMA table_info(ingredients)")
    }
    recipe_ingredient_columns = {
        row[1]: row[3] for row in conn.execute("PRAGMA table_info(recipe_ingredients)")
    }

    return any(
        (
            ingredient_columns.get("unit") == 1,
            recipe_ingredient_columns.get("quantity") == 1,
            recipe_ingredient_columns.get("unit") == 1,
        )
    )
