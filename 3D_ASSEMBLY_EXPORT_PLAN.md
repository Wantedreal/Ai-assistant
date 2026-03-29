# 3D Full Battery Assembly & CAD Export — Implementation Plan

## Goal

Build a fully detailed, interactive 3D battery pack assembly in the frontend (Three.js) with toggleable component layers, and a backend STEP export (CadQuery) that generates a proper CAD assembly file containing the same components.

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────┐
│                        FRONTEND (Three.js)                    │
│                                                               │
│  PackViewer3D.jsx  →  PackAssemblyBuilder.js (NEW)            │
│                       ├─ buildCells()                         │
│                       ├─ buildTerminals()                     │
│                       ├─ buildBusbars()                       │
│                       ├─ buildBrackets()       ← cylindrical  │
│                       ├─ buildInsulationCards() ← prismatic   │
│                       ├─ buildSidePlates()                    │
│                       ├─ buildBMS()                           │
│                       ├─ buildCables()                        │
│                       ├─ buildInsulationWrap()                │
│                       └─ buildHeatShrink()                    │
│                                                               │
│  LayerControlPanel.jsx (NEW)                                  │
│  ├─ Toggle: Cells              [on/off]                       │
│  ├─ Toggle: Terminals (+/-)    [on/off]                       │
│  ├─ Toggle: Busbars/Nickel     [on/off]                       │
│  ├─ Toggle: Brackets/Holders   [on/off]  (cylindrical)       │
│  ├─ Toggle: Insulation Cards   [on/off]  (prismatic)         │
│  ├─ Toggle: Side Plates        [on/off]                       │
│  ├─ Toggle: BMS/PCB            [on/off]                       │
│  ├─ Toggle: Cables/Wires       [on/off]                       │
│  ├─ Toggle: Insulation Wrap    [on/off]                       │
│  ├─ Toggle: Heat Shrink        [on/off]                       │
│  ├─ Toggle: Housing            [on/off]                       │
│  ├─ Toggle: World Axis         [on/off]                       │
│  └─ Toggle: Dimensions/Measures[on/off]                       │
│                                                               │
│  ExportPanel.jsx (NEW)                                        │
│  ├─ [Export GLTF/GLB]  → Three.js GLTFExporter (client-side) │
│  ├─ [Export STL]        → Three.js STLExporter (client-side)  │
│  └─ [Export STEP]       → POST /api/v1/export/step (backend)  │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│                        BACKEND (Python)                       │
│                                                               │
│  app/core/cad_builder.py (NEW)                                │
│  ├─ CadAssemblyBuilder class                                  │
│  │   Uses CadQuery to build the same assembly as Three.js:    │
│  │   ├─ _build_housing()                                      │
│  │   ├─ _build_cells()                                        │
│  │   ├─ _build_terminals()                                    │
│  │   ├─ _build_busbars()                                      │
│  │   ├─ _build_brackets()                                     │
│  │   ├─ _build_insulation()                                   │
│  │   ├─ _build_bms()                                          │
│  │   ├─ _build_cables()                                       │
│  │   └─ export_step() → bytes                                 │
│  │                                                            │
│  app/routers/export.py (NEW)                                  │
│  └─ POST /api/v1/export/step                                  │
│      Input:  CalculationRequest + component toggles           │
│      Output: .step file (StreamingResponse)                   │
└───────────────────────────────────────────────────────────────┘
```

---

## Component Inventory — What Gets Built

### Per Cell Type: Cylindrical

| Component | 3D Shape | Dimensions | Material/Color | Notes |
|-----------|----------|------------|----------------|-------|
| Cell body | Cylinder | `diameter/2` radius, `height * 0.96` | Blue wrap (PVC) | Instanced S×P array |
| Positive terminal (+) | Small cylinder | `diameter * 0.3` radius, `height * 0.04` | Nickel/silver | Top of cell, nub |
| Negative terminal (-) | Flat ring | `diameter/2` radius, thin | Nickel/silver | Bottom of cell (flat) |
| Cell bracket/holder | Slotted plate | `S × diameter` × `P × diameter` × 2mm | Dark gray (ABS plastic) | Top bracket + bottom bracket, circular cutouts for cells |
| Nickel strips (parallel) | Thin rectangle | `P × diameter` × 5mm × 0.15mm | Nickel silver | Connects parallel cells on top/bottom |
| There's no busbar in Cylindrical Cells | Thick rectangle | `diameter` × 10mm × 0.5mm | Copper | Connects series groups, alternating top/bottom |
| Ring insulation | Thin ring | `diameter + 0.5mm` OD, `diameter * 0.7` ID, 0.3mm thick | Green (fish paper) | Around positive terminal to prevent short |
| No Side plates | Thin box | Height × width × 1mm | Gray (FR4/PCB) | 2 plates on each side to compress cells |

### Per Cell Type: Prismatic / Pouch

| Component | 3D Shape | Dimensions | Material/Color | Notes |
|-----------|----------|------------|----------------|-------|
| Cell body | Box | `L × H × W` | Silver metallic (prismatic) / Gray pouch | Instanced S×P |
| Positive terminal (+) | Box tab | `L*0.25 × H*0.05 × 15mm` | Aluminum silver | Top-right of cell |
| Negative terminal (-) | Box tab | `L*0.25 × H*0.05 × 15mm` | Copper orange | Top-left of cell |
| Insulation card | Thin box | `L × H × 0.3mm` | Orange (fish paper/Nomex) | Between each series group (insulator) |
| Busbar (series) | Thick plate | Spans 2 terminals across series groups × 15mm × 1mm | Copper | Bolted across + to - terminals |
| Busbar (parallel) | Plate | Spans P terminals × 10mm × 0.5mm | Copper | Connects same-polarity terminals |
| Side compression plates | Box | `total_L × H × 3mm` | Steel gray | 2 plates, one each side, clamp cells |
| End plates | Box | `W × H × 5mm` | Steel gray | 2 plates at the ends |

### Common Components (Both Types)

| Component | 3D Shape | Dimensions | Material/Color | Notes |
|-----------|----------|------------|----------------|-------|
| BMS PCB | Thin box | `60 × 40 × 1.6mm` (parametric) | Green (PCB) | Positioned on top or side of array |
| Balance wires | Thin cylinders (spline/line) | 1mm diameter, routed from BMS to each series node | Color-coded rainbow | S+1 wires total |
| Charge/discharge cables | Thicker cylinders | 2mm diameter | Red (+) / Black (-) | From BMS to main output terminals |
| Main output terminals | Cylinder or box | 6mm diameter, 10mm tall | Brass/gold | Pack + and - output connectors |
| EVA foam insulation | Slightly larger box wrapping the array | Array dims + 2mm padding | White translucent | Internal thermal insulation |
| Heat shrink | Slightly larger box wrapping everything | Array + EVA + 1mm | Dark blue/black, slight transparency | Outer wrap |
| World axis | AxesHelper | 50mm arms | R/G/B | Three.js AxesHelper |
| Dimension lines | Line + text sprites | Along each axis | White | Shows L/W/H measurements |

---

## Implementation Phases

### Phase 0 — Refactor PackViewer3D.jsx (Prerequisite)

**Why**: The current `PackViewer3D.jsx` is a single 543-line `useEffect` that builds everything inline. Adding 10+ component builders inside it would make it unmaintainable. We need to extract the scene construction into a modular builder.

**Tasks**:
1. Create `frontend/src/3d/PackAssemblyBuilder.js` — a class that takes `(scene, config)` and exposes methods to add/remove component groups
2. Each component group is a `THREE.Group` with a `name` property (e.g. `"cells"`, `"busbars"`, `"bms"`)
3. `PackViewer3D.jsx` becomes a thin React wrapper: setup renderer/camera/controls, delegate geometry to the builder, handle toggles via `group.visible = true/false`
4. The builder stores all groups in a `Map<string, THREE.Group>` for easy toggle access

**File changes**:
- NEW: `frontend/src/3d/PackAssemblyBuilder.js`
- EDIT: `frontend/src/components/PackViewer3D.jsx` (gut the inline geometry, use builder)

---

### Phase 1 — Enhanced Cell Terminals (Positive/Negative)

**Current state**: Cylindrical cells have a small top cap. Prismatic cells have 2 small box terminals. Both are basic approximations.

**Improvements**:

**Cylindrical**:
- Positive terminal: nub on top (already exists, refine dimensions)
- Negative terminal: flat circle on the bottom (NEW)
- Alternating orientation for series: in a series string, adjacent cells alternate polarity direction (one up, next down). This is standard for cylindrical packs. The cell at position `(s, p)` is flipped 180 degrees if `s` is odd.

**Prismatic**:
- Positive terminal: aluminum tab on one side (exists, refine)
- Negative terminal: copper tab on other side (exists, refine)
- No orientation flip needed — busbars connect + to - across the top


**Data needed**: Already available in `cell_used` from the engine result. No backend changes.

**Files**:
- EDIT: `frontend/src/3d/PackAssemblyBuilder.js` → `buildCells()`, `buildTerminals()`

---

### Phase 2 — Busbars & Nickel Strips (Electrical Connections)

This is the core wiring between cells.

**Cylindrical pack connection pattern**:
1. the rectangular nickel strips are used to connect the cells paralleraly,  in the top it start from the  first cell but in bottom start from the second cell and the first or maybe the last one  we do just one line of the nickel strips, of busbar that is vertically connect the same bornes of the cells which means paralelary
2. Pattern: ___

**Prismatic pack connection pattern**:
1. We keep our main positive and negative borns untouched by busbar
2. connection: a  plate bridges the + terminal of one group to the - terminal of the next group
3. All connections are on top of the cells (no flipping)
4. Busbar thickness: ~1mm copper, ~0.5mm nickel

**3D construction**:
- Nickel strips: `BoxGeometry(strip_width, 0.15, strip_length)` positioned on cell tops/bottoms
- Busbars: `BoxGeometry(busbar_width, busbar_thickness, busbar_length)` bridging terminals
- Use `THREE.InstancedMesh` for strips (one per parallel group), regular meshes for busbars (only S-1 needed)

**Data needed**: `S`, `P`, `stepX`, `stepZ`, cell dimensions. All already available.

**Files**:
- EDIT: `frontend/src/3d/PackAssemblyBuilder.js` → `buildNickelStrips()`, `buildBusbars()`

---

### Phase 3 — Brackets / Holders / Insulation Cards

**Cylindrical — Cell Bracket (Holder)**:
- 2 plastic plates (top + bottom) with circular cutouts for each cell
- Dimensions: `S × stepX` by `P × stepZ` by 2mm thick
- Cutouts: circles at each cell position with `diameter + 0.5mm` clearance
- 3D: `ExtrudeGeometry` from a `Shape` with holes, or simplified as a flat plate (cutouts optional for performance)
- Color: dark gray ABS plastic

**Prismatic — Insulation Cards**:
- Thin insulation sheets placed **between each series group**
- Dimensions: `P × cell_width` by `cell_height` by 0.3mm
- Count: `S - 1` cards (one between each pair of series neighbors)
- Material: orange (Nomex/fish paper)
- 3D: `BoxGeometry(card_width, card_height, 0.3)` positioned at each series boundary

**Files**:
- EDIT: `frontend/src/3d/PackAssemblyBuilder.js` → `buildBrackets()`, `buildInsulationCards()`

---

### Phase 4 — Side/End Compression Plates

Structural plates that hold the cell stack together.

**Prismatic packs**:
- 2 side plates along the length: `total_L × cell_H × 3mm` (steel)
- 2 end plates: `total_W × cell_H × 5mm` (steel, thicker)
- Positioned flush against the outermost cells with tie rods (simplified as thin cylinders at corners)

**Cylindrical packs**:
- It doesn't need to put it

**Files**:
- EDIT: `frontend/src/3d/PackAssemblyBuilder.js` → `buildSidePlates()`

---

### Phase 5 — BMS + Cables

**BMS PCB**:
- A flat green rectangle: `60 × 40 × 1.6mm` (standard 4-layer PCB)
- Positioned above the cell array, offset to one side
- Has small component bumps on top (simplified as a few tiny boxes for ICs)
- Parametric: for large S counts, the BMS board scales wider

**Balance Wires**:
- Between the wires, there is one black wire attached to our main negative born, and all the other red wires attached to each born positivie borns

**Charge/Discharge Cables**:
- 2 thicker cables: Red (+) and Black (-)
- From BMS board → to main output terminals
- Output terminals: brass-colored cylinders mounted on the side plate or housing wall
- Cable diameter: 2-3mm

**Files**:
- EDIT: `frontend/src/3d/PackAssemblyBuilder.js` → `buildBMS()`, `buildBalanceWires()`, `buildMainCables()`

---

### Phase 6 — Insulation Wrap + Heat Shrink

**EVA Foam Layer**:
- A box slightly larger than the assembled array + plates
- Semi-transparent white material
- Represents internal thermal insulation
- `BoxGeometry(array_L + 4, array_H + 4, array_W + 4)` with `MeshPhysicalMaterial({ transmission: 0.8, opacity: 0.3 })`

**Heat Shrink Tube**:
- A box slightly larger than EVA
- Dark blue/black, semi-transparent
- Represents the PVC/polyolefin outer wrap
- Same approach but +2mm larger than EVA

**Files**:
- EDIT: `frontend/src/3d/PackAssemblyBuilder.js` → `buildInsulationWrap()`, `buildHeatShrink()`

---

### Phase 7 — Layer Toggle UI (LayerControlPanel)

**Implementation**:
- A side panel or overlay panel inside the fullscreen 3D viewer
- List of checkboxes/toggles, one per component group
- Each toggle calls `builder.setLayerVisible(name, boolean)` which sets `group.visible`
- Group by category:
  ```
  STRUCTURE
    ☑ Housing
    ☑ Side Plates
    ☑ Brackets/Holders
    
  ELECTRICAL
    ☑ Cells
    ☑ Terminals (+/-)
    ☑ Busbars
    ☑ Nickel Strips
    
  ELECTRONICS
    ☑ BMS/PCB
    ☑ Balance Wires
    ☑ Main Cables
    ☑ Output Terminals
    
  INSULATION
    ☑ Insulation Cards
    ☑ EVA Foam
    ☑ Heat Shrink
    
  ANNOTATIONS
    ☑ World Axis
    ☑ Dimension Lines
  ```
- "Show All" / "Hide All" buttons
- Conditional items: Brackets only shown for cylindrical, Insulation Cards only for prismatic

**Files**:
- NEW: `frontend/src/components/LayerControlPanel.jsx`
- EDIT: `frontend/src/components/PackViewer3D.jsx` (add panel integration)

---

### Phase 8 — Frontend Export (GLTF + STL)

**GLTF/GLB Export**:
```js
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

