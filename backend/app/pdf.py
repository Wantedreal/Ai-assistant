"""
PDF Report generation for battery pack calculations.
Professional engineering report with step-by-step methodology and A.N.
"""
import math
from io import BytesIO
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle,
    Paragraph, Spacer, HRFlowable, KeepTogether,
)
from reportlab.graphics.shapes import (
    Drawing, Rect, Line, String, Polygon, Group,
)

# ─── Palette ──────────────────────────────────────────────────────────────────
_BLUE_DARK    = colors.HexColor('#1a3a52')
_BLUE_MID     = colors.HexColor('#2c5aa0')
_BLUE_LIGHT   = colors.HexColor('#dbeafe')
_BLUE_CELL    = colors.HexColor('#2563eb')
_BLUE_CELL2   = colors.HexColor('#1d4ed8')  # alternate polarity column
_RED_CELL     = colors.HexColor('#ef4444')
_RED_CELL2    = colors.HexColor('#dc2626')
_GREEN_OK     = colors.HexColor('#15803d')
_RED_KO       = colors.HexColor('#b91c1c')
_GREEN_BG     = colors.HexColor('#dcfce7')
_RED_BG       = colors.HexColor('#fee2e2')
_GRAY_BORDER  = colors.HexColor('#d1d5db')
_GRAY_ROW     = colors.HexColor('#f9fafb')
_HOUSING_FILL = colors.HexColor('#eff6ff')
_DIM_COLOR    = colors.HexColor('#374151')


# ─── Shared table style ───────────────────────────────────────────────────────
def _ts(header=_BLUE_MID):
    return TableStyle([
        ('BACKGROUND',    (0, 0), (-1, 0),  header),
        ('TEXTCOLOR',     (0, 0), (-1, 0),  colors.white),
        ('FONTNAME',      (0, 0), (-1, 0),  'Helvetica-Bold'),
        ('FONTSIZE',      (0, 0), (-1, 0),  9),
        ('TOPPADDING',    (0, 0), (-1, 0),  6),
        ('BOTTOMPADDING', (0, 0), (-1, 0),  6),
        ('ALIGN',         (0, 0), (-1, -1), 'LEFT'),
        ('FONTSIZE',      (0, 1), (-1, -1), 9),
        ('TOPPADDING',    (0, 1), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
        ('ROWBACKGROUNDS',(0, 1), (-1, -1), [colors.white, _GRAY_ROW]),
        ('GRID',          (0, 0), (-1, -1), 0.5, _GRAY_BORDER),
        ('LEFTPADDING',   (0, 0), (-1, -1), 8),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 8),
    ])


# ─── Pack top-down schematic ──────────────────────────────────────────────────
def _arrow(d, x1, y1, x2, y2, color=_DIM_COLOR):
    """Dimension line with arrowheads."""
    d.add(Line(x1, y1, x2, y2, strokeColor=color, strokeWidth=0.6))
    h = 3.5
    if abs(x2 - x1) >= abs(y2 - y1):  # horizontal
        d.add(Polygon([x1, y1, x1+h, y1+h/2, x1+h, y1-h/2],
                      fillColor=color, strokeColor=color, strokeWidth=0))
        d.add(Polygon([x2, y2, x2-h, y2+h/2, x2-h, y2-h/2],
                      fillColor=color, strokeColor=color, strokeWidth=0))
    else:  # vertical
        d.add(Polygon([x1, y1, x1+h/2, y1+h, x1-h/2, y1+h],
                      fillColor=color, strokeColor=color, strokeWidth=0))
        d.add(Polygon([x2, y2, x2+h/2, y2-h, x2-h/2, y2-h],
                      fillColor=color, strokeColor=color, strokeWidth=0))


