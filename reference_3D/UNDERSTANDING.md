# 3D Assembly Understanding — Reference Images Analysis

## Image 1 — `image.png`: Single Cylindrical Cell

A single 18650-style cylindrical cell. Key visual observations:
- **Body**: Blue PVC shrink-wrap, fully cylindrical
- **Positive terminal (+)**: Small raised nub on the top (silver/nickel)
- **Negative terminal (−)**: Flat face on the bottom (the entire bottom cap)
- **Proportions**: Height ≈ 3.5–4× the diameter

**Implementation in builder**:
- Body: `CylinderGeometry(diameter/2, diameter/2, height*0.96, 16)`
- Positive nub: `CylinderGeometry(diameter*0.3, diameter*0.3, height*0.04, 12)` on top
- Negative flat disk: `CylinderGeometry(diameter/2 - 0.3, ..., 0.4mm thick)` on bottom ✓

---

## Image 2 — `Screenshot 2026-03-29 212348.png`: Prismatic Pack Assembly

A large-format prismatic cell pack. Key visual observations:

### Cell orientation
- Cells are **standing upright** (tall face vertical)
- Cells are stacked **front-to-back** (series stacking direction is along the cell's THICKNESS)
- The large face (width × height) is what you see when looking from the front or side
- Each cell takes up its **thickness** in the series stacking direction

### Structural components visible
- **Black end brackets / compression plates**: At the front and back of the pack (steel-gray or dark plastic), clamp the cell stack together
- **Foam/insulation between cells**: Thin white/grey layer visible between series groups (probably fish-paper or Nomex)
- **Busbars**: Red copper busbars running across the TOP of the pack, connecting + of one group to − of the next
- **Main power cables**: 2 large cables coming out the top-right — 1 red (+), 1 blue/black (−)
- **BMS module**: Visible on the front face panel (the green PCB or the red aluminium heat-spreader block)
- **Side plates / frame**: Blue structural frame surrounding the whole pack

### Key dimension question (see below)

---

## Image 3 — `Screenshot 2026-03-29 212445.png`: Cylindrical Pack Assembly

A cylindrical cell pack (18650-style) in a plastic holder. Key visual observations:

### Cell arrangement
- Cells arranged in a **grid** — appears to be roughly 5 series × 4 parallel (or similar)
- All cells point in the **same direction** (positive terminal up for all cells visible)
  - NOTE: In real packs, adjacent series cells often alternate orientation so that adjacent + and − terminals face each other for shorter nickel strips. This image may show a simplified/artistic view, or all-same-direction is also used in some designs.

### Holder/Bracket
- **Black ABS plastic holder**: Each cell sits in an individual socket/ring
- The holder appears to be a single piece spanning the full S×P array
- Circular cutouts sized just larger than the cell diameter
- The holder grips each cell around its body (not just top/bottom)
- There appear to be TWO holder plates: top and bottom (like a sandwich)

### Nickel strips / connections
- Not clearly visible in this image, but implied at the top/bottom of the cells
- The holder slots likely align for strip placement

---

## Open Questions / Things to Confirm

### 1. Dimension convention for prismatic/pouch cells

**Current DB convention** (from sample data):
```
LP925572:          longueur=72mm  largeur=55mm  hauteur=9.2mm   (Pouch)
MP174565:          longueur=70mm  largeur=45.5mm hauteur=18.1mm  (Prismatic)
CE175-360:         longueur=253mm largeur=172mm  hauteur=5.8mm   (Pouch)
HJLFP48173170E:    longueur=165mm largeur=174mm  hauteur=48mm    (Prismatic)
```

`hauteur_mm` appears to be the **thickness** (smallest face) for flat pouch cells. This is the dimension the engine uses as `H_raw` (pack height), but also the dimension that makes cells appear flat in 3D.

**Questions**:
- Is `longueur` the length of the large face, or the stacking pitch in series direction?
- Is `hauteur` the thickness (thin face that stacks in series), or the physical height when standing upright?
- For the reference pack image, are cells stacked along `hauteur` or `longueur`?

**Current 3D fix applied**: `bodyH = max(largeur_mm, hauteur_mm) * 0.95` so cells always stand upright visually. The cells fill their full footprint (longueur × largeur as width × depth in scene).

### 2. Series stacking direction for prismatic cells

The engine computes:
```
L_raw = S × longueur_mm   (series direction = along longueur)
W_raw = P × largeur_mm    (parallel direction = along largeur)
```

Looking at the reference image, the series stacking appears to go along the cell **thickness** (which would be `hauteur_mm`). If this is the case, the engine formula should be:
```
L_raw = S × hauteur_mm    ← series along thickness
W_raw = P × longueur_mm   ← parallel along the long face
H_raw = largeur_mm        ← pack height = standing cell face height
```

**This needs your validation.** If the engine convention is intentionally different from real-world convention, that's fine — the 3D will just be a schematic approximation.

### 3. Cylindrical cell alternating orientation

In the reference image (Screenshot 212445), all cells appear to have the same orientation (positive side up). The current implementation alternates every series column (`s % 2 === 1` → flip 180°).

**Question**: Should cylindrical cells all face the same direction, or alternate? Alternating reduces the nickel strip span needed to bridge series connections (shorter busbar path), which is the standard for most real cylindrical packs.

### 4. Cylindrical holder/bracket style

From Screenshot 212445, the holder has individual sockets per cell (like a honeycomb or grid of rings). The current plan was a flat plate with circular cutouts.

**Confirm**: Is the target a flat plate with holes (simple 2D extrude), or individual ring sockets per cell?

---

## Component Priority Summary

Based on the reference images, proposed implementation order:

| Priority | Component | Seen in image | Notes |
|----------|-----------|---------------|-------|
| 1 | Cells (body + terminals) | Both | DONE (Phase 0+1) |
| 2 | Cell brackets / holders | Image 3 | Cylindrical: individual ring sockets in top+bottom plate |
| 3 | Insulation cards between series groups | Image 2 | Prismatic: thin orange/white sheets |
| 4 | Busbars (series) | Image 2 | Red copper plate bridging + to − across series groups |
| 5 | Compression / end plates | Image 2 | Black end plates at series stack ends |
| 6 | BMS | Image 2 | Green PCB or aluminium block on front/side |
| 7 | Main cables (+/−) | Image 2 | Red and blue/black large cables out the top |
