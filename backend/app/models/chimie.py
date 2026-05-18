from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.database import Base


class Chimie(Base):
    __tablename__ = "chimies"

    id  = Column(Integer, primary_key=True, autoincrement=True)
    nom = Column(String(20), nullable=False, unique=True)

    cellules = relationship("Cellule", back_populates="chimie_rel")

    def __repr__(self):
        return f"<Chimie id={self.id} nom='{self.nom}'>"
