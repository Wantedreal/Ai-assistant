# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session Orientation

**At the start of every session, read this file first, then immediately read:**
`C:\Users\rayan\.claude\projects\C--Test-Project-Ai-assistant\memory\project_graph.md`

That file contains 10 Mermaid diagrams covering the full architecture, API, engine algorithm, component tree, data flow, 3D layers, constants, and build pipeline. Reading it gives you a complete project map without re-reading all source files.

## Project Overview

Battery Pack Pre-Design Assistant — a desktop Electron application for electrical engineers to size Li-Ion battery packs. The user inputs housing dimensions and energy/current targets; the app outputs a Series×Parallel cell configuration with ACCEPT/REJECT verdict and 3D visualization.

## Architecture

```
Electron (frontend/electron/main.cjs)
  ├─ Spawns FastAPI backend process (Windows exe in production)
  └─ BrowserWindow → React (Vite dev server or dist/index.html)
        └─ Axios (http://localhost:8000/api/v1)
              └─ FastAPI backend
                    ├─ SQLite via SQLAlchemy (353+ battery cells — see battery_cells_with_manual.xlsx)
                    ├─ Core sizing engine (backend/app/core/engine.py)
                    └─ PDF export (backend/app/pdf.py)
```

**Database master file:** `battery_cells_with_manual.xlsx` (project root) — 353 cells: 339 TUM/ISI + 14 manually extracted (12 CATL LFP/NMC + SVOLT-134Ah + SVOLT-196Ah Blade + SVOLT-184Ah Blade). Import via app Import button to populate SQLite. Remaining datasheets in `data_based/` (~44 PDFs: CALB 4, CATL 3, EVE 8, ETC 5, Ganfeng 4, GOTION 2, Higee 3, Lishen 6, REPT 2, Great Power 2, ETP 1, SVOLT-325Ah 1, YinLong 3).

**Key data flow:** User fills form → `POST /api/v1/calculate` → deterministic algorithm (P = ⌈I/I_max⌉, S = ⌈max(V, E/(V·C·P·DoD))⌉) → geometry check vs housing → result + 3D render update.

**Vite dev proxy:** `/api` → `http://127.0.0.1:8000`, so frontend never hardcodes the backend port.

## Environment Setup (new machine)

**Python 3.12 is required** — cadquery/OCP has no Python 3.14 wheel.
Python 3.14 can coexist; use `py -3.12` to target the right version.

```powershell
# Install Python 3.12 if not present
winget install Python.Python.3.12 --accept-source-agreements --accept-package-agreements

# Create venv with 3.12 explicitly
cd backend
py -3.12 -m venv venv
venv\Scripts\pip install --prefer-binary fastapi uvicorn sqlalchemy "pandas>=2.2" openpyxl pydantic python-multipart reportlab cadquery pyinstaller

# Frontend
cd frontend
npm install
```

## Development Commands

### Backend (Python / FastAPI)

```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (React / Vite)

```bash
cd frontend
npm run dev          # Vite dev server on port 5173
```

### Electron (Desktop)

```powershell
cd frontend
$env:ELECTRON_DEV='true'
npm run dev:electron  # Launches Electron pointing at Vite dev server
```

All three must run simultaneously for full local development.

### Production Build

**The simplest way — use the build scripts at the project root:**

| Script | When to use | Time |
|--------|-------------|------|
| `build-smart.bat` | Auto-detects what changed (recommended) | — |
| `build-fast.bat` | Only frontend/JS/React changed | ~15 sec |
| `build-full.bat` | Backend Python code changed | ~3 min |

Or press **`Ctrl+Shift+B`** in VS Code (runs `build-smart.bat`).

**Manual steps (what the scripts do internally):**

```powershell
# Step 1 — Backend (only needed when .py files change)
cd backend
venv\Scripts\pyinstaller.exe backend.spec --noconfirm --clean
# Output: backend/dist/backend/backend.exe + _internal/

# Step 2 — Frontend (Vite)
cd frontend
npm run build

