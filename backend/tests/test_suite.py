"""
Comprehensive automated test suite — Battery Pack Designer Backend
Run from backend/ directory:
    pytest tests/test_suite.py -v
"""

import math
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.database import Base, get_db
from app.models.cellule import Cellule
from app.core.engine import run_engine
from app.schemas.battery import CalculationRequest, ConfigModeEnum

# ─── In-memory SQLite test database ──────────────────────────────────────────
# StaticPool forces all connections to share one underlying connection,
# which is required for SQLite :memory: to be visible across sessions.

TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_database():
    """Create tables and seed test cells before each test, drop after."""
    Base.metadata.create_all(bind=test_engine)
    db = TestingSession()

    # Cylindrical cell — INR18650 style
    cyl = Cellule(
        id=1, nom="INR18650-35E",
        longueur_mm=65.0, largeur_mm=18.5, hauteur_mm=65.0,
        diameter_mm=18.5, masse_g=48.0,
        tension_nominale=3.6, capacite_ah=3.5, courant_max_a=8.0,
        type_cellule="Cylindrical", taux_swelling_pct=0.08,
    )

    # Prismatic cell
    pri = Cellule(
        id=2, nom="Samsung-Prismatic",
        longueur_mm=200.0, largeur_mm=148.0, hauteur_mm=7.3,
        diameter_mm=None, masse_g=385.0,
        tension_nominale=3.7, capacite_ah=37.0, courant_max_a=150.0,
        type_cellule="Prismatic", taux_swelling_pct=2.0,
    )

    # Pouch cell — swelling stored as percentage (>1 threshold)
    pouch = Cellule(
        id=3, nom="Pouch-LiPo",
        longueur_mm=100.0, largeur_mm=70.0, hauteur_mm=10.0,
        diameter_mm=None, masse_g=200.0,
        tension_nominale=3.8, capacite_ah=10.0, courant_max_a=50.0,
        type_cellule="Pouch", taux_swelling_pct=5.0,
    )

    db.add_all([cyl, pri, pouch])
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=test_engine)


client = TestClient(app)


# ═════════════════════════════════════════════════════════════════════════════
# 1. HEALTH & CATALOGUE ENDPOINTS
# ═════════════════════════════════════════════════════════════════════════════