def _pack_schematic(req, result, cell_info):
    """
    Build a proportional top-down 2D schematic of the pack.
    Returns a ReportLab Drawing (Flowable).
    X axis (horizontal) = series direction L
    Y axis (vertical)   = parallel direction l
    """
    S   = result.nb_serie
    P   = result.nb_parallele
    gap = getattr(req, 'cell_gap_mm', 0.0)
    ok  = result.verdict.value == 'ACCEPT'

    cell_type = (cell_info.type_cellule or 'Pouch').lower()
    if cell_type == 'cylindrical':
        diam  = cell_info.diameter_mm or cell_info.longueur_mm
        cx_mm = diam
        cz_mm = diam
    else:
        cx_mm = cell_info.hauteur_mm   # thin face → series axis X
        cz_mm = cell_info.largeur_mm   # wide face → parallel axis Z

    hL = req.housing_l
    hW = req.housing_l_small

    # ── Scale to fit on page ─────────────────────────────────────────────
    margin_pt = 28          # space around housing for dimension lines
    max_w = 170 * mm - 2 * margin_pt
    max_h = 85  * mm - 2 * margin_pt
    scale = min(max_w / hL, max_h / hW)

    hL_pt = hL * scale
    hW_pt = hW * scale
    draw_w = hL_pt + 2 * margin_pt
    draw_h = hW_pt + 2 * margin_pt

    ox = margin_pt   # housing left
    oy = margin_pt   # housing bottom

    d = Drawing(draw_w, draw_h)

    # ── Housing ──────────────────────────────────────────────────────────
    d.add(Rect(ox, oy, hL_pt, hW_pt,
               fillColor=_HOUSING_FILL,
               strokeColor=_BLUE_MID, strokeWidth=1.5))

    # ── Array bounding box (raw, no swelling) ────────────────────────────
    arr_L = result.dimensions_raw.longueur_mm
    arr_W = result.dimensions_raw.largeur_mm
    arr_L_pt = arr_L * scale
    arr_W_pt = arr_W * scale
    arr_ox = ox + (hL_pt - arr_L_pt) / 2
    arr_oy = oy + (hW_pt - arr_W_pt) / 2

    step_x_pt = (cx_mm + gap) * scale
    step_z_pt = (cz_mm + gap) * scale

    # Ensure the inter-cell gap is always visible in the schematic (min 1.5 pt when gap > 0)
    pad = max(gap * scale, 1.5) if gap > 0 else 0.5
    cx_draw = step_x_pt - pad
    cz_draw = step_z_pt - pad

    c1 = _BLUE_CELL  if ok else _RED_CELL
    c2 = _BLUE_CELL2 if ok else _RED_CELL2

    if S * P <= 400:
        for s in range(S):
            for p in range(P):
                lx = arr_ox + s * step_x_pt + pad / 2
                ly = arr_oy + p * step_z_pt + pad / 2
                fill = c1 if s % 2 == 0 else c2
                d.add(Rect(lx, ly, cx_draw, cz_draw,
                           fillColor=fill,
                           strokeColor=colors.white, strokeWidth=0.3))
    else:
        # Too many cells — draw array footprint only
        d.add(Rect(arr_ox, arr_oy, arr_L_pt, arr_W_pt,
                   fillColor=c1, strokeColor=colors.white, strokeWidth=1))
        d.add(String(arr_ox + arr_L_pt / 2, arr_oy + arr_W_pt / 2,
                     f'{S}×{P} cells', fontSize=8, textAnchor='middle',
                     fillColor=colors.white, fontName='Helvetica-Bold'))

    # ── Dimension line — housing length (bottom) ─────────────────────────
    dim_y = oy - 16
    _arrow(d, ox, dim_y, ox + hL_pt, dim_y)
    d.add(Line(ox,         oy, ox,         dim_y - 2, strokeColor=_DIM_COLOR, strokeWidth=0.4))
    d.add(Line(ox + hL_pt, oy, ox + hL_pt, dim_y - 2, strokeColor=_DIM_COLOR, strokeWidth=0.4))
    d.add(String((ox * 2 + hL_pt) / 2, dim_y + 3,
                 f'L = {hL:.0f} mm', fontSize=7, textAnchor='middle',
                 fillColor=_DIM_COLOR, fontName='Helvetica'))

    # ── Dimension line — housing width (left) ────────────────────────────
    dim_x = ox - 18
    _arrow(d, dim_x, oy, dim_x, oy + hW_pt)
    d.add(Line(ox, oy,         dim_x - 2, oy,         strokeColor=_DIM_COLOR, strokeWidth=0.4))
    d.add(Line(ox, oy + hW_pt, dim_x - 2, oy + hW_pt, strokeColor=_DIM_COLOR, strokeWidth=0.4))
    d.add(String(dim_x - 3, (oy * 2 + hW_pt) / 2,
                 f'l={hW:.0f}', fontSize=6, textAnchor='end',
                 fillColor=_DIM_COLOR, fontName='Helvetica'))

    # ── S / P axis labels ─────────────────────────────────────────────────
    d.add(String(arr_ox + arr_L_pt / 2, arr_oy + arr_W_pt + 5,
                 f'← S = {S} series →',
                 fontSize=7, textAnchor='middle',
                 fillColor=_BLUE_MID, fontName='Helvetica-Bold'))
    # Vertical label approximation (stack chars isn't easy — use rotated approach)
    # Instead, place it above-left
    d.add(String(ox + 3, oy + hW_pt - 8,
                 f'P={P}',
                 fontSize=7, textAnchor='start',
                 fillColor=_BLUE_MID, fontName='Helvetica-Bold'))

    # ── Legend ────────────────────────────────────────────────────────────
    leg_x = ox + hL_pt + 6
    leg_y = oy + hW_pt - 8
    if leg_x + 40 < draw_w:  # only if space available
        d.add(Rect(leg_x, leg_y,      8, 6, fillColor=_HOUSING_FILL, strokeColor=_BLUE_MID, strokeWidth=0.8))
        d.add(String(leg_x + 10, leg_y + 1, 'Housing', fontSize=6, fillColor=_DIM_COLOR))
        d.add(Rect(leg_x, leg_y - 10, 8, 6, fillColor=c1, strokeColor=colors.white, strokeWidth=0.3))
        d.add(String(leg_x + 10, leg_y - 9, 'Cells', fontSize=6, fillColor=_DIM_COLOR))

    return d