# Step 3 — Electron packaging (two-step to avoid winCodeSign symlink issue)
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npx electron-builder --win          # creates release/win-unpacked (ignore winCodeSign error)
npx electron-builder --win nsis --prepackaged release/win-unpacked
# Output: frontend/release/Battery Pack Designer Setup 1.0.0.exe
```

Output installer is fully self-contained — no Python or Node.js needed on target machine.

**winCodeSign / symlink issue (Windows without Developer Mode):**
electron-builder downloads `winCodeSign` to run `rcedit.exe` (embeds the app icon into the exe). The package contains macOS dylib symlinks that 7zip cannot create without Windows Developer Mode enabled. The build scripts work around this by:
1. Running `electron-builder --win` (ignores the winCodeSign failure — `release/win-unpacked/` is always created before the failure)
2. Running `--prepackaged` for the NSIS step (skips winCodeSign entirely)

**Permanent fix:** Enable Developer Mode in Windows → Settings → Privacy & Security → For Developers → Developer Mode → On. This grants symlink creation rights, rcedit runs, and the exe gets the BoltLogo icon embedded (visible in Explorer / taskbar).

## Key API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/health` | Health check (Electron polls this on startup) |
| GET | `/api/v1/cells` | Full cell catalogue |
| GET | `/api/v1/cells/{id}` | Single cell |
| POST | `/api/v1/calculate` | Core sizing calculation |
| POST | `/api/v1/calculate/pdf` | PDF report generation |
| POST | `/api/v1/export/step` | STEP file export (CadQuery) |
| POST | `/api/v1/cells/import` | Upload `.xlsx` → truncate + re-insert catalogue, saves source path |
| POST | `/api/v1/cells/sync` | Re-import from last saved source path (OneDrive sync workflow) |
| GET | `/api/v1/cells/import/config` | Returns saved source path (used to enable/disable Sync button) |
| POST | `/api/v1/cells/recommend` | Run engine on all cells, return top 5 ACCEPT + up to 3 near-miss cells |

Swagger UI available at `http://localhost:8000/docs` when backend is running.

## Frontend Component Layout

The UI is a "bento grid":
- **Top-left:** `CellSelector.jsx` — searchable dropdown over 384 cells
- **Center:** `ConstraintsForm.jsx` — housing dimensions + energy/current/voltage targets
- **Top-right:** `PackViewer3D.jsx` — Three.js 3D visualization (WebGL), delegates to `PackAssemblyBuilder.js`
- **Bottom-left:** `CellSelector.jsx` (`CellActionCard`) — Calculate + Export PDF buttons + inline ACCEPT/REJECT verdict line
- **Bottom-center:** `ResultsPanel.jsx` (`bio-card`) — Electrical results with scroll (Configuration, Total cells, Pack voltage, Pack current, Usable energy, Total weight)
- **Bottom-right:** `ResultsPanel.jsx` (`contact-card`) — Mechanical results with scroll (Final L/W/H, Margin L/W/H, Fill ratio)

### 3D Visualization (`frontend/src/3d/PackAssemblyBuilder.js`)

Builds the scene in named `THREE.Group` layers (toggle with `setLayerVisible`):

| Layer | Group name | Contents | Cell types |
|-------|-----------|----------|------------|
| Housing | `housing` | Transparent blue/red enclosure walls (open-top tray) | All |
| Dimensions | `dimensions` | Blue module L/l/h dimension lines + amber X/Z margin indicators | All |
| Cells | `cells` | Instanced cell bodies + edge outlines | All |
| Terminals | `terminals` | Positive/negative terminal geometry | All |
| Busbars | `busbars` | Nickel strips + series jumpers (cyl) or copper snake-path busbars (prismatic) | All |
| Brackets | `brackets` | ABS plastic cross-bar grid top+bottom | Cylindrical only |
| Separator cards | `separator_cards` | Orange Nomex sheets — S+1 total (S−1 inner + 2 outer) | Prismatic/Pouch |
| End plates | `end_plates` | Compression end plates at ±X, thickness from `endPlateThick` slider | Prismatic/Pouch |
| Side supports | `side_supports` | Steel side rails at ±Z, rail depth fixed at 8 mm | Prismatic/Pouch |

**BMS / balance wires / cables removed from 3D scene** — too complex to maintain, not needed for pre-design.

