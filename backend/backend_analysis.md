# Backend Code Analysis - Battery Pack Pre-Design Assistant

This document provides a comprehensive explanation of the backend codebase, including its architecture, core logic, and mathematical models, as requested.

## 1. Project Overview & Architecture

The backend is built using **FastAPI** and is organized into a modular structure:
- `app/main.py`: Entry point for the FastAPI application. Defines the API endpoints, routing, and integrates Swagger documentation.
- `app/core/engine.py`: Contains the core deterministic sizing engine. This is where mathematical formulas to determine cell configuration (Series/Parallel) and geometric constraints are applied.
- `app/db/database.py`: Manages the SQLite database connection using SQLAlchemy.
- `app/models/cellule.py`: Defines the SQLAlchemy ORM model for a battery cell (`Cellule`).
- `app/schemas/battery.py`: Defines the Pydantic schemas (e.g., `CalculationRequest`, `CalculationResult`) handles the API payload validation.
- root utility scripts: 
  - `import_data.py`: A script to import battery specifications from Excel files into the SQLite database.
  - `verify_database.py`: A script that verifies the contents of the database (generating statistics on imported cells).

## 2. Main API Endpoints (`app/main.py`)

- **`GET /api/v1/health`**: System health check endpoint. Returns `{"status": "ok"}` and version details. Used in CI/CD and Docker environments.
- **`GET /api/v1/cells`**: Returns the complete catalogue of Li-Ion cells stored in the database.
- **`GET /api/v1/cells/{cell_id}`**: Fetches detailed specifications for a single cell by its ID.
- **`POST /api/v1/calculate`**: The main calculation endpoint. It receives constraints (target energy, target current, housing dimensions, etc.) and executes the sizing engine to determine the optimal S/P configuration.

## 3. The Core Sizing Engine (`app/core/engine.py`)

The sizing algorithm is fully deterministic and divided into specific steps complying with the project's specifications (dossier de cadrage §9.4).

### Step 1: Parallel Cells (P) - Current Constraint
The number of cells in parallel is determined strictly by the target current.

**Formula**: P = Ceil( Target Current / Cell Max Current )

**Code Implementation** (from `app/core/engine.py`):
```python
# You can modify or comment on this calculation:
P = math.ceil(req.courant_cible_a / cell.courant_max_a)
```

### Step 2: Series Cells (S) - Energy Constraint
The number of cells in series is driven by the target energy. The algorithm first converts the targeted energy from kWh to Wh, calculates the energy of one parallel group, and then finds the series multiplier required.

**Formula**: 
- Target Energy (Wh) = Target Energy (kWh) * 1000
- Parallel Group Energy = Cell Nominal Voltage * Cell Capacity * P
- S = Ceil( Target Energy (Wh) / Parallel Group Energy )

**Code Implementation**:
```python
# Energy conversions and series calculation:
energy_wh = req.energie_cible_kwh * 1000.0   # kWh -> Wh conversion
energy_per_parallel_group = cell.tension_nominale * cell.capacite_ah * P

# Calculate S (Series)
S = math.ceil(energy_wh / energy_per_parallel_group)
```

### Step 3: Electrical Summary
Once S and P are known, the pack's electrical limits are calculated:

**Formulas**:
- Actual Voltage = S * Cell Nominal Voltage
- Actual Capacity = P * Cell Capacity
- Total Energy (Wh) = Actual Voltage * Actual Capacity
- Usable Energy (Wh) = Total Energy (Wh) * (Depth of Discharge / 100)
- Total Pack Weight (kg) = (S * P * Cell Mass (g)) / 1000

**Code Implementation**:
```python
# Electrical properties calculations:
actual_voltage_v   = round(S * cell.tension_nominale, 3)
actual_capacity_ah = round(P * cell.capacite_ah, 3)
total_energy_wh    = round(actual_voltage_v * actual_capacity_ah, 2)

# DoD applied to total energy:
usable_energy_wh   = round(total_energy_wh * (req.depth_of_discharge / 100.0), 2)

# Weight calculation:
total_cells        = S * P
total_weight_kg    = round((total_cells * cell.masse_g) / 1000.0, 3)
```

### Step 4: Physical Geometry & Swelling Models
The physical properties of the pack include a material swelling factor. Stored as a percentage (e.g., 8%) or fraction (0.08).

**Code Implementation for Swelling Factor**:
```python
swelling_raw = cell.taux_swelling_pct
if swelling_raw > 1.0:
    swelling_factor = 1.0 + (swelling_raw / 100.0) # percentage
else:
    swelling_factor = 1.0 + swelling_raw           # fraction
```

For **Pouch** and **Prismatic** cells, swelling applies to Length and Width. Height is not stacked.
For **Cylindrical** cells, swelling is considered 0 due to rigid casings.

**Code Implementation for Dimensions**:
```python
# Example for Pouch cells:
L_raw = round(S * cell.longueur_mm * swelling_factor, 2)
W_raw = round(P * cell.largeur_mm  * swelling_factor, 2)
H_raw = round(cell.hauteur_mm, 2)
```

To form the final safety bounding box, the required **margin** (e.g., 15 mm ENF-02 rule) is added evenly to all faces (two faces per axis).

**Code Implementation for Margins**:
```python
margin = req.marge_mm
L_final = round(L_raw + 2 * margin, 2)
W_final = round(W_raw + 2 * margin, 2)
H_final = round(H_raw + 2 * margin, 2)
```

### Step 5: Collision Detection
A pass/fail boolean verdict evaluates whether the calculated array strictly fits within the customer housing inputs:
- ACCEPT if $L_{final} \le Housing_{L}$ and $W_{final} \le Housing_{W}$ and $H_{final} \le Housing_{H}$.
- REJECT otherwise, providing reasoning indicating exactly which axis suffered an overflow and by how many millimeters.

## 4. Next Steps

Currently, the backend covers all initial mechanical calculation specifications well. As instructed ("We will make changes on the backend but for now do not do nothing"), no active changes have been applied to the backend, yet we are ready to implement further instructions should they be related to endpoints, calculations, or models configuration.
