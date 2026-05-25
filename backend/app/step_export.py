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

import hashlib
import logging
import math
import os
import sys
import tempfile
import warnings
from collections import OrderedDict
from io import BytesIO
from types import ModuleType

_log = logging.getLogger(__name__)

# CadQuery imports casadi (constraint solver) at the top of its assembly module.
# We only use basic geometry here — no assembly constraints — so the real casadi
# DLL is never needed.  Injecting a stub before the cadquery import prevents
# the native DLL load attempt entirely, which also keeps startup fast.
if 'casadi' not in sys.modules:
    _stub = ModuleType('casadi')
    _stub.__spec__ = None

    class _S:
        def __init__(self, *a, **kw): pass
        def __call__(self, *a, **kw): return self
        def __getattr__(self, n): return _S()
        def __iter__(self): return iter([])

    _stub.__getattr__ = lambda n: _S  # type: ignore
    sys.modules['casadi'] = _stub

import cadquery as cq
from cadquery import Assembly, Color, Compound, Location, Vector

from app.models.cellule import Cellule
from app.schemas.battery import CalculationRequest, CalculationResult, VerdictEnum

warnings.filterwarnings("ignore", category=FutureWarning, module="cadquery")

# ── Simple LRU cache (max 4 entries ≈ 4–20 MB RAM) ───────────────────────────
_CACHE: OrderedDict[str, bytes] = OrderedDict()
_CACHE_MAX = 4


def _cache_key(req: CalculationRequest, result, cell: Cellule) -> str:
    parts = (
        result.nb_serie, result.nb_parallele,
        cell.id,
        cell.type_cellule,
        cell.longueur_mm, cell.largeur_mm, cell.hauteur_mm, cell.diameter_mm,
        req.cell_gap_mm,
        getattr(req, 'end_plate_thickness_mm', 10.0) or 0.0,
        result.verdict.value if hasattr(result.verdict, 'value') else str(result.verdict),
    )
    return hashlib.md5(str(parts).encode(), usedforsecurity=False).hexdigest()


def _cache_get(key: str) -> bytes | None:
    if key in _CACHE:
        _CACHE.move_to_end(key)
        return _CACHE[key]
    return None


def _cache_set(key: str, data: bytes) -> None:
    _CACHE[key] = data
    _CACHE.move_to_end(key)
    if len(_CACHE) > _CACHE_MAX:
        _CACHE.popitem(last=False)

# ── Dimension verification ────────────────────────────────────────────────────