**Visual-only sliders (LayerControlPanel, fullscreen only — not sent to engine):**
- Cell gap (0–5 mm) — also sent to engine
- End plate thickness (0–30 mm) — also sent to engine for prismatic `L_raw`; pouch/cylindrical: visual only
- Busbar width (5–60 mm) — controls busbar Z-stretch (`hBarW`); Y-thickness fixed 2.5 mm; never sent to engine

**Margin annotations (dimensions group):**
- X axis: end-plate-face ↔ housing inner wall (amber, at +Z front face)
- Z axis: array Z-face ↔ housing inner wall (amber, at +X right face)
- Y axis: removed (too cluttered)

**Module-level constants** (change once, affect all builders):
- `WALL_MM = 2` — housing wall thickness used in every `yCenter` calculation
- `TERM_OFFSET_RATIO = 0.35` — prismatic terminal Z-offset as fraction of cell width

**Cylindrical axis convention** — cells stand upright (Y = `hauteur_mm`), series spreads in X with pitch = `diameter_mm + cellGap`, parallel spreads in Z. Adjacent series columns alternate polarity (flip 180° around Z-axis).

**Prismatic/Pouch axis convention** — cells stand upright (Y = `longueur_mm`), series stacks thin-face-to-thin-face in X with pitch = `hauteur_mm + cellGap`, parallel spreads in Z with pitch = `largeur_mm + cellGap`. Terminal Z-offset = `largeur_mm × TERM_OFFSET_RATIO`.

**Export methods:**
- `getExportGroup()` — deep-clones all visible layers into a root Group; InstancedMesh preserved for GLB
- `getFlatGroupForSTL()` — expands every InstancedMesh instance into individual Meshes with world transforms baked into geometry vertices; cloned geometries must be disposed after export (handled in `ExportPanel.jsx`)

## Cell Data Model

```python
class Cellule(Base):
    nom: str              # e.g. "INR18650-35E"
    longueur_mm, largeur_mm, hauteur_mm: float
    diameter_mm: float    # nullable, cylindrical cells only
    masse_g: float
    tension_nominale: float
    capacite_ah: float
    courant_max_a: float
    type_cellule: str     # "Cylindrical" | "Prismatic" | "Pouch"
    taux_swelling_pct: float
```

`diameter_mm` is used for cylindrical cell geometry; for prismatic/pouch: `longueur_mm` = cell height (Y), `largeur_mm` = cell width (Z, parallel axis), `hauteur_mm` = cell thickness (X, series axis).

## Engine Dimension Convention

The sizing engine (`backend/app/core/engine.py`) computes `L_raw / W_raw / H_raw` mapped to the housing inputs as follows:

| Cell type | `L_raw` (→ `housing_l`) | `W_raw` (→ `housing_l_small`) | `H_raw` (→ `housing_h`) |
|-----------|------------------------|-------------------------------|-------------------------|
| Cylindrical | `S × diameter` (X) | `P × diameter` (Z) | `hauteur_mm` (Y) |
| Prismatic/Pouch | `S × hauteur_mm` (X) | `P × largeur_mm` (Z) | `longueur_mm` (Y) |

These map exactly to the 3D axes: `housing_l` = X (housingL), `housing_l_small` = Z (housingW), `housing_h` = Y (housingH).

## Debugging Protocol

Per AGENTS.md: **reproduce consistently → investigate + form hypothesis → demonstrate root cause → fix → document**.

- Do not patch symptoms; find the root cause.
- Validate each step before moving to the next.
- Check backend logs and browser console together — most issues manifest in both.

## Code Style

- Simple, incremental changes — no overengineering
- No defensive programming for impossible scenarios
- Clear docstrings on functions; minimal inline comments
- No emojis in logs or print statements

## Planned Work (see 3D_ASSEMBLY_EXPORT_PLAN.md)

See `/reference_3D` for reference images of the target assembly.