const exporter = new GLTFExporter()
exporter.parse(scene, (gltf) => {
  // gltf is ArrayBuffer for GLB, or JSON for GLTF
  const blob = new Blob([gltf], { type: 'application/octet-stream' })
  saveAs(blob, 'battery_pack.glb')
}, { binary: true }) // binary = GLB
```

**STL Export**:
```js
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'

const exporter = new STLExporter()
const stlString = exporter.parse(scene, { binary: true })
const blob = new Blob([stlString], { type: 'application/octet-stream' })
saveAs(blob, 'battery_pack.stl')
```

**Note on InstancedMesh**: `GLTFExporter` supports `InstancedMesh` natively. `STLExporter` requires expanding instances to individual meshes first (a helper function to "un-instance" before export).

**Files**:
- NEW: `frontend/src/components/ExportPanel.jsx`
- EDIT: `frontend/src/3d/PackAssemblyBuilder.js` → add `getExportableScene()` method

---

### Phase 9 — Backend STEP Export (CadQuery)

**Why backend**: STEP is a B-Rep format (boundary representation — real mathematical surfaces). Three.js only has triangulated meshes. You cannot convert triangles to STEP reliably. CadQuery uses OpenCascade to create proper CAD solids from parametric definitions — the same dimensions the engine already computes.

**Installation**:
```powershell
cd backend
.\venv\Scripts\Activate.ps1
pip install cadquery
```

**CadQuery Assembly Builder** (`backend/app/core/cad_builder.py`):

```python
import cadquery as cq
from cadquery import Assembly, Color
import math

