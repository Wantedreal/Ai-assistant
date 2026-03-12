"""Application configuration settings"""
import os
from pathlib import Path

# Database URL
DATABASE_URL = "sqlite:///./battery_cells.db"

# Project paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DB_DIR = BASE_DIR / "data"
DB_DIR.mkdir(exist_ok=True)

# Absolute path to SQLite database
DATABASE_PATH = DB_DIR / "battery_cells.db"
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

class Settings:
    """Application settings"""
    DATABASE_URL: str = DATABASE_URL
    DEBUG: bool = True
    APP_NAME: str = "Battery Cell API"
    VERSION: str = "1.0.0"

settings = Settings()
