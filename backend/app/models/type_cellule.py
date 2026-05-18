from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.database import Base


class TypeCellule(Base):
    __tablename__ = "types_cellule"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    nom         = Column(String(50), nullable=False, unique=True)
    description = Column(String(200), nullable=True)

    cellules = relationship("Cellule", back_populates="type_cellule_rel")

    def __repr__(self):
        return f"<TypeCellule id={self.id} nom='{self.nom}'>"
