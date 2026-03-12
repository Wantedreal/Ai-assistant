"""SQLAlchemy ORM model for battery cells"""
from sqlalchemy import Column, Integer, String, Float
from app.db.database import Base


class Cellule(Base):
    """
    ORM model for the `cellules` table.
    Matches the database schema with all battery cell specifications.
    
    Columns:
      - id: Primary key (auto-increment)
      - nom: Product name/reference (e.g., "INR18650-35E")
      - longueur_mm: Length in millimeters
      - largeur_mm: Width in millimeters
      - hauteur_mm: Height/thickness in millimeters
      - masse_g: Mass in grams
      - tension_nominale: Nominal voltage in Volts
      - capacite_ah: Capacity in Amperes-hour
      - courant_max_a: Maximum discharge current in Amperes
      - type_cellule: Cell format (Pouch, Cylindrical, Prismatic)
      - taux_swelling_pct: Swelling rate percentage
    """
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
    taux_swelling_pct = Column(Float, nullable=False, default=0.08)

    def __repr__(self) -> str:
        return (
            f"<Cellule id={self.id} nom='{self.nom}' "
            f"{self.longueur_mm}×{self.largeur_mm}×{self.hauteur_mm}mm "
            f"{self.tension_nominale}V {self.capacite_ah}Ah>"
        )
