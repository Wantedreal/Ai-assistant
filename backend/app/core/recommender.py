"""
Phase 3 — Cell Recommender

Runs the sizing engine on every cell and returns:
  - ACCEPT cells ranked by fill ratio descending (best packing first)
  - Near-miss REJECT cells within NEAR_MISS_THRESHOLD_MM of fitting,
    ranked by smallest deficit first

Up to 5 ACCEPT + up to 3 near-miss results are returned.
"""

from app.core.engine import run_engine
from app.schemas.battery import CalculationRequest, VerdictEnum

NEAR_MISS_THRESHOLD_MM = 30.0


def recommend_cells(cells: list, req_base: CalculationRequest) -> list:
    """
    Returns a list of dicts with keys:
      cell, nb_serie, nb_parallele, total_cells, fill_ratio_pct,
      margin_l_mm, margin_w_mm, margin_h_mm, near_miss
    """
    accept  = []
    near    = []

    for cell in cells:
        try:
            calc_req = CalculationRequest(
                cell_id=cell.id,
                courant_cible_a=req_base.courant_cible_a,
                energie_cible_wh=req_base.energie_cible_wh,
                tension_cible_v=req_base.tension_cible_v,
                housing_l=req_base.housing_l,
                housing_l_small=req_base.housing_l_small,
                housing_h=req_base.housing_h,
                marge_mm=req_base.marge_mm,
                cell_gap_mm=req_base.cell_gap_mm,
                depth_of_discharge=req_base.depth_of_discharge,
                config_mode=req_base.config_mode,
                manual_series=req_base.manual_series,
                manual_parallel=req_base.manual_parallel,
                cycles_per_day=req_base.cycles_per_day,
            )
            result = run_engine(calc_req, cell)
        except Exception as exc:
            print(f"[recommender] skipping cell id={cell.id} ({cell.nom}): {exc}")
            continue

        margins = result.marges_reelles
        ml = margins.get('L', 0)
        mw = margins.get('W', 0)
        mh = margins.get('H', 0)

        entry = {
            'cell':           cell,
            'nb_serie':       result.nb_serie,
            'nb_parallele':   result.nb_parallele,
            'total_cells':    result.total_cells,
            'fill_ratio_pct': result.taux_occupation_pct,
            'margin_l_mm':    ml,
            'margin_w_mm':    mw,
            'margin_h_mm':    mh,
            'near_miss':      False,
        }

        if result.verdict == VerdictEnum.ACCEPT:
            accept.append(entry)
        else:
            min_margin = min(ml, mw, mh)
            if min_margin >= -NEAR_MISS_THRESHOLD_MM:
                entry['near_miss'] = True
                near.append((min_margin, entry))

    accept.sort(key=lambda x: x['fill_ratio_pct'], reverse=True)
    near.sort(key=lambda x: x[0], reverse=True)   # least deficit first

    return accept[:5] + [e for _, e in near[:3]]
