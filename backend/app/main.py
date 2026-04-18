"""
FastAPI application — Battery Pack Pre-Design Assistant
Capgemini Engineering | PFE 2025

Endpoints:
    GET  /api/v1/health           — Health check (Docker / CI)
    GET  /api/v1/cells            — Full cell catalogue
    GET  /api/v1/cells/{cell_id}  — Single cell detail
    POST /api/v1/calculate        — Core sizing engine
    GET  /docs                    — Swagger UI (auto-generated)
    GET  /redoc                   — ReDoc documentation

Run:
    uvicorn app.main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List

from app.db.database import engine, get_db, init_db
from app.models.cellule import Cellule
from app.schemas.battery import CalculationRequest, CalculationResult, CellRead
from app.core.engine import run_engine
from app.pdf import generate_pdf_report
from app.step_export import generate_step_file

# ── Create tables on startup (idempotent — safe to call multiple times) ───────
init_db()


# ══════════════════════════════════════════════════════════════════════════════
# APPLICATION SETUP
# ══════════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="Battery Pack Pre-Design Assistant",
    description="""
## Assistant IA — Pré-conception de Packs Batteries Li-Ion
**Capgemini Engineering | PFE 2025**

Moteur de calcul électromécanique déterministe pour le dimensionnement
S/P (Série/Parallèle) et la vérification géométrique de packs batteries.

### Workflow
1. `GET /api/v1/cells` → Récupérer le catalogue de cellules
2. `POST /api/v1/calculate` → Calculer la configuration optimale
3. Lire le **verdict** `ACCEPT` / `REJECT` et les dimensions de l'Array

