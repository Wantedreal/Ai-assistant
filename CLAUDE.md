# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session Orientation

**At the start of every session, read this file first, then immediately read:**
`C:\Users\Azus\.claude\projects\C--Rayane-Capgemini-Engineering-PFE-Prototype-Template\memory\project_architecture_graph.md`

That file contains 10 Mermaid diagrams covering the full architecture, API, engine algorithm, component tree, data flow, 3D layers, constants, and build pipeline.

## Project Overview

Battery Pack Pre-Design Assistant — a desktop Electron application for electrical engineers to size Li-Ion battery packs. The user inputs housing dimensions and energy/current targets; the app outputs a Series×Parallel cell configuration with ACCEPT/REJECT verdict and 3D visualization.

## Architecture

```
Electron (frontend/electron/main.cjs)
  ├─ Spawns FastAPI backend process (Windows exe in production)
  └─ BrowserWindow → React (Vite dev server or dist/index.html)
        └─ Axios (http://127.0.0.1:8000/api/v1)
              └─ FastAPI backend
                    ├─ SQLite via SQLAlchemy (353+ battery cells)
                    ├─ Core sizing engine (backend/app/core/engine.py)
                    └─ PDF export (backend/app/pdf.py)
```

**Database master file:** `battery_cells_with_manual.xlsx` (project root) — 353 cells. Import via the app's Import button to populate SQLite.

**Key data flow:** User fills form → `POST /api/v1/calculate` → deterministic algorithm (P = ⌈I/I_max⌉, S = ⌈max(V, E/(V·C·P·DoD))⌉) → geometry check vs housing → result + 3D render update.

**Vite dev proxy:** `/api` → `http://127.0.0.1:8000`.

## Environment Setup (new machine)

**Python 3.12 is required** — cadquery/OCP has no Python 3.14 wheel.

```powershell
# Install Python 3.12 if not present
winget install Python.Python.3.12 --accept-source-agreements --accept-package-agreements

# Backend venv
cd backend
py -3.12 -m venv venv
venv\Scripts\pip install --prefer-binary fastapi uvicorn sqlalchemy "pandas>=2.2" openpyxl pydantic python-multipart reportlab cadquery pyinstaller truststore

# Frontend
cd frontend
npm install
```

**API keys** — create `backend/.env` with your keys (required for AI chat):
```
GROQ_API_KEY=your_key_here
OPENROUTER_API_KEY=your_key_here
# CAPGEMINI_API_KEY=your_key_here   # corporate Zscaler networks only
```
No keys are embedded in source code. The `.env` is bundled into the installer automatically by the build scripts.

## Development Commands

### Backend
```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```powershell
cd frontend
npm run dev          # Vite 8 dev server on port 5173
```

### Electron
```powershell
cd frontend
$env:ELECTRON_DEV='true'
npm run dev:electron  # Launches Electron 42 pointing at Vite dev server
```

All three must run simultaneously for full local development.

### Production Build

| Script | When to use | Time |
|--------|-------------|------|
| `build-smart.bat` | Auto-detects what changed (recommended) | — |
| `build-fast.bat` | Only frontend/JS/React changed | ~15 sec |
| `build-full.bat` | Backend Python code changed | ~3 min |

**`Ctrl+Shift+B`** in VS Code runs `build-smart.bat`.

Output: `frontend/release/Battery Pack Designer Setup 1.0.0.exe` — self-contained, no Python or Node.js needed on target machine.

**winCodeSign workaround:** electron-builder's winCodeSign step fails on Windows without Developer Mode. Both build scripts use the two-step approach: `electron-builder --win` (creates `win-unpacked`, ignore the error) then `electron-builder --win nsis --prepackaged release\win-unpacked`. Icon is embedded via rcedit found in `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign`.

## Key API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/health` | Health check (Electron polls on startup) |
| GET | `/api/v1/cells` | Full cell catalogue |
| GET | `/api/v1/cells/{id}` | Single cell |
| POST | `/api/v1/calculate` | Core sizing calculation |
| POST | `/api/v1/calculate/pdf` | PDF report generation |
| POST | `/api/v1/export/step` | STEP file export (CadQuery) |
| POST | `/api/v1/cells/import` | Upload `.xlsx` → truncate + re-insert catalogue |
| POST | `/api/v1/cells/sync` | Re-import from last saved source path |
| GET | `/api/v1/cells/import/config` | Returns saved source path |
| POST | `/api/v1/cells/import/config` | Save manual source path |
| DELETE | `/api/v1/cells/import/config` | Remove saved source path |
| POST | `/api/v1/cells/recommend` | Top 5 fitting + up to 3 near-miss cells |
| POST | `/api/v1/explain` | AI chemistry explainer (OpenRouter) |
| GET | `/api/v1/chat` | AI multi-turn chat (SSE streaming) |

Swagger UI: `http://localhost:8000/docs` (dev only — disabled in production exe).

## Frontend Component Layout

Bento grid:
- **Top-left:** `CellSelector.jsx` — searchable dropdown, Best Matches recommender, Import/Sync buttons
- **Center:** `ConstraintsForm.jsx` — housing dimensions + energy/current/voltage targets
- **Top-right:** `PackViewer3D.jsx` — Three.js 3D visualization (WebGL)
- **Bottom-left:** `CellSelector.jsx` (`CellActionCard`) — Calculate + Export PDF + inline ACCEPT/REJECT verdict
- **Bottom-center:** `ResultsPanel.jsx` — Electrical results (scrollable)
- **Bottom-right:** `ResultsPanel.jsx` — Mechanical results (scrollable)
- **Floating:** `AIFab.jsx` — AI chat panel (bottom-right corner)

