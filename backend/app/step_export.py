"""
step_export.py
--------------
Generates a parametric STEP file that mirrors the geometry produced by
PackAssemblyBuilder.js — same axis convention, same positions, same dimensions.

Performance strategy:
  For any repeated shape (cells, terminals, bracket bars, strips, etc.) we
  create the OCC solid ONCE, then call Shape.moved(loc) N times (a cheap
  location-transform, no re-computation), bundle them into a Compound, and
  add that single Compound to the Assembly.  This is ~60x faster than
  creating N individual OCC solids.

  Cables use individual Assembly.add() calls — there are only 4 × 3-4 segs.
  Balance wires are omitted (r = 0.35 mm — not useful in mechanical STEP).

Axis convention (identical to Three.js / PackAssemblyBuilder):
    X  —  series axis     (pack length,  housing_l)
    Y  —  height axis     (cell standing direction, housing_h)
    Z  —  parallel axis   (pack width,   housing_l_small)

Author: PFE Capgemini Engineering — Battery Pre-Design Assistant
"""

import math
import os
import tempfile
import warnings
from io import BytesIO

import cadquery as cq
from cadquery import Assembly, Color, Compound, Location, Vector

from app.models.cellule import Cellule
from app.schemas.battery import CalculationRequest, CalculationResult

warnings.filterwarnings("ignore", category=FutureWarning, module="cadquery")

# ── Constants — keep in sync with PackAssemblyBuilder.js ─────────────────────
WALL_MM           = 2
TERM_OFFSET_RATIO = 0.35
BRACKET_H         = 10

# ── Colour palette (R, G, B  0.0–1.0) ────────────────────────────────────────
C_HOUSING     = Color(0.23, 0.51, 0.96)
C_BLUE        = Color(0.11, 0.31, 0.85)
C_STEEL       = Color(0.75, 0.75, 0.75)
C_WHITE_TERM  = Color(0.95, 0.95, 0.95)
C_BLACK       = Color(0.07, 0.07, 0.07)
C_BUSBAR      = Color(0.63, 0.63, 0.63)
C_BRACKET     = Color(0.07, 0.09, 0.15)
C_ORANGE      = Color(0.98, 0.45, 0.09)
C_GRAY        = Color(0.42, 0.45, 0.50)
C_RED         = Color(0.86, 0.15, 0.15)
C_BRASS       = Color(0.85, 0.47, 0.04)
C_CABLE_RED   = Color(0.86, 0.15, 0.15)
C_CABLE_BLACK = Color(0.07, 0.07, 0.07)
C_CABLE_ORG   = Color(0.80, 0.27, 0.00)
C_CABLE_BLUE  = Color(0.11, 0.31, 0.85)


# ══════════════════════════════════════════════════════════════════════════════
# PUBLIC ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

def generate_step_file(
    req: CalculationRequest,
    result: CalculationResult,
    cell: Cellule,
) -> BytesIO:
    """
    Build a CadQuery Assembly mirroring the PackAssemblyBuilder.js scene
    and return it as a STEP file in a BytesIO buffer.
    """
    S   = result.nb_serie
    P   = result.nb_parallele
    gap = req.cell_gap_mm
    ep  = getattr(req, 'end_plate_thickness_mm', 10.0) or 0.0
    hL  = req.housing_l
    hW  = req.housing_l_small
    hH  = req.housing_h

    cell_type = (cell.type_cellule or "Pouch").lower()
    is_cyl    = cell_type == "cylindrical"

    if is_cyl:
        diameter = cell.diameter_mm if cell.diameter_mm else cell.longueur_mm
        stepX = diameter + gap
        stepZ = diameter + gap
        bodyH = cell.hauteur_mm * 0.96
    else:
        sizeX = cell.hauteur_mm
        sizeZ = cell.largeur_mm
        bodyH = cell.longueur_mm * 0.95
        stepX = sizeX + gap
        stepZ = sizeZ + gap

    yCenter = -hH / 2 + WALL_MM + bodyH / 2
    startX  = -(S * stepX) / 2 + stepX / 2
    startZ  = -(P * stepZ) / 2 + stepZ / 2
    totalZ  = P * stepZ

    asm = Assembly(name="battery_pack")

    # Housing and cables excluded — STEP is for mechanical cell array integration
    if is_cyl:
        _build_cylindrical_cells(asm, S, P, diameter, bodyH, yCenter, startX, startZ, stepX, stepZ)
        _build_nickel_strips(asm, S, P, diameter, bodyH, yCenter, startX, startZ, stepX, stepZ)
        _build_cylindrical_brackets(asm, S, P, diameter, bodyH, yCenter, startX, startZ, stepX, stepZ)
    else:
        _build_prismatic_cells(asm, S, P, sizeX, sizeZ, bodyH, yCenter, startX, startZ, stepX, stepZ)
        _build_prismatic_busbars(asm, S, P, sizeX, sizeZ, bodyH, yCenter, startX, startZ, stepX, stepZ)
        _build_insulation_cards(asm, S, P, sizeX, sizeZ, bodyH, yCenter, startX, stepX, stepZ, gap)
        _build_side_plates(asm, S, P, sizeX, sizeZ, bodyH, yCenter, stepX, stepZ, gap, ep)

    with tempfile.NamedTemporaryFile(suffix=".step", delete=False) as f:
        path = f.name
    try:
        asm.save(path)
        with open(path, "rb") as f:
            data = f.read()
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass

    return BytesIO(data)


# ══════════════════════════════════════════════════════════════════════════════
# GEOMETRY HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _box(lx: float, ly: float, lz: float) -> cq.Workplane:
    """Box centered at origin: lx=X, ly=Y, lz=Z."""
    return cq.Workplane("XY").box(lx, ly, lz)


def _cyl_y(height: float, radius: float) -> cq.Workplane:
    """Cylinder aligned along Y axis, centered at origin."""
    return cq.Workplane("XZ").cylinder(height, radius)


def _loc(x: float, y: float, z: float) -> Location:
    return Location(Vector(x, y, z))


def _loc_rot(x, y, z, ax, ay, az, angle_deg) -> Location:
    return Location(Vector(x, y, z), Vector(ax, ay, az), angle_deg)


def _batch(wp: cq.Workplane, locs: list, name: str, color: Color, asm: Assembly):
    """
    Create the OCC solid ONCE from wp, then place it at every location in locs
    using Shape.moved() (a cheap transform), bundle into a Compound, and add
    that single Compound to the assembly.  O(1) OCC solid creation vs O(N).
    """
    if not locs:
        return
    proto = wp.val()
    bodies = [proto.moved(l) for l in locs]
    asm.add(Compound.makeCompound(bodies), name=name, color=color)


# ── Cable tube helper (used for the 4 main cables — few segments, individual adds OK) ──

def _tube_seg(p1, p2, radius, name, color, asm):
    """Cylinder between two 3D points."""
    dx, dy, dz = p2[0]-p1[0], p2[1]-p1[1], p2[2]-p1[2]
    L = math.sqrt(dx*dx + dy*dy + dz*dz)
    if L < 0.5:
        return
    cx, cy, cz = (p1[0]+p2[0])/2, (p1[1]+p2[1])/2, (p1[2]+p2[2])/2
    nx, ny, nz = dx/L, dy/L, dz/L
    angle   = math.degrees(math.acos(max(-1.0, min(1.0, ny))))
    rot_len = math.sqrt(nz*nz + nx*nx)
    tube    = _cyl_y(L, radius)
    if rot_len < 1e-9:
        loc = _loc(cx, cy, cz) if ny > 0 else _loc_rot(cx, cy, cz, 1, 0, 0, 180)
    else:
        loc = _loc_rot(cx, cy, cz, nz/rot_len, 0, -nx/rot_len, angle)
    asm.add(tube, name=name, color=color, loc=loc)


def _polyline_tube(pts, radius, name, color, asm):
    for i, (a, b) in enumerate(zip(pts, pts[1:])):
        _tube_seg(a, b, radius, f"{name}_{i}", color, asm)


# ══════════════════════════════════════════════════════════════════════════════
# LAYER BUILDERS — each matches the corresponding _build* in PackAssemblyBuilder.js
# ══════════════════════════════════════════════════════════════════════════════

def _build_housing(asm, hL, hW, hH):
    wall = WALL_MM
    fbH  = hH / 2 - wall
    fbY  = -hH / 2 + wall + fbH / 2
    lrD  = hW - wall * 2
    asm.add(_box(hL, wall, hW),   name="h_bottom", color=C_HOUSING, loc=_loc(0, -hH/2+wall/2, 0))
    asm.add(_box(hL, fbH, wall),  name="h_front",  color=C_HOUSING, loc=_loc(0, fbY,  hW/2-wall/2))
    asm.add(_box(hL, fbH, wall),  name="h_back",   color=C_HOUSING, loc=_loc(0, fbY, -hW/2+wall/2))
    asm.add(_box(wall, fbH, lrD), name="h_left",   color=C_HOUSING, loc=_loc( hL/2-wall/2, fbY, 0))
    asm.add(_box(wall, fbH, lrD), name="h_right",  color=C_HOUSING, loc=_loc(-hL/2+wall/2, fbY, 0))


# ── Cylindrical cells + terminals ─────────────────────────────────────────────

def _build_cylindrical_cells(asm, S, P, diameter, bodyH, yCenter, startX, startZ, stepX, stepZ):
    pos_dh = 0.3   # positive disc height
    pos_bh = 0.6   # positive button height
    neg_dh = 0.3   # negative disc height

    # ── Cell bodies — one shape, all S*P locs ─────────────────────────────────
    body_locs = [_loc(startX+s*stepX, yCenter, startZ+p*stepZ) for s in range(S) for p in range(P)]
    _batch(_cyl_y(bodyH, diameter/2), body_locs, "cells", C_BLUE, asm)

    # ── Terminals — even columns have +terminal on top, odd on bottom ─────────
    # Positive disc
    pd = _cyl_y(pos_dh, diameter/2 - 0.3)
    _batch(pd, [_loc(startX+s*stepX, yCenter+bodyH/2+pos_dh/2, startZ+p*stepZ) for s in range(0,S,2) for p in range(P)], "pd_top", C_STEEL, asm)
    _batch(pd, [_loc(startX+s*stepX, yCenter-bodyH/2-pos_dh/2, startZ+p*stepZ) for s in range(1,S,2) for p in range(P)], "pd_bot", C_STEEL, asm)

    # Positive button
    pb = _cyl_y(pos_bh, diameter*0.18*0.85)
    _batch(pb, [_loc(startX+s*stepX, yCenter+bodyH/2+pos_dh+pos_bh/2, startZ+p*stepZ) for s in range(0,S,2) for p in range(P)], "pb_top", C_STEEL, asm)
    _batch(pb, [_loc(startX+s*stepX, yCenter-bodyH/2-pos_dh-pos_bh/2, startZ+p*stepZ) for s in range(1,S,2) for p in range(P)], "pb_bot", C_STEEL, asm)

    # Negative disc (complementary side)
    nd = _cyl_y(neg_dh, diameter/2 - 0.3)
    _batch(nd, [_loc(startX+s*stepX, yCenter-bodyH/2-neg_dh/2, startZ+p*stepZ) for s in range(0,S,2) for p in range(P)], "nd_top", C_STEEL, asm)
    _batch(nd, [_loc(startX+s*stepX, yCenter+bodyH/2+neg_dh/2, startZ+p*stepZ) for s in range(1,S,2) for p in range(P)], "nd_bot", C_STEEL, asm)


# ── Nickel strips (cylindrical busbars) ───────────────────────────────────────

def _build_nickel_strips(asm, S, P, diameter, bodyH, yCenter, startX, startZ, stepX, stepZ):
    bp    = BRACKET_H * 0.25   # bracket protrude = 2.5 mm
    y_top = yCenter + bodyH/2 + max(0.3, bp) + 0.3
    y_bot = yCenter - bodyH/2 - max(0.3, bp) - 0.3
    thick = 0.5

    plen  = (P-1)*stepZ + diameter if P > 1 else diameter
    strip = _box(diameter*0.6, thick, plen)
    strip_locs = (
        [_loc(startX+s*stepX, y_top, 0) for s in range(S)] +
        [_loc(startX+s*stepX, y_bot, 0) for s in range(S)]
    )
    _batch(strip, strip_locs, "strips", C_BUSBAR, asm)

    if S > 1:
        jumper = _box(stepX, thick, diameter*0.35)
        j_locs = [
            _loc(startX+s*stepX+stepX/2,
                 y_top+0.25 if s%2==1 else y_bot-0.25,
                 startZ+p*stepZ)
            for s in range(S-1) for p in range(P)
        ]
        _batch(jumper, j_locs, "jumpers", C_BUSBAR, asm)


# ── Cylindrical brackets ──────────────────────────────────────────────────────

def _build_cylindrical_brackets(asm, S, P, diameter, bodyH, yCenter, startX, startZ, stepX, stepZ):
    totalX = S * stepX
    totalZ = P * stepZ
    bh     = BRACKET_H
    bwx    = max(2.5, min(6, stepX - diameter))
    bwz    = max(2.5, min(6, stepZ - diameter))
    grip   = bh * 0.75

    x_bar = _box(totalX + bwx*2, bh, bwz)   # runs along X (one per Z slot)
    z_bar = _box(bwx, bh, totalZ + bwz*2)   # runs along Z (one per X slot)

    for y_base, sfx in [
        (yCenter + bodyH/2 - grip,        "top"),
        (yCenter - bodyH/2 - bh + grip,   "bot"),
    ]:
        ym = y_base + bh/2
        _batch(x_bar, [_loc(0, ym, startZ+(pb-0.5)*stepZ) for pb in range(P+1)], f"brk_x_{sfx}", C_BRACKET, asm)
        _batch(z_bar, [_loc(startX+(sb-0.5)*stepX, ym, 0) for sb in range(S+1)], f"brk_z_{sfx}", C_BRACKET, asm)


# ── Prismatic cells + terminals ───────────────────────────────────────────────

def _build_prismatic_cells(asm, S, P, sizeX, sizeZ, bodyH, yCenter, startX, startZ, stepX, stepZ):
    wrap_h = bodyH - 2
    y_wrap = yCenter - 1
    y_cap  = yCenter + bodyH/2 - 1
    term_y = yCenter + bodyH/2
    tr     = min(sizeX*0.32, sizeZ*0.12, 7)   # terminal radius (matches JS formula)
    po     =  sizeZ * TERM_OFFSET_RATIO        # positive Z offset
    no     = -sizeZ * TERM_OFFSET_RATIO        # negative Z offset
    sr     = min(2.5, tr*0.45)                 # stud radius
    nr     = min(4.0, tr*0.65)                 # hex-nut radius (matches JS nutGeom)
    qr_sz  = min(8.0, sizeX*0.6)              # label plate size (matches JS qrGeom)

    wrap_locs = [_loc(startX+s*stepX, y_wrap,     startZ+p*stepZ) for s in range(S) for p in range(P)]
    cap_locs  = [_loc(startX+s*stepX, y_cap,      startZ+p*stepZ) for s in range(S) for p in range(P)]
    # Label plate sits centred on cap face between the two terminals (matches JS qrGeom at termY+0.5)
    lbl_locs  = [_loc(startX+s*stepX, term_y+0.5, startZ+p*stepZ) for s in range(S) for p in range(P)]
    _batch(_box(sizeX, wrap_h, sizeZ), wrap_locs, "cells",        C_BLUE,       asm)
    _batch(_box(sizeX, 2,      sizeZ), cap_locs,  "caps",         C_BLACK,      asm)
    _batch(_box(qr_sz, 1.0,    qr_sz), lbl_locs,  "label_plates", C_WHITE_TERM, asm)

    # Terminal locs — even columns: pos at +po, neg at +no
    #                  odd columns: pos at +no, neg at +po  (flipped polarity)
    def tlocs(y_off, off_even, off_odd):
        return (
            [_loc(startX+s*stepX, y_off, startZ+p*stepZ+off_even) for s in range(0,S,2) for p in range(P)] +
            [_loc(startX+s*stepX, y_off, startZ+p*stepZ+off_odd)  for s in range(1,S,2) for p in range(P)]
        )

    ring = _cyl_y(1.5, tr*1.2)
    base = _cyl_y(2.5, tr)
    stud = _cyl_y(7.0, sr)
    nut  = _cyl_y(1.5, nr)   # hex nut on stud (matches JS nutGeom at termY+4.55)

    # Y offsets match PackAssemblyBuilder.js exactly: +1.05 ring, +1.55 base, +6.3 stud, +4.55 nut
    _batch(ring, tlocs(term_y+1.05, po, no), "pos_ring", C_WHITE_TERM, asm)
    _batch(base, tlocs(term_y+1.55, po, no), "pos_base", C_STEEL,      asm)
    _batch(stud, tlocs(term_y+6.3,  po, no), "pos_stud", C_STEEL,      asm)
    _batch(nut,  tlocs(term_y+4.55, po, no), "pos_nut",  C_STEEL,      asm)
    _batch(ring, tlocs(term_y+1.05, no, po), "neg_ring", C_BLACK,      asm)
    _batch(base, tlocs(term_y+1.55, no, po), "neg_base", C_STEEL,      asm)
    _batch(stud, tlocs(term_y+6.3,  no, po), "neg_stud", C_STEEL,      asm)
    _batch(nut,  tlocs(term_y+4.55, no, po), "neg_nut",  C_STEEL,      asm)


