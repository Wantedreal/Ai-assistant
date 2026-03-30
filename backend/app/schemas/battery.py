"""
Battery schema models for API validation and responses
"""
from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional, List


class VerdictEnum(str, Enum):
    """Calculation verdict"""
    ACCEPT = "ACCEPT"
    REJECT = "REJECT"


class ConfigModeEnum(str, Enum):
    """Configuration mode"""
    AUTO = "auto"
    MANUAL = "manual"


class ArrayDimensions(BaseModel):
    """Physical dimensions of the battery array"""
    longueur_mm: float = Field(..., gt=0, description="Length in mm")
    largeur_mm: float = Field(..., gt=0, description="Width in mm")
    hauteur_mm: float = Field(..., gt=0, description="Height in mm")


class ElectricalSummary(BaseModel):
    """Electrical specifications of the pack"""
    actual_voltage_v: float = Field(..., gt=0, description="Actual voltage in V")
    actual_capacity_ah: float = Field(..., gt=0, description="Actual capacity in Ah")
    total_energy_wh: float = Field(..., gt=0, description="Total energy in Wh")
    usable_energy_wh: float = Field(..., gt=0, description="Usable energy in Wh (with DoD)")
    total_weight_kg: float = Field(..., gt=0, description="Total weight in kg")
    energy_density_wh_kg: float = Field(..., ge=0, description="Energy density in Wh/kg")


class CellRead(BaseModel):
    """Cell information response"""
    id: int
    nom: str
    longueur_mm: float
    largeur_mm: float
    hauteur_mm: float
    diameter_mm: Optional[float] = None
    masse_g: float
    tension_nominale: float
    capacite_ah: float
    courant_max_a: float
    type_cellule: str
    taux_swelling_pct: float

    class Config:
        from_attributes = True


class CalculationRequest(BaseModel):
    """Request payload for battery pack calculation"""
    cell_id: int = Field(..., gt=0, description="Cell ID from catalogue")
    
    # Target specifications
    energie_cible_wh: Optional[float] = Field(None, gt=0, description="Target energy in Wh. Used if tension_cible_v is not provided.")
    tension_cible_v: Optional[float] = Field(None, gt=0, description="Target voltage in V. Can be used instead of energy.")
    courant_cible_a: float = Field(..., gt=0, description="Target current in A")
    
    # Housing constraints
    housing_l: float = Field(..., gt=0, description="Housing length in mm")
    housing_l_small: float = Field(..., gt=0, description="Housing width in mm")
    housing_h: float = Field(..., gt=0, description="Housing height in mm")
    
    # Safety parameters
    marge_mm: float = Field(default=15.0, ge=0, description="Security margin per face in mm")
    depth_of_discharge: float = Field(default=80.0, ge=1.0, le=100.0, description="DoD percentage")
    
    # Configuration mode
    config_mode: ConfigModeEnum = Field(default=ConfigModeEnum.AUTO, description="Auto or Manual mode")
    
    # Manual mode (if config_mode == manual)
    manual_series: Optional[int] = Field(None, gt=0, description="Manual series count")
    manual_parallel: Optional[int] = Field(None, gt=0, description="Manual parallel count")


class CalculationResult(BaseModel):
    """Response payload from calculation engine"""
    # ── §9.3.2 required fields from spec ──────────────────────────────────
    nb_serie: int = Field(..., description="Series count")
    nb_parallele: int = Field(..., description="Parallel count")
    
    dimensions_array: ArrayDimensions = Field(..., description="Final array dimensions with margins")
    
    verdict: VerdictEnum = Field(..., description="ACCEPT or REJECT")
    justification: str = Field(..., description="Verdict explanation")
    
    taux_occupation_pct: float = Field(..., description="Current pack volume ratio against housing")
    marges_reelles: dict = Field(..., description="Real calculated margins in mm {L, W, H}")
    
    energie_reelle_wh: float = Field(..., description="Real energy in Wh")
    tension_totale_v: float = Field(..., description="Total voltage in V")
    courant_total_a: float = Field(..., description="Total current in A")
    
    # ── Extensions beyond spec ────────────────────────────────────────────
    total_cells: int = Field(..., description="Total number of cells")
    dimensions_raw: ArrayDimensions = Field(..., description="Array dimensions without margins")
    electrical: ElectricalSummary = Field(..., description="Extended electrical specs")
    validation_errors: List[str] = Field(default_factory=list, description="List of constraint violations")
    config_mode: str = Field(..., description="Configuration mode used")
    cell_used: CellRead = Field(..., description="Cell specifications used")
