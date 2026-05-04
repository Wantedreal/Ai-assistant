"""Database configuration and session management"""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# Create SQLite engine
engine = create_engine(
    settings.DATABASE_URL, 
    connect_args={"check_same_thread": False}
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create declarative base for ORM models
Base = declarative_base()

def get_db():
    """Dependency for getting database session in FastAPI routes"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize database — create all tables and apply safe column migrations."""
    Base.metadata.create_all(bind=engine)
    _migrate_schema()


def _migrate_schema():
    """Add new columns to existing databases without dropping data."""
    with engine.connect() as conn:
        for col, col_type in [('prix_usd', 'REAL')]:
            try:
                conn.execute(text(f'SELECT {col} FROM cellules LIMIT 0'))
            except Exception:
                conn.execute(text(f'ALTER TABLE cellules ADD COLUMN {col} {col_type}'))
                conn.commit()
        _migrate_history_autoincrement(conn)


def _migrate_history_autoincrement(conn):
    """Recreate calculation_history with AUTOINCREMENT so deleted IDs are never reused."""
    # Check if table exists at all
    tbl = conn.execute(text(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='calculation_history'"
    )).scalar()
    if not tbl:
        return  # Will be created fresh by create_all with AUTOINCREMENT
    if 'AUTOINCREMENT' in tbl.upper():
        return  # Already correct

    # Recreate with AUTOINCREMENT, preserving all existing rows
    conn.execute(text("""
        CREATE TABLE calculation_history_new (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp    DATETIME NOT NULL,
            cell_id      INTEGER NOT NULL,
            cell_nom     VARCHAR(100) NOT NULL,
            cell_type    VARCHAR(50),
            nb_serie     INTEGER NOT NULL,
            nb_parallele INTEGER NOT NULL,
            verdict      VARCHAR(10) NOT NULL,
            fill_pct     FLOAT,
            energy_wh    FLOAT,
            lifetime_yr  FLOAT,
            payload_json TEXT NOT NULL,
            result_json  TEXT NOT NULL
        )
    """))
    conn.execute(text(
        "INSERT INTO calculation_history_new SELECT * FROM calculation_history"
    ))
    max_id = conn.execute(text(
        "SELECT COALESCE(MAX(id), 0) FROM calculation_history"
    )).scalar()
    conn.execute(text("DROP TABLE calculation_history"))
    conn.execute(text(
        "ALTER TABLE calculation_history_new RENAME TO calculation_history"
    ))
    # Ensure sqlite_sequence reflects the true max so new rows never reuse a past ID
    conn.execute(text(
        "INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('calculation_history', :m)"
    ), {"m": max_id})
    conn.commit()