def _log_dim_check(req, result, cell, is_cyl, S, P, gap, ep, hL, hW, hH):
    """
    Compare every key STEP dimension against the engine result and request.
    Logs INFO lines for matches (≤ 0.5 mm), WARNING lines for real mismatches.
    Called on every export so the backend log is always auditable.
    """
    if is_cyl:
        diameter  = cell.diameter_mm if cell.diameter_mm else cell.longueur_mm
        step_L    = S * diameter + (S - 1) * gap       # cell array length (X)
        step_W    = P * diameter + (P - 1) * gap       # cell array width  (Z)
        step_H    = cell.hauteur_mm * 0.96              # visual body height (0.96 factor)
        eng_H_note = "engine uses full hauteur_mm; STEP uses ×0.96 for visual clearance"
    else:
        step_L = S * cell.hauteur_mm + (S - 1) * gap + 2 * ep
        step_W = P * cell.largeur_mm  + (P - 1) * gap
        step_H = cell.longueur_mm * 0.95
        eng_H_note = "engine uses full longueur_mm; STEP uses ×0.95 for visual clearance"

    checks = [
        # (label,                   STEP value,            engine/req value,                    known_delta_ok)
        ("couvercle inner_L",       hL,                    req.housing_l,                        False),
        ("couvercle inner_W",       hW,                    req.housing_l_small,                  False),
        ("couvercle inner_H",       hH,                    req.housing_h,                        False),
        ("couvercle outer_L",       hL + 2 * WALL_MM,      req.housing_l,                        True),
        ("couvercle outer_H",       hH + 2 * WALL_MM,      req.housing_h,                        True),
        ("array_L",                 step_L,                result.dimensions_raw.longueur_mm,    False),
        ("array_W",                 step_W,                result.dimensions_raw.largeur_mm,     False),
        ("array_H (visual)",        step_H,                result.dimensions_raw.hauteur_mm,     True),
        ("margin_L (per side)",     (hL  - step_L) / 2,   result.marges_reelles.get("L", 0),    False),
        ("margin_W (per side)",     (hW  - step_W) / 2,   result.marges_reelles.get("W", 0),    False),
        ("margin_H (per side)",     (hH  - step_H) / 2,   result.marges_reelles.get("H", 0),    True),
    ]

    _log.info("── STEP dimension audit: %s  S=%d P=%d ──", cell.nom, S, P)
    for label, step_val, eng_val, known_ok in checks:
        diff = abs(step_val - eng_val)
        if diff <= 0.5:
            _log.info("  %-28s  STEP=%8.2f mm   engine=%8.2f mm   Δ=%.2f ✓", label, step_val, eng_val, diff)
        elif known_ok:
            _log.info("  %-28s  STEP=%8.2f mm   engine=%8.2f mm   Δ=%.2f  (expected)", label, step_val, eng_val, diff)
        else:
            _log.warning("  %-28s  STEP=%8.2f mm   engine=%8.2f mm   Δ=%.2f  ← MISMATCH", label, step_val, eng_val, diff)
    _log.info("  array_H note: %s", eng_H_note)
    _log.info("  cell_bottom_y: -hH/2 + 1.0 mm clearance from inner bottom")


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
    Results are cached by geometry key — repeat requests return instantly.
    """
    key = _cache_key(req, result, cell)
    cached = _cache_get(key)
    if cached:
        return BytesIO(cached)
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

    # Floor clearance from couvercle inner bottom:
    #   Cylindrical: bracket protrudes 2.5 mm + strip 0.5 mm → need > 3.0 mm → use 3.5 mm
    #   Prismatic/Pouch: nothing below cell body → 1 mm sufficient
    floor_clearance = 3.5 if is_cyl else 1.0
    yCenter = -hH / 2 + floor_clearance + bodyH / 2
    startX  = -(S * stepX) / 2 + stepX / 2
    startZ  = -(P * stepZ) / 2 + stepZ / 2
    totalZ  = P * stepZ

    _log_dim_check(req, result, cell, is_cyl, S, P, gap, ep, hL, hW, hH)

    asm = Assembly(name="battery_pack")

    # Couvercle — named sub-assembly with 6 individual face bodies; only on ACCEPT
    if result.verdict == VerdictEnum.ACCEPT:
        couvercle_asm = Assembly(name="couvercle")
        _build_couvercle(couvercle_asm, hL, hW, hH)
        asm.add(couvercle_asm)

    # Module — all cells, terminals, busbars, brackets in their own sub-assembly
    module_asm = Assembly(name="module")
    if is_cyl:
        _build_cylindrical_cells(module_asm, S, P, diameter, bodyH, yCenter, startX, startZ, stepX, stepZ)
        _build_nickel_strips(module_asm, S, P, diameter, bodyH, yCenter, startX, startZ, stepX, stepZ)
        _build_cylindrical_brackets(module_asm, S, P, diameter, bodyH, yCenter, startX, startZ, stepX, stepZ)
    else:
        _build_prismatic_cells(module_asm, S, P, sizeX, sizeZ, bodyH, yCenter, startX, startZ, stepX, stepZ)
        _build_prismatic_busbars(module_asm, S, P, sizeX, sizeZ, bodyH, yCenter, startX, startZ, stepX, stepZ)
        _build_insulation_cards(module_asm, S, P, sizeX, sizeZ, bodyH, yCenter, startX, stepX, stepZ, gap)
        _build_side_plates(module_asm, S, P, sizeX, sizeZ, bodyH, yCenter, stepX, stepZ, gap, ep)
    asm.add(module_asm)

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

    _cache_set(key, data)
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

def _build_couvercle(couvercle_asm, hL, hW, hH):
    """
    Complete closed enclosure split into 6 individually named face plates.

    Inner cavity = hL(X) × hH(Y) × hW(Z) — exactly the configured housing space.
    Each face plate is WALL_MM thick.  Tiling scheme (no volumetric overlap):
      top / bottom — full outer footprint  oL × wall × oW
      front / back — full outer X, inner height  oL × hH × wall
      left / right — inner height and depth  wall × hH × hW
    Corners are owned by the top/bottom plates.
    """
    wall = WALL_MM
    oL   = hL + 2 * wall
    oW   = hW + 2 * wall

    faces = [
        ("top",    _box(oL, wall, oW), _loc(0,  hH/2 + wall/2, 0)),
        ("bottom", _box(oL, wall, oW), _loc(0, -hH/2 - wall/2, 0)),
        ("front",  _box(oL, hH, wall), _loc(0, 0,  hW/2 + wall/2)),
        ("back",   _box(oL, hH, wall), _loc(0, 0, -hW/2 - wall/2)),
        ("left",   _box(wall, hH, hW), _loc( hL/2 + wall/2, 0, 0)),
        ("right",  _box(wall, hH, hW), _loc(-hL/2 - wall/2, 0, 0)),
    ]
    for name, shape, loc in faces:
        couvercle_asm.add(shape, name=name, color=C_HOUSING, loc=loc)


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
    thick = 0.5
    bp    = BRACKET_H * 0.25          # bracket protrudes 2.5 mm beyond cell terminal face
    y_top = yCenter + bodyH/2 + bp + thick/2   # strip flush against bracket outer face
    y_bot = yCenter - bodyH/2 - bp - thick/2

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
    po     =  sizeZ * TERM_OFFSET_RATIO        # positive Z offset
    no     = -sizeZ * TERM_OFFSET_RATIO        # negative Z offset

    # GLTF-style Procedural Geometry
    try:
        cell_body = cq.Workplane("XY").box(sizeX, wrap_h, sizeZ).edges("|Y").fillet(2.0)
        cap_body  = cq.Workplane("XY").box(sizeX-0.5, 2.0, sizeZ-0.5).edges("|Y").fillet(1.5)
    except:
        cell_body = _box(sizeX, wrap_h, sizeZ)
        cap_body  = _box(sizeX-0.5, 2.0, sizeZ-0.5)

    term_len_x = min(sizeX * 0.6, 40.0)
    term_len_z = min(sizeZ * 0.2, 40.0)
    try:
        pad = cq.Workplane("XY").box(term_len_x, 1.5, term_len_z).edges("|Y").fillet(2.0)
    except:
        pad = _box(term_len_x, 1.5, term_len_z)

    vent_x = min(sizeX * 0.4, 15.0)
    vent_z = min(sizeZ * 0.3, 30.0)
    try:
        vent = cq.Workplane("XY").box(vent_x, 0.5, vent_z).edges("|Y").fillet(3.0)
    except:
        vent = _box(vent_x, 0.5, vent_z)

    wrap_locs = [_loc(startX+s*stepX, y_wrap,     startZ+p*stepZ) for s in range(S) for p in range(P)]
    cap_locs  = [_loc(startX+s*stepX, y_cap,      startZ+p*stepZ) for s in range(S) for p in range(P)]
    vent_locs = [_loc(startX+s*stepX, term_y+0.25, startZ+p*stepZ) for s in range(S) for p in range(P)]

    _batch(cell_body, wrap_locs, "cells", C_BLUE, asm)
    _batch(cap_body, cap_locs, "caps", C_BLACK, asm)
    _batch(vent, vent_locs, "vents", C_STEEL, asm)

    def tlocs(y_off, off_even, off_odd):
        return (
            [_loc(startX+s*stepX, y_off, startZ+p*stepZ+off_even) for s in range(0,S,2) for p in range(P)] +
            [_loc(startX+s*stepX, y_off, startZ+p*stepZ+off_odd)  for s in range(1,S,2) for p in range(P)]
        )

    # Flat rectangular terminals matching the GLTF
    C_POS_PAD = Color(0.9, 0.7, 0.7)   # Pinkish copper
    C_NEG_PAD = Color(0.85, 0.75, 0.5) # Gold/Brass

    _batch(pad, tlocs(term_y+0.75, po, no), "pos_pad", C_POS_PAD, asm)
    _batch(pad, tlocs(term_y+0.75, no, po), "neg_pad", C_NEG_PAD, asm)


# ── Prismatic busbars (snake path) ────────────────────────────────────────────

def _build_prismatic_busbars(asm, S, P, sizeX, sizeZ, bodyH, yCenter, startX, startZ, stepX, stepZ):
    po     =  sizeZ * TERM_OFFSET_RATIO
    no     = -sizeZ * TERM_OFFSET_RATIO
    busbar_flat_h = 2.5  # matches PackAssemblyBuilder.js busbarFlatH
    bar_y  = yCenter + bodyH/2 + 1.5 + busbar_flat_h / 2   # resting directly on 1.5mm pads
    
    term_len_z = min(sizeZ * 0.2, 40.0)
    hbw    = term_len_z + 4   # terminal pad width + 2mm overhang each side (matches frontend)
    hbx    = stepX + hbw      # length covers center-to-center + rounded ends

    # Pill-shaped busbars with two holes matching GLTF style
    try:
        h_bar = (
            cq.Workplane("XZ")
            .rect(hbx, hbw)
            .extrude(busbar_flat_h)
            .edges("|Y").fillet(hbw/2 - 0.1)
            .faces(">Y").workplane()
            .pushPoints([(-stepX/2, 0), (stepX/2, 0)])
            .circle(hbw * 0.2).cutThruAll()
            .translate((0, -busbar_flat_h/2, 0))
        )
    except:
        h_bar = _box(hbx, busbar_flat_h, hbw)

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
    rail_len   = S * stepX - gap + 2 * max(ep, 0)  # spans full array including end plates
    rail_y     = yCenter  # centred on array height
    rail = _box(rail_len, rail_h, rail_thick)
    _batch(rail, [_loc(0, rail_y, ahz + rail_thick/2), _loc(0, rail_y, -ahz - rail_thick/2)], "side_rails", C_GRAY, asm)
    # End plates: skip if ep <= 0
    if ep > 0:
        end = _box(ep, bodyH, ahz * 2)
        _batch(end, [_loc(ahx + ep/2, yCenter, 0), _loc(-ahx - ep/2, yCenter, 0)], "end_plates", C_GRAY, asm)
