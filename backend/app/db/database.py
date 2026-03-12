"""Database configuration and session management"""
from sqlalchemy import create_engine
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
    """Initialize database - create all tables"""
    Base.metadata.create_all(bind=engine)
