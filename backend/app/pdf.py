"""
PDF Report generation for battery pack calculations
"""
from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT


def generate_pdf_report(calculation_request, calculation_result, cell_info):
    """
    Generate a PDF report for the battery pack calculation.
    
    Args:
        calculation_request: CalculationRequest object with input parameters
        calculation_result: CalculationResult object with output configuration
        cell_info: CellRead object with cell specifications
    
    Returns:
        BytesIO: PDF file in memory
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=15*mm, bottomMargin=20*mm)
    story = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1a3a52'),
        spaceAfter=12,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#2c5aa0'),
        spaceAfter=10,
        spaceBefore=12,
        fontName='Helvetica-Bold',
        borderPadding=8,
        backColor=colors.HexColor('#e8f0f7')
    )
    
    normal_style = ParagraphStyle(
        'Custom',
        parent=styles['Normal'],
        fontSize=10,
        leading=12
    )
    
    # ─── Title & Date ───────────────────────────────────────────────────
    story.append(Paragraph("BATTERY PACK CONFIGURATION REPORT", title_style))
    story.append(Spacer(1, 5*mm))
    
    date_text = datetime.now().strftime("%d %B %Y at %H:%M:%S")
    story.append(Paragraph(f"<i>Generated on {date_text}</i>", 
                          ParagraphStyle('dateStyle', parent=styles['Normal'], 
                                       alignment=TA_CENTER, fontSize=9, 
                                       textColor=colors.grey)))
    story.append(Spacer(1, 10*mm))
    
    # ─── Input Parameters ───────────────────────────────────────────────
    story.append(Paragraph("INPUT PARAMETERS", heading_style))
    
    input_data = [
        ['Parameter', 'Value'],
        ['Cell Name', cell_info.nom],
        ['Housing Length', f"{calculation_request.housing_l:.1f} mm"],
        ['Housing Width', f"{calculation_request.housing_l_small:.1f} mm"],
        ['Housing Height', f"{calculation_request.housing_h:.1f} mm"],
        ['Target Energy', f"{calculation_request.energie_cible_wh:.1f} Wh"],
        ['Target Current', f"{calculation_request.courant_cible_a:.1f} A"],
        ['Safety Margin', f"{calculation_request.marge_mm:.1f} mm"],
        ['Depth of Discharge', f"{calculation_request.depth_of_discharge:.1f}%"],
    ]
    
    input_table = Table(input_data, colWidths=[80*mm, 90*mm])
    input_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5aa0')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f5f5f5')),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
    ]))
    story.append(input_table)
    story.append(Spacer(1, 10*mm))
    
    # ─── Calculated Configuration ────────────────────────────────────────
    story.append(Paragraph("CALCULATED CONFIGURATION", heading_style))
    
    config_data = [
        ['Parameter', 'Value'],
        ['Series (S)', str(calculation_result.nb_serie)],
        ['Parallel (P)', str(calculation_result.nb_parallele)],
        ['Total Cells', str(calculation_result.nb_serie * calculation_result.nb_parallele)],
        ['Array Length', f"{calculation_result.dimensions_array.longueur_mm:.1f} mm"],
        ['Array Width', f"{calculation_result.dimensions_array.largeur_mm:.1f} mm"],
        ['Array Height', f"{calculation_result.dimensions_array.hauteur_mm:.1f} mm"],
        ['Volume Occupancy', f"{calculation_result.taux_occupation_pct:.1f}%"],
    ]
    
    config_table = Table(config_data, colWidths=[80*mm, 90*mm])
    config_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5aa0')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f5f5f5')),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
    ]))
    story.append(config_table)
    story.append(Spacer(1, 10*mm))
    
    # ─── Electrical Summary ─────────────────────────────────────────────
    story.append(Paragraph("ELECTRICAL SUMMARY", heading_style))
    
    elec_summary = calculation_result.electrical
    elec_data = [
        ['Parameter', 'Value'],
        ['Total Voltage', f"{elec_summary.actual_voltage_v:.2f} V"],
        ['Total Capacity', f"{elec_summary.actual_capacity_ah:.2f} Ah"],
        ['Total Energy', f"{elec_summary.total_energy_wh:.1f} Wh"],
        ['Usable Energy', f"{elec_summary.usable_energy_wh:.1f} Wh"],
        ['Total Weight', f"{elec_summary.total_weight_kg:.2f} kg"],
        ['Energy Density', f"{elec_summary.energy_density_wh_kg:.2f} Wh/kg"],
    ]
    
    elec_table = Table(elec_data, colWidths=[80*mm, 90*mm])
    elec_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5aa0')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f5f5f5')),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
    ]))
    story.append(elec_table)
    story.append(Spacer(1, 12*mm))
    
    # ─── Verdict Badge ──────────────────────────────────────────────────
    if calculation_result.verdict.value == "ACCEPT":
        verdict_color = colors.HexColor('#27ae60')
        text_color = colors.white
        verdict_text = "✓ ACCEPT"
    else:
        verdict_color = colors.HexColor('#e74c3c')
        text_color = colors.white
        verdict_text = "✗ REJECT"
    
    verdict_style = ParagraphStyle(
        'VerdictStyle',
        parent=styles['Normal'],
        fontSize=18,
        textColor=text_color,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    verdict_table = Table([[verdict_text]], colWidths=[170*mm])
    verdict_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), verdict_color),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
    ]))
    story.append(verdict_table)
    story.append(Spacer(1, 10*mm))
    
    # ─── Justification ──────────────────────────────────────────────────
    story.append(Paragraph("JUSTIFICATION", heading_style))
    story.append(Paragraph(calculation_result.justification, normal_style))
    story.append(Spacer(1, 10*mm))
    
    # ─── Margins Info ───────────────────────────────────────────────────
    if hasattr(calculation_result, 'marges_reelles'):
        story.append(Paragraph("REAL MARGINS", heading_style))
        margins = calculation_result.marges_reelles
        margins_data = [
            ['Direction', 'Margin (mm)'],
            ['Length', f"{margins.get('L', 0):.1f}"],
            ['Width', f"{margins.get('W', 0):.1f}"],
            ['Height', f"{margins.get('H', 0):.1f}"],
        ]
        
        margins_table = Table(margins_data, colWidths=[80*mm, 90*mm])
        margins_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5aa0')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('TOPPADDING', (0, 0), (-1, 0), 8),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f5f5f5')),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
        ]))
        story.append(margins_table)
    
    # Build PDF with custom footer
    doc.build(story, onFirstPage=_add_footer, onLaterPages=_add_footer)
    buffer.seek(0)
    return buffer


def _add_footer(canvas_obj, doc):
    """Add page number to footer"""
    canvas_obj.saveState()
    canvas_obj.setFont("Helvetica", 9)
    canvas_obj.setFillColor(colors.grey)
    page_num = doc.page
    canvas_obj.drawRightString(210*mm - 15*mm, 10*mm, f"Page {page_num}")
    canvas_obj.restoreState()