**Completed (Phases 0, 1, 2, 3, 4, 5, 7, 8 + code quality pass + PDF report + layout fixes):**
- Cylindrical cells with alternating polarity, positive/negative terminals, insulation rings, nickel strips
- Prismatic cells standing upright with terminals and copper busbars (snake-path series routing)
- Engine dimension fix: prismatic `L/W/H` now matches the 3D axis convention exactly
- Cylindrical cell brackets (perforated ABS plates top+bottom via `ExtrudeGeometry` with holes)
- Prismatic insulation cards (orange Nomex sheets between series groups) — converted to `InstancedMesh`
- Prismatic side/end compression plates (steel gray) — flush against outermost cells (no phantom gap)
- Layer toggle UI (`LayerControlPanel.jsx`) — fullscreen only, conditional on cell type
- BMS (Daly-style): red aluminum heatsink, black endcaps, dynamic S+1 balance pins, B−/C−/P− brass power ports
- Balance wires: harness-style routing — rise to common Y plane, sweep to BMS front face, fan to individual pins
- Main cables: B+ red, B− black, P− orange (load), C− blue (charger) with brass bolt terminals
- Frontend GLB/STL export (`ExportPanel.jsx`): `getExportGroup()` expands `InstancedMesh` for GLTF; `getFlatGroupForSTL()` bakes world transforms for binary STL
- Code quality fixes: module constants `WALL_MM`, `TERM_OFFSET_RATIO`; removed dead `dimensions_array` param; fixed GPU memory leak on STL export; fixed RAF cleanup in camera preset animation
- Cell gap (`cell_gap_mm`): lifted to `App.jsx` form state, sent to backend engine (dimensions include (N-1)×gap), shown in ConstraintsForm under Housing dimensions
- Prismatic terminal size fix: radius now constrained by cell thickness (`sizeX`) so terminals never overflow the cell face
- PDF report (`backend/app/pdf.py`): full professional report — input params, cell specs, step-by-step methodology with Relation/A.N./Result blocks, top-down vector pack schematic, results + color-coded margins + verdict. Manual mode correctly bypasses formula derivation. PDF payload in `CellSelector.jsx` now includes `cell_gap_mm` and manual S/P fields.
- Dashboard layout fixes (Steps 1–3): action card no longer has dead space (`align-self: stretch; justify-content: center`); bottom cards equal height via `align-items: stretch`; upper cards capped to viewport with `height: 100vh` + `grid-template-rows: 2.4fr 1fr` at desktop breakpoints.
- Results panel expanded: Electrical card shows Configuration, Total cells, Pack voltage, Pack current, Usable energy, Total weight — all in a scrollable inner area (`results-scroll-area`). Mechanical card shows Final L/W/H, Margin L/W/H, Fill ratio — also scrollable. Cards have `max-height` at small/medium breakpoints to prevent unbounded growth.
- Verdict moved to `CellActionCard` (`social-card`) as a compact inline colored text line (✓ ACCEPT / ✗ REJECT — reason), shown immediately after Calculate.
- `projects-card` overflow changed from `hidden` → `overflow-y: auto` so cell selector content scrolls on small windows.

- STEP export (`backend/app/step_export.py`): `POST /api/v1/export/step` — CadQuery parametric STEP of full cell array (cells, terminals, busbars, brackets/insulation cards/side plates). Housing, BMS and cables intentionally excluded from STEP (cleaner for CAD integration). Performance: `Shape.moved()` + `Compound.makeCompound()` pattern — one OCC solid per unique shape, N cheap location-transforms (~60× faster than individual solids). Typical generation time: 1–7 s depending on cell count. Colors embedded as `COLOUR_RGB` in AP214; visible in SolidWorks/CATIA/Fusion 360/FreeCAD.
- STEP button in `ExportPanel.jsx` — enabled after first Calculate (uses `lastPayload` stored in `App.jsx` state, forwarded via `PackViewer3D` → `ExportPanel`). `api.js` has `exportStep(payload)` → `responseType: 'blob'`.

- **Cell schematic** (`frontend/src/components/CellSchematic.jsx`): pure inline SVG, no deps. Renders differently per cell type — Cylindrical (side view + inset top-view circle), Prismatic (isometric 3-face box), Pouch (soft-corner foil with tabs). Dimensions are proportional to real cell data. Positive terminal red, negative blue. Dimension annotation lines included. Empty state shown when no cell selected. Replaces the static `Projectscard.png` image in `CellSelectorCard`.

