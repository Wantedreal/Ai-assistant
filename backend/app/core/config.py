"""Application configuration settings"""
import sys
from pathlib import Path

# When running as a PyInstaller bundle, __file__ inside a PYZ archive is not
# a real filesystem path. sys._MEIPASS is the reliable root for bundled data.
if getattr(sys, 'frozen', False):
    _BASE = Path(sys._MEIPASS)
else:
    _BASE = Path(__file__).resolve().parent.parent.parent

DB_DIR = _BASE / "data"
DATABASE_PATH = DB_DIR / "battery_cells.db"
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"


class Settings:
    """Application settings"""
    DATABASE_URL: str = DATABASE_URL
    DEBUG: bool = False
    APP_NAME: str = "Battery Cell API"
    VERSION: str = "1.0.0"


settings = Settings()