# ─── Styles ───────────────────────────────────────────────────────────────────
def _make_styles():
    base = getSampleStyleSheet()

    title = ParagraphStyle('RTitle', parent=base['Normal'],
        fontSize=20, fontName='Helvetica-Bold',
        textColor=_BLUE_DARK, alignment=TA_CENTER, spaceAfter=10)

    subtitle = ParagraphStyle('RSubtitle', parent=base['Normal'],
        fontSize=9, fontName='Helvetica',
        textColor=colors.HexColor('#6b7280'), alignment=TA_CENTER, spaceAfter=0)

    section = ParagraphStyle('RSection', parent=base['Normal'],
        fontSize=11, fontName='Helvetica-Bold',
        textColor=colors.white,
        backColor=_BLUE_MID,
        borderPadding=(5, 8, 5, 8),
        spaceBefore=10, spaceAfter=6)

    subsection = ParagraphStyle('RSubSection', parent=base['Normal'],
        fontSize=10, fontName='Helvetica-Bold',
        textColor=_BLUE_MID,
        spaceBefore=8, spaceAfter=4)

    formula = ParagraphStyle('RFormula', parent=base['Normal'],
        fontSize=10, fontName='Helvetica-Oblique',
        textColor=_BLUE_DARK,
        backColor=_BLUE_LIGHT,
        borderPadding=(4, 8, 4, 8),
        leftIndent=0, spaceAfter=3, spaceBefore=3)

    an = ParagraphStyle('RAN', parent=base['Normal'],
        fontSize=10, fontName='Helvetica',
        textColor=colors.HexColor('#1f2937'),
        leftIndent=12, spaceAfter=2)

    result_line = ParagraphStyle('RResult', parent=base['Normal'],
        fontSize=10, fontName='Helvetica-Bold',
        textColor=_BLUE_DARK,
        leftIndent=12, spaceAfter=6)

    note = ParagraphStyle('RNote', parent=base['Normal'],
        fontSize=9, fontName='Helvetica-Oblique',
        textColor=colors.HexColor('#6b7280'),
        leftIndent=12, spaceAfter=4)

    normal = ParagraphStyle('RNormal', parent=base['Normal'],
        fontSize=10, leading=14)

    caption = ParagraphStyle('RCaption', parent=base['Normal'],
        fontSize=8, fontName='Helvetica-Oblique',
        textColor=colors.HexColor('#6b7280'),
        alignment=TA_CENTER, spaceAfter=6)

    return dict(title=title, subtitle=subtitle, section=section,
                subsection=subsection, formula=formula, an=an,
                result_line=result_line, note=note, normal=normal,
                caption=caption)


# ─── Footer ───────────────────────────────────────────────────────────────────
def _footer(canvas_obj, doc):
    canvas_obj.saveState()
    canvas_obj.setFont('Helvetica', 8)
    canvas_obj.setFillColor(colors.HexColor('#9ca3af'))
    canvas_obj.drawString(20 * mm, 10 * mm,
        'Battery Pack Pre-Design Assistant — Capgemini Engineering')
    canvas_obj.drawRightString(190 * mm, 10 * mm, f'Page {doc.page}')
    canvas_obj.restoreState()