- **Database import/sync** (`backend/app/importer.py`): reads `.xlsx` with openpyxl (no pandas), truncates + re-inserts `cellules` table, saves source path to `backend/data/import_config.json`. Extended format now also reads `Temp_Min_C`, `Temp_Max_C`, `Temp_Max_Charge_C`, `VCharge_Max_V` columns (mapped to `temp_min_c`, `temp_max_c`, `temp_max_charge_c`, `v_charge_max` in DB). Two buttons added to bottom of `CellSelectorCard` — **Import** (file picker upload) and **Sync** (re-reads from saved path). Sync disabled until first Import. Both styled as `modern-btn`. After success, `loadCells()` in `App.jsx` refreshes the dropdown. `frontend/electron/preload.js` exposes `window.electronAPI.getFilePath(file)` via `webUtils` so Electron can pass the real filesystem path to the backend for future Sync calls.

- **Phase 1 — Cell Data Model Extension** (`backend/app/models/cellule.py`, `backend/app/schemas/battery.py`, `backend/app/importer.py`): Added 10 nullable columns to `Cellule` ORM and `CellRead` schema — `fabricant`, `chimie`, `cycle_life`, `dod_reference_pct`, `c_rate_max_discharge`, `c_rate_max_charge`, `energie_volumique_wh_l`, `eol_capacity_pct`, `energie_massique_wh_kg`, `cutoff_voltage_v`. Two Alembic migrations applied (`migrations/versions/`). Importer updated to read TUM/ISI extended Excel format (auto-detected via `Product_Number` header) with deduplication (most-filled row wins, tie-break by CycleLife), chemistry normalization (NMC variants → NMC, Ni-Rich → NMC), dod_reference_pct fraction→percentage conversion, and outlier removal (energie_volumique > 800 Wh/L → NULL). Frontend: chemistry pill badge in search dropdown and cell detail, fabricant line in both, phase1 spec row (cycles @ DoD, C-rate, cutoff V), chemistry color badge in CellSchematic SVG. **3 roadmap fields absent from TUM/ISI dataset:** `temp_min_c`, `temp_max_c`, `self_discharge_pct_month` — not added; needed before Phase 2 temperature check and calendar aging sections.

- **Phase 2 — Engine: C-rate Derating + Cycle Life** (`backend/app/core/engine.py`, `backend/app/schemas/battery.py`, `backend/app/pdf.py`, `frontend/src/components/ConstraintsForm.jsx`): Added C-rate derating and lifetime estimation as informational outputs — they do NOT affect the ACCEPT/REJECT verdict. Engine computes `c_rate_actual`, `derating_factor_pct`, `c_effective_ah`, `cycle_life_at_dod`, `lifetime_years`, `lifetime_years_low`, `lifetime_years_high`. PDF gains Section 6 "Performance Estimate" with full Relation/A.N./Result blocks for both sub-sections. `cycles_per_day` lives in `App.jsx` form state (default 1, sent silently to backend) but is **not shown in the UI form** — it is PDF-only. **k constants:** NMC 0.33 (PyBaMM Chen2020 validated), LFP 0.10, NCA 0.40, LTO 0.04, LCO 0.25, unknown 0.20. Formula valid for 20–80% of C_max; `c_rate_warning=True` above 80%. **Aging exponents:** NMC 1.5, LFP 1.8, NCA 1.3, LTO 2.2 (literature values, ±30% uncertainty range shown in report). PyBaMM calibration script at `backend/scripts/calibrate_derating.py`. **3 fields still missing from dataset:** `temp_min_c`, `temp_max_c`, `self_discharge_pct_month` — temperature check and calendar aging deferred. **Discharge curve columns** (`cap_pct_at_0_5c` through `cap_pct_at_5c`) planned for per-cell k fitting once manufacturer datasheets are collected (priority: Kokam 35 cells, Saft 33 cells, LG Chem 12 cells).

