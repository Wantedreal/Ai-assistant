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
- **Bottom:** `ResultsPanel.jsx` — S×P config, dimensions, verdict

### 3D Visualization (`frontend/src/3d/PackAssemblyBuilder.js`)

Builds the scene in named `THREE.Group` layers (toggle with `setLayerVisible`):

| Layer | Contents |
|-------|----------|
| `housing` | Transparent blue enclosure walls |
| `cells` | Instanced cell bodies + edge outlines |
| `terminals` | Positive/negative terminal geometry |
| `busbars` | Nickel strips (cylindrical) or copper busbars (prismatic) |

**Cylindrical axis convention** — cells stand upright (Y = `hauteur_mm`), series spreads in X with pitch = `diameter_mm`, parallel spreads in Z with pitch = `diameter_mm`. Adjacent series columns alternate polarity (flip 180°).

**Prismatic/Pouch axis convention** — cells stand upright (Y = `longueur_mm`), series stacks thin-face-to-thin-face in X with pitch = `hauteur_mm`, parallel spreads in Z with pitch = `largeur_mm`.

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

**Completed (Phase 0, 1, 2, 3, 4, 7):**
- Cylindrical cells with alternating polarity, positive/negative terminals, insulation rings, nickel strips
- Prismatic cells standing upright with terminals and copper busbars (snake-path series routing)
- Engine dimension fix: prismatic `L/W/H` now matches the 3D axis convention exactly
- Cylindrical cell brackets (perforated ABS plates top+bottom via ExtrudeGeometry with holes)
- Prismatic insulation cards (orange Nomex sheets between series groups)
- Prismatic side/end compression plates (steel gray)
- Layer toggle UI (`LayerControlPanel.jsx`) — fullscreen only, conditional on cell type

**Next phases (cylindrical and prismatic only for now):**
- BMS, balance wires, main cables (Phase 5)
- Insulation wrap + heat shrink (Phase 6)
- Export to GLTF/STL (client-side Three.js) and STEP (backend via CadQuery) (Phase 8, 9)
- New backend endpoint: `POST /api/v1/export/step`
