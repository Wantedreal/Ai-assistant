from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.database import Base


class Fabricant(Base):
    __tablename__ = "fabricants"

    id   = Column(Integer, primary_key=True, autoincrement=True)
    nom  = Column(String(100), nullable=False, unique=True)
    pays = Column(String(50), nullable=True)

    cellules = relationship("Cellule", back_populates="fabricant_rel")

    def __repr__(self):
        return f"<Fabricant id={self.id} nom='{self.nom}'>"