- **Phase 3 — Cell Recommender** (`backend/app/core/recommender.py`, `backend/app/schemas/battery.py`, `backend/app/main.py`, `frontend/src/components/CellSelector.jsx`): New endpoint `POST /api/v1/cells/recommend` runs the sizing engine on every cell in the catalogue with the user's exact constraints and returns the cells that fit, ranked by fill ratio. Two tiers of results:
  - **Fitting cells** (blue, up to 5) — ACCEPT verdict, ranked by fill ratio descending. Shows S×P config, fill %, and actual margins L/W/H in mm.
  - **Near-miss cells** (amber "near fit" tag, up to 3) — REJECT verdict but within 30 mm of fitting on the worst axis. Shows S×P, exact mm deficit. Threshold constant: `NEAR_MISS_THRESHOLD_MM = 30` in `recommender.py`.
  - No multi-criteria scoring (energy density, weight, cycle life removed by design — fit is the only criterion).
  - Frontend: collapsible "Best matches" section at top of `CellSelectorCard`, collapsed by default, fetches on open, click any result to select the cell. `RecommendRequest` mirrors `CalculationRequest` (same housing/energy/current/margin/gap/DoD fields, no `cell_id`). `cycles_per_day` passed silently (default 1). `CellMatch` response includes `near_miss` bool, S×P, fill ratio, margins.

- **Phase 5 — AI Chemistry Explainer** (`backend/app/explainer.py`, `frontend/src/components/ExplainerPanel.jsx`, `backend/.env`): OpenRouter API (free tier), 7-model fallback chain (`meta-llama/llama-3.3-70b`, `google/gemma-3-27b`, etc.). Key embedded as `_EMBEDDED_KEY` in `explainer.py` (acceptable for internal tool). System prompt merged into user message for Gemma compatibility (Gemma rejects `system` role). `POST /api/v1/explain` endpoint. Collapsible `ExplainerPanel` below verdict in `CellActionCard`, caches result per calculation via `fetchedForRef`. `max_tokens=800`.

- **Phase 6 — BMS Specification** (`backend/app/core/bms_spec.py`, `backend/app/schemas/battery.py`, `backend/app/core/engine.py`, `frontend/src/components/ResultsPanel.jsx`, `backend/app/pdf.py`): `compute_bms_spec()` called as Step 7 in engine. 11 new fields on `CalculationResult`: `bms_v_min/max_pack` (S × chemistry cutoff), `bms_i_continuous_a` (P × I_max), `bms_i_charge_a` (P × c_rate_max_charge × C, or 0.5C flagged as estimated), `bms_balance_channels` (= S), `bms_balance_current_a` (C × 0.02), `bms_temp_sensors` (⌈S×P/12⌉), `bms_charge_cutoff_temp_c` (hardcoded per chemistry), `bms_discharge_cutoff_temp_c` (cell `temp_min_c`), `bms_suggestion` (lookup table). Chemistry cutoffs: LFP 2.50–3.65 V, NMC 2.80–4.20 V, NCA 3.00–4.20 V, LTO 1.80–2.80 V. `BMSCard` added to `ResultsPanel.jsx` (reuses `.perf-card`). PDF section 5.4 added.

- **Phase 7 — BMS Wiring Topology: SKIPPED** — not needed for a pre-design tool. BMS manufacturer datasheets cover wiring; topology is identical across all S counts.

- **3D visual controls + dimension annotations:**
  - `end_plate_thickness_mm` slider (LayerControlPanel + ConstraintsForm) — sent to engine for prismatic `L_raw = S×h + (S−1)×g + 2×ep`; pouch/cylindrical: visual only. Side rail depth fixed at 8 mm (not tied to end plate).
  - Busbar width slider — controls `hBarW` (Z-stretch); `busbarFlatH = 2.5 mm` fixed; never sent to engine.
  - ConstraintsForm hides end plate + busbar rows for cylindrical cells (`isPrismatic` guard on `cell` prop).
  - `buildDimensionAnnotations(housingL, housingW, housingH, result)` — blue module L/l/h lines + amber X and Z margin indicators (Y removed). Lines use `depthTest: false` to render through geometry; labels are `THREE.Sprite` with `CanvasTexture`.
  - BMS, balance wires, cables removed from 3D scene entirely.
  - `layers` state in `PackViewer3D` uses lazy `useState` initialiser that reads `result?.cell_used?.type_cellule` at mount — fullscreen modal opens with correct layer visibility immediately.

