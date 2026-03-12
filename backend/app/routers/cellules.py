"""API endpoints for battery cells"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.models.cellule import Cellule
from app.schemas.cellule import CelluleResponse, CelluleCreate

router = APIRouter(prefix="/api/cellules", tags=["cellules"])


@router.get("/", response_model=List[CelluleResponse])
def list_cellules(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all battery cells with pagination"""
    cellules = db.query(Cellule).offset(skip).limit(limit).all()
    return cellules


@router.get("/{cellule_id}", response_model=CelluleResponse)
def get_cellule(cellule_id: int, db: Session = Depends(get_db)):
    """Get a specific battery cell by ID"""
    cellule = db.query(Cellule).filter(Cellule.id == cellule_id).first()
    if not cellule:
        raise HTTPException(status_code=404, detail="Cell not found")
    return cellule


@router.post("/", response_model=CelluleResponse)
def create_cellule(cellule: CelluleCreate, db: Session = Depends(get_db)):
    """Create a new battery cell"""
    db_cellule = Cellule(**cellule.dict())
    db.add(db_cellule)
    db.commit()
    db.refresh(db_cellule)
    return db_cellule


@router.get("/stats/count")
def get_cellule_count(db: Session = Depends(get_db)):
    """Get total count of cells in database"""
    count = db.query(Cellule).count()
    return {"total_cells": count}


@router.get("/type/{type_cellule}", response_model=List[CelluleResponse])
def get_cellules_by_type(type_cellule: str, db: Session = Depends(get_db)):
    """Get all cells of a specific type (Pouch, Cylindrical, Prismatic)"""
    cellules = db.query(Cellule).filter(Cellule.type_cellule == type_cellule).all()
    return cellules
