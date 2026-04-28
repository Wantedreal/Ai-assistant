"""SQLAlchemy ORM model for calculation history"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from app.db.database import Base


class CalculationHistory(Base):
    __tablename__ = "calculation_history"

    id           = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp    = Column(DateTime, nullable=False, default=datetime.utcnow)
    cell_id      = Column(Integer, nullable=False)
    cell_nom     = Column(String(100), nullable=False)
    cell_type    = Column(String(50), nullable=True)
    nb_serie     = Column(Integer, nullable=False)
    nb_parallele = Column(Integer, nullable=False)
    verdict      = Column(String(10), nullable=False)
    fill_pct     = Column(Float, nullable=True)
    energy_wh    = Column(Float, nullable=True)
    lifetime_yr  = Column(Float, nullable=True)
    payload_json = Column(Text, nullable=False)
    result_json  = Column(Text, nullable=False)
