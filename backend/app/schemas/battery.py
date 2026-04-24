"""
Battery schema models for API validation and responses
"""
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field, model_validator
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

    # Extended fields (nullable)
    fabricant:           Optional[str]   = None
    chimie:              Optional[str]   = None
    cycle_life:          Optional[int]   = None
    dod_reference_pct:   Optional[float] = None
    c_rate_max_discharge: Optional[float] = None
    c_rate_max_charge:   Optional[float] = None
    eol_capacity_pct:    Optional[float] = None
    cutoff_voltage_v:    Optional[float] = None
    temp_min_c:          Optional[float] = None
    temp_max_c:          Optional[float] = None
    temp_max_charge_c:   Optional[float] = None
    v_charge_max:        Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


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

    # Mechanical spacing
    cell_gap_mm: float = Field(default=0.0, ge=0.0, description="Mechanical gap between adjacent cells in mm")

    # Structural components
    end_plate_thickness_mm: float = Field(default=10.0, ge=0.0, description="End plate thickness per side in mm (prismatic only)")

    # Phase 2 — lifetime estimate
    cycles_per_day: float = Field(default=1.0, gt=0, description="Expected full cycles per day (default 1)")

    @model_validator(mode='after')
    def check_manual_fields(self):
        if self.config_mode == ConfigModeEnum.MANUAL:
            if not self.manual_series or not self.manual_parallel:
                raise ValueError(
                    "manual_series and manual_parallel are required when config_mode is 'manual'"
                )
        return self


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
    is_rotated: bool = Field(default=False, description="True if array was rotated 90deg to fit")
    total_cells: int = Field(..., description="Total number of cells")
    dimensions_raw: ArrayDimensions = Field(..., description="Array dimensions without margins")
    electrical: ElectricalSummary = Field(..., description="Extended electrical specs")
    validation_errors: List[str] = Field(default_factory=list, description="List of constraint violations")
    config_mode: str = Field(..., description="Configuration mode used")
    cell_used: CellRead = Field(..., description="Cell specifications used")

    # Phase 2 — C-rate derating (informational only, does not affect verdict)
    c_rate_actual:       Optional[float] = Field(None, description="Actual C-rate per cell")
    c_rate_warning:      Optional[bool]  = Field(None, description="True if C-rate exceeds reliable formula range")
    derating_factor_pct: Optional[float] = Field(None, description="Capacity loss % due to C-rate (negative value)")
    c_effective_ah:      Optional[float] = Field(None, description="Effective capacity per cell after derating")

    # Phase 2 — Lifetime estimation (informational only)
    cycle_life_at_dod:   Optional[int]   = Field(None, description="Cycle life adjusted to operating DoD")
    lifetime_years:      Optional[float] = Field(None, description="Estimated pack lifetime in years")
    lifetime_years_low:  Optional[float] = Field(None, description="Pessimistic lifetime bound (−30%)")
    lifetime_years_high: Optional[float] = Field(None, description="Optimistic lifetime bound (+30%)")

    # Phase 6 — BMS specification (informational)
    bms_v_min_pack:           Optional[float] = Field(None, description="Pack minimum voltage (V)")
    bms_v_max_pack:           Optional[float] = Field(None, description="Pack maximum voltage (V)")
    bms_i_continuous_a:       Optional[float] = Field(None, description="Continuous discharge current (A)")
    bms_i_charge_a:           Optional[float] = Field(None, description="Max charge current (A)")
    bms_i_charge_estimated:   Optional[bool]  = Field(None, description="True if charge current used default 0.5C")
    bms_balance_channels:     Optional[int]   = Field(None, description="Number of balance channels (= S)")
    bms_balance_current_a:    Optional[float] = Field(None, description="Balance current per channel (A)")
    bms_temp_sensors:         Optional[int]   = Field(None, description="Recommended temperature sensor count")
    bms_charge_cutoff_temp_c: Optional[int]   = Field(None, description="Min charge temperature (°C)")
    bms_discharge_cutoff_temp_c: Optional[float] = Field(None, description="Min discharge temperature (°C)")
    bms_suggestion:           Optional[str]   = Field(None, description="Suggested BMS product family")


# ── Phase 3 — Cell Recommender ────────────────────────────────────────────────

class RecommendRequest(BaseModel):
    """Request payload for cell recommendation — same constraints as CalculationRequest, no cell_id"""
    courant_cible_a:    float           = Field(..., gt=0)
    energie_cible_wh:   Optional[float] = Field(None, gt=0)
    tension_cible_v:    Optional[float] = Field(None, gt=0)
    housing_l:          float           = Field(..., gt=0)
    housing_l_small:    float           = Field(..., gt=0)
    housing_h:          float           = Field(..., gt=0)
    marge_mm:           float           = Field(default=15.0, ge=0)
    cell_gap_mm:             float = Field(default=0.0, ge=0)
    end_plate_thickness_mm:  float = Field(default=10.0, ge=0.0)
    depth_of_discharge:      float = Field(default=80.0, ge=1.0, le=100.0)
    config_mode:        ConfigModeEnum  = Field(default=ConfigModeEnum.AUTO)
    manual_series:      Optional[int]   = Field(None, gt=0)
    manual_parallel:    Optional[int]   = Field(None, gt=0)
    cycles_per_day:     float           = Field(default=1.0, gt=0)


class CellMatch(BaseModel):
    cell:           CellRead
    nb_serie:       int
    nb_parallele:   int
    total_cells:    int
    fill_ratio_pct: float
    margin_l_mm:    float
    margin_w_mm:    float
    margin_h_mm:    float
    near_miss:      bool = False  # True if REJECT but within NEAR_MISS_THRESHOLD_MM


class RecommendResult(BaseModel):
    matches: List[CellMatch]


# ── Phase 5 — AI Explainer ────────────────────────────────────────────────────

class ExplainRequest(BaseModel):
    """Payload for the AI chemistry explainer — cell context + result summary."""
    cell_id:              int
    # Constraints
    energie_cible_wh:     Optional[float] = None
    tension_cible_v:      Optional[float] = None
    courant_cible_a:      float
    depth_of_discharge:   float           = 80.0
    cycles_per_day:       float           = 1.0
    # Housing
    housing_l:            Optional[float] = None
    housing_l_small:      Optional[float] = None
    housing_h:            Optional[float] = None
    # Result summary (so the engine is not re-run)
    nb_serie:             int
    nb_parallele:         int
    verdict:              str
    justification:        Optional[str]   = None
    tension_totale_v:     Optional[float] = None
    energie_reelle_wh:    Optional[float] = None
    pack_l_mm:            Optional[float] = None
    pack_w_mm:            Optional[float] = None
    pack_h_mm:            Optional[float] = None
    margin_l_mm:          Optional[float] = None
    margin_w_mm:          Optional[float] = None
    margin_h_mm:          Optional[float] = None
    lifetime_years:       Optional[float] = None
    c_rate_actual:        Optional[float] = None
    derating_factor_pct:  Optional[float] = None
    c_rate_warning:       Optional[bool]  = None


class ExplainResponse(BaseModel):
    explanation: str