class CadAssemblyBuilder:
    """Builds a full battery pack CAD assembly from engine results."""

    def __init__(self, calc_result, housing_dims, options):
        self.result = calc_result
        self.housing = housing_dims   # { L, W, H }
        self.options = options         # { include_bms, include_busbars, ... }
        self.assembly = Assembly()

    def build(self):
        """Build the full assembly based on enabled options."""
        self._build_housing()
        self._build_cells()

        if self.options.get("busbars", True):
            self._build_busbars()
        if self.options.get("brackets", True):
            self._build_brackets()
        if self.options.get("insulation", True):
            self._build_insulation()
        if self.options.get("bms", True):
            self._build_bms()
        if self.options.get("cables", True):
            self._build_cables()

        return self

    def _build_housing(self):
        """Open-top tray: box shell with no top face."""
        wall = 2.0
        L, W, H = self.housing["L"], self.housing["W"], self.housing["H"]
        outer = cq.Workplane("XY").box(L, W, H)
        inner = cq.Workplane("XY").box(L - 2*wall, W - 2*wall, H).translate((0, 0, wall))
        tray = outer.cut(inner)
        self.assembly.add(tray, name="housing", color=Color(0.23, 0.51, 0.96, 0.3))

    def _build_cells(self):
        """Create S×P cell array."""
        S = self.result["nb_serie"]
        P = self.result["nb_parallele"]
        cell = self.result["cell_used"]
        cell_type = cell["type_cellule"].lower()
        dims = self.result["dimensions_array"]
        step_x = dims["longueur_mm"] / S
        step_z = dims["largeur_mm"] / P

        for s in range(S):
            for p in range(P):
                x = -dims["longueur_mm"]/2 + step_x/2 + s * step_x
                z = -dims["largeur_mm"]/2 + step_z/2 + p * step_z

                if cell_type == "cylindrical":
                    d = cell.get("diameter_mm") or cell["longueur_mm"]
                    h = cell["hauteur_mm"]
                    body = cq.Workplane("XY").cylinder(h, d/2)
                else:
                    body = cq.Workplane("XY").box(
                        cell["longueur_mm"],
                        cell["largeur_mm"],
                        cell["hauteur_mm"]
                    )

                self.assembly.add(
                    body,
                    name=f"cell_s{s}_p{p}",
                    loc=cq.Location(cq.Vector(x, 0, z)),
                    color=Color(0.1, 0.1, 0.9, 1.0)
                )

    def _build_busbars(self):
        # Series busbars connecting + to - across groups
        ...

    def _build_brackets(self):
        # Cell holders for cylindrical
        ...

    def _build_insulation(self):
        # Cards between series groups (prismatic)
        ...

    def _build_bms(self):
        # BMS PCB board
        ...

    def _build_cables(self):
        # Balance wires + main cables
        ...

    def export_step(self) -> bytes:
        """Export the assembly to STEP format."""
        import io
        self.assembly.save("pack_assembly.step")
        with open("pack_assembly.step", "rb") as f:
            return f.read()
