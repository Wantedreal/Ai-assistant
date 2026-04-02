# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Battery Pack Pre-Design Assistant — a desktop Electron application for electrical engineers to size Li-Ion battery packs. The user inputs housing dimensions and energy/current targets; the app outputs a Series×Parallel cell configuration with ACCEPT/REJECT verdict and 3D visualization.

## Architecture

```
Electron (frontend/electron/main.cjs)
  ├─ Spawns FastAPI backend process (Windows exe in production)
  └─ BrowserWindow → React (Vite dev server or dist/index.html)
        └─ Axios (http://localhost:8000/api/v1)
              └─ FastAPI backend
                    ├─ SQLite via SQLAlchemy (384 battery cells)
                    ├─ Core sizing engine (backend/app/core/engine.py)
                    └─ PDF export (backend/app/pdf.py)
```

**Key data flow:** User fills form → `POST /api/v1/calculate` → deterministic algorithm (P = ⌈I/I_max⌉, S = ⌈max(V, E/(V·C·P·DoD))⌉) → geometry check vs housing → result + 3D render update.

**Vite dev proxy:** `/api` → `http://127.0.0.1:8000`, so frontend never hardcodes the backend port.

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

```powershell
# Backend: single-folder executable via PyInstaller
cd backend
pyinstaller --onedir --name backend --add-data "data;data" --paths . app/main.py

# Frontend + Electron installer
cd frontend
npm run electron:build
# Output: frontend/release/Battery Pack Designer Setup 1.0.0.exe
```

## Key API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/health` | Health check (Electron polls this on startup) |
| GET | `/api/v1/cells` | Full cell catalogue |
| GET | `/api/v1/cells/{id}` | Single cell |
| POST | `/api/v1/calculate` | Core sizing calculation |
| POST | `/api/v1/calculate/pdf` | PDF report generation |

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
| Housing | `housing` | Transparent blue enclosure walls (open-top tray) | All |
| Cells | `cells` | Instanced cell bodies + edge outlines | All |
| Terminals | `terminals` | Positive/negative terminal geometry | All |
| Busbars | `busbars` | Nickel strips + series jumpers (cyl) or copper snake-path busbars (prismatic) | All |
| Brackets | `brackets` | ABS plastic cross-bar grid top+bottom | Cylindrical only |
| Insulation cards | `insulation_cards` | Orange Nomex sheets between series groups | Prismatic/Pouch |
| Side plates | `side_plates` | Steel compression plates (side + end) | Prismatic/Pouch |
| BMS | `bms` | Daly-style red aluminium heatsink PCB with balance pins and 3 power ports (B−/C−/P−) | All |
| Balance wires | `balance_wires` | S+1 wires: 1 black (pack−) + S red, routed via harness plane to BMS pins | All |
| Cables | `cables` | B+ red, B− black, P− orange, C− blue thick cables + brass output bolt terminals | All |

**Module-level constants** (change once, affect all builders):
- `WALL_MM = 2` — housing wall thickness used in every `yCenter` calculation
- `TERM_OFFSET_RATIO = 0.22` — prismatic terminal Z-offset as fraction of cell width

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

**uncompleted:**
- **Phase 6** — EVA foam insulation wrap + heat shrink sleeve over cell array (cylindrical and prismatic)
- **Phase 9** — Backend STEP export via CadQuery: new endpoint `POST /api/v1/export/step`, parametric solid from housing + cell array geometry
- **Option 4 — Housing-geometry-based positioning**: BMS, cables, and harness should attach to housing walls (flush against inner face) rather than to cell array bounds. Requires passing `housingL, housingW` into `buildBMS()`. BMS Z = `housingW / 2 - WALL_MM - bmsThick / 2`; harness Y = `housingH / 2 - 4`; cable exits at `housingH / 2`.

## Layout Notes

The bento grid uses `grid-template-rows: 2.4fr 1fr` at all desktop breakpoints (1024px+). At smaller viewports (< 1024px) the grid is `auto` rows, so `bio-card` and `contact-card` have explicit `max-height` values (200px at < 640px, 240px at 640–1023px) to keep scroll active.

The bottom row (`bottom-row`) is a flex row with `align-items: stretch`. Cards inside use `flex-direction: column; justify-content: flex-start; overflow: hidden; min-height: 0`. The result rows are in `.results-scroll-area` (`flex: 1; overflow-y: auto; min-height: 0`) so they scroll independently while the card size is fixed by the grid row.

## Your task
Is to review all the code and see if there's modifications must be done in the frontend or the design