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


# ─── Translations ─────────────────────────────────────────────────────────────
_TR = {
    'en': {
        'report_title':     'BATTERY PACK PRE-DESIGN REPORT',
        'generated_on':     'Generated on {date}',
        'date_fmt':         '%d %B %Y at %H:%M',
        # Sections
        's1': '1. INPUT PARAMETERS',
        's2': '2. CELL SPECIFICATIONS',
        's3': '3. SIZING METHODOLOGY',
        's4': '4. PACK SCHEMATICS',
        's5': '5. RESULTS SUMMARY',
        # Subsections
        'ss31_manual':  '3.1  Manual configuration',
        'ss31_auto':    '3.1  Parallel branch count  P',
        'ss32':         '3.2  Series element count  S',
        'ss33':         '3.3  Pack dimensions with swelling',
        'ss34':         '3.4  Margin verification per face',
        'ss41':         '4.1  Top view (X–Z plane)',
        'ss42':         '4.2  Isometric view',
        'ss51':         '5.1  Pack configuration',
        'ss52':         '5.2  Electrical summary',
        'ss53':         '5.3  Mechanical margins',
        # Input table
        'col_param':    'Parameter',
        'col_symbol':   'Symbol',
        'col_value':    'Value',
        'p_cell_model': 'Cell model',
        'p_cell_type':  'Cell type',
        'p_energy':     'Target energy',
        'p_voltage':    'Target voltage',
        'p_current':    'Target current',
        'p_dod':        'Depth of discharge',
        'p_housing_l':  'Housing length',
        'p_housing_w':  'Housing width',
        'p_housing_h':  'Housing height',
        'p_margin':     'Safety margin per face',
        'p_gap':        'Inter-cell gap',
        'p_mode':       'Configuration mode',
        'p_ep':         'End plate thickness (per side)',
        'p_man_s':      'Manual series (imposed)',
        'p_man_p':      'Manual parallel (imposed)',
        'mode_manual':  'Manual (S, P imposed)',
        'mode_auto':    'Automatic',
        # Cell spec table
        'c_voltage':    'Nominal voltage V_n',
        'c_capacity':   'Nominal capacity C',
        'c_current':    'Max discharge current I_max',
        'c_mass':       'Mass',
        'c_swelling':   'Swelling rate τ',
        'c_diameter':   'Diameter',
        'c_height':     'Height',
        'c_height_y':   'Height (Y)',
        'c_width_z':    'Width (Z)',
        'c_thick_x':    'Thickness (X)',
        # Section 3 body text
        'manual_notice': (
            'The engineer has directly imposed S = <b>{S}</b> and P = <b>{P}</b>. '
            'The automatic sizing formulas (§3.1 and §3.2) are bypassed. '
            'The dimensional and margin checks (§3.3 and §3.4) are applied '
            'to the imposed configuration.'),
        'p_parallel_intro': (
            'The minimum number of parallel branches P is set so that the pack '
            'can deliver the target current I, given the per-cell maximum I_max :'),
        'p_series_intro':   'S is the maximum of all active constraints (voltage and/or energy):',
        'note_voltage':     'Voltage constraint.',
        'note_energy':      'Energy constraint.',
        's_max_line':       '→ S = max({cands}) = <b>{S}</b>',
        'dim_intro': (
            'Each cell dimension is scaled by the swelling factor (1 + τ). '
            'Inter-cell gaps add (N−1)×g per axis (N cells, gap g = {gap:.1f} mm).'),
        'no_swell_cyl':  'no swelling on height for cylindrical',
        'no_swell_pris': 'cell height — no swelling on Y',
        'margin_intro': (
            'Margin δ_actual = (Housing_dim − L_raw) / 2 must exceed the required '
            'safety margin δ = {delta:.1f} mm on every axis.'),
        'margin_ok':    '✓ OK',
        'margin_fail':  '✗ INSUFFICIENT',
        'min_req':      'min required',
        # Section 4 captions
        'cap_top': (
            'Top-down view. L_housing / l_housing in gray; L_module / l_module in blue. '
            'Amber Δ = margin per face. '
            'Blue cells = even series columns, dark blue = odd columns (reversed polarity). '
            'Array: {S} series × {P} parallel.'),
        'cap_iso': (
            'Isometric projection. Housing in light blue (3 visible faces). '
            'Dashed blue outline = module array. '
            'Gray dim lines = housing (L / l / h). Blue dim lines = module (L_mod / l_mod / h_mod).'),
        # Section 5 tables
        'cfg_s':        'Series count S',
        'cfg_p':        'Parallel count P',
        'cfg_total':    'Total cells  S × P',
        'cfg_mode':     'Configuration mode',
        'cfg_arr_l':    'Array L (with swelling)',
        'cfg_arr_w':    'Array l (with swelling)',
        'cfg_arr_h':    'Array h',
        'cfg_vol':      'Volume occupancy',
        'el_voltage':   'Nominal voltage  V = S × V_n',
        'el_capacity':  'Capacity  C_pack = P × C',
        'el_energy_t':  'Total energy  E_total',
        'el_energy_u':  'Usable energy  E_usable (×DoD)',
        'el_mass':      'Total mass',
        'el_density':   'Gravimetric energy density',
        'mg_axis':      'Axis',
        'mg_housing':   'Housing (mm)',
        'mg_array':     'Array raw (mm)',
        'mg_margin':    'Margin (mm)',
        'mg_required':  'Required (mm)',
        'mg_status':    'Status',
        'mg_L':         'L (length)',
        'mg_W':         'l (width)',
        'mg_H':         'h (height)',
        'mg_ok':        '✓ OK',
        'mg_fail':      '✗ FAIL',
        'verdict_ok':   '✓  ACCEPT',
        'verdict_ko':   '✗  REJECT',
        # Schematic legend
        'leg_housing':  'Housing',
        'leg_cells':    'Cells',
        'cells_label':  '{S}×{P} cells',
        # Relation/formula labels
        'rel_label':    'Relation',
        'an_label':     'A.N.',
        # Footer
        'footer_left':  'Battery Pack Pre-Design Assistant — Capgemini Engineering',
        'footer_page':  'Page',
    },
    'fr': {
        'report_title':     'RAPPORT DE PRÉ-DIMENSIONNEMENT DU PACK BATTERIE',
        'generated_on':     'Généré le {date}',
        'date_fmt':         '%d %B %Y à %H:%M',
        # Sections
        's1': '1. PARAMÈTRES D\'ENTRÉE',
        's2': '2. SPÉCIFICATIONS DE LA CELLULE',
        's3': '3. MÉTHODOLOGIE DE DIMENSIONNEMENT',
        's4': '4. SCHÉMAS DU PACK',
        's5': '5. RÉSUMÉ DES RÉSULTATS',
        # Subsections
        'ss31_manual':  '3.1  Configuration manuelle',
        'ss31_auto':    '3.1  Nombre de branches parallèles  P',
        'ss32':         '3.2  Nombre d\'éléments en série  S',
        'ss33':         '3.3  Dimensions du pack avec gonflement',
        'ss34':         '3.4  Vérification des marges par face',
        'ss41':         '4.1  Vue de dessus (plan X–Z)',
        'ss42':         '4.2  Vue isométrique',
        'ss51':         '5.1  Configuration du pack',
        'ss52':         '5.2  Résumé électrique',
        'ss53':         '5.3  Marges mécaniques',
        # Input table
        'col_param':    'Paramètre',
        'col_symbol':   'Symbole',
        'col_value':    'Valeur',
        'p_cell_model': 'Modèle de cellule',
        'p_cell_type':  'Type de cellule',
        'p_energy':     'Énergie cible',
        'p_voltage':    'Tension cible',
        'p_current':    'Courant cible',
        'p_dod':        'Profondeur de décharge',
        'p_housing_l':  'Longueur du boîtier',
        'p_housing_w':  'Largeur du boîtier',
        'p_housing_h':  'Hauteur du boîtier',
        'p_margin':     'Marge de sécurité par face',
        'p_gap':        'Jeu inter-cellules',
        'p_mode':       'Mode de configuration',
        'p_ep':         'Épaisseur plaque terminale (par côté)',
        'p_man_s':      'Série manuelle (imposée)',
        'p_man_p':      'Parallèle manuel (imposé)',
        'mode_manual':  'Manuel (S, P imposés)',
        'mode_auto':    'Automatique',
        # Cell spec table
        'c_voltage':    'Tension nominale V_n',
        'c_capacity':   'Capacité nominale C',
        'c_current':    'Courant max de décharge I_max',
        'c_mass':       'Masse',
        'c_swelling':   'Taux de gonflement τ',
        'c_diameter':   'Diamètre',
        'c_height':     'Hauteur',
        'c_height_y':   'Hauteur (Y)',
        'c_width_z':    'Largeur (Z)',
        'c_thick_x':    'Épaisseur (X)',
        # Section 3 body text
        'manual_notice': (
            'L\'ingénieur a directement imposé S = <b>{S}</b> et P = <b>{P}</b>. '
            'Les formules de dimensionnement automatique (§3.1 et §3.2) sont ignorées. '
            'Les vérifications dimensionnelles et de marge (§3.3 et §3.4) sont appliquées '
            'à la configuration imposée.'),
        'p_parallel_intro': (
            'Le nombre minimal de branches parallèles P est fixé de façon à ce que le pack '
            'puisse délivrer le courant cible I, compte tenu du maximum par cellule I_max :'),
        'p_series_intro':   'S est le maximum de toutes les contraintes actives (tension et/ou énergie) :',
        'note_voltage':     'Contrainte de tension.',
        'note_energy':      'Contrainte d\'énergie.',
        's_max_line':       '→ S = max({cands}) = <b>{S}</b>',
        'dim_intro': (
            'Chaque dimension de cellule est multipliée par le facteur de gonflement (1 + τ). '
            'Les jeux inter-cellules ajoutent (N−1)×g par axe (N cellules, jeu g = {gap:.1f} mm).'),
        'no_swell_cyl':  'pas de gonflement en hauteur pour les cylindriques',
        'no_swell_pris': 'hauteur cellule — pas de gonflement en Y',
        'margin_intro': (
            'La marge δ_réelle = (Dim_boîtier − L_brut) / 2 doit dépasser la marge de sécurité '
            'requise δ = {delta:.1f} mm sur chaque axe.'),
        'margin_ok':    '✓ OK',
        'margin_fail':  '✗ INSUFFISANT',
        'min_req':      'requis min',
        # Section 4 captions
        'cap_top': (
            'Vue de dessus. L_boîtier / l_boîtier en gris ; L_module / l_module en bleu. '
            'Δ ambre = marge par face. '
            'Cellules bleues = colonnes série paires, bleu foncé = colonnes impaires (polarité inversée). '
            'Tableau : {S} série × {P} parallèle.'),
        'cap_iso': (
            'Projection isométrique. Boîtier en bleu clair (3 faces visibles). '
            'Contour bleu pointillé = tableau de modules. '
            'Lignes de cote grises = boîtier (L / l / h). Lignes bleues = module (L_mod / l_mod / h_mod).'),
        # Section 5 tables
        'cfg_s':        'Nombre de séries S',
        'cfg_p':        'Nombre de parallèles P',
        'cfg_total':    'Total cellules  S × P',
        'cfg_mode':     'Mode de configuration',
        'cfg_arr_l':    'L tableau (avec gonflement)',
        'cfg_arr_w':    'l tableau (avec gonflement)',
        'cfg_arr_h':    'h tableau',
        'cfg_vol':      'Taux d\'occupation volumique',
        'el_voltage':   'Tension nominale  V = S × V_n',
        'el_capacity':  'Capacité  C_pack = P × C',
        'el_energy_t':  'Énergie totale  E_total',
        'el_energy_u':  'Énergie utilisable  E_usable (×PdD)',
        'el_mass':      'Masse totale',
        'el_density':   'Densité d\'énergie massique',
        'mg_axis':      'Axe',
        'mg_housing':   'Boîtier (mm)',
        'mg_array':     'Tableau brut (mm)',
        'mg_margin':    'Marge (mm)',
        'mg_required':  'Requis (mm)',
        'mg_status':    'Statut',
        'mg_L':         'L (longueur)',
        'mg_W':         'l (largeur)',
        'mg_H':         'h (hauteur)',
        'mg_ok':        '✓ OK',
        'mg_fail':      '✗ ÉCHEC',
        'verdict_ok':   '✓  ACCEPTÉ',
        'verdict_ko':   '✗  REFUSÉ',
        # Schematic legend
        'leg_housing':  'Boîtier',
        'leg_cells':    'Cellules',
        'cells_label':  '{S}×{P} cellules',
        # Relation/formula labels
        'rel_label':    'Relation',
        'an_label':     'A.N.',
        # Footer
        'footer_left':  'Outil de pré-dimensionnement pack batterie — Capgemini Engineering',
        'footer_page':  'Page',
    },
}


def _t(lang: str, key: str, **kwargs) -> str:
    """Look up a translation string, fall back to English."""
    s = _TR.get(lang, _TR['en']).get(key) or _TR['en'].get(key, key)
    return s.format(**kwargs) if kwargs else s


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


def _pack_schematic(req, result, cell_info, lang='en'):
    """
    Build a proportional top-down 2D schematic of the pack.
    X axis (horizontal) = series direction L
    Y axis (vertical)   = parallel direction l
    Scale is based on the larger of housing vs module so the drawing never overflows.
    """
    S   = result.nb_serie
    P   = result.nb_parallele
    gap = getattr(req, 'cell_gap_mm', 0.0)
    ok  = result.verdict.value == 'ACCEPT'

    cell_type = (cell_info.type_cellule or 'Pouch').lower()
    if cell_type == 'cylindrical':
        diam  = cell_info.diameter_mm or cell_info.longueur_mm
        cx_mm = cz_mm = diam
    else:
        cx_mm = cell_info.hauteur_mm
        cz_mm = cell_info.largeur_mm

    hL    = req.housing_l
    hW    = req.housing_l_small
    arr_L = result.dimensions_raw.longueur_mm
    arr_W = result.dimensions_raw.largeur_mm

    # ── Margins (points) ────────────────────────────────────────────────
    # Housing dims at bottom + right; module dims at top + left (no overlap possible)
    left_margin   = 50   # module l_mod dim line + rotated label
    right_margin  = 76   # housing l dim line + label
    bottom_margin = 42   # housing L dim line + label
    top_margin    = 34   # module L_mod dim line + label

    avail_w = 170 * mm - left_margin - right_margin
    avail_h =  92 * mm - bottom_margin - top_margin

    # Scale on the UNION bounding box so overflow (REJECT) never clips
    total_L = max(hL, arr_L)
    total_W = max(hW, arr_W)
    scale   = min(avail_w / total_L, avail_h / total_W)

    hL_pt    = hL    * scale
    hW_pt    = hW    * scale
    arr_L_pt = arr_L * scale
    arr_W_pt = arr_W * scale

    scene_w = total_L * scale
    scene_h = total_W * scale

    # Housing centred inside the scene bounding box
    ox    = left_margin + (scene_w - hL_pt)    / 2
    oy    = bottom_margin + (scene_h - hW_pt)  / 2
    # Array centred inside the scene bounding box (same centre as housing)
    arr_ox = left_margin + (scene_w - arr_L_pt) / 2
    arr_oy = bottom_margin + (scene_h - arr_W_pt) / 2

    draw_w = scene_w + left_margin + right_margin
    draw_h = scene_h + bottom_margin + top_margin

    d = Drawing(draw_w, draw_h)

    # ── Housing ──────────────────────────────────────────────────────────
    d.add(Rect(ox, oy, hL_pt, hW_pt,
               fillColor=_HOUSING_FILL,
               strokeColor=_BLUE_MID, strokeWidth=1.5))

    # ── Cells ────────────────────────────────────────────────────────────
    ep_pt = getattr(req, 'end_plate_thickness_mm', 0.0) * scale if cell_type != 'cylindrical' else 0.0
    step_x_pt = (cx_mm + gap) * scale
    step_z_pt = (cz_mm + gap) * scale
    pad = max(gap * scale, 1.5) if gap > 0 else 0.5
    cx_draw = max(step_x_pt - pad, 0.5)
    cz_draw = max(step_z_pt - pad, 0.5)
    c1 = _BLUE_CELL  if ok else _RED_CELL
    c2 = _BLUE_CELL2 if ok else _RED_CELL2
    cell_ox = arr_ox + ep_pt

    if S * P <= 400:
        for s in range(S):
            for p in range(P):
                lx = cell_ox + s * step_x_pt + pad / 2
                ly = arr_oy  + p * step_z_pt + pad / 2
                d.add(Rect(lx, ly, cx_draw, cz_draw,
                           fillColor=(c1 if s % 2 == 0 else c2),
                           strokeColor=colors.white, strokeWidth=0.3))
    else:
        d.add(Rect(arr_ox, arr_oy, arr_L_pt, arr_W_pt,
                   fillColor=c1, strokeColor=colors.white, strokeWidth=1))
        d.add(String(arr_ox + arr_L_pt / 2, arr_oy + arr_W_pt / 2,
                     _t(lang, 'cells_label', S=S, P=P), fontSize=8, textAnchor='middle',
                     fillColor=colors.white, fontName='Helvetica-Bold'))

    # End plates (prismatic)
    if ep_pt > 0:
        ep_color = colors.HexColor('#1a1a1a')
        d.add(Rect(arr_ox,                    arr_oy, ep_pt, arr_W_pt, fillColor=ep_color, strokeColor=ep_color, strokeWidth=0))
        d.add(Rect(arr_ox + arr_L_pt - ep_pt, arr_oy, ep_pt, arr_W_pt, fillColor=ep_color, strokeColor=ep_color, strokeWidth=0))

    # Dashed red outline when module overflows housing (REJECT due to size)
    if arr_L > hL or arr_W > hW:
        d.add(Rect(arr_ox, arr_oy, arr_L_pt, arr_W_pt,
                   fillColor=colors.transparent,
                   strokeColor=_RED_CELL, strokeWidth=1.2,
                   strokeDashArray=[5, 3]))

    _BLU = colors.HexColor('#2563eb')
    _AMB = colors.HexColor('#d97706')
    right_edge   = left_margin + scene_w
    top_of_scene = bottom_margin + scene_h

    # ── Bottom: Housing L ────────────────────────────────────────────────
    dim_y_h = bottom_margin - 16
    _arrow(d, ox, dim_y_h, ox + hL_pt, dim_y_h)
    d.add(Line(ox,         oy, ox,         dim_y_h + 2, strokeColor=_DIM_COLOR, strokeWidth=0.4))
    d.add(Line(ox + hL_pt, oy, ox + hL_pt, dim_y_h + 2, strokeColor=_DIM_COLOR, strokeWidth=0.4))
    d.add(String((ox * 2 + hL_pt) / 2, dim_y_h + 3,
                 f'L = {hL:.0f} mm', fontSize=7, textAnchor='middle',
                 fillColor=_DIM_COLOR, fontName='Helvetica'))

    # ── Top: Module L_mod ────────────────────────────────────────────────
    dim_y_m = top_of_scene + 16
    _arrow(d, arr_ox, dim_y_m, arr_ox + arr_L_pt, dim_y_m, color=_BLU)
    d.add(Line(arr_ox,             arr_oy + arr_W_pt, arr_ox,             dim_y_m - 2, strokeColor=_BLU, strokeWidth=0.4))
    d.add(Line(arr_ox + arr_L_pt, arr_oy + arr_W_pt, arr_ox + arr_L_pt, dim_y_m - 2, strokeColor=_BLU, strokeWidth=0.4))
    d.add(String((arr_ox * 2 + arr_L_pt) / 2, dim_y_m + 3,
                 f'L_mod = {arr_L:.0f} mm', fontSize=6.5, textAnchor='middle',
                 fillColor=_BLU, fontName='Helvetica-Bold'))

    # ── Right: Housing l ─────────────────────────────────────────────────
    rx_h = right_edge + 14
    _arrow(d, rx_h, oy, rx_h, oy + hW_pt)
    d.add(Line(ox + hL_pt, oy,         rx_h - 2, oy,         strokeColor=_DIM_COLOR, strokeWidth=0.4))
    d.add(Line(ox + hL_pt, oy + hW_pt, rx_h - 2, oy + hW_pt, strokeColor=_DIM_COLOR, strokeWidth=0.4))
    d.add(String(rx_h + 3, (oy * 2 + hW_pt) / 2,
                 f'l_h = {hW:.0f} mm', fontSize=7, textAnchor='start',
                 fillColor=_DIM_COLOR, fontName='Helvetica'))

    # ── Left: Module l_mod (rotated 90° CCW label) ───────────────────────
    lx_m = left_margin - 18
    _arrow(d, lx_m, arr_oy, lx_m, arr_oy + arr_W_pt, color=_BLU)
    d.add(Line(arr_ox, arr_oy,            lx_m + 2, arr_oy,            strokeColor=_BLU, strokeWidth=0.4))
    d.add(Line(arr_ox, arr_oy + arr_W_pt, lx_m + 2, arr_oy + arr_W_pt, strokeColor=_BLU, strokeWidth=0.4))
    mid_m_y = (arr_oy * 2 + arr_W_pt) / 2
    g = Group(String(0, 0, f'l_mod = {arr_W:.0f} mm', fontSize=6.5, textAnchor='middle',
                     fillColor=_BLU, fontName='Helvetica-Bold'))
    g.transform = (0, 1, -1, 0, lx_m - 7, mid_m_y)   # 90° CCW rotation + translate
    d.add(g)

    # ── Margin labels in gap zones ───────────────────────────────────────
    marg_L = (hL - arr_L) / 2
    marg_W = (hW - arr_W) / 2
    gap_x_pt = (hL_pt - arr_L_pt) / 2
    gap_z_pt = (hW_pt - arr_W_pt) / 2

    def _delta_label(d, x, y, text):
        """Amber margin label with white backing for readability."""
        tw, th = 34, 9
        d.add(Rect(x - tw/2, y - 1, tw, th, fillColor=colors.white,
                   strokeColor=colors.transparent, strokeWidth=0))
        d.add(String(x, y + 1, text, fontSize=7.5, textAnchor='middle',
                     fillColor=_AMB, fontName='Helvetica-Bold'))

    if abs(gap_x_pt) > 8:
        mid_y = (oy * 2 + hW_pt) / 2
        for lx in (ox + gap_x_pt / 2, ox + hL_pt - gap_x_pt / 2):
            _delta_label(d, lx, mid_y, f'Δ{marg_L:.0f} mm')
    if abs(gap_z_pt) > 8:
        mid_x = arr_ox + arr_L_pt / 2
        for ly in (oy + gap_z_pt / 2, oy + hW_pt - gap_z_pt / 2):
            _delta_label(d, mid_x, ly, f'Δ{marg_W:.0f} mm')

    # ── S / P axis labels (inside housing rect) ──────────────────────────
    d.add(String(arr_ox + arr_L_pt / 2, arr_oy + arr_W_pt / 2 + 4,
                 f'← S = {S} →', fontSize=7, textAnchor='middle',
                 fillColor=_BLUE_MID, fontName='Helvetica-Bold'))
    d.add(String(arr_ox + 3, arr_oy + arr_W_pt / 2 - 8,
                 f'P={P}', fontSize=7, textAnchor='start',
                 fillColor=_BLUE_MID, fontName='Helvetica-Bold'))

    # ── Legend ───────────────────────────────────────────────────────────
    leg_x = rx_h + 5
    leg_y = oy + hW_pt - 8
    d.add(Rect(leg_x, leg_y,      8, 6, fillColor=_HOUSING_FILL, strokeColor=_BLUE_MID, strokeWidth=0.8))
    d.add(String(leg_x + 10, leg_y + 1, _t(lang, 'leg_housing'), fontSize=6, fillColor=_DIM_COLOR))
    d.add(Rect(leg_x, leg_y - 10, 8, 6, fillColor=c1, strokeColor=colors.white, strokeWidth=0.3))
    d.add(String(leg_x + 10, leg_y - 9, _t(lang, 'leg_cells'), fontSize=6, fillColor=_DIM_COLOR))

    return d


# ─── Pack isometric view ──────────────────────────────────────────────────────
def _pack_isometric(req, result):
    """
    Isometric projection of the pack housing with L / l / h dimension lines.
    Returns a ReportLab Drawing (Flowable).
    """
    hL = req.housing_l          # series direction  (front edge)
    hW = req.housing_l_small    # parallel direction (depth)
    hH = req.housing_h          # height

    arr_L = result.dimensions_raw.longueur_mm
    arr_W = result.dimensions_raw.largeur_mm
    arr_H = result.dimensions_raw.hauteur_mm

    C30 = math.cos(math.radians(30))
    S30 = math.sin(math.radians(30))

    margin = 38       # space for one set of dimension lines per side (housing ↘, module ↖)
    max_w  = 170 * mm - 2 * margin
    max_h  =  80 * mm - 2 * margin

    iso_w = (hL + hW) * C30        # projected bounding width
    iso_h = (hL + hW) * S30 + hH   # projected bounding height
    s = min(max_w / iso_w, max_h / iso_h)

    def iso(x, z, y):
        """3D pack coords → 2D isometric (unshifted)."""
        return ((x - z) * C30 * s, (x + z) * S30 * s + y * s)

    def iso_arr(x, z, y):
        """Same projection scaled to array dims (centred inside housing)."""
        ox_arr = (hL - arr_L) / 2
        oz_arr = (hW - arr_W) / 2
        oy_arr = (hH - arr_H) / 2
        return iso(x + ox_arr, z + oz_arr, y + oy_arr)

    # 8 corners of housing box (origin = bottom-front-left)
    corners_raw = [
        iso(0,   0,   0),   # A front-bottom-left
        iso(hL,  0,   0),   # B front-bottom-right
        iso(hL,  hW,  0),   # C back-bottom-right
        iso(0,   hW,  0),   # D back-bottom-left
        iso(0,   0,   hH),  # E front-top-left
        iso(hL,  0,   hH),  # F front-top-right
        iso(hL,  hW,  hH),  # G back-top-right
        iso(0,   hW,  hH),  # H back-top-left
    ]
    # 8 corners of module array (centred inside housing)
    module_raw = [
        iso_arr(0,    0,    0),
        iso_arr(arr_L,0,    0),
        iso_arr(arr_L,arr_W,0),
        iso_arr(0,    arr_W,0),
        iso_arr(0,    0,    arr_H),
        iso_arr(arr_L,0,    arr_H),
        iso_arr(arr_L,arr_W,arr_H),
        iso_arr(0,    arr_W,arr_H),
    ]

    all_pts = corners_raw + module_raw
    min_x = min(p[0] for p in all_pts)
    min_y = min(p[1] for p in all_pts)
    max_x = max(p[0] for p in all_pts)
    max_y = max(p[1] for p in all_pts)

    draw_w = max_x - min_x + 2 * margin
    draw_h = max_y - min_y + 2 * margin
    ox = margin - min_x
    oy = margin - min_y

    def sh(p): return (p[0] + ox, p[1] + oy)

    A, B, Cp, D, E, F, G, H = [sh(p) for p in corners_raw]
    mA, mB, mC, mD, mE, mF, mG, mH = [sh(p) for p in module_raw]

    d = Drawing(draw_w, draw_h)

    # ── Housing faces (3 visible) ─────────────────────────────────────────
    FACE_TOP   = colors.HexColor('#dbeafe')
    FACE_FRONT = colors.HexColor('#eff6ff')
    FACE_SIDE  = colors.HexColor('#bfdbfe')
    EDGE       = _BLUE_MID

    d.add(Polygon([H[0],H[1], G[0],G[1], F[0],F[1], E[0],E[1]],
                  fillColor=FACE_TOP, strokeColor=EDGE, strokeWidth=0.8))
    d.add(Polygon([B[0],B[1], Cp[0],Cp[1], G[0],G[1], F[0],F[1]],
                  fillColor=FACE_SIDE, strokeColor=EDGE, strokeWidth=0.8))
    d.add(Polygon([A[0],A[1], B[0],B[1], F[0],F[1], E[0],E[1]],
                  fillColor=FACE_FRONT, strokeColor=EDGE, strokeWidth=0.8))

    # ── Module array outline (front + right + top visible edges only) ─────
    MOD_C = colors.HexColor('#2563eb')
    MOD_W = 0.7
    # front face edges
    for p1, p2 in [(mA,mB), (mB,mF), (mF,mE), (mE,mA)]:
        d.add(Line(p1[0],p1[1], p2[0],p2[1], strokeColor=MOD_C, strokeWidth=MOD_W, strokeDashArray=[2,2]))
    # right face edges
    for p1, p2 in [(mB,mC), (mC,mG), (mG,mF)]:
        d.add(Line(p1[0],p1[1], p2[0],p2[1], strokeColor=MOD_C, strokeWidth=MOD_W, strokeDashArray=[2,2]))
    # top face edges
    for p1, p2 in [(mE,mH), (mH,mG)]:
        d.add(Line(p1[0],p1[1], p2[0],p2[1], strokeColor=MOD_C, strokeWidth=MOD_W, strokeDashArray=[2,2]))

    # ── Dimension helper ──────────────────────────────────────────────────
    MOD_DIM_C = colors.HexColor('#2563eb')

    def _dim_iso(p1, p2, label, side=1, offset=12, color=_DIM_COLOR):
        """Dimension line between two 2D points with rotated arrowheads."""
        dx = p2[0]-p1[0]; dy = p2[1]-p1[1]
        length = math.hypot(dx, dy)
        if length < 1: return
        ux, uy = dx/length, dy/length
        nx, ny = uy * side, -ux * side
        p1o = (p1[0] + nx*offset, p1[1] + ny*offset)
        p2o = (p2[0] + nx*offset, p2[1] + ny*offset)
        # witness lines from edge to dim line
        d.add(Line(p1[0], p1[1], p1o[0]+nx*2, p1o[1]+ny*2, strokeColor=color, strokeWidth=0.4))
        d.add(Line(p2[0], p2[1], p2o[0]+nx*2, p2o[1]+ny*2, strokeColor=color, strokeWidth=0.4))
        # main dim line
        d.add(Line(p1o[0], p1o[1], p2o[0], p2o[1], strokeColor=color, strokeWidth=0.6))
        # arrowheads
        h = 3.5
        px, py = -uy, ux
        d.add(Polygon([p1o[0], p1o[1],
                       p1o[0]+ux*h-px*(h/2), p1o[1]+uy*h-py*(h/2),
                       p1o[0]+ux*h+px*(h/2), p1o[1]+uy*h+py*(h/2)],
                      fillColor=color, strokeColor=color, strokeWidth=0))
        d.add(Polygon([p2o[0], p2o[1],
                       p2o[0]-ux*h-px*(h/2), p2o[1]-uy*h-py*(h/2),
                       p2o[0]-ux*h+px*(h/2), p2o[1]-uy*h+py*(h/2)],
                      fillColor=color, strokeColor=color, strokeWidth=0))
        # label offset further outward
        mx = (p1o[0]+p2o[0])/2 + nx*9
        my = (p1o[1]+p2o[1])/2 + ny*9
        d.add(String(mx, my, label, fontSize=6.5, textAnchor='middle',
                     fillColor=color, fontName='Helvetica-Bold'))

    # Housing dims — outward from bottom/right edges (side=1 → below/right of edge)
    _dim_iso(A,  B,  f'L = {hL:.0f} mm',  side=1,  offset=14, color=_DIM_COLOR)
    _dim_iso(B,  Cp, f'l = {hW:.0f} mm',  side=1,  offset=14, color=_DIM_COLOR)
    _dim_iso(B,  F,  f'h = {hH:.0f} mm',  side=1,  offset=14, color=_DIM_COLOR)

    # Module dims — placed on opposite exterior faces from housing dims
    # L_mod: front TOP edge mE→mF, side=-1 (outward above top face)
    _dim_iso(mE, mF, f'L_mod = {arr_L:.0f} mm', side=-1, offset=14, color=MOD_DIM_C)
    # l_mod: right TOP depth edge mF→mG, side=+1 (outward upper-right from right face)
    _dim_iso(mF, mG, f'l_mod = {arr_W:.0f} mm', side=1,  offset=14, color=MOD_DIM_C)
    # h_mod: LEFT front vertical mA→mE, side=-1 (outward to the left)
    _dim_iso(mA, mE, f'h_mod = {arr_H:.0f} mm', side=-1, offset=14, color=MOD_DIM_C)

    return d


# ─── Styles ───────────────────────────────────────────────────────────────────
def _make_styles():
    base = getSampleStyleSheet()

    title = ParagraphStyle('RTitle', parent=base['Normal'],
        fontSize=22, fontName='Helvetica-Bold',
        textColor=_BLUE_DARK, alignment=TA_CENTER,
        spaceBefore=8, spaceAfter=6, leading=28)

    subtitle = ParagraphStyle('RSubtitle', parent=base['Normal'],
        fontSize=9, fontName='Helvetica',
        textColor=colors.HexColor('#6b7280'), alignment=TA_CENTER, spaceAfter=4)

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
def _footer(canvas_obj, doc, lang='en'):
    canvas_obj.saveState()
    canvas_obj.setFont('Helvetica', 8)
    canvas_obj.setFillColor(colors.HexColor('#9ca3af'))
    canvas_obj.drawString(20 * mm, 10 * mm, _t(lang, 'footer_left'))
    canvas_obj.drawRightString(190 * mm, 10 * mm, f'{_t(lang, "footer_page")} {doc.page}')
    canvas_obj.restoreState()


# ─── Main entry point ─────────────────────────────────────────────────────────
def generate_pdf_report(calculation_request, calculation_result, cell_info, lang: str = 'en'):
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
    ep          = getattr(req, 'end_plate_thickness_mm', 10.0) if cell_type == 'prismatic' else 0.0
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
    story.append(Paragraph(_t(lang, 'report_title'), st['title']))
    story.append(Paragraph(
        _t(lang, 'generated_on', date=datetime.now().strftime(_t(lang, 'date_fmt'))),
        st['subtitle']))
    story.append(Spacer(1, 5*mm))
    story.append(HRFlowable(width='100%', thickness=1.5, color=_BLUE_MID))
    story.append(Spacer(1, 8*mm))

    # ── Input parameters ─────────────────────────────────────────────────────
    story.append(Paragraph(_t(lang, 's1'), st['section']))

    def _fmt_opt(v, unit='', digits=1):
        if v is None:
            return '—'
        return f'{v:.{digits}f} {unit}'.strip()

    mode_label = _t(lang, 'mode_manual') if is_manual else _t(lang, 'mode_auto')
    input_rows = [
        [_t(lang,'col_param'), _t(lang,'col_symbol'), _t(lang,'col_value')],
        [_t(lang,'p_cell_model'), '—', cell.nom],
        [_t(lang,'p_cell_type'),  '—', cell.type_cellule],
        [_t(lang,'p_energy'),     'E', _fmt_opt(req.energie_cible_wh, 'Wh')],
        [_t(lang,'p_voltage'),    'V', _fmt_opt(req.tension_cible_v, 'V')],
        [_t(lang,'p_current'),    'I', f'{req.courant_cible_a:.1f} A'],
        [_t(lang,'p_dod'),        'DoD', f'{req.depth_of_discharge:.1f} %'],
        [_t(lang,'p_housing_l'),  'L', f'{req.housing_l:.1f} mm'],
        [_t(lang,'p_housing_w'),  'l', f'{req.housing_l_small:.1f} mm'],
        [_t(lang,'p_housing_h'),  'h', f'{req.housing_h:.1f} mm'],
        [_t(lang,'p_margin'),     'δ', f'{req.marge_mm:.1f} mm'],
        [_t(lang,'p_gap'),        'g', f'{gap:.1f} mm'],
        [_t(lang,'p_mode'),       '—', mode_label],
    ]
    if cell_type == 'prismatic':
        input_rows.insert(-1, [_t(lang,'p_ep'), 'e_p', f'{ep:.1f} mm'])
    if is_manual:
        input_rows.append([_t(lang,'p_man_s'), 'S', str(req.manual_series or S)])
        input_rows.append([_t(lang,'p_man_p'), 'P', str(req.manual_parallel or P)])

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
    story.append(Paragraph(_t(lang, 's2'), st['section']))

    if cell_type == 'cylindrical':
        diam = cell.diameter_mm or cell.longueur_mm
        dim_rows = [
            [_t(lang,'c_diameter'), f'{diam:.1f} mm'],
            [_t(lang,'c_height'),   f'{cell.hauteur_mm:.1f} mm'],
        ]
    else:
        dim_rows = [
            [_t(lang,'c_height_y'), f'{cell.longueur_mm:.1f} mm'],
            [_t(lang,'c_width_z'),  f'{cell.largeur_mm:.1f} mm'],
            [_t(lang,'c_thick_x'),  f'{cell.hauteur_mm:.1f} mm'],
        ]

    cell_rows = [[_t(lang,'col_param'), _t(lang,'col_value')]] + [
        [_t(lang,'c_voltage'),  f'{cell.tension_nominale:.3f} V'],
        [_t(lang,'c_capacity'), f'{cell.capacite_ah:.2f} Ah'],
        [_t(lang,'c_current'),  f'{cell.courant_max_a:.1f} A'],
        [_t(lang,'c_mass'),     f'{cell.masse_g:.1f} g'],
        [_t(lang,'c_swelling'), f'{swelling_pct:.1f} %'],
    ] + dim_rows

    t_cell = Table(cell_rows, colWidths=[95*mm, 75*mm])
    t_cell.setStyle(_ts())
    story.append(t_cell)
    story.append(Spacer(1, 6*mm))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 3 — Sizing Methodology
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph(_t(lang, 's3'), st['section']))

    def formula_block(relation, an_str, result_str, note_str=None):
        """Helper: returns a list of story elements for one formula step."""
        out = []
        out.append(Paragraph(f'{_t(lang,"rel_label")} :&nbsp;&nbsp;&nbsp; {relation}', st['formula']))
        out.append(Paragraph(f'{_t(lang,"an_label")} :&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {an_str}', st['an']))
        out.append(Paragraph(f'→ {result_str}', st['result_line']))
        if note_str:
            out.append(Paragraph(note_str, st['note']))
        return out

    if is_manual:
        story.append(Paragraph(_t(lang, 'ss31_manual'), st['subsection']))
        story.append(Paragraph(_t(lang, 'manual_notice', S=S, P=P), st['normal']))
        story.append(Spacer(1, 4*mm))
    else:
        story.append(Paragraph(_t(lang, 'ss31_auto'), st['subsection']))
        story.append(Paragraph(_t(lang, 'p_parallel_intro'), st['normal']))
        an_p = (f'P = ⌈ {req.courant_cible_a:.1f} / {cell.courant_max_a:.1f} ⌉'
                f' = ⌈ {req.courant_cible_a/cell.courant_max_a:.3f} ⌉')
        story.extend(formula_block(
            'P = ⌈ I / I_max ⌉',
            an_p,
            f'P = {P}'))
        story.append(Spacer(1, 2*mm))

        story.append(Paragraph(_t(lang, 'ss32'), st['subsection']))
        story.append(Paragraph(_t(lang, 'p_series_intro'), st['normal']))

        s_candidates_display = []

        if req.tension_cible_v is not None and cell.tension_nominale > 0:
            s_v = math.ceil(req.tension_cible_v / cell.tension_nominale)
            an_sv = (f'S_V = ⌈ {req.tension_cible_v:.1f} / {cell.tension_nominale:.3f} ⌉'
                     f' = ⌈ {req.tension_cible_v/cell.tension_nominale:.3f} ⌉')
            story.extend(formula_block(
                'S_V = ⌈ V_cible / V_n ⌉',
                an_sv,
                f'S_V = {s_v}',
                _t(lang, 'note_voltage')))
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
                _t(lang, 'note_energy')))
            s_candidates_display.append(f'S_E = {s_e}')

        if len(s_candidates_display) > 1:
            story.append(Paragraph(
                _t(lang, 's_max_line', cands=', '.join(s_candidates_display), S=S),
                st['result_line']))
        story.append(Spacer(1, 2*mm))

    story.append(Paragraph(_t(lang, 'ss33'), st['subsection']))
    story.append(Paragraph(_t(lang, 'dim_intro', gap=gap), st['normal']))

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
        an_H = f'h = {cell.hauteur_mm:.1f} mm  ({_t(lang, "no_swell_cyl")})'
        rel_L = 'L = S × d × (1 + τ) + (S−1) × g'
        rel_W = 'l = P × d × (1 + τ) + (P−1) × g'
    else:
        ep_term = f' + 2×{ep:.1f}' if ep > 0 else ''
        an_L = (f'L = {S}×{cell.hauteur_mm:.1f}×(1+{swelling_pct:.1f}/100) + ({S}-1)×{gap:.1f}{ep_term}'
                f' = {L_sw:.1f} mm')
        an_W = (f'l = {P}×{cell.largeur_mm:.1f}×(1+{swelling_pct:.1f}/100) + ({P}-1)×{gap:.1f}'
                f' = {W_sw:.1f} mm')
        an_H = f'h = {cell.longueur_mm:.1f} mm  ({_t(lang, "no_swell_pris")})'
        rel_L = 'L = S × h_cell × (1 + τ) + (S−1) × g + 2 × e_p' if ep > 0 else 'L = S × h_cell × (1 + τ) + (S−1) × g'
        rel_W = 'l = P × l_cell × (1 + τ) + (P−1) × g'

    story.extend(formula_block(rel_L, an_L, f'L_pack = {L_sw:.1f} mm'))
    story.extend(formula_block(rel_W, an_W, f'l_pack = {W_sw:.1f} mm'))
    story.append(Paragraph(f'→ h_pack = {an_H}', st['result_line']))
    story.append(Spacer(1, 2*mm))

    story.append(Paragraph(_t(lang, 'ss34'), st['subsection']))
    story.append(Paragraph(_t(lang, 'margin_intro', delta=req.marge_mm), st['normal']))

    margins = result.marges_reelles
    mL, mW, mH = margins.get('L', 0), margins.get('W', 0), margins.get('H', 0)

    def _margin_an(housing_dim, raw_dim, actual_margin, axis_label):
        ok_str = _t(lang, 'margin_ok') if actual_margin >= req.marge_mm else _t(lang, 'margin_fail')
        return (
            f'δ_{axis_label} = ⌊ {housing_dim:.1f} − {raw_dim:.1f} ⌋ / 2 = {actual_margin:.1f} mm   [{ok_str}]',
    )

    _min_req = _t(lang, 'min_req')
    story.extend(formula_block(
        'δ = (Dim_housing − Dim_raw) / 2 ≥ δ_min',
        _margin_an(req.housing_l,       L_raw, mL, 'L'),
        f'δ_L = {mL:.1f} mm  ({_min_req}: {req.marge_mm:.1f} mm)'))
    story.extend(formula_block(
        'δ = (Dim_housing − Dim_raw) / 2 ≥ δ_min',
        _margin_an(req.housing_l_small, W_raw, mW, 'l'),
        f'δ_l = {mW:.1f} mm  ({_min_req}: {req.marge_mm:.1f} mm)'))
    story.extend(formula_block(
        'δ = (Dim_housing − Dim_raw) / 2 ≥ δ_min',
        _margin_an(req.housing_h,       H_raw, mH, 'h'),
        f'δ_h = {mH:.1f} mm  ({_min_req}: {req.marge_mm:.1f} mm)'))

    story.append(Spacer(1, 6*mm))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 4 — Pack Schematics
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph(_t(lang, 's4'), st['section']))
    story.append(Spacer(1, 2*mm))

    story.append(Paragraph(_t(lang, 'ss41'), st['subsection']))
    schematic = _pack_schematic(req, result, cell_info, lang=lang)
    story.append(schematic)
    story.append(Paragraph(_t(lang, 'cap_top', S=S, P=P), st['caption']))
    story.append(Spacer(1, 4*mm))

    story.append(Paragraph(_t(lang, 'ss42'), st['subsection']))
    iso_drawing = _pack_isometric(req, result)
    story.append(iso_drawing)
    story.append(Paragraph(_t(lang, 'cap_iso'), st['caption']))
    story.append(Spacer(1, 6*mm))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 5 — Results
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph(_t(lang, 's5'), st['section']))

    story.append(Paragraph(_t(lang, 'ss51'), st['subsection']))
    cfg_rows = [
        [_t(lang,'col_param'), _t(lang,'col_value')],
        [_t(lang,'cfg_s'),     str(S)],
        [_t(lang,'cfg_p'),     str(P)],
        [_t(lang,'cfg_total'), str(S * P)],
        [_t(lang,'cfg_mode'),  mode_label],
        [_t(lang,'cfg_arr_l'), f'{L_sw:.1f} mm'],
        [_t(lang,'cfg_arr_w'), f'{W_sw:.1f} mm'],
        [_t(lang,'cfg_arr_h'), f'{H_raw:.1f} mm'],
        [_t(lang,'cfg_vol'),   f'{result.taux_occupation_pct:.1f} %'],
    ]
    t_cfg = Table(cfg_rows, colWidths=[95*mm, 75*mm])
    t_cfg.setStyle(_ts())
    story.append(t_cfg)
    story.append(Spacer(1, 5*mm))

    story.append(Paragraph(_t(lang, 'ss52'), st['subsection']))
    elec = result.electrical
    elec_rows = [
        [_t(lang,'col_param'), _t(lang,'col_value')],
        [_t(lang,'el_voltage'),  f'{elec.actual_voltage_v:.2f} V'],
        [_t(lang,'el_capacity'), f'{elec.actual_capacity_ah:.2f} Ah'],
        [_t(lang,'el_energy_t'), f'{elec.total_energy_wh:.1f} Wh'],
        [_t(lang,'el_energy_u'), f'{elec.usable_energy_wh:.1f} Wh'],
        [_t(lang,'el_mass'),     f'{elec.total_weight_kg:.3f} kg'],
        [_t(lang,'el_density'),  f'{elec.energy_density_wh_kg:.1f} Wh/kg'],
    ]
    t_elec = Table(elec_rows, colWidths=[95*mm, 75*mm])
    t_elec.setStyle(_ts())
    story.append(t_elec)
    story.append(Spacer(1, 5*mm))

    story.append(Paragraph(_t(lang, 'ss53'), st['subsection']))
    req_margin = req.marge_mm

    def _cell_color_margin(val):
        return _GREEN_OK if val >= req_margin else _RED_KO

    margin_rows = [
        [_t(lang,'mg_axis'), _t(lang,'mg_housing'), _t(lang,'mg_array'),
         _t(lang,'mg_margin'), _t(lang,'mg_required'), _t(lang,'mg_status')],
        [_t(lang,'mg_L'),
         f'{req.housing_l:.1f}',       f'{L_raw:.1f}', f'{mL:.1f}', f'{req_margin:.1f}',
         _t(lang,'mg_ok') if mL >= req_margin else _t(lang,'mg_fail')],
        [_t(lang,'mg_W'),
         f'{req.housing_l_small:.1f}', f'{W_raw:.1f}', f'{mW:.1f}', f'{req_margin:.1f}',
         _t(lang,'mg_ok') if mW >= req_margin else _t(lang,'mg_fail')],
        [_t(lang,'mg_H'),
         f'{req.housing_h:.1f}',       f'{H_raw:.1f}', f'{mH:.1f}', f'{req_margin:.1f}',
         _t(lang,'mg_ok') if mH >= req_margin else _t(lang,'mg_fail')],
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

    story.append(Spacer(1, 3*mm))

    # ── Verdict ───────────────────────────────────────────────────────────────
    v_color = _GREEN_OK if is_ok else _RED_KO
    v_bg    = _GREEN_BG if is_ok else _RED_BG
    v_text  = _t(lang, 'verdict_ok') if is_ok else _t(lang, 'verdict_ko')
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

    # ── Build ─────────────────────────────────────────────────────────────────
    footer_fn = lambda c, d: _footer(c, d, lang=lang)
    doc.build(story, onFirstPage=footer_fn, onLaterPages=footer_fn)
    buf.seek(0)
    return buf