# ── Prismatic busbars (snake path) ────────────────────────────────────────────

def _build_prismatic_busbars(asm, S, P, sizeX, sizeZ, bodyH, yCenter, startX, startZ, stepX, stepZ):
    po     =  sizeZ * TERM_OFFSET_RATIO
    no     = -sizeZ * TERM_OFFSET_RATIO
    tr     = min(sizeX*0.32, sizeZ*0.12, 7)
    busbar_flat_h = 2.5  # matches PackAssemblyBuilder.js busbarFlatH
    # Match JS: termYLocal = yCenter+bodyH/2+2, termBaseTop = +2.8, busbarY = +0.5+busbarFlatH/2
    bar_y  = yCenter + bodyH/2 + 2 + 2.8 + 0.5 + busbar_flat_h / 2   # = yCenter+bodyH/2+6.55
    hbw    = tr*2 + 2    # bar width in Z
    hbx    = stepX + tr*2  # bar width in X

    def neg_z(s, p):
        z = startZ + p*stepZ
        return z + (po if s%2==1 else no)

    def pos_z(s, p):
        z = startZ + p*stepZ
        return z + (no if s%2==1 else po)

    snake = []
    for p in range(P-1, -1, -1):
        row = P-1-p
        if row % 2 == 0:
            for s in range(S-1, -1, -1): snake.append((s, p))
        else:
            for s in range(S):           snake.append((s, p))

    h_locs, v_bars = [], []
    for i in range(len(snake)-1):
        a, b = snake[i], snake[i+1]
        if a[1] == b[1]:
            xa, xb = startX+a[0]*stepX, startX+b[0]*stepX
            h_locs.append(_loc((xa+xb)/2, bar_y, neg_z(*a)))
        else:
            nz, pz = neg_z(*a), pos_z(*b)
            v_bars.append({"x": startX+a[0]*stepX, "z": (nz+pz)/2, "len": abs(nz-pz)})

    h_bar = _box(hbx, busbar_flat_h, hbw)
    _batch(h_bar, h_locs, "h_bars", C_BUSBAR, asm)

    for i, b in enumerate(v_bars):
        blen = max(b["len"]+hbw, hbw)
        asm.add(_box(hbw, busbar_flat_h, blen), name=f"vbar_{i}", color=C_BUSBAR, loc=_loc(b["x"], bar_y, b["z"]))


# ── Prismatic insulation cards ────────────────────────────────────────────────

def _build_insulation_cards(asm, S, P, sizeX, sizeZ, bodyH, yCenter, startX, stepX, stepZ, gap):
    card_h = bodyH * 0.75
    card_w = P * sizeZ + (P - 1) * gap  # exact cell face width
    card   = _box(0.3, card_h, card_w)
    ahx    = (S * stepX - gap) / 2  # array half-X
    # S-1 inner cards + 2 outer cards (at end-plate/cell interfaces) = S+1 total
    inner = [_loc(startX + s*stepX + stepX/2, yCenter, 0) for s in range(S - 1)]
    outer = [_loc(ahx, yCenter, 0), _loc(-ahx, yCenter, 0)]
    _batch(card, inner + outer, "ins_cards", C_ORANGE, asm)


# ── Prismatic side/end plates ─────────────────────────────────────────────────

def _build_side_plates(asm, S, P, sizeX, sizeZ, bodyH, yCenter, stepX, stepZ, gap, ep=10.0):
    ahx        = (S * stepX - gap) / 2
    ahz        = (P * stepZ - gap) / 2
    rail_thick = 8    # fixed side rail depth (mm) — matches PackAssemblyBuilder.js
    rail_h     = 12   # fixed rail height (mm)
    rail_len   = S * stepX - gap + 2 * ep  # spans full array including end plates
    rail_y     = yCenter  # centred on array height
    rail = _box(rail_len, rail_h, rail_thick)
    _batch(rail, [_loc(0, rail_y, ahz + rail_thick/2), _loc(0, rail_y, -ahz - rail_thick/2)], "side_rails", C_GRAY, asm)
    # End plates: ep thick, height = bodyH, Z span = array width
    end = _box(ep, bodyH, ahz * 2)
    _batch(end, [_loc(ahx + ep/2, yCenter, 0), _loc(-ahx - ep/2, yCenter, 0)], "end_plates", C_GRAY, asm)


