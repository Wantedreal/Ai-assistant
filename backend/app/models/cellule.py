"""SQLAlchemy ORM model for battery cells"""
from sqlalchemy import Column, Integer, String, Float
from app.db.database import Base


class Cellule(Base):
    __tablename__ = "cellules"

    id                = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nom               = Column(String(100), nullable=False)

    # Physical dimensions (mm)
    longueur_mm       = Column(Float, nullable=False)
    largeur_mm        = Column(Float, nullable=False)
    hauteur_mm        = Column(Float, nullable=False)

    # Mass
    masse_g           = Column(Float, nullable=False)

    # Electrical specifications
    tension_nominale  = Column(Float, nullable=False)
    capacite_ah       = Column(Float, nullable=False)
    courant_max_a     = Column(Float, nullable=False)

    # Geometry & safety
    type_cellule      = Column(String(50), nullable=False, default="Pouch")
    taux_swelling_pct = Column(Float, nullable=False, default=8.0)  # stored as percentage (e.g. 8.0 = 8%)
    diameter_mm       = Column(Float, nullable=True)

    # Extended cell data (all nullable)
    fabricant            = Column(String(100), nullable=True)   # manufacturer name
    chimie               = Column(String(20),  nullable=True)   # NMC, LFP, NCA, LTO, LCO
    cycle_life           = Column(Integer,     nullable=True)   # rated cycles to 80% capacity
    dod_reference_pct    = Column(Float,       nullable=True)   # DoD at which cycle_life is rated (0–100)
    c_rate_max_discharge = Column(Float,       nullable=True)   # max continuous discharge C-rate
    c_rate_max_charge    = Column(Float,       nullable=True)   # max continuous charge C-rate
    eol_capacity_pct     = Column(Float,       nullable=True)   # capacity at end-of-life (%)
    cutoff_voltage_v     = Column(Float,       nullable=True)   # discharge cutoff voltage (V)
    temp_min_c           = Column(Float,       nullable=True)   # min discharge temperature (°C)
    temp_max_c           = Column(Float,       nullable=True)   # max discharge temperature (°C)
    temp_max_charge_c    = Column(Float,       nullable=True)   # max charge temperature (°C)
    v_charge_max         = Column(Float,       nullable=True)   # charge cutoff voltage (V)

    def __repr__(self) -> str:
        return (
            f"<Cellule id={self.id} nom='{self.nom}' "
            f"{self.longueur_mm}x{self.largeur_mm}x{self.hauteur_mm}mm "
            f"{self.tension_nominale}V {self.capacite_ah}Ah>"
        )