### Règles physiques appliquées
- Marge de sécurité : **15 mm minimum par face** (ENF-02)
- Taux de swelling intégré dans le calcul géométrique (EF-03)
- Précision mathématique cible : **< 2%** d'erreur (KR 1.1)
    """,
    version="1.0.0",
    contact={
        "name": "Capgemini Engineering — PFE Battery Team",
        "email": "pfe-battery@capgemini.com",
    },
    license_info={"name": "Proprietary — Capgemini Engineering"},
)

# ── CORS — allow React dev server ─────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:80",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@app.get(
    "/api/v1/health",
    tags=["System"],
    summary="Health check",
)
def health_check():
    """
    Vérifie que l'API est opérationnelle.
    Utilisé par Docker HEALTHCHECK et les pipelines CI/CD.
    """
    return {
        "status": "ok",
        "version": "1.0.0",
        "database": "sqlite",
        "engine": "deterministic"
    }


@app.get(
    "/api/v1/cells",
    response_model=List[CellRead],
    tags=["Catalogue"],
    summary="Lister toutes les cellules disponibles",
)
def get_all_cells(db: Session = Depends(get_db)):
    """
    Retourne l'intégralité du catalogue de cellules Li-Ion.
    Utilisé par React pour alimenter le menu déroulant de sélection.
    """
    cells = db.query(Cellule).order_by(Cellule.id).all()
    if not cells:
        raise HTTPException(
            status_code=404,
            detail="Catalogue vide — exécutez import_data.py pour initialiser les données."
        )
    return cells


@app.get(
    "/api/v1/cells/{cell_id}",
    response_model=CellRead,
    tags=["Catalogue"],
    summary="Détail d'une cellule",
)
def get_cell_by_id(cell_id: int, db: Session = Depends(get_db)):
    """
    Retourne les spécifications complètes d'une cellule par son ID.
    Utile pour afficher une fiche technique dans l'UI ou pour le rapport PDF.
    """
    cell = db.query(Cellule).filter(Cellule.id == cell_id).first()
    if not cell:
        raise HTTPException(
            status_code=404,
            detail=f"Cellule avec id={cell_id} introuvable dans le catalogue."
        )
    return cell


@app.post(
    "/api/v1/calculate",
    response_model=CalculationResult,
    tags=["Moteur de Calcul"],
    summary="Calculer la configuration optimale du pack",
    responses={
        200: {"description": "Calcul réussi — verdict ACCEPT ou REJECT"},
        404: {"description": "Cellule introuvable dans le catalogue"},
        422: {"description": "Données d'entrée invalides (validation Pydantic)"},
    },
)
def calculate_pack(
    req: CalculationRequest,
    db: Session = Depends(get_db)
):
    """
    ## Moteur de calcul principal

    Prend les contraintes utilisateur, exécute le moteur électromécanique
    et retourne la configuration S/P avec verdict géométrique.

    ### Algorithme (mode auto)
    1. **P** = ⌈ I_target / I_cell_max ⌉  — contrainte courant
    2. **S** = ⌈ E_target / (V_nom × C_cell × P) ⌉  — contrainte énergie
    3. **Géométrie** = S × L_cell × (1 + swelling%) + 2×marge
    4. **Verdict** : ACCEPT si Array ≤ Housing sur les 3 axes, REJECT sinon

    ### Exemple (cellule INR18650-35E)
    - Énergie cible : 55 kWh, Courant cible : 200 A
    - Housing : 1200 × 900 × 300 mm
    - Marge : 15 mm
    """
    # Fetch the selected cell from the real SQLite database
    cell = db.query(Cellule).filter(Cellule.id == req.cell_id).first()
    if not cell:
        raise HTTPException(
            status_code=404,
            detail=f"Cellule id={req.cell_id} introuvable. "
                   f"Vérifiez le catalogue via GET /api/v1/cells."
        )

    # Execute the deterministic core engine
    try:
        result = run_engine(req, cell)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return result


@app.post(
    "/api/v1/calculate/pdf",
    tags=["Moteur de Calcul"],
    summary="Generate PDF report for pack configuration",
    responses={
        200: {"description": "PDF file"},
        404: {"description": "Cell not found"},
        422: {"description": "Invalid input data"},
    },
)
def generate_report_pdf(
    req: CalculationRequest,
    db: Session = Depends(get_db)
):
    """
    Generate a PDF report for the battery pack calculation.
    
    Returns the calculation result with comprehensive details:
    - Input parameters (housing, energy, current, margins)
    - Calculated configuration (S/P, dimensions, totals)
    - Electrical summary (voltage, energy, weight, density)
    - Verdict (ACCEPT/REJECT) with justification
    - Page numbers in footer
    """
    # Fetch the selected cell
    cell = db.query(Cellule).filter(Cellule.id == req.cell_id).first()
    if not cell:
        raise HTTPException(
            status_code=404,
            detail=f"Cell id={req.cell_id} not found in catalogue."
        )
    
    # Execute the calculation
    try:
        result = run_engine(req, cell)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Generate PDF in memory
    pdf_buffer = generate_pdf_report(req, result, cell)
    
    # Return as downloadable PDF
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=battery_report.pdf"}
    )


@app.post(
    "/api/v1/export/step",
    tags=["Moteur de Calcul"],
    summary="Export battery pack as STEP file",
    responses={
        200: {"description": "STEP file (AP214)"},
        404: {"description": "Cell not found"},
        422: {"description": "Invalid input data"},
    },
)
def export_step(
    req: CalculationRequest,
    db: Session = Depends(get_db)
):
    """
    Generate a parametric STEP file of the full battery pack assembly.

    Geometry matches the 3D viewer exactly — housing, cells, terminals,
    busbars, brackets / insulation cards / side plates, BMS, balance wires
    and main cables. Importable into SolidWorks, CATIA, Fusion 360, FreeCAD.
    """
    cell = db.query(Cellule).filter(Cellule.id == req.cell_id).first()
    if not cell:
        raise HTTPException(
            status_code=404,
            detail=f"Cell id={req.cell_id} not found in catalogue."
        )

    try:
        result = run_engine(req, cell)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    step_buf = generate_step_file(req, result, cell)

    return StreamingResponse(
        step_buf,
        media_type="application/step",
        headers={"Content-Disposition": "attachment; filename=battery_pack.step"}
    )


# ── Root and fallback endpoints ───────────────────────────────────────────────

@app.get("/")
def read_root():
    """Root endpoint"""
    return {
        "message": "Welcome to Battery Pack Pre-Design Assistant API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
        "health": "/api/v1/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