# ── BMS ───────────────────────────────────────────────────────────────────────

def _build_bms(asm, S, yCenter, total_z):
    bms_l = max(80, S*8+30)
    bms_w = 50
    bth   = 15
    bx, by, bz = 0, yCenter, total_z/2 + bth/2 + 1

    asm.add(_box(bms_l-10, bms_w, bth), name="bms_body",  color=C_RED,   loc=_loc(bx, by, bz))
    cap = _box(5, bms_w, bth)
    _batch(cap, [_loc(bx-bms_l/2+2.5, by, bz), _loc(bx+bms_l/2-2.5, by, bz)], "bms_caps", C_BLACK, asm)

    # Balance pins
    x0 = bx - bms_l/2 + 15
    x1 = bx + bms_l/2 - 15
    top_pins = [(x0 + (i/S)*(x1-x0) if S > 0 else x0, by+bms_w/2+1.5, bz) for i in range(S+1)]
    pin = _cyl_y(3, 0.8)
    _batch(pin, [_loc(*p) for p in top_pins], "bms_pins", C_BRASS, asm)

    # Power ports
    px = bx - bms_l/2 - 2
    port = _box(4, 4, 4)
    _batch(port, [_loc(px, by+15, bz), _loc(px, by, bz), _loc(px, by-15, bz)], "ports", C_BRASS, asm)

    return {
        "bms_x": bx, "bms_y": by, "bms_l": bms_l, "bms_z": bz,
        "top_pins": top_pins,
        "port_c": (bx-bms_l/2-4, by+15, bz),
        "port_b": (bx-bms_l/2-4, by,    bz),
        "port_p": (bx-bms_l/2-4, by-15, bz),
    }


# ── Main cables ───────────────────────────────────────────────────────────────

def _build_main_cables(asm, S, P, cell, gap, is_cyl, bms_pos, yCenter, bodyH, startX, startZ, stepX, stepZ):
    if bms_pos is None:
        return

    port_c = bms_pos["port_c"]
    port_b = bms_pos["port_b"]
    port_p = bms_pos["port_p"]
    bms_x  = bms_pos["bms_x"]
    bms_y  = bms_pos["bms_y"]
    bms_l  = bms_pos["bms_l"]
    bms_z  = bms_pos["bms_z"]
    r = 2.5

    if is_cyl:
        pt    = yCenter + bodyH/2 + 1.2
        pb    = yCenter - bodyH/2 - 0.6
        lf    = (S-1) % 2 == 1
        p_pos = (startX+(S-1)*stepX, pb if lf else pt, 0.0)
        p_neg = (startX, pb, 0.0)
    else:
        term_h = max(8, cell.longueur_mm*0.07)
        pt    = yCenter + bodyH/2 + term_h + 2.5
        po    =  cell.largeur_mm * TERM_OFFSET_RATIO
        no    = -cell.largeur_mm * TERM_OFFSET_RATIO
        lf    = (S-1) % 2 == 1
        p_neg = (startX, pt, startZ+no)
        p_pos = (startX+(S-1)*stepX, pt, startZ+(no if lf else po))

    above = pt + 20
    rx    = bms_x + bms_l/2 + 12
    out_l = (rx, bms_y+18, bms_z)
    out_c = (rx, bms_y-18, bms_z)

    bolt = _cyl_y(6, 4)
    _batch(bolt, [_loc(*out_l), _loc(*out_c)], "bolts", C_BRASS, asm)

    _polyline_tube([p_pos, (p_pos[0], above, p_pos[2]), (out_l[0], above, out_l[2]), out_l], r, "cable_b+", C_CABLE_RED,   asm)
    _polyline_tube([p_neg, (p_neg[0], above, p_neg[2]), (port_b[0]+5, above, port_b[2]), (port_b[0]+5, port_b[1]+12, port_b[2]), port_b], r, "cable_b-", C_CABLE_BLACK, asm)
    _polyline_tube([port_p, (port_p[0]+15, port_p[1], port_p[2]), (out_l[0]-5, port_p[1]+15, out_l[2]), out_l], r, "cable_p-", C_CABLE_ORG, asm)
    _polyline_tube([port_c, (port_c[0]+15, port_c[1], port_c[2]), (out_c[0]-5, port_c[1]-10, out_c[2]), out_c], r, "cable_c-", C_CABLE_BLUE, asm)
