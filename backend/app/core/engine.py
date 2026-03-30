"""
core_engine.py
--------------
Deterministic electromechanical sizing engine.
Implements exactly the formulas defined in the project spec (dossier de cadrage §9.4).

Formula order (as per spec):
    1. P = ceil(I_target / I_cell_max)          ← current constraint first
    2. S = ceil(E_target / (V_nom × C × P))     ← energy constraint second
    3. Geometry = S × L_cell × (1 + swelling%)  ← apply swelling
    4. Collision = Geometry + 2×margin ≤ Housing ← 15 mm rule per face

Author: PFE Capgemini Engineering — Battery Pre-Design Assistant
"""

import math
from app.models.cellule import Cellule
from app.schemas.battery import (
    CalculationRequest, CalculationResult,
    ArrayDimensions, ElectricalSummary,
    VerdictEnum, CellRead
)


def run_engine(req: CalculationRequest, cell: Cellule) -> CalculationResult:
    """
    Main engine entry point.
    
    Args:
        req  : Validated CalculationRequest (from Pydantic)
        cell : Cellule ORM object fetched from SQLite

    Returns:
        CalculationResult : Full result payload ready to serialize as JSON
    """

    # ══════════════════════════════════════════════════════════════════════════
    # STEP 1 — Determine P (Parallel)
    # Formula: P = I_target / I_max (rounded up to guarantee meeting target)
    # ══════════════════════════════════════════════════════════════════════════
    if req.config_mode.value == "auto":
        if cell.courant_max_a > 0:
            P = math.ceil(req.courant_cible_a / cell.courant_max_a)
        else:
            P = 1

        # ══════════════════════════════════════════════════════════════════════
        # STEP 2 — Determine S (Series)
        # - From voltage: S_v = V_target / Vn
        # - From energy:  S_e = E / (Vn * P * Cap * DoD)
        # If both are provided, choose the largest S so both targets are met.
        # ══════════════════════════════════════════════════════════════════════
        s_candidates = []

        if req.tension_cible_v is not None:
            if cell.tension_nominale > 0:
                s_candidates.append(math.ceil(req.tension_cible_v / cell.tension_nominale))
            else:
                s_candidates.append(1)

        if req.energie_cible_wh is not None:
            dod_factor = (req.depth_of_discharge / 100.0)
            denominator = cell.tension_nominale * P * cell.capacite_ah * dod_factor
            if denominator > 0:
                s_candidates.append(math.ceil(req.energie_cible_wh / denominator))
            else:
                s_candidates.append(1)

        if not s_candidates:
            raise ValueError("Either energie_cible_wh or tension_cible_v must be provided")

        S = max(s_candidates)

    else:
        # Manual mode: bypass algorithm, use engineer's direct input
        S = req.manual_series or 1
        P = req.manual_parallel or 1

    # Guard against impossible zero values
    S = max(S, 1)
    P = max(P, 1)

    total_cells = S * P

    # ══════════════════════════════════════════════════════════════════════════
    # STEP 3 — Electrical properties and Dimensions Gonflés (Swelling)
    # ══════════════════════════════════════════════════════════════════════════
    actual_voltage_v   = round(S * cell.tension_nominale, 3)
    actual_capacity_ah = round(P * cell.capacite_ah, 3)
    
    # Target Energy formula: N_cellules * Vn * Cap * DoD
    total_energy_wh    = round(total_cells * cell.tension_nominale * cell.capacite_ah, 2)
    usable_energy_wh   = round(total_energy_wh * (req.depth_of_discharge / 100.0), 2)
    total_weight_kg    = round((total_cells * cell.masse_g) / 1000.0, 3)
    energy_density = round(total_energy_wh / total_weight_kg, 2) if total_weight_kg > 0 else 0.0

    # Dimension gonflés = Dim_cellule * (1 + Taux_gonflement/100)
    # DB stores swelling as either decimal fraction (0.08 = 8%) or percentage (8.0 = 8%).
    # Normalise to percentage before applying, using the > 1.0 threshold to distinguish formats.
    swelling_raw = cell.taux_swelling_pct
    swelling_pct = swelling_raw if swelling_raw > 1.0 else swelling_raw * 100.0
    swelling_factor = 1.0 + (swelling_pct / 100.0)

    # Apply dimensions based on cell type geometry
    cell_type = (cell.type_cellule or "Pouch").lower()
    
    if cell_type == "cylindrical":
        diameter = cell.diameter_mm if cell.diameter_mm else cell.longueur_mm
        L_raw = round(S * diameter, 2)
        W_raw = round(P * diameter, 2)
        H_raw = round(cell.hauteur_mm, 2)
        # Cylindrical swelling: radial expansion (diameter increases) and axial (height)
        L_gonfles = round(S * diameter * swelling_factor, 2)
        W_gonfles = round(P * diameter * swelling_factor, 2)
        H_gonfles = round(cell.hauteur_mm * swelling_factor, 2)
    else: # Pouch and Prismatic
        # Cells stand upright: Y = longueur_mm (tall), X = hauteur_mm (thin face), Z = largeur_mm (wide face)
        # Series stacks in X (thin face to thin face), parallel spreads in Z
        L_raw = round(S * cell.hauteur_mm, 2)   # pack depth  (X axis, series cells stacked thin)
        W_raw = round(P * cell.largeur_mm, 2)   # pack width  (Z axis, parallel cells)
        H_raw = round(cell.longueur_mm, 2)      # pack height (Y axis, cell stands upright)
        L_gonfles = round(S * cell.hauteur_mm * swelling_factor, 2)
        W_gonfles = round(P * cell.largeur_mm * swelling_factor, 2)
        H_gonfles = round(cell.longueur_mm, 2)
    
    # Volume calculation based on cell type
    # Cylindrical: V = pi * r^2 * h (true cylinder volume)
    # Prismatic/Pouch: V = l * w * h (rectangular prism volume)
    if cell_type == "cylindrical":
        radius_mm = diameter / 2.0
        vol_per_cell = math.pi * (radius_mm ** 2) * cell.hauteur_mm
    else:
        vol_per_cell = cell.longueur_mm * cell.largeur_mm * cell.hauteur_mm
    
    # Taux d'occupation based on RAW cell volume (before swelling)
    vol_cellules = total_cells * vol_per_cell
    vol_housing = req.housing_l * req.housing_l_small * req.housing_h
    taux_occupation_pct = round((vol_cellules / vol_housing) * 100.0, 2) if vol_housing > 0 else 0.0

    violations = []

    # ══════════════════════════════════════════════════════════════════════════
    # STEP 4 — Target validation (energy / voltage / volume)
    # These checks run even in MANUAL mode (S/P provided by user).
    # ══════════════════════════════════════════════════════════════════════════
    # Business rule: energy and voltage targets are coupled:
    # if one is provided, the other is mandatory, and both must be satisfied.
    if (req.tension_cible_v is None) != (req.energie_cible_wh is None):
        violations.append(
            "Les cibles Energie (energie_cible_wh) et Tension (tension_cible_v) doivent être renseignées ensemble."
        )

    if req.energie_cible_wh is not None:
        if usable_energy_wh + 1e-9 < req.energie_cible_wh:
            violations.append(
                f"Energie cible non atteinte ({usable_energy_wh} Wh < {round(req.energie_cible_wh, 2)} Wh)"
            )

    if req.tension_cible_v is not None:
        if actual_voltage_v + 1e-9 < req.tension_cible_v:
            violations.append(
                f"Tension cible non atteinte ({actual_voltage_v} V < {req.tension_cible_v} V)"
            )

    if req.courant_cible_a is not None:
        actual_current_a = P * cell.courant_max_a
        if actual_current_a + 1e-9 < req.courant_cible_a:
            violations.append(
                f"Courant cible non atteint ({round(actual_current_a, 2)} A < {round(req.courant_cible_a, 2)} A)"
            )

    if vol_housing > 0 and vol_cellules > vol_housing:
        violations.append(
            f"Volume total cellules dépasse le volume pack ({round(vol_cellules, 2)} mm³ > {round(vol_housing, 2)} mm³)"
        )

    # ══════════════════════════════════════════════════════════════════════════
    # STEP 5 — Collision Detection & Margin par cote calculation
    # Margins calculated on RAW dimensions (before swelling) as per spec
    # Formula: Margin par cote = (Dim_housing - Dim_raw) / 2
    # ══════════════════════════════════════════════════════════════════════════
    margin_l = round((req.housing_l - L_raw) / 2.0, 2)
    margin_w = round((req.housing_l_small - W_raw) / 2.0, 2)
    margin_h = round((req.housing_h - H_raw) / 2.0, 2)
    
    marges_reelles = {
        "L": margin_l,
        "W": margin_w,
        "H": margin_h
    }

    # If any margin is smaller than the required safety margin (req.marge_mm), it's a reject
    if margin_l < req.marge_mm:
        violations.append(f"Longueur (L): marge insuffisante ({margin_l} mm < {req.marge_mm} mm)")
    if margin_w < req.marge_mm:
        violations.append(f"Largeur (l): marge insuffisante ({margin_w} mm < {req.marge_mm} mm)")
    if margin_h < req.marge_mm:
        violations.append(f"Hauteur (h): marge insuffisante ({margin_h} mm < {req.marge_mm} mm)")

    verdict = VerdictEnum.ACCEPT if not violations else VerdictEnum.REJECT
    justification = (
        "Toutes les marges de sécurité sont respectées sur les 3 axes."
        if not violations
        else " | ".join(violations)
    )

    # ── §9.3.2 mandatory derived metrics ─────────────────────────────────────
    energie_reelle_wh = round(usable_energy_wh, 2)            # Target Energy (Wh) = s*P * Vn * Cap * DoD
    tension_totale_v   = actual_voltage_v                      # V_nom × S
    courant_total_a    = round(P * cell.courant_max_a, 2)      # I_cell_max × P (spec §9.3.2)


    # ══════════════════════════════════════════════════════════════════════════
    # STEP 6 — Build and return result
    # ══════════════════════════════════════════════════════════════════════════
    return CalculationResult(
        # ── §9.3.2 required fields — spec-exact names ────────────────────────
        nb_serie=S,
        nb_parallele=P,
        dimensions_array=ArrayDimensions(
            longueur_mm=L_gonfles,
            largeur_mm=W_gonfles,
            hauteur_mm=H_gonfles,
        ),
        verdict=verdict,
        justification=justification,
        taux_occupation_pct=taux_occupation_pct,
        marges_reelles=marges_reelles,
        energie_reelle_wh=energie_reelle_wh,
        tension_totale_v=tension_totale_v,
        courant_total_a=courant_total_a,

        # ── Extensions beyond dossier spec ───────────────────────────────────
        total_cells=total_cells,
        dimensions_raw=ArrayDimensions(
            longueur_mm=L_raw,
            largeur_mm=W_raw,
            hauteur_mm=H_raw,
        ),
        electrical=ElectricalSummary(
            actual_voltage_v=actual_voltage_v,
            actual_capacity_ah=actual_capacity_ah,
            total_energy_wh=total_energy_wh,
            usable_energy_wh=usable_energy_wh,
            total_weight_kg=total_weight_kg,
            energy_density_wh_kg=energy_density,
        ),
        validation_errors=violations,
        config_mode=req.config_mode.value,
        cell_used=CellRead.model_validate(cell),
    )