```

**API Endpoint** (`backend/app/routers/export.py`):

```python
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.core.cad_builder import CadAssemblyBuilder
import io

router = APIRouter(prefix="/api/v1/export", tags=["export"])

@router.post("/step")
async def export_step(payload: StepExportRequest):
    """Generate and return a STEP file of the battery pack assembly."""
    # Run engine to get result
    result = run_engine(payload.calc_request, cell)

    # Build CAD assembly
    builder = CadAssemblyBuilder(
        calc_result=result.dict(),
        housing_dims={"L": payload.housing_l, "W": payload.housing_w, "H": payload.housing_h},
        options=payload.component_options
    )
    builder.build()
    step_bytes = builder.export_step()

    return StreamingResponse(
        io.BytesIO(step_bytes),
        media_type="application/step",
        headers={"Content-Disposition": "attachment; filename=battery_pack.step"}
    )
```

**CadQuery binary size consideration**: OpenCascade adds ~200-300MB to the PyInstaller bundle. Options:
- Accept the size increase (modern installers handle this fine)
- Make CadQuery an optional dependency — only import when STEP export is requested, show a warning if not installed
- Use a lighter alternative: `build123d` (newer CadQuery successor, same OpenCascade backend but cleaner API)

**Files**:
- NEW: `backend/app/core/cad_builder.py`
- NEW: `backend/app/routers/export.py`
- EDIT: `backend/app/main.py` (register the new router)
- EDIT: `backend/requirements.txt` (add `cadquery`)
- EDIT: `frontend/src/services/api.js` (add `exportStep()` method)

---

## Implementation Order (Recommended)

| Step | Phase | Estimated Effort | Dependencies |
|------|-------|------------------|--------------|
| 1 | Phase 0: Refactor PackViewer3D | 3-4 hours | None |
| 2 | Phase 1: Enhanced terminals | 1-2 hours | Phase 0 |
| 3 | Phase 2: Busbars & nickel strips | 3-4 hours | Phase 1 |
| 4 | Phase 3: Brackets & insulation cards | 2-3 hours | Phase 0 |
| 5 | Phase 4: Side/end plates | 1-2 hours | Phase 0 |
| 6 | Phase 7: Layer toggle UI | 2-3 hours | Phase 0 |
| 7 | Phase 5: BMS + cables | 3-4 hours | Phase 2 |
| 8 | Phase 6: Insulation wrap + heat shrink | 1-2 hours | Phase 4 |
| 9 | Phase 8: Frontend GLTF/STL export | 1-2 hours | Phase 0 |
| 10 | Phase 9: Backend STEP export | 4-6 hours | Engine exists |

**Total estimated effort**: ~22-32 hours of development

---

## Data Flow for STEP Export

```
User clicks "Export STEP"
        │
        ▼
