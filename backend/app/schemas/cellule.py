"""Pydantic schemas for API validation"""
from pydantic import BaseModel, Field
from typing import Optional


class CelluleBase(BaseModel):
    """Base schema for battery cell data"""
    nom: str = Field(..., min_length=1, max_length=100)
    longueur_mm: float = Field(..., gt=0)
    largeur_mm: float = Field(..., gt=0)
    hauteur_mm: float = Field(..., gt=0)
    masse_g: float = Field(..., gt=0)
    tension_nominale: float = Field(..., gt=0)
    capacite_ah: float = Field(..., gt=0)
    courant_max_a: float = Field(..., gt=0)
    type_cellule: str = Field(default="Pouch", max_length=50)
    taux_swelling_pct: float = Field(default=0.08, ge=0)


class CelluleCreate(CelluleBase):
    """Schema for creating a battery cell"""
    pass


class CelluleUpdate(BaseModel):
    """Schema for updating a battery cell"""
    nom: Optional[str] = None
    longueur_mm: Optional[float] = None
    largeur_mm: Optional[float] = None
    hauteur_mm: Optional[float] = None
    masse_g: Optional[float] = None
    tension_nominale: Optional[float] = None
    capacite_ah: Optional[float] = None
    courant_max_a: Optional[float] = None
    type_cellule: Optional[str] = None
    taux_swelling_pct: Optional[float] = None


class CelluleResponse(CelluleBase):
    """Schema for API response"""
    id: int

    class Config:
        from_attributes = True
