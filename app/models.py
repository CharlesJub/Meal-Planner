from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import declarative_base

from app.database import engine

Base = declarative_base()


class Cuisine(Base):
    __tablename__ = "cuisines"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)


class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    cuisine_id = Column(Integer, ForeignKey("cuisines.id"), nullable=False)
    instructions = Column(Text, nullable=False)
    servings = Column(Integer, nullable=False)
    source = Column(String, nullable=True)


class Ingredient(Base):
    __tablename__ = "ingredients"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    unit = Column(String, nullable=True)
    calories_per_unit = Column(Float, nullable=True)
    protein_per_unit = Column(Float, nullable=True)
    carbs_per_unit = Column(Float, nullable=True)
    fat_per_unit = Column(Float, nullable=True)


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id = Column(Integer, primary_key=True)

    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    ingredient_id = Column(Integer, ForeignKey("ingredients.id"), nullable=False)

    quantity = Column(Float, nullable=True)
    unit = Column(String, nullable=True)


class CuisinePickHistory(Base):
    __tablename__ = "cuisine_pick_history"

    id = Column(Integer, primary_key=True)
    cuisine_id = Column(Integer, ForeignKey("cuisines.id"), nullable=False)
    picked_at = Column(DateTime, default=datetime.utcnow, nullable=False)
