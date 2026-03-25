# Engine.py Changes Documentation

## Changes Implemented

### 1. True Cylindrical Volume Formula
**Location**: Lines 121-128

Cylindrical cells now use the proper cylinder volume formula:
```
V_cylinder = π × r² × h
```

**Code**:
```python
if cell_type == "cylindrical":
    radius_mm = diameter / 2.0
    vol_per_cell = math.pi * (radius_mm ** 2) * cell.hauteur_mm
else:
    vol_per_cell = cell.longueur_mm * cell.largeur_mm * cell.hauteur_mm
```

- Cylindrical: Uses `π × r² × h` (true cylinder)
- Prismatic/Pouch: Uses `l × w × h` (rectangular prism)

---

### 2. Margins Applied on Raw Dimensions
**Location**: Lines 172-179

Margins are now calculated using raw (un-swelled) dimensions, not swollen ones.

**Before**:
```python
margin_l = round((req.housing_l - L_gonfles) / 2.0, 2)
margin_w = round((req.housing_l_small - W_gonfles) / 2.0, 2)
margin_h = round((req.housing_h - H_gonfles) / 2.0, 2)
```

**After**:
```python
margin_l = round((req.housing_l - L_raw) / 2.0, 2)
margin_w = round((req.housing_l_small - W_raw) / 2.0, 2)
margin_h = round((req.housing_h - H_raw) / 2.0, 2)
```

The occupation rate (`taux_occupation_pct`) also uses raw cell volume (before swelling).

---

### 3. Results Show Real/Raw Dimensions
**Location**: Lines 215-219

The `dimensions_array` field now returns raw (real) pack dimensions instead of swollen ones.

**Code**:
```python
dimensions_array=ArrayDimensions(
    longueur_mm=L_raw,
    largeur_mm=W_raw,
    hauteur_mm=H_raw,
),
```

---

### 4. Cylindrical Swelling Fix
**Location**: Lines 109-112

Previously, cylindrical cells had no swelling applied. Now swelling is properly applied:
- Radial expansion: `L_gonfles` and `W_gonfles` use `diameter * swelling_factor`
- Axial expansion: `H_gonfles` uses `hauteur_mm * swelling_factor`

**Code**:
```python
if cell_type == "cylindrical":
    diameter = cell.longueur_mm
    L_raw = round(S * diameter, 2)
    W_raw = round(P * diameter, 2)
    H_raw = round(cell.hauteur_mm, 2)
    # Cylindrical swelling: radial expansion (diameter increases) and axial (height)
    L_gonfles = round(S * diameter * swelling_factor, 2)
    W_gonfles = round(P * diameter * swelling_factor, 2)
    H_gonfles = round(cell.hauteur_mm * swelling_factor, 2)
```

---

## Suggestions for Future Improvement

### 1. Redundant `dimensions_raw` Field (Lines 230-234)
Both `dimensions_array` and `dimensions_raw` now return identical raw values. This redundancy could be addressed by either:
- Removing `dimensions_raw` entirely
- Renaming it to `dimensions_gonfles` to return swollen dimensions for engineering analysis

### 2. Swelling Factor Logic Ambiguity (Line 98-99)
```python
swelling_factor = 1.0 + (swelling_raw / 100.0) if swelling_raw > 1.0 else 1.0 + swelling_raw
```

This assumes `taux_swelling_pct` could be stored as either:
- A percentage value (e.g., `20` for 20%)
- A decimal fraction (e.g., `0.2` for 20%)

**Suggestion**: Verify how `taux_swelling_pct` is stored in the database. If consistently as percentage, simplify to:
```python
swelling_factor = 1.0 + (swelling_raw / 100.0)
```

### 3. Missing Swollen Dimensions in Output
The `L_gonfles`, `W_gonfles`, `H_gonfles` variables are calculated but not returned in the output. If needed for engineering analysis or logging, consider adding a `dimensions_swelling` field to the schema.

### 4. Redundant Variable (Line 203)
```python
energie_reelle_wh = round(usable_energy_wh, 2)
```
This is just a rounded copy of `usable_energy_wh`. Could be removed if not used downstream.

---

## Why Pouch/Prismatic Height is NOT Swelled

**Location**: Line 119

```python
H_gonfles = round(cell.hauteur_mm, 2)  # Keeping H un-swelled for Pouch/Prismatic
```

### Reasoning:
1. **Swelling direction**: Pouch and prismatic cells primarily swell in the **thickness** (width/depth) direction, not in height. The swelling is due to gas generation and electrode expansion perpendicular to the electrode layers.

2. **Mechanical constraint**: In a typical battery pack, cells are placed with their largest flat faces against each other. The height (z-axis) is constrained by bus bars and connections, so swelling in that direction is minimal or managed by compression.

3. **Industry practice**: Battery thermal management systems often apply slight compression on the faces of pouch cells, which constrains thickness swelling and prevents height increase.

4. **Prior implementation**: This follows the original implementation setup where H was intentionally kept un-swelled for Pouch/Prismatic cell types.

### Note:
If your use case requires different swelling behavior, you could apply the swelling factor to H for Pouch/Prismatic cells as well:
```python
H_gonfles = round(cell.hauteur_mm * swelling_factor, 2)
```
