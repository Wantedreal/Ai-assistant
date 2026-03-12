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
    # STEP 1 — Determine P (Parallel) — driven by current constraint
    # Formula: P = ceil(I_target / I_cell_max)
    # ══════════════════════════════════════════════════════════════════════════
    if req.config_mode.value == "auto":
        P = math.ceil(req.courant_cible_a / cell.courant_max_a)

        # ── STEP 2 — Determine S (Series) — driven by energy constraint ──────
        # Formula: S = ceil(E_target_Wh / (V_nom × C_cell_Ah × P))
        energy_wh = req.energie_cible_kwh * 1000.0   # kWh → Wh conversion
        energy_per_parallel_group = cell.tension_nominale * cell.capacite_ah * P
        S = math.ceil(energy_wh / energy_per_parallel_group)

    else:
        # Manual mode: bypass algorithm, use engineer's direct input
        S = req.manual_series or 1
        P = req.manual_parallel or 1

    # Guard against impossible zero values
    S = max(S, 1)
    P = max(P, 1)

    total_cells = S * P

    # ══════════════════════════════════════════════════════════════════════════
    # STEP 3 — Electrical properties
    # ══════════════════════════════════════════════════════════════════════════
    actual_voltage_v   = round(S * cell.tension_nominale, 3)
    actual_capacity_ah = round(P * cell.capacite_ah, 3)
    total_energy_wh    = round(actual_voltage_v * actual_capacity_ah, 2)
    usable_energy_wh   = round(total_energy_wh * (req.depth_of_discharge / 100.0), 2)
    total_weight_kg    = round((total_cells * cell.masse_g) / 1000.0, 3)

    # Energy density (Wh/kg) — useful engineering metric
    energy_density = round(total_energy_wh / total_weight_kg, 2) if total_weight_kg > 0 else 0.0

    # ══════════════════════════════════════════════════════════════════════════
    # STEP 4 — Physical geometry (Array dimensions WITH swelling)
    # Swelling factor applied on L and W axes (confirmed: height axis excluded
    # for pouch cells — to review with technical expert for other geometries)
    # ══════════════════════════════════════════════════════════════════════════

    # taux_swelling_pct is stored as a fraction (0.08 = 8%) in the DB
    # We handle both conventions safely:
    swelling_raw = cell.taux_swelling_pct
    if swelling_raw > 1.0:
        # Value stored as percentage (e.g. 8.0) — convert to fraction
        swelling_factor = 1.0 + (swelling_raw / 100.0)
    else:
        # Value stored as fraction (e.g. 0.08) — use directly
        swelling_factor = 1.0 + swelling_raw

    # ── Raw pack dimensions (no margins, with swelling) ───────────────────────
    # Pouch / Prismatic cell layout:
    #   L_array = S × longueur_cell × swelling   (series direction)
    #   W_array = P × largeur_cell  × swelling   (parallel direction)
    #   H_array = hauteur_cell                   (thickness — no stacking on H)
    cell_type = (cell.type_cellule or "Pouch").lower()

    if cell_type == "cylindrical":
        # Cylindrical: longueur_mm == largeur_mm == diameter (confirmed in real data).
        # hauteur_mm = physical height of the cylinder (65 mm for 18650, etc.)
        # No swelling on cylindrical — rigid metal casing, all cylindrical rows
        # in the dataset have taux_swelling_pct == 0.
        diameter = cell.longueur_mm   # longueur == largeur for cylindrical cells
        L_raw = round(S * diameter, 2)
        W_raw = round(P * diameter, 2)
        H_raw = round(cell.hauteur_mm, 2)

    elif cell_type == "prismatic":
        # Prismatic: rigid rectangular aluminium casing, stacked face-to-face.
        # swelling = 0.03 across all prismatic rows in the real dataset.
        # Series direction → L axis, parallel stacks → W axis.
        L_raw = round(S * cell.longueur_mm * swelling_factor, 2)
        W_raw = round(P * cell.largeur_mm  * swelling_factor, 2)
        H_raw = round(cell.hauteur_mm, 2)

    elif cell_type == "pouch":
        # Pouch: flexible casing, highest swelling (0.08 in real dataset).
        # Same stacking convention as prismatic.
        L_raw = round(S * cell.longueur_mm * swelling_factor, 2)
        W_raw = round(P * cell.largeur_mm  * swelling_factor, 2)
        H_raw = round(cell.hauteur_mm, 2)

    else:
        # Unknown / future type — safe fallback to Pouch behaviour
        L_raw = round(S * cell.longueur_mm * swelling_factor, 2)
        W_raw = round(P * cell.largeur_mm  * swelling_factor, 2)
        H_raw = round(cell.hauteur_mm, 2)

    # ── Final pack dimensions (with margins on all 6 faces) ───────────────────
    margin = req.marge_mm
    L_final = round(L_raw + 2 * margin, 2)
    W_final = round(W_raw + 2 * margin, 2)
    H_final = round(H_raw + 2 * margin, 2)

    # ══════════════════════════════════════════════════════════════════════════
    # STEP 5 — Rule Engine: collision detection (15 mm per face)
    # Condition: D_array_final ≤ D_housing  (margin already included in D_final)
    # ══════════════════════════════════════════════════════════════════════════
    axes = {
        "Longueur (L)": (L_final, req.housing_l),
        "Largeur  (l)": (W_final, req.housing_l_small),   # spec uses housing_l_small
        "Hauteur  (h)": (H_final, req.housing_h),
    }

    violations = []
    for axis_name, (pack_dim, housing_dim) in axes.items():
        if pack_dim > housing_dim:
            overflow = round(pack_dim - housing_dim, 2)
            violations.append(
                f"{axis_name} : dépassement de {overflow} mm "
                f"(pack={pack_dim} mm, boîtier={housing_dim} mm, "
                f"marge={margin} mm × 2)"
            )

    verdict = VerdictEnum.ACCEPT if not violations else VerdictEnum.REJECT
    justification = (
        "Toutes les marges de sécurité sont respectées sur les 3 axes."
        if not violations
        else " | ".join(violations)
    )

    # ── §9.3.2 mandatory derived metrics ─────────────────────────────────────
    energie_reelle_kwh = round(total_energy_wh / 1000.0, 4)   # Wh → kWh (spec unit)
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
            longueur_mm=L_final,
            largeur_mm=W_final,
            hauteur_mm=H_final,
        ),
        verdict=verdict,
        justification=justification,
        energie_reelle_kwh=energie_reelle_kwh,
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