- **PDF report (§4 — opposite-sides dim layout, no overlap):**
  - §4.1 Top view — housing L at **bottom**, module L_mod at **top**; housing l at **right**, module l_mod at **left** (90° CCW rotated label via `Group.transform=(0,1,-1,0,tx,ty)`). Margins: `left=50, right=76, bottom=42, top=34`. Amber Δ labels use `_delta_label()` helper with white backing rect (fontSize 7.5, threshold 8 pt).
  - §4.2 Isometric view — `_dim_iso(p1, p2, label, side, offset, color)` helper. Housing dims (gray): A→B/B→Cp/B→F with `side=1, offset=14`. Module dims (blue): L_mod on mE→mF `side=-1`, l_mod on mF→mG `side=+1`, h_mod on mA→mE `side=-1` — each on a different edge/face so no shared corner and no overlap.
  - `end_plate_thickness_mm` in input table (prismatic only); end plate dark rects in top-view schematic.

- **STEP export sync with 3D:** `ep` from request, S+1 insulation cards at 75% height, `railThick = 8` fixed.

- **DB schema fix:** `battery_cells.db` was missing `temp_min_c`, `temp_max_c`, `temp_max_charge_c`, `v_charge_max` columns — added via `ALTER TABLE`. These are imported from the `.xlsx` but were never migrated to the existing DB file.

**uncompleted:**
- **EVA foam / heat shrink** — insulation wrap over cell array (cylindrical and prismatic)

## Layout Notes

The bento grid uses `grid-template-rows: 2.4fr 1fr` at all desktop breakpoints (1024px+). At smaller viewports (< 1024px) the grid is `auto` rows, so `bio-card` and `contact-card` have explicit `max-height` values (200px at < 640px, 240px at 640–1023px) to keep scroll active.

The bottom row (`bottom-row`) is a flex row with `align-items: stretch`. Cards inside use `flex-direction: column; justify-content: flex-start; overflow: hidden; min-height: 0`. The result rows are in `.results-scroll-area` (`flex: 1; overflow-y: auto; min-height: 0`) so they scroll independently while the card size is fixed by the grid row.

## Production Build System

### New files created for the build pipeline

| File | Purpose |
|------|---------|
| `backend/run.py` | PyInstaller entry point — calls `multiprocessing.freeze_support()` before anything else (required on Windows to prevent infinite child process spawning), then starts uvicorn |
| `backend/backend.spec` | PyInstaller spec with all hidden imports for uvicorn, anyio, SQLAlchemy SQLite dialect, reportlab fonts. Use this instead of the CLI command. |
| `build-smart.bat` | Double-clickable: auto-detects via `git diff` whether backend changed, runs fast or full build accordingly |
| `build-fast.bat` | Double-clickable: rebuilds frontend + Electron installer only (~15 sec) |
| `build-full.bat` | Double-clickable: rebuilds backend (PyInstaller) + frontend + installer (~3 min) |
| `build.ps1` | PowerShell equivalent of `build-full.bat` |
| `.vscode/tasks.json` | VS Code build tasks — `Ctrl+Shift+B` runs `build-smart.bat` |
| `frontend/public/images/Projectscard.png` | Copied from `frontend/images/` into `public/` so Vite bundles it in `dist/` |
| `frontend/public/images/ImageCard.png` | Same as above |
| `BUILD.md` | Human-readable build & distribution guide |

### Key fixes made for production (Electron + PyInstaller)

**`backend/app/core/config.py`**
- Added explicit `sys.frozen` check: when running as a PyInstaller bundle, uses `sys._MEIPASS` as the base path for the SQLite database. Without this, `__file__` inside a PYZ archive is not a real filesystem path and the DB can't be found.

**`frontend/vite.config.js`**
- Added `base: './'` — Vite defaults to `base: '/'` which produces absolute asset paths (`/assets/...`). Under `file://` in Electron, these resolve to the filesystem root and fail. Relative paths (`./assets/...`) work correctly.

