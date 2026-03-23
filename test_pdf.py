#!/usr/bin/env python
"""Test PDF generation directly without HTTP"""

import sys
sys.path.insert(0, r'c:\Users\rmatloub\Desktop\DEV_Projet\Ai-assistant')

from backend.app.pdf import generate_pdf_report
from backend.app.schemas.battery import CalculationRequest, CalculationResult, ArrayDimensions, ElectricalSummary, CellRead, VerdictEnum

# Mock test data
test_request = CalculationRequest(
    cell_id=1,
    energie_cible_wh=3500,
    tension_cible_v=70,
    courant_cible_a=200,
    housing_l=400,
    housing_l_small=400,
    housing_h=100,
    marge_mm=15,
    depth_of_discharge=80,
    config_mode='auto'
)

test_cell = CellRead(
    id=1,
    nom='INR18650-35E',
    longueur_mm=65.15,
    largeur_mm=18.2,
    hauteur_mm=18.2,
    masse_g=45.5,
    tension_nominale=3.7,
    capacite_ah=3.5,
    courant_max_a=10,
    type_cellule='18650 Li-ion',
    taux_swelling_pct=3.0
)

test_result = CalculationResult(
    nb_serie=20,
    nb_parallele=10,
    dimensions_array=ArrayDimensions(
        longueur_mm=370,
        largeur_mm=370,
        hauteur_mm=85
    ),
    verdict=VerdictEnum.ACCEPT,
    justification="Pack fits within housing with safe margins. All constraints satisfied.",
    taux_occupation_pct=68.5,
    marges_reelles={'L': 15, 'W': 15, 'H': 7.5},
    energie_reelle_wh=3640,
    tension_totale_v=74.0,
    courant_total_a=200,
    total_cells=200,
    dimensions_raw=ArrayDimensions(
        longueur_mm=340,
        largeur_mm=340,
        hauteur_mm=1302
    ),
    electrical=ElectricalSummary(
        actual_voltage_v=74.0,
        actual_capacity_ah=35.0,
        total_energy_wh=2590,
        usable_energy_wh=2072,
        total_weight_kg=9.1,
        energy_density_wh_kg=284.6
    ),
    config_mode='auto',
    cell_used=test_cell
)

# Generate PDF
try:
    pdf_buffer = generate_pdf_report(test_request, test_result, test_cell)
    
    # Save to file
    with open('test_report.pdf', 'wb') as f:
        f.write(pdf_buffer.getvalue())
    
    print("✓ PDF generated successfully!")
    print(f"  File size: {len(pdf_buffer.getvalue())} bytes")
    print("  Saved to: test_report.pdf")
    
except Exception as e:
    print(f"✗ PDF generation failed: {e}")
    import traceback
    traceback.print_exc()
