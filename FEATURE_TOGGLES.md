# Feature Toggles

This document describes how to enable/disable optional features in the Battery Pack Designer application.

---

## PDF Export Feature

### Current Status
**DISABLED** by default (commented out for demo purposes)

### Location
[`frontend/src/components/CellSelector.jsx`](frontend/src/components/CellSelector.jsx:241)

### How to Enable/Disable

**To ENABLE:** Change `{false && (` to `{true && (` or simply `{`
```jsx
// BEFORE (disabled):
{false && (
  <button ...>Export PDF</button>
)}

// AFTER (enabled):
{true && (
  <button ...>Export PDF</button>
)}
```

**To DISABLE:** Change `{true && (` or `{` back to `{false && (`

### Backend Requirement
Ensure the backend PDF endpoint is functional:
- Endpoint: `POST /api/v1/calculate/pdf`
- Ensure `reportlab` is installed: `pip install reportlab`
- See [`backend/app/pdf.py`](backend/app/pdf.py) for implementation

---

## 3D Pack Visualization Feature

### Current Status
**ENABLED** - FIXED (hooks error resolved, housing always shown)

### Behavior
- **Before calculation:** Shows housing wireframe + "Calculate a configuration" overlay
- **After calculation:** Shows housing + battery cells (overlay removed)

### Location
- Component: [`frontend/src/components/PackViewer3D.jsx`](frontend/src/components/PackViewer3D.jsx)
- Skeleton: [`frontend/src/components/PackViewer3DSkeleton.jsx`](frontend/src/components/PackViewer3DSkeleton.jsx)
- Import in App: [`frontend/src/App.jsx:13`](frontend/src/App.jsx:13)

### How to DISABLE (Step by Step)

**Step 1:** Comment out the lazy import (line 13)
```jsx
// BEFORE:
const PackViewer3D = lazy(() => import('./components/PackViewer3D'))

// AFTER (add //):
// const PackViewer3D = lazy(() => import('./components/PackViewer3D'))
```

**Step 2:** Comment out the right panel 3D visualization (lines 221-236)
```jsx
// BEFORE:
{/* ── RIGHT — 3D Pack visualization ── */}
<div className="photo-card" aria-label="3D Visualization" style={{ padding: 0 }}>
  <ErrorBoundary>
    <Suspense fallback={<PackViewer3DSkeleton />}>
      <PackViewer3D ... />
    </Suspense>
  </ErrorBoundary>
</div>

// AFTER (wrap with {/* and */}):
{/* {/* ── RIGHT — 3D Pack visualization ── */}
{/* <div className="photo-card" aria-label="3D Visualization" style={{ padding: 0 }}> */}
{/*   <ErrorBoundary> */}
{/*     <Suspense fallback={<PackViewer3DSkeleton />}> */}
{/*       <PackViewer3D ... /> */}
{/*     </Suspense> */}
{/*   </ErrorBoundary> */}
{/* </div> */}
```

**Step 3:** Comment out the fullscreen modal (lines 254-363)
```jsx
// BEFORE:
{/* ── Fullscreen 3D Viewer Modal ── */}
{fullscreenMode && (
  <div className="fullscreen-overlay">
    ...
  </div>
)}

// AFTER:
{/* ── Fullscreen 3D Viewer Modal ── */}
{/* {fullscreenMode && ( */}
{/*   <div className="fullscreen-overlay"> */}
{/*     ... entire modal content ... */}
{/*   </div> */}
{/* )} */}
```

### How to ENABLE

**Step 1:** Uncomment the lazy import (remove the `//`):
```jsx
const PackViewer3D = lazy(() => import('./components/PackViewer3D'))
```

**Step 2:** Uncomment the right panel section:
```jsx
{/* ── RIGHT — 3D Pack visualization ── */}
<div className="photo-card" aria-label="3D Visualization" style={{ padding: 0 }}>
  <ErrorBoundary>
    <Suspense fallback={<PackViewer3DSkeleton />}>
      <PackViewer3D ... />
    </Suspense>
  </ErrorBoundary>
</div>
```

**Step 3:** Uncomment the fullscreen modal section

### Dependencies
- Three.js (loaded lazily)
- Uses WebGL for rendering
- May require significant memory on low-end devices

---

## Quick Toggle Config (Optional Enhancement)

For easier toggling, you could add a config file:

```js
// frontend/src/config.js
export const FEATURES = {
  PDF_EXPORT: true,      // Set to false to disable
  3D_VISUALIZATION: true, // Set to false to disable
}
```

Then use it in components:
```jsx
import { FEATURES } from '../config'

// In CellSelector.jsx
{FEATURES.PDF_EXPORT && (
  <button>Export PDF</button>
)}
```

---

## Notes
- PDF export requires the backend to be running
- 3D viewer uses lazy loading to reduce initial bundle size
- Both features work independently of each other
