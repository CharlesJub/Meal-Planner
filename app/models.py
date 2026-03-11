from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import declarative_base

from app.database import engine

Base = declarative_base()


class Cuisine(Base):
    __tablename__ = "cuisines"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