### 3D Layers (`frontend/src/3d/PackAssemblyBuilder.js`)

| Layer | Group name | Cell types |
|-------|-----------|------------|
| Housing | `housing` | All |
| Dimensions | `dimensions` | All |
| Cells | `cells` | All |
| Terminals | `terminals` | All |
| Busbars | `busbars` | All |
| Brackets | `brackets` | Cylindrical only |
| Separator cards | `separator_cards` | Prismatic/Pouch |
| End plates | `end_plates` | Prismatic/Pouch |
| Side supports | `side_supports` | Prismatic/Pouch |

**Module constants:** `WALL_MM = 2`, `TERM_OFFSET_RATIO = 0.35`

**Cylindrical:** cells upright (Y = `hauteur_mm`), series in X, parallel in Z. Adjacent series columns alternate polarity.

**Prismatic/Pouch:** cells upright (Y = `longueur_mm`), series stacks thin-face in X (pitch = `hauteur_mm + gap`), parallel in Z (pitch = `largeur_mm + gap`).

## Cell Data Model

```python
class Cellule(Base):
    nom: str
    longueur_mm, largeur_mm, hauteur_mm: float
    diameter_mm: float        # nullable, cylindrical only
    masse_g: float
    tension_nominale: float
    capacite_ah: float
    courant_max_a: float
    type_cellule: str         # "Cylindrical" | "Prismatic" | "Pouch"
    taux_swelling_pct: float
    # Extended fields: fabricant, chimie, cycle_life, dod_reference_pct,
    # c_rate_max_discharge, c_rate_max_charge, energie_volumique_wh_l,
    # eol_capacity_pct, energie_massique_wh_kg, cutoff_voltage_v,
    # temp_min_c, temp_max_c, temp_max_charge_c, v_charge_max
```

## Engine Dimension Convention

| Cell type | `L_raw` (→ `housing_l`, X) | `W_raw` (→ `housing_l_small`, Z) | `H_raw` (→ `housing_h`, Y) |
|-----------|---------------------------|----------------------------------|---------------------------|
| Cylindrical | `S × diameter` | `P × diameter` | `hauteur_mm` |
| Prismatic/Pouch | `S × hauteur_mm` | `P × largeur_mm` | `longueur_mm` |

## AI Chat Providers

`backend/app/chat.py` — streaming SSE, provider selected by dropdown in chat header:
- **Auto** — Groq → OpenRouter fallback (never Capgemini)
- **Capgemini** — `https://openai.generative.engine.capgemini.com/v1/chat/completions`, model `anthropic.claude-sonnet-4-6`, requires `CAPGEMINI_API_KEY` in `.env`; needed on Zscaler networks
- **Groq** — `GROQ_API_KEY` from `.env`
- **OpenRouter** — `OPENROUTER_API_KEY` from `.env`, 3-model fallback chain

`truststore.inject_into_ssl()` at startup trusts Windows certificate store (Zscaler CA) in both dev and exe modes.

## Security

- **No hardcoded keys** — all API keys read from `backend/.env` only
- **Swagger disabled** in production exe (`docs_url=None`)
- **CORS** restricted to `localhost`/`127.0.0.1` origins only
- **Upload limit** 50 MB on Excel import endpoint
- **Bandit** clean (0 findings); `hashlib.md5(..., usedforsecurity=False)` for non-security cache key
- **pip-audit + npm audit** both report 0 vulnerabilities
- **GPU sandbox** enforced (no `--disable-gpu-sandbox` flag)

## Build Pipeline Files

| File | Purpose |
|------|---------|
| `backend/run.py` | PyInstaller entry point — `freeze_support()` then uvicorn |
| `backend/backend.spec` | PyInstaller spec with all hidden imports |
| `build-smart.bat` | Auto-detects backend changes via git diff |
| `build-fast.bat` | Frontend + Electron only (~15 sec) |
| `build-full.bat` | Backend + frontend + installer (~3 min) |
| `backend/tests/test_suite.py` | 63-test pytest suite — run before every build |

**Run tests:** `cd backend && venv\Scripts\python.exe -m pytest tests/test_suite.py -v`

## Debugging Protocol

**Reproduce consistently → investigate → form hypothesis → demonstrate root cause → fix.**

- Do not patch symptoms.
- Check backend logs and browser DevTools console together.
- Backend log in production: `%APPDATA%\backend.log`

## Code Style

- Simple, incremental changes — no overengineering
- No defensive programming for impossible scenarios
- Minimal comments — only when WHY is non-obvious
- No emojis in logs or print statements

## Layout Notes

Bento grid: `grid-template-rows: 2.4fr 1fr` at 1024px+. Bottom row is flex with `align-items: stretch`. Result rows live in `.results-scroll-area` (`flex: 1; overflow-y: auto; min-height: 0`).

## Distribution

Copy `frontend/release/Battery Pack Designer Setup 1.0.0.exe` to target machine. Double-click → install. Windows SmartScreen: "More info" → "Run anyway". If it fails on a very old machine, install VC++ 2015-2022 Redistributable x64.