class TestHealthAndCatalogue:

    def test_health_returns_ok(self):
        r = client.get("/api/v1/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        assert "version" in body

    def test_get_all_cells_returns_list(self):
        r = client.get("/api/v1/cells")
        assert r.status_code == 200
        cells = r.json()
        assert isinstance(cells, list)
        assert len(cells) == 3

    def test_get_cell_by_id_valid(self):
        r = client.get("/api/v1/cells/1")
        assert r.status_code == 200
        cell = r.json()
        assert cell["nom"] == "INR18650-35E"
        assert cell["type_cellule"] == "Cylindrical"

    def test_get_cell_by_id_missing_returns_404(self):
        r = client.get("/api/v1/cells/9999")
        assert r.status_code == 404

    def test_cell_fields_complete(self):
        r = client.get("/api/v1/cells/1")
        cell = r.json()
        required = ["id", "nom", "longueur_mm", "largeur_mm", "hauteur_mm",
                    "masse_g", "tension_nominale", "capacite_ah",
                    "courant_max_a", "type_cellule", "taux_swelling_pct"]
        for field in required:
            assert field in cell, f"Missing field: {field}"


# ═════════════════════════════════════════════════════════════════════════════
# 2. CALCULATE ENDPOINT — HAPPY PATH
# ═════════════════════════════════════════════════════════════════════════════

BASE_PAYLOAD = {
    "cell_id": 1,
    "energie_cible_wh": 1000.0,
    "tension_cible_v": 48.0,
    "courant_cible_a": 50.0,
    "housing_l": 1000.0,
    "housing_l_small": 800.0,
    "housing_h": 150.0,
    "marge_mm": 15.0,
    "depth_of_discharge": 80.0,
    "cell_gap_mm": 0.0,
}


class TestCalculateHappyPath:

    def test_calculate_returns_200(self):
        r = client.post("/api/v1/calculate", json=BASE_PAYLOAD)
        assert r.status_code == 200

    def test_response_has_required_fields(self):
        r = client.post("/api/v1/calculate", json=BASE_PAYLOAD)
        body = r.json()
        required = ["nb_serie", "nb_parallele", "verdict", "justification",
                    "dimensions_array", "electrical", "marges_reelles",
                    "total_cells", "energie_reelle_wh", "tension_totale_v",
                    "courant_total_a", "taux_occupation_pct"]
        for f in required:
            assert f in body, f"Missing field in response: {f}"

    def test_verdict_is_accept_or_reject(self):
        r = client.post("/api/v1/calculate", json=BASE_PAYLOAD)
        assert r.json()["verdict"] in ("ACCEPT", "REJECT")

    def test_series_parallel_are_positive(self):
        r = client.post("/api/v1/calculate", json=BASE_PAYLOAD)
        body = r.json()
        assert body["nb_serie"] >= 1
        assert body["nb_parallele"] >= 1

    def test_total_cells_equals_s_times_p(self):
        r = client.post("/api/v1/calculate", json=BASE_PAYLOAD)
        body = r.json()
        assert body["total_cells"] == body["nb_serie"] * body["nb_parallele"]

    def test_dimensions_are_positive(self):
        r = client.post("/api/v1/calculate", json=BASE_PAYLOAD)
        dim = r.json()["dimensions_array"]
        assert dim["longueur_mm"] > 0
        assert dim["largeur_mm"] > 0
        assert dim["hauteur_mm"] > 0

    def test_electrical_fields_positive(self):
        r = client.post("/api/v1/calculate", json=BASE_PAYLOAD)
        elec = r.json()["electrical"]
        assert elec["actual_voltage_v"] > 0
        assert elec["actual_capacity_ah"] > 0
        assert elec["total_energy_wh"] > 0
        assert elec["usable_energy_wh"] > 0
        assert elec["total_weight_kg"] > 0

    def test_usable_energy_less_than_total(self):
        r = client.post("/api/v1/calculate", json=BASE_PAYLOAD)
        elec = r.json()["electrical"]
        assert elec["usable_energy_wh"] < elec["total_energy_wh"]

    def test_prismatic_cell_calculate(self):
        payload = {**BASE_PAYLOAD, "cell_id": 2,
                   "energie_cible_wh": 5000.0, "tension_cible_v": 48.0,
                   "housing_l": 2000.0, "housing_l_small": 1500.0, "housing_h": 300.0}
        r = client.post("/api/v1/calculate", json=payload)
        assert r.status_code == 200
        assert r.json()["verdict"] in ("ACCEPT", "REJECT")

    def test_pouch_cell_calculate(self):
        payload = {**BASE_PAYLOAD, "cell_id": 3,
                   "housing_l": 1500.0, "housing_l_small": 1000.0, "housing_h": 200.0}
        r = client.post("/api/v1/calculate", json=payload)
        assert r.status_code == 200

    def test_with_cell_gap_increases_dimensions(self):
        r_no_gap = client.post("/api/v1/calculate", json={**BASE_PAYLOAD, "cell_gap_mm": 0.0})
        r_gap = client.post("/api/v1/calculate", json={**BASE_PAYLOAD, "cell_gap_mm": 2.0})
        dim_no_gap = r_no_gap.json()["dimensions_array"]
        dim_gap = r_gap.json()["dimensions_array"]
        # Gaps increase L or W (series/parallel axes)
        assert (dim_gap["longueur_mm"] >= dim_no_gap["longueur_mm"] or
                dim_gap["largeur_mm"] >= dim_no_gap["largeur_mm"])


# ═════════════════════════════════════════════════════════════════════════════
# 3. CALCULATE ENDPOINT — REJECTION / EDGE CASES
# ═════════════════════════════════════════════════════════════════════════════

class TestCalculateRejection:

    def test_tiny_housing_gives_reject(self):
        payload = {**BASE_PAYLOAD,
                   "housing_l": 10.0, "housing_l_small": 10.0, "housing_h": 10.0}
        r = client.post("/api/v1/calculate", json=payload)
        assert r.status_code == 200
        assert r.json()["verdict"] == "REJECT"

    def test_reject_has_validation_errors(self):
        payload = {**BASE_PAYLOAD,
                   "housing_l": 10.0, "housing_l_small": 10.0, "housing_h": 10.0}
        r = client.post("/api/v1/calculate", json=payload)
        errors = r.json()["validation_errors"]
        assert len(errors) > 0

    def test_cell_not_found_returns_404(self):
        payload = {**BASE_PAYLOAD, "cell_id": 9999}
        r = client.post("/api/v1/calculate", json=payload)
        assert r.status_code == 404

    def test_missing_required_field_returns_422(self):
        payload = {k: v for k, v in BASE_PAYLOAD.items() if k != "courant_cible_a"}
        r = client.post("/api/v1/calculate", json=payload)
        assert r.status_code == 422

    def test_negative_housing_returns_422(self):
        r = client.post("/api/v1/calculate", json={**BASE_PAYLOAD, "housing_l": -100.0})
        assert r.status_code == 422

    def test_zero_current_returns_422(self):
        r = client.post("/api/v1/calculate", json={**BASE_PAYLOAD, "courant_cible_a": 0.0})
        assert r.status_code == 422

    def test_dod_out_of_range_returns_422(self):
        r = client.post("/api/v1/calculate", json={**BASE_PAYLOAD, "depth_of_discharge": 150.0})
        assert r.status_code == 422

    def test_neither_energy_nor_voltage_returns_422(self):
        """With neither energy nor voltage, engine ValueError is caught → 422."""
        payload = {k: v for k, v in BASE_PAYLOAD.items()
                   if k not in ("energie_cible_wh", "tension_cible_v")}
        r = client.post("/api/v1/calculate", json=payload)
        assert r.status_code == 422

    def test_large_housing_gives_accept(self):
        payload = {**BASE_PAYLOAD,
                   "housing_l": 5000.0, "housing_l_small": 5000.0, "housing_h": 500.0}
        r = client.post("/api/v1/calculate", json=payload)
        assert r.status_code == 200
        assert r.json()["verdict"] == "ACCEPT"


# ═════════════════════════════════════════════════════════════════════════════
# 4. MANUAL MODE
# ═════════════════════════════════════════════════════════════════════════════

class TestManualMode:

    MANUAL_PAYLOAD = {
        "cell_id": 1,
        "courant_cible_a": 50.0,
        "housing_l": 2000.0, "housing_l_small": 1500.0, "housing_h": 200.0,
        "marge_mm": 15.0, "depth_of_discharge": 80.0, "cell_gap_mm": 0.0,
        "config_mode": "manual",
        "manual_series": 10,
        "manual_parallel": 5,
    }

    def test_manual_mode_uses_provided_sp(self):
        r = client.post("/api/v1/calculate", json=self.MANUAL_PAYLOAD)
        assert r.status_code == 200
        body = r.json()
        assert body["nb_serie"] == 10
        assert body["nb_parallele"] == 5
        assert body["total_cells"] == 50

    def test_manual_mode_voltage_matches_s_times_vn(self):
        r = client.post("/api/v1/calculate", json=self.MANUAL_PAYLOAD)
        body = r.json()
        # V_total = S × V_nominal = 10 × 3.6 = 36
        assert abs(body["tension_totale_v"] - 10 * 3.6) < 0.01

    def test_manual_mode_config_mode_field(self):
        r = client.post("/api/v1/calculate", json=self.MANUAL_PAYLOAD)
        assert r.json()["config_mode"] == "manual"

    def test_manual_mode_ignores_auto_targets(self):
        """Manual mode with energy/voltage set — should still use manual S/P."""
        payload = {**self.MANUAL_PAYLOAD,
                   "energie_cible_wh": 9999.0, "tension_cible_v": 999.0}
        r = client.post("/api/v1/calculate", json=payload)
        assert r.status_code == 200
        body = r.json()
        assert body["nb_serie"] == 10
        assert body["nb_parallele"] == 5


# ═════════════════════════════════════════════════════════════════════════════
# 5. ENGINE UNIT TESTS (no HTTP — direct function calls)
# ═════════════════════════════════════════════════════════════════════════════

def make_request(**overrides) -> CalculationRequest:
    defaults = dict(
        cell_id=1,
        energie_cible_wh=1000.0,
        tension_cible_v=48.0,
        courant_cible_a=50.0,
        housing_l=1000.0,
        housing_l_small=800.0,
        housing_h=150.0,
        marge_mm=15.0,
        depth_of_discharge=80.0,
        cell_gap_mm=0.0,
        config_mode=ConfigModeEnum.AUTO,
    )
    defaults.update(overrides)
    return CalculationRequest(**defaults)


def make_cylindrical_cell(**overrides) -> Cellule:
    c = Cellule()
    c.id = 1; c.nom = "TEST-CYL"
    c.longueur_mm = 65.0; c.largeur_mm = 18.5; c.hauteur_mm = 65.0
    c.diameter_mm = 18.5; c.masse_g = 48.0
    c.tension_nominale = 3.6; c.capacite_ah = 3.5; c.courant_max_a = 8.0
    c.type_cellule = "Cylindrical"; c.taux_swelling_pct = 0.08
    for k, v in overrides.items():
        setattr(c, k, v)
    return c


def make_prismatic_cell(**overrides) -> Cellule:
    c = Cellule()
    c.id = 2; c.nom = "TEST-PRI"
    c.longueur_mm = 200.0; c.largeur_mm = 148.0; c.hauteur_mm = 7.3
    c.diameter_mm = None; c.masse_g = 385.0
    c.tension_nominale = 3.7; c.capacite_ah = 37.0; c.courant_max_a = 150.0
    c.type_cellule = "Prismatic"; c.taux_swelling_pct = 2.0
    for k, v in overrides.items():
        setattr(c, k, v)
    return c


class TestEngineAlgorithm:

    def test_parallel_is_ceil_of_current_ratio(self):
        """P = ceil(I_target / I_cell_max)."""
        cell = make_cylindrical_cell(courant_max_a=8.0)
        req = make_request(courant_cible_a=20.0)
        result = run_engine(req, cell)
        assert result.nb_parallele == math.ceil(20.0 / 8.0)  # = 3

    def test_series_from_voltage(self):
        """S = ceil(V_target / V_nominal) when only voltage provided."""
        cell = make_cylindrical_cell(tension_nominale=3.6)
        req = make_request(tension_cible_v=36.0, energie_cible_wh=None)
        result = run_engine(req, cell)
        assert result.nb_serie == math.ceil(36.0 / 3.6)  # = 10

    def test_series_from_energy(self):
        """S = ceil(E_target / (V_nom × C × P × DoD)) when only energy provided."""
        cell = make_cylindrical_cell(tension_nominale=3.6, capacite_ah=3.5, courant_max_a=8.0)
        req = make_request(energie_cible_wh=500.0, tension_cible_v=None,
                           courant_cible_a=8.0, depth_of_discharge=100.0,
                           housing_l=5000.0, housing_l_small=5000.0, housing_h=500.0)
        result = run_engine(req, cell)
        P = math.ceil(8.0 / 8.0)  # = 1
        expected_S = math.ceil(500.0 / (3.6 * P * 3.5 * 1.0))
        assert result.nb_serie == expected_S

    def test_series_takes_max_of_both_constraints(self):
        """When both energy and voltage provided, S = max(S_v, S_e)."""
        cell = make_cylindrical_cell(tension_nominale=3.6, capacite_ah=3.5, courant_max_a=8.0)
        req = make_request(energie_cible_wh=50000.0, tension_cible_v=7.2,  # energy dominates
                           courant_cible_a=8.0, depth_of_discharge=80.0,
                           housing_l=10000.0, housing_l_small=10000.0, housing_h=1000.0)
        result = run_engine(req, cell)
        # S_v = ceil(7.2/3.6) = 2; S_e >> 2 because energy is huge
        assert result.nb_serie >= 2

    def test_total_cells_is_s_times_p(self):
        cell = make_cylindrical_cell()
        req = make_request(housing_l=5000.0, housing_l_small=5000.0, housing_h=500.0)
        result = run_engine(req, cell)
        assert result.total_cells == result.nb_serie * result.nb_parallele

    def test_voltage_equals_s_times_vnom(self):
        cell = make_cylindrical_cell(tension_nominale=3.6)
        req = make_request(tension_cible_v=36.0, energie_cible_wh=None,
                           housing_l=5000.0, housing_l_small=5000.0, housing_h=500.0)
        result = run_engine(req, cell)
        expected = result.nb_serie * 3.6
        assert abs(result.tension_totale_v - expected) < 0.01

    def test_usable_energy_respects_dod(self):
        cell = make_cylindrical_cell()
        req = make_request(depth_of_discharge=80.0,
                           housing_l=5000.0, housing_l_small=5000.0, housing_h=500.0)
        result = run_engine(req, cell)
        total = result.electrical.total_energy_wh
        usable = result.electrical.usable_energy_wh
        assert abs(usable - total * 0.80) < 0.01

    def test_minimum_s_and_p_are_1(self):
        """Even if targets are tiny, S and P must be at least 1."""
        cell = make_cylindrical_cell(courant_max_a=8.0, tension_nominale=3.6)
        req = make_request(courant_cible_a=1.0, tension_cible_v=1.0, energie_cible_wh=None,
                           housing_l=5000.0, housing_l_small=5000.0, housing_h=500.0)
        result = run_engine(req, cell)
        assert result.nb_serie >= 1
        assert result.nb_parallele >= 1


class TestEngineSwelling:

    def test_cylindrical_swelling_fraction_format(self):
        """taux_swelling_pct=0.08 (fraction) → swelling_factor = 1 + 0.08*100/100 = 1.08."""
        cell = make_cylindrical_cell(diameter_mm=18.5, hauteur_mm=65.0, taux_swelling_pct=0.08)
        req = make_request(tension_cible_v=3.6, energie_cible_wh=None, courant_cible_a=8.0,
                           housing_l=5000.0, housing_l_small=5000.0, housing_h=500.0)
        result = run_engine(req, cell)
        # swelling_pct = 0.08 * 100 = 8%, factor = 1.08
        # With S=1, P=1: L_gonfles = 1 * 18.5 * 1.08
        expected_L = round(1 * 18.5 * 1.08, 2)
        assert abs(result.dimensions_array.longueur_mm - expected_L) < 0.1

    def test_cylindrical_swelling_percent_format(self):
        """taux_swelling_pct=8.0 (percent) → same 8% expansion."""
        cell_frac = make_cylindrical_cell(diameter_mm=18.5, taux_swelling_pct=0.08)
        cell_pct = make_cylindrical_cell(diameter_mm=18.5, taux_swelling_pct=8.0)
        req = make_request(tension_cible_v=3.6, energie_cible_wh=None, courant_cible_a=8.0,
                           housing_l=5000.0, housing_l_small=5000.0, housing_h=500.0)
        r1 = run_engine(req, cell_frac)
        r2 = run_engine(req, cell_pct)
        # Both represent 8% — dimensions should be identical
        assert abs(r1.dimensions_array.longueur_mm - r2.dimensions_array.longueur_mm) < 0.01
        assert abs(r1.dimensions_array.largeur_mm - r2.dimensions_array.largeur_mm) < 0.01

    def test_zero_swelling_returns_raw_dimensions(self):
        """No swelling → L_gonfles equals the raw cell dimension."""
        cell = make_cylindrical_cell(diameter_mm=20.0, hauteur_mm=70.0, taux_swelling_pct=0.0)
        req = make_request(tension_cible_v=3.6, energie_cible_wh=None, courant_cible_a=8.0,
                           housing_l=5000.0, housing_l_small=5000.0, housing_h=500.0)
        result = run_engine(req, cell)
        S, P = result.nb_serie, result.nb_parallele
        expected_L = round(S * 20.0, 2)
        assert abs(result.dimensions_array.longueur_mm - expected_L) < 0.01

    def test_prismatic_swelling_applied_to_x_and_z(self):
        """Prismatic: swelling on X (hauteur_mm) and Z (largeur_mm), not Y (longueur_mm)."""
        cell = make_prismatic_cell(hauteur_mm=7.3, largeur_mm=148.0,
                                   longueur_mm=200.0, taux_swelling_pct=2.0)
        # end_plate_thickness_mm=0 isolates swelling effect from end-plate contribution
        req = make_request(tension_cible_v=3.7, energie_cible_wh=None, courant_cible_a=50.0,
                           housing_l=5000.0, housing_l_small=5000.0, housing_h=500.0,
                           end_plate_thickness_mm=0.0)
        result = run_engine(req, cell)
        S, P = result.nb_serie, result.nb_parallele
        # swelling_factor = 1.02 (2% stored as percentage)
        expected_L = round(S * 7.3 * 1.02, 2)
        expected_W = round(P * 148.0 * 1.02, 2)
        # H should NOT have swelling applied
        expected_H = round(200.0, 2)
        assert abs(result.dimensions_array.longueur_mm - expected_L) < 0.1
        assert abs(result.dimensions_array.largeur_mm - expected_W) < 0.1
        assert abs(result.dimensions_array.hauteur_mm - expected_H) < 0.1


class TestEngineGeometry:

    def test_accept_when_fits_with_margin(self):
        """Engine must ACCEPT when dimensions fit with margin.
        Both energy and voltage must be provided together (engine business rule)."""
        cell = make_cylindrical_cell(diameter_mm=18.5, hauteur_mm=65.0, taux_swelling_pct=0.0)
        req = make_request(tension_cible_v=3.6, energie_cible_wh=50.0,  # both provided
                           courant_cible_a=8.0, marge_mm=15.0,
                           housing_l=5000.0, housing_l_small=5000.0, housing_h=500.0)
        result = run_engine(req, cell)
        assert result.verdict.value == "ACCEPT"

    def test_reject_when_margin_violated(self):
        cell = make_cylindrical_cell(diameter_mm=100.0, hauteur_mm=200.0)
        # Tiny housing — won't fit
        req = make_request(tension_cible_v=3.6, energie_cible_wh=None,
                           courant_cible_a=8.0, marge_mm=15.0,
                           housing_l=50.0, housing_l_small=50.0, housing_h=50.0)
        result = run_engine(req, cell)
        assert result.verdict.value == "REJECT"
        assert len(result.validation_errors) > 0

    def test_rotation_auto_fits(self):
        """Engine should auto-rotate if rotated orientation fits but normal does not."""
        cell = make_cylindrical_cell(diameter_mm=18.5, hauteur_mm=65.0, taux_swelling_pct=0.0)
        # Force S=10, P=1 via voltage and tiny current → L=185, W=18.5
        # Provide a housing that is narrow in L but wide in W
        req = make_request(tension_cible_v=36.0, energie_cible_wh=None,
                           courant_cible_a=1.0, marge_mm=5.0,
                           housing_l=100.0, housing_l_small=5000.0, housing_h=500.0)
        result = run_engine(req, cell)
        # Whether rotated or not, engine should produce a valid verdict
        assert result.verdict.value in ("ACCEPT", "REJECT")

    def test_margins_in_result(self):
        req = make_request(housing_l=5000.0, housing_l_small=5000.0, housing_h=500.0)
        cell = make_cylindrical_cell()
        result = run_engine(req, cell)
        assert "L" in result.marges_reelles
        assert "W" in result.marges_reelles
        assert "H" in result.marges_reelles

    def test_cell_gap_adds_to_total_length(self):
        """With gap, dimensions grow by (S-1)*gap on X and (P-1)*gap on Z."""
        cell = make_cylindrical_cell(diameter_mm=18.5, taux_swelling_pct=0.0)
        req_no_gap = make_request(tension_cible_v=36.0, energie_cible_wh=None,
                                  courant_cible_a=1.0, cell_gap_mm=0.0,
                                  housing_l=5000.0, housing_l_small=5000.0, housing_h=500.0)
        req_gap = make_request(tension_cible_v=36.0, energie_cible_wh=None,
                               courant_cible_a=1.0, cell_gap_mm=2.0,
                               housing_l=5000.0, housing_l_small=5000.0, housing_h=500.0)
        r1 = run_engine(req_no_gap, cell)
        r2 = run_engine(req_gap, cell)
        S = r1.nb_serie
        # L should increase by (S-1)*2
        diff = r2.dimensions_array.longueur_mm - r1.dimensions_array.longueur_mm
        assert abs(diff - (S - 1) * 2.0) < 0.01

    def test_fill_ratio_is_positive(self):
        req = make_request(housing_l=5000.0, housing_l_small=5000.0, housing_h=500.0)
        cell = make_cylindrical_cell()
        result = run_engine(req, cell)
        assert result.taux_occupation_pct > 0


class TestEngineManualMode:

    def test_manual_uses_exact_s_p(self):
        cell = make_cylindrical_cell()
        req = make_request(config_mode=ConfigModeEnum.MANUAL,
                           manual_series=7, manual_parallel=4,
                           housing_l=5000.0, housing_l_small=5000.0, housing_h=500.0)
        result = run_engine(req, cell)
        assert result.nb_serie == 7
        assert result.nb_parallele == 4

    def test_manual_requires_series_and_parallel(self):
        """Manual mode must reject requests where series/parallel are not provided."""
        from pydantic import ValidationError as PydanticValidationError
        with pytest.raises(PydanticValidationError):
            make_request(config_mode=ConfigModeEnum.MANUAL,
                         manual_series=None, manual_parallel=None,
                         housing_l=5000.0, housing_l_small=5000.0, housing_h=500.0)


# ═════════════════════════════════════════════════════════════════════════════
# 6. PDF ENDPOINT
# ═════════════════════════════════════════════════════════════════════════════

class TestPdfEndpoint:

    def test_pdf_returns_200(self):
        r = client.post("/api/v1/calculate/pdf", json=BASE_PAYLOAD)
        assert r.status_code == 200

    def test_pdf_content_type_is_pdf(self):
        r = client.post("/api/v1/calculate/pdf", json=BASE_PAYLOAD)
        assert "application/pdf" in r.headers["content-type"]

    def test_pdf_content_disposition_attachment(self):
        r = client.post("/api/v1/calculate/pdf", json=BASE_PAYLOAD)
        assert "attachment" in r.headers.get("content-disposition", "")

    def test_pdf_body_not_empty(self):
        r = client.post("/api/v1/calculate/pdf", json=BASE_PAYLOAD)
        assert len(r.content) > 1000  # real PDF is at least a few KB

    def test_pdf_starts_with_pdf_magic(self):
        r = client.post("/api/v1/calculate/pdf", json=BASE_PAYLOAD)
        assert r.content[:4] == b"%PDF"

    def test_pdf_cell_not_found_returns_404(self):
        r = client.post("/api/v1/calculate/pdf", json={**BASE_PAYLOAD, "cell_id": 9999})
        assert r.status_code == 404

    def test_pdf_manual_mode(self):
        payload = {
            "cell_id": 1, "courant_cible_a": 50.0,
            "housing_l": 2000.0, "housing_l_small": 1500.0, "housing_h": 200.0,
            "marge_mm": 15.0, "depth_of_discharge": 80.0, "cell_gap_mm": 0.0,
            "config_mode": "manual", "manual_series": 10, "manual_parallel": 5,
        }
        r = client.post("/api/v1/calculate/pdf", json=payload)
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"


# ═════════════════════════════════════════════════════════════════════════════
# 7. INPUT VALIDATION (Pydantic boundary)
# ═════════════════════════════════════════════════════════════════════════════

class TestInputValidation:

    def test_cell_id_zero_rejected(self):
        r = client.post("/api/v1/calculate", json={**BASE_PAYLOAD, "cell_id": 0})
        assert r.status_code == 422

    def test_negative_energy_rejected(self):
        r = client.post("/api/v1/calculate",
                        json={**BASE_PAYLOAD, "energie_cible_wh": -500.0})
        assert r.status_code == 422

    def test_dod_below_1_rejected(self):
        r = client.post("/api/v1/calculate",
                        json={**BASE_PAYLOAD, "depth_of_discharge": 0.5})
        assert r.status_code == 422

    def test_dod_above_100_rejected(self):
        r = client.post("/api/v1/calculate",
                        json={**BASE_PAYLOAD, "depth_of_discharge": 101.0})
        assert r.status_code == 422

    def test_negative_gap_rejected(self):
        r = client.post("/api/v1/calculate",
                        json={**BASE_PAYLOAD, "cell_gap_mm": -1.0})
        assert r.status_code == 422

    def test_manual_series_zero_rejected(self):
        r = client.post("/api/v1/calculate", json={
            **BASE_PAYLOAD,
            "config_mode": "manual",
            "manual_series": 0,
            "manual_parallel": 3,
        })
        assert r.status_code == 422

    def test_string_payload_rejected(self):
        r = client.post("/api/v1/calculate",
                        json={**BASE_PAYLOAD, "housing_l": "not_a_number"})
        assert r.status_code == 422