Frontend sends POST /api/v1/export/step
  {
    calc_request: { ...same payload as /calculate... },
    component_options: {
      housing: true,
      cells: true,
      busbars: true,
      brackets: true,
      insulation: true,
      bms: true,
      cables: false,       ← user toggled this off
      heat_shrink: true
    }
  }
        │
        ▼
Backend: run_engine() → get CalculationResult
        │
        ▼
CadAssemblyBuilder(result, housing, options)
  .build()              ← constructs CadQuery assembly
  .export_step()        ← serializes to STEP bytes
        │
        ▼
StreamingResponse → .step file download
        │
        ▼
User opens in SolidWorks / CATIA / Blender
  → sees named assembly tree:
      battery_pack_assembly
      ├── housing
      ├── cells (S×P instances)
      ├── busbars
      ├── brackets
      ├── bms_pcb
      └── cables
```

---

## Key Technical Decisions

### 1. Frontend geometry must match backend geometry
The Three.js builder and CadQuery builder must produce geometrically identical results. This means:
- Same positioning math (center offsets, step sizes)
- Same dimensions for all components
- Shared constants (busbar thickness, insulation card thickness, etc.)

**Solution**: Define all dimensional constants in a shared config. Frontend reads them from a `/api/v1/assembly/config` endpoint or hardcodes them identically.

### 2. InstancedMesh handling for export
- **GLTF**: Supports instances natively → export works directly
- **STL**: Does not support instances → need a helper to "flatten" InstancedMesh into individual meshes before export
- **STEP**: CadQuery builds individual solids anyway (no instancing concept in STEP, though OpenCascade supports it via compound shapes)

### 3. Performance with many components
- Current: S×P cells with instancing = fast
- Adding busbars, strips, brackets, wires = more draw calls
- Mitigation: Use `THREE.Group.visible = false` for hidden layers (GPU skips them entirely). Use instancing where possible (nickel strips, insulation cards). Use `LOD` or simplified geometry when not in fullscreen.

### 4. BMS sizing
The BMS dimensions should scale with the S count:
- S ≤ 4: small BMS (40 × 30 × 1.6mm)
- S ≤ 8: medium BMS (60 × 40 × 1.6mm)
- S ≤ 16: large BMS (80 × 50 × 1.6mm)
- S > 16: extra-large or stacked BMS modules

---

## Files Summary — What Gets Created/Modified

### New Files
| File | Purpose |
|------|---------|
| `frontend/src/3d/PackAssemblyBuilder.js` | Modular 3D assembly builder class |
| `frontend/src/components/LayerControlPanel.jsx` | Toggle panel for component visibility |
| `frontend/src/components/ExportPanel.jsx` | Export buttons (GLTF, STL, STEP) |
| `backend/app/core/cad_builder.py` | CadQuery assembly builder for STEP |
| `backend/app/routers/export.py` | STEP export API endpoint |

### Modified Files
| File | Changes |
|------|---------|
| `frontend/src/components/PackViewer3D.jsx` | Delegate geometry to builder, integrate panels |
| `frontend/src/components/App.jsx` | Pass toggle state, export handlers |
| `frontend/src/services/api.js` | Add `exportStep()` method |
| `backend/app/main.py` | Register export router |
| `backend/requirements.txt` | Add `cadquery` |
| `frontend/package.json` | Add `file-saver` (for download triggers) |