**`frontend/index.html`** (source, not dist)
- Fixed CSP: added `http://127.0.0.1:8000` to `connect-src` (Node.js may resolve `localhost` to IPv6 `::1` while uvicorn only binds IPv4 `0.0.0.0`). Also relaxed `script-src` for module scripts under `file://`.

**`frontend/electron/main.cjs`**
- Health check URL changed from `http://localhost:8000` to `http://127.0.0.1:8000` (IPv4 explicit — avoids IPv6 resolution issue on Windows).
- Backend spawn now sets `cwd: path.dirname(binaryPath)` so `_internal/` is always found relative to the exe.
- Added `backendLastOutput` capture (stderr + stdout) that appears in the error dialog if health check fails.
- `resolveIcon()` updated: added `../icon.ico` and `../icon.png` as first candidates (relative to `electron/` inside the asar) so the window icon resolves correctly in production without relying on `build/` which is not bundled.

**`backend/backend.spec`**
- Removed `openpyxl` from the `excludes` list — it is needed by `importer.py` for the Import button to work in the built exe.

**App icon (`build/icon.ico`, `build/icon.png`, `public/icon.ico`, `public/icon.png`)**
- All four regenerated from the BoltLogo SVG polygon coordinates using Pillow. Previous `icon.png` was a wrong 1288×1296 image. New ICO has 6 sizes (16, 32, 48, 64, 128, 256 px) with diagonal gradient fill and glow. `public/icon.ico` is bundled into the asar by Vite so `resolveIcon()` finds it at runtime.

**`build-full.bat` and `build-fast.bat`**
- Electron packaging step changed to two-step approach: `electron-builder --win` (exit code ignored — creates `win-unpacked` before the winCodeSign failure) then `electron-builder --win nsis --prepackaged release\win-unpacked` (no winCodeSign needed). `CSC_IDENTITY_AUTO_DISCOVERY=false` set for both steps.
- Added log file at `%APPDATA%\backend.log` for post-mortem debugging.

**`frontend/src/components/PackViewer3D.jsx`**
- GLB mesh paths changed from `/meshes/...` to `./meshes/...` (same absolute-vs-relative issue as assets).

**`frontend/src/components/CellSelector.jsx`**
- Image path changed from `/images/Projectscard.png` to `./images/Projectscard.png`.

**`frontend/src/services/api.js`**
- `baseURL` changed from `http://localhost:8000/api/v1` to `http://127.0.0.1:8000/api/v1` (matches `electron/main.cjs`; avoids IPv6 resolution on Windows).

**`frontend/package.json`**
- Added full `electron-builder` config: `appId`, `productName`, `extraResources` (copies `backend/dist/backend` → `resources/backend`), NSIS installer options, platform targets.

**`backend/app/main.py`**
- `run_engine()` calls wrapped in `try/except ValueError` on both `/calculate` and `/calculate/pdf` — unhandled ValueError now returns 422 instead of raw 500 traceback.
- Removed `"*"` wildcard from CORS `allow_origins`; explicit origins only.

**`backend/app/schemas/battery.py`**
- `CellRead` updated from Pydantic v1 `class Config` to `model_config = ConfigDict(from_attributes=True)`.

**`backend/tests/test_suite.py`** (new file)
- 63-test pytest suite covering all endpoints, engine algorithm, swelling, geometry, manual mode, PDF, and input validation.
- Run: `cd backend && venv/Scripts/python.exe -m pytest tests/test_suite.py -v`

### Distribution

Copy `frontend/release/Battery Pack Designer Setup 1.0.0.exe` to target machine (USB, file share, etc.). Double-click to install — no Python or Node.js required. If Windows SmartScreen blocks it: "More info" → "Run anyway" (unsigned app warning, normal for internal tools).

If the app fails on a very old machine: install [VC++ 2015-2022 Redistributable x64](https://aka.ms/vs/17/release/vc_redist.x64.exe) (required by Python 3.13, usually pre-installed on Windows 10/11).

## Your task
I want you now to review the code I already make a graph to explain for you the structure and content of the code , and we will work on the step exportation, the problem is it doesn"t really export xhat we are seeing especially on the prismatic cells I don't see the terminals the busbars really etc