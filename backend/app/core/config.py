"""Application configuration settings"""
import os
import shutil
import sys
from pathlib import Path

if getattr(sys, 'frozen', False):
    # Persistent user-writable location — survives app restarts and reinstalls.
    # Electron sets BATTERY_PACK_USER_DATA to app.getPath('userData') before spawning us.
    # Fallback: %APPDATA%\Battery Pack Designer (same path Electron uses on Windows).
    _user_data = (
        os.environ.get('BATTERY_PACK_USER_DATA')
        or os.path.join(
            os.environ.get('APPDATA', os.path.expanduser('~')),
            'Battery Pack Designer',
        )
    )
    DB_DIR = Path(_user_data) / 'data'
    DB_DIR.mkdir(parents=True, exist_ok=True)

    DATABASE_PATH = DB_DIR / 'battery_cells.db'

    # Seed the DB from the bundle on first install (never overwrite an existing DB).
    _seed = Path(sys._MEIPASS) / 'data' / 'battery_cells.db'
    if not DATABASE_PATH.exists() and _seed.exists():
        shutil.copy2(_seed, DATABASE_PATH)
else:
    _BASE = Path(__file__).resolve().parent.parent.parent
    DB_DIR = _BASE / 'data'
    DATABASE_PATH = DB_DIR / 'battery_cells.db'

DATABASE_URL = f'sqlite:///{DATABASE_PATH}'


class Settings:
    """Application settings"""
    DATABASE_URL: str = DATABASE_URL
    DEBUG: bool = False
    APP_NAME: str = 'Battery Cell API'
    VERSION: str = '1.0.0'


settings = Settings()