# ─── Main entry point ─────────────────────────────────────────────────────────
def generate_pdf_report(calculation_request, calculation_result, cell_info):
    """
    Generate a professional engineering PDF report.

    Args:
        calculation_request : CalculationRequest
        calculation_result  : CalculationResult
        cell_info           : CellRead

    Returns:
        BytesIO : PDF in memory
    """
    req    = calculation_request
    result = calculation_result
    cell   = cell_info

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            topMargin=18*mm, bottomMargin=22*mm,
                            leftMargin=20*mm, rightMargin=20*mm)
    st  = _make_styles()
    S   = result.nb_serie
    P   = result.nb_parallele
    is_manual   = (result.config_mode == 'manual')
    is_ok       = (result.verdict.value == 'ACCEPT')
    cell_type   = (cell.type_cellule or 'Pouch').lower()
    gap         = getattr(req, 'cell_gap_mm', 0.0)
    swelling_raw = cell.taux_swelling_pct
    swelling_pct = swelling_raw if swelling_raw > 1.0 else swelling_raw * 100.0
    sw_factor    = 1.0 + swelling_pct / 100.0
    dod_dec      = req.depth_of_discharge / 100.0

    story = []

    # ══════════════════════════════════════════════════════════════════════════
    # PAGE 1 — Cover / Inputs
    # ══════════════════════════════════════════════════════════════════════════

    # ── Title block ──────────────────────────────────────────────────────────
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph('BATTERY PACK PRE-DESIGN REPORT', st['title']))
    story.append(Paragraph(
        datetime.now().strftime('Generated on %d %B %Y at %H:%M'),
        st['subtitle']))
    story.append(Spacer(1, 3*mm))
    story.append(HRFlowable(width='100%', thickness=1.5, color=_BLUE_MID))
    story.append(Spacer(1, 6*mm))

    # ── Input parameters ─────────────────────────────────────────────────────
    story.append(Paragraph('1. INPUT PARAMETERS', st['section']))

    def _fmt_opt(v, unit='', digits=1):
        if v is None:
            return '—'
        return f'{v:.{digits}f} {unit}'.strip()

    mode_label = 'Manual (S, P imposed)' if is_manual else 'Automatic'
    input_rows = [
        ['Parameter', 'Symbol', 'Value'],
        ['Cell model',              '—',    cell.nom],
        ['Cell type',               '—',    cell.type_cellule],
        ['Target energy',           'E',    _fmt_opt(req.energie_cible_wh, 'Wh')],
        ['Target voltage',          'V',    _fmt_opt(req.tension_cible_v, 'V')],
        ['Target current',          'I',    f'{req.courant_cible_a:.1f} A'],
        ['Depth of discharge',      'DoD',  f'{req.depth_of_discharge:.1f} %'],
        ['Housing length',          'L',    f'{req.housing_l:.1f} mm'],
        ['Housing width',           'l',    f'{req.housing_l_small:.1f} mm'],
        ['Housing height',          'h',    f'{req.housing_h:.1f} mm'],
        ['Safety margin per face',  'δ',    f'{req.marge_mm:.1f} mm'],
        ['Inter-cell gap',          'g',    f'{gap:.1f} mm'],
        ['Configuration mode',      '—',    mode_label],
    ]
    if is_manual:
        input_rows.append(['Manual series (imposed)',   'S',  str(req.manual_series or S)])
        input_rows.append(['Manual parallel (imposed)', 'P',  str(req.manual_parallel or P)])

    col_w = [75*mm, 20*mm, 75*mm]
    base_ts = _ts()
    base_ts.add('FONTNAME',  (1, 1), (1, -1), 'Helvetica-Oblique')
    base_ts.add('TEXTCOLOR', (1, 1), (1, -1), _BLUE_MID)
    base_ts.add('ALIGN',     (1, 0), (1, -1), 'CENTER')
    t_in = Table(input_rows, colWidths=col_w)
    t_in.setStyle(base_ts)
    story.append(t_in)
    story.append(Spacer(1, 5*mm))

    # ── Cell specifications ───────────────────────────────────────────────────
    story.append(Paragraph('2. CELL SPECIFICATIONS', st['section']))

    if cell_type == 'cylindrical':
        diam = cell.diameter_mm or cell.longueur_mm
        dim_rows = [
            ['Diameter', f'{diam:.1f} mm'],
            ['Height',   f'{cell.hauteur_mm:.1f} mm'],
        ]
    else:
        dim_rows = [
            ['Height (Y)',    f'{cell.longueur_mm:.1f} mm'],
            ['Width (Z)',     f'{cell.largeur_mm:.1f} mm'],
            ['Thickness (X)', f'{cell.hauteur_mm:.1f} mm'],
        ]

    cell_rows = [['Parameter', 'Value']] + [
        ['Nominal voltage V_n',       f'{cell.tension_nominale:.3f} V'],
        ['Nominal capacity C',        f'{cell.capacite_ah:.2f} Ah'],
        ['Max discharge current I_max', f'{cell.courant_max_a:.1f} A'],
        ['Mass',                      f'{cell.masse_g:.1f} g'],
        ['Swelling rate τ',           f'{swelling_pct:.1f} %'],
    ] + dim_rows

    t_cell = Table(cell_rows, colWidths=[95*mm, 75*mm])
    t_cell.setStyle(_ts())
    story.append(t_cell)
    story.append(Spacer(1, 6*mm))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 3 — Sizing Methodology
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('3. SIZING METHODOLOGY', st['section']))

    def formula_block(relation, an_str, result_str, note_str=None):
        """Helper: returns a list of story elements for one formula step."""
        out = []
        out.append(Paragraph(f'Relation :&nbsp;&nbsp;&nbsp; {relation}', st['formula']))
        out.append(Paragraph(f'A.N. :&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {an_str}', st['an']))
        out.append(Paragraph(f'→ {result_str}', st['result_line']))
        if note_str:
            out.append(Paragraph(note_str, st['note']))
        return out

    if is_manual:
        # ── Manual mode notice ────────────────────────────────────────────────
        story.append(Paragraph('3.1  Manual configuration', st['subsection']))
        story.append(Paragraph(
            f'The engineer has directly imposed S = <b>{S}</b> and P = <b>{P}</b>. '
            f'The automatic sizing formulas (§3.1 and §3.2) are bypassed. '
            f'The dimensional and margin checks (§3.3 and §3.4) are applied '
            f'to the imposed configuration.',
            st['normal']))
        story.append(Spacer(1, 4*mm))
    else:
        # ── Step 3.1 — P (parallel) ───────────────────────────────────────────
        story.append(Paragraph('3.1  Parallel branch count  P', st['subsection']))
        story.append(Paragraph(
            'The minimum number of parallel branches P is set so that the pack '
            'can deliver the target current I, given the per-cell maximum I_max :',
            st['normal']))
        an_p = (f'P = ⌈ {req.courant_cible_a:.1f} / {cell.courant_max_a:.1f} ⌉'
                f' = ⌈ {req.courant_cible_a/cell.courant_max_a:.3f} ⌉')
        story.extend(formula_block(
            'P = ⌈ I / I_max ⌉',
            an_p,
            f'P = {P}'))
        story.append(Spacer(1, 2*mm))

        # ── Step 3.2 — S (series) ─────────────────────────────────────────────
        story.append(Paragraph('3.2  Series element count  S', st['subsection']))
        story.append(Paragraph(
            'S is the maximum of all active constraints (voltage and/or energy):',
            st['normal']))

        s_candidates_display = []

        if req.tension_cible_v is not None and cell.tension_nominale > 0:
            s_v = math.ceil(req.tension_cible_v / cell.tension_nominale)
            an_sv = (f'S_V = ⌈ {req.tension_cible_v:.1f} / {cell.tension_nominale:.3f} ⌉'
                     f' = ⌈ {req.tension_cible_v/cell.tension_nominale:.3f} ⌉')
            story.extend(formula_block(
                'S_V = ⌈ V_cible / V_n ⌉',
                an_sv,
                f'S_V = {s_v}',
                'Voltage constraint.'))
            s_candidates_display.append(f'S_V = {s_v}')

        if req.energie_cible_wh is not None:
            denom = cell.tension_nominale * P * cell.capacite_ah * dod_dec
            s_e   = math.ceil(req.energie_cible_wh / denom) if denom > 0 else 1
            an_se = (f'S_E = ⌈ {req.energie_cible_wh:.1f} / '
                     f'({cell.tension_nominale:.3f} × {cell.capacite_ah:.2f} × {P} × {dod_dec:.2f}) ⌉'
                     f' = ⌈ {req.energie_cible_wh:.1f} / {denom:.3f} ⌉'
                     f' = ⌈ {req.energie_cible_wh/denom:.3f} ⌉')
            story.extend(formula_block(
                'S_E = ⌈ E_cible / (V_n × C × P × DoD) ⌉',
                an_se,
                f'S_E = {s_e}',
                'Energy constraint.'))
            s_candidates_display.append(f'S_E = {s_e}')

        if len(s_candidates_display) > 1:
            story.append(Paragraph(
                f'→ S = max({", ".join(s_candidates_display)}) = <b>{S}</b>',
                st['result_line']))
        story.append(Spacer(1, 2*mm))

    # ── Step 3.3 — Dimensions ─────────────────────────────────────────────────
    story.append(Paragraph('3.3  Pack dimensions with swelling', st['subsection']))
    story.append(Paragraph(
        f'Each cell dimension is scaled by the swelling factor (1 + τ). '
        f'Inter-cell gaps add (N−1)×g per axis (N cells, gap g = {gap:.1f} mm).',
        st['normal']))

    L_raw = result.dimensions_raw.longueur_mm
    W_raw = result.dimensions_raw.largeur_mm
    H_raw = result.dimensions_raw.hauteur_mm
    L_sw  = result.dimensions_array.longueur_mm
    W_sw  = result.dimensions_array.largeur_mm

    if cell_type == 'cylindrical':
        diam = cell.diameter_mm or cell.longueur_mm
        an_L = (f'L = {S}×{diam:.1f}×(1+{swelling_pct:.1f}/100) + ({S}-1)×{gap:.1f}'
                f' = {L_sw:.1f} mm')
        an_W = (f'l = {P}×{diam:.1f}×(1+{swelling_pct:.1f}/100) + ({P}-1)×{gap:.1f}'
                f' = {W_sw:.1f} mm')
        an_H = f'h = {cell.hauteur_mm:.1f} mm  (no swelling on height for cylindrical)'
        rel_L = 'L = S × d × (1 + τ) + (S−1) × g'
        rel_W = 'l = P × d × (1 + τ) + (P−1) × g'
    else:
        an_L = (f'L = {S}×{cell.hauteur_mm:.1f}×(1+{swelling_pct:.1f}/100) + ({S}-1)×{gap:.1f}'
                f' = {L_sw:.1f} mm')
        an_W = (f'l = {P}×{cell.largeur_mm:.1f}×(1+{swelling_pct:.1f}/100) + ({P}-1)×{gap:.1f}'
                f' = {W_sw:.1f} mm')
        an_H = f'h = {cell.longueur_mm:.1f} mm  (cell height — no swelling on Y)'
        rel_L = 'L = S × h_cell × (1 + τ) + (S−1) × g'
        rel_W = 'l = P × l_cell × (1 + τ) + (P−1) × g'

    story.extend(formula_block(rel_L, an_L, f'L_pack = {L_sw:.1f} mm'))
    story.extend(formula_block(rel_W, an_W, f'l_pack = {W_sw:.1f} mm'))
    story.append(Paragraph(f'→ h_pack = {an_H}', st['result_line']))
    story.append(Spacer(1, 2*mm))

    # ── Step 3.4 — Margin verification ────────────────────────────────────────
    story.append(Paragraph('3.4  Margin verification per face', st['subsection']))
    story.append(Paragraph(
        f'Margin δ_actual = (Housing_dim − L_raw) / 2 must exceed the required '
        f'safety margin δ = {req.marge_mm:.1f} mm on every axis.',
        st['normal']))

    margins = result.marges_reelles
    mL, mW, mH = margins.get('L', 0), margins.get('W', 0), margins.get('H', 0)

    def _margin_an(housing_dim, raw_dim, actual_margin, axis_label):
        ok_str = '✓ OK' if actual_margin >= req.marge_mm else '✗ INSUFFICIENT'
        return (
            f'δ_{axis_label} = ⌊ {housing_dim:.1f} − {raw_dim:.1f} ⌋ / 2 = {actual_margin:.1f} mm   [{ok_str}]')

    story.extend(formula_block(
        'δ = (Dim_housing − Dim_raw) / 2 ≥ δ_min',
        _margin_an(req.housing_l,       L_raw, mL, 'L'),
        f'δ_L = {mL:.1f} mm  (min required: {req.marge_mm:.1f} mm)'))
    story.extend(formula_block(
        'δ = (Dim_housing − Dim_raw) / 2 ≥ δ_min',
        _margin_an(req.housing_l_small, W_raw, mW, 'l'),
        f'δ_l = {mW:.1f} mm  (min required: {req.marge_mm:.1f} mm)'))
    story.extend(formula_block(
        'δ = (Dim_housing − Dim_raw) / 2 ≥ δ_min',
        _margin_an(req.housing_h,       H_raw, mH, 'h'),
        f'δ_h = {mH:.1f} mm  (min required: {req.marge_mm:.1f} mm)'))

    story.append(Spacer(1, 6*mm))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 4 — Pack Schematic
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('4. PACK SCHEMATIC — TOP VIEW', st['section']))
    story.append(Spacer(1, 3*mm))

    schematic = _pack_schematic(req, result, cell_info)
    story.append(schematic)
    story.append(Paragraph(
        f'Top-down view (X–Z plane). '
        f'Blue cells = even series columns (normal polarity). '
        f'Dark blue = odd series columns (reversed). '
        f'Housing outline in light blue. Array: {S} series × {P} parallel.',
        st['caption']))
    story.append(Spacer(1, 6*mm))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 5 — Results
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('5. RESULTS SUMMARY', st['section']))

    # ── Configuration ─────────────────────────────────────────────────────────
    story.append(Paragraph('5.1  Pack configuration', st['subsection']))
    cfg_rows = [
        ['Parameter', 'Value'],
        ['Series count S',         str(S)],
        ['Parallel count P',       str(P)],
        ['Total cells  S × P',     str(S * P)],
        ['Configuration mode',     mode_label],
        ['Array L (with swelling)', f'{L_sw:.1f} mm'],
        ['Array l (with swelling)', f'{W_sw:.1f} mm'],
        ['Array h',                 f'{H_raw:.1f} mm'],
        ['Volume occupancy',        f'{result.taux_occupation_pct:.1f} %'],
    ]
    t_cfg = Table(cfg_rows, colWidths=[95*mm, 75*mm])
    t_cfg.setStyle(_ts())
    story.append(t_cfg)
    story.append(Spacer(1, 5*mm))

    # ── Electrical ────────────────────────────────────────────────────────────
    story.append(Paragraph('5.2  Electrical summary', st['subsection']))
    elec = result.electrical
    elec_rows = [
        ['Parameter', 'Value'],
        ['Nominal voltage  V = S × V_n',    f'{elec.actual_voltage_v:.2f} V'],
        ['Capacity  C_pack = P × C',         f'{elec.actual_capacity_ah:.2f} Ah'],
        ['Total energy  E_total',            f'{elec.total_energy_wh:.1f} Wh'],
        ['Usable energy  E_usable (×DoD)',   f'{elec.usable_energy_wh:.1f} Wh'],
        ['Total mass',                        f'{elec.total_weight_kg:.3f} kg'],
        ['Gravimetric energy density',        f'{elec.energy_density_wh_kg:.1f} Wh/kg'],
    ]
    t_elec = Table(elec_rows, colWidths=[95*mm, 75*mm])
    t_elec.setStyle(_ts())
    story.append(t_elec)
    story.append(Spacer(1, 5*mm))

    # ── Margins table ─────────────────────────────────────────────────────────
    story.append(Paragraph('5.3  Mechanical margins', st['subsection']))
    req_margin = req.marge_mm

    def _cell_color_margin(val):
        return _GREEN_OK if val >= req_margin else _RED_KO

    margin_rows = [
        ['Axis', 'Housing (mm)', 'Array raw (mm)', 'Margin (mm)', 'Required (mm)', 'Status'],
        ['L (length)',
         f'{req.housing_l:.1f}',       f'{L_raw:.1f}', f'{mL:.1f}', f'{req_margin:.1f}',
         '✓ OK' if mL >= req_margin else '✗ FAIL'],
        ['l (width)',
         f'{req.housing_l_small:.1f}', f'{W_raw:.1f}', f'{mW:.1f}', f'{req_margin:.1f}',
         '✓ OK' if mW >= req_margin else '✗ FAIL'],
        ['h (height)',
         f'{req.housing_h:.1f}',       f'{H_raw:.1f}', f'{mH:.1f}', f'{req_margin:.1f}',
         '✓ OK' if mH >= req_margin else '✗ FAIL'],
    ]
    col_w_m = [28*mm, 30*mm, 33*mm, 28*mm, 30*mm, 21*mm]
    t_margin = Table(margin_rows, colWidths=col_w_m)
    t_margin.setStyle(_ts())

    # Color-code status and margin cells
    for row_idx, (val, axis) in enumerate([(mL,'L'), (mW,'l'), (mH,'h')], start=1):
        ok_row = val >= req_margin
        status_color = _GREEN_OK if ok_row else _RED_KO
        bg_color     = _GREEN_BG if ok_row else _RED_BG
        t_margin.setStyle(TableStyle([
            ('TEXTCOLOR',  (5, row_idx), (5, row_idx), status_color),
            ('FONTNAME',   (5, row_idx), (5, row_idx), 'Helvetica-Bold'),
            ('BACKGROUND', (3, row_idx), (3, row_idx), bg_color),
        ]))

    story.append(t_margin)
    story.append(Spacer(1, 5*mm))

    # ── BMS Specification ─────────────────────────────────────────────────────
    if result.bms_v_min_pack is not None:
        story.append(Paragraph('5.4  BMS specification', st['subsection']))

        def _bms_fmt(v, unit='', d=1):
            return f'{v:.{d}f} {unit}'.strip() if v is not None else '—'

        charge_str = _bms_fmt(result.bms_i_charge_a, 'A')
        if result.bms_i_charge_estimated:
            charge_str += ' (est. — c_rate_max_charge not in dataset)'

        discharge_cutoff = (f'{result.bms_discharge_cutoff_temp_c:.0f} °C'
                            if result.bms_discharge_cutoff_temp_c is not None
                            else '— (temp_min_c not in dataset)')

        bms_rows = [
            ['Parameter', 'Value', 'Source'],
            ['Voltage window',
             f'{result.bms_v_min_pack:.1f} V  →  {result.bms_v_max_pack:.1f} V',
             'S × V_min/max (chemistry constants)'],
            ['Continuous discharge current',
             f'{result.bms_i_continuous_a:.1f} A',
             'P × I_cell_max'],
            ['Max charge current',
             charge_str,
             'P × c_rate_max_charge × C'],
            ['Balance channels',
             str(result.bms_balance_channels),
             '= S'],
            ['Balance current / channel',
             f'{result.bms_balance_current_a:.3f} A',
             'C × 2 % (standard floor)'],
            ['Temperature sensors',
             str(result.bms_temp_sensors),
             '⌈ S×P / 12 ⌉'],
            ['Charge cutoff temperature',
             (f'{result.bms_charge_cutoff_temp_c} °C'
              if result.bms_charge_cutoff_temp_c is not None else '—'),
             'Chemistry constant'],
            ['Discharge cutoff temperature',
             discharge_cutoff,
             'Cell temp_min_c'],
            ['Suggested BMS family',
             result.bms_suggestion or '—',
             'Voltage + current lookup'],
        ]
        col_w_bms = [65*mm, 55*mm, 50*mm]
        t_bms = Table(bms_rows, colWidths=col_w_bms)
        t_bms.setStyle(_ts())
        story.append(t_bms)
        story.append(Paragraph(
            'Note: values marked "est." use default assumptions — '
            'verify against selected BMS datasheet before final design.',
            st['note']))
        story.append(Spacer(1, 5*mm))

    story.append(Spacer(1, 3*mm))

    # ── Verdict ───────────────────────────────────────────────────────────────
    v_color = _GREEN_OK if is_ok else _RED_KO
    v_bg    = _GREEN_BG if is_ok else _RED_BG
    v_text  = '✓  ACCEPT' if is_ok else '✗  REJECT'
    verdict_table = Table([[v_text]], colWidths=[170*mm])
    verdict_table.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), v_bg),
        ('TEXTCOLOR',     (0, 0), (-1, -1), v_color),
        ('FONTNAME',      (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE',      (0, 0), (-1, -1), 16),
        ('ALIGN',         (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING',    (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('BOX',           (0, 0), (-1, -1), 1.5, v_color),
    ]))
    story.append(verdict_table)
    story.append(Spacer(1, 4*mm))

    if result.justification:
        story.append(Paragraph(result.justification, st['normal']))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 6 — Performance Estimate (Phase 2)
    # ══════════════════════════════════════════════════════════════════════════
    has_derating = result.c_rate_actual  is not None
    has_lifetime = result.lifetime_years is not None

    if has_derating or has_lifetime:
        story.append(Spacer(1, 6*mm))
        story.append(Paragraph('6. PERFORMANCE ESTIMATE', st['section']))
        story.append(Paragraph(
            'Engineering estimates based on chemistry-level models. '
            'Verify against manufacturer discharge curves and cycle life data for final design.',
            st['note']))
        story.append(Spacer(1, 4*mm))

        k_map  = {'NMC': 0.33, 'LFP': 0.10, 'NCA': 0.40, 'LTO': 0.04, 'LCO': 0.25}
        exp_map = {'NMC': 1.5, 'LFP': 1.8, 'NCA': 1.3, 'LTO': 2.2, 'LCO': 1.5}
        k    = k_map.get(cell.chimie, 0.20)
        cpd  = getattr(req, 'cycles_per_day', 1.0) or 1.0

        # ── 6.1 C-rate derating ───────────────────────────────────────────────
        if has_derating:
            story.append(Paragraph('6.1  C-rate derating', st['subsection']))
            story.append(Paragraph(
                'At high discharge rates, internal resistance losses reduce deliverable capacity. '
                'The quadratic derating model (valid for C-rates between 20% and 80% of rated maximum):',
                st['normal']))

            I_cell = req.courant_cible_a / P
            ratio  = result.c_rate_actual / cell.c_rate_max_discharge if cell.c_rate_max_discharge else 0

            story.extend(formula_block(
                'I_cell = I_target / P',
                f'I_cell = {req.courant_cible_a:.1f} / {P} = {I_cell:.2f} A',
                f'I_cell = {I_cell:.2f} A per cell'))

            story.extend(formula_block(
                'C_actual = I_cell / C_nominal',
                f'C_actual = {I_cell:.2f} / {cell.capacite_ah:.2f} = {result.c_rate_actual:.3f} C',
                f'C_actual = {result.c_rate_actual:.3f} C  '
                f'{"(⚠ above 80% of C_max — estimate less reliable)" if result.c_rate_warning else "(within reliable range)"}'))

            if result.derating_factor_pct == 0:
                story.extend(formula_block(
                    'derating_factor = 1 − k × (C_actual / C_max)²',
                    f'ratio = {result.c_rate_actual:.3f} / {cell.c_rate_max_discharge:.1f} = {ratio:.3f}  <  0.20',
                    'derating_factor = 0 %  (C-rate below 20% of maximum — negligible derating)',
                    f'k = {k}  ({cell.chimie or "unknown"} chemistry estimate)'))
            else:
                story.extend(formula_block(
                    'derating_factor = 1 − k × (C_actual / C_max)²',
                    f'derating = {k} × ({result.c_rate_actual:.3f} / {cell.c_rate_max_discharge:.1f})²'
                    f' = {k} × {ratio**2:.4f} = {abs(result.derating_factor_pct/100):.4f}',
                    f'derating_factor = {result.derating_factor_pct:.1f} %',
                    f'k = {k}  ({cell.chimie or "unknown"} chemistry estimate, PyBaMM-validated for NMC)'))

                story.extend(formula_block(
                    'C_effective = C_nominal × (1 + derating_factor/100)',
                    f'C_effective = {cell.capacite_ah:.2f} × (1 − {abs(result.derating_factor_pct/100):.4f})',
                    f'C_effective = {result.c_effective_ah:.3f} Ah per cell'))

            story.append(Spacer(1, 3*mm))

        # ── 6.2 Cycle life and lifetime ───────────────────────────────────────
        if has_lifetime:
            exp = exp_map.get(cell.chimie, 1.5)
            story.append(Paragraph('6.2  Cycle life and pack lifetime', st['subsection']))
            story.append(Paragraph(
                'The Wöhler power law relates cycle life to depth of discharge. '
                'Shallower cycling stress results in exponentially longer life:',
                st['normal']))

            dod_ratio = cell.dod_reference_pct / req.depth_of_discharge

            story.extend(formula_block(
                'N_dod = N_ref × (DoD_ref / DoD_operating) ^ α',
                f'N_dod = {cell.cycle_life:,} × ({cell.dod_reference_pct:.0f} / {req.depth_of_discharge:.0f}) ^ {exp}'
                f' = {cell.cycle_life:,} × {dod_ratio:.4f} ^ {exp}'
                f' = {cell.cycle_life:,} × {dod_ratio**exp:.4f}',
                f'N_dod = {result.cycle_life_at_dod:,} cycles at {req.depth_of_discharge:.0f}% DoD',
                f'α = {exp}  ({cell.chimie or "unknown"} chemistry aging exponent, literature value)'))

            story.extend(formula_block(
                'Lifetime = N_dod / (cycles_per_day × 365)',
                f'Lifetime = {result.cycle_life_at_dod:,} / ({cpd:.1f} × 365)'
                f' = {result.cycle_life_at_dod:,} / {cpd*365:.0f}',
                f'Lifetime = {result.lifetime_years:.1f} years at {cpd:.1f} cycle/day',
                f'Uncertainty range: {result.lifetime_years_low:.1f} – {result.lifetime_years_high:.1f} years  (±30% on aging exponent)'))

            story.append(Spacer(1, 3*mm))

    # ── Build ─────────────────────────────────────────────────────────────────
    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    buf.seek(0)
    return buf
