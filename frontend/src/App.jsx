import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react'
import { apiService } from './services/api'

import Header from './components/Header'
import { CellSelectorCard } from './components/CellSelector'
import CellActionCard from './components/CellSelector'
import ConstraintsForm from './components/ConstraintsForm'
import PackViewer3DSkeleton from './components/PackViewer3DSkeleton'
import ResultsPanel from './components/ResultsPanel'

// Lazy load the 3D viewer component (contains heavy Three.js library)
const PackViewer3D = lazy(() => import('./components/PackViewer3D'))

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toNum = (v, fallback = 0) => {
  const n = parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? fallback : n
}

const toOptNum = (v) => {
  if (v == null) return undefined
  const s = String(v).trim()
  if (s === '') return undefined
  const n = parseFloat(s.replace(',', '.'))
  return isNaN(n) ? undefined : n
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [cells, setCells]             = useState([])
  const [selectedId, setSelectedId]   = useState(null)
  const [loading, setLoading]         = useState(true)
  const [apiError, setApiError]       = useState(null)
  const [calculating, setCalculating] = useState(false)
  const [calcError, setCalcError]     = useState(null)
  const [result, setResult]           = useState(null)
  const [fullscreenMode, setFullscreenMode] = useState(false)
  const [cameraPreset, setCameraPreset] = useState('free')

  // Form — keys match CalculationRequest exactly
  const [form, setForm] = useState({
    energie_cible_wh:   3500,
    tension_cible_v:    70,
    courant_cible_a:    200,
    housing_l:          400,
    housing_l_small:    400,
    housing_h:          100,
    marge_mm:           15,
    depth_of_discharge: 80,
    config_mode:        'auto',
    manual_series:      '',
    manual_parallel:    '',
  })

  const handleFieldChange = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSelectCell = (id) => {
    setSelectedId(id)
    setResult(null)
  }

  const handleEnterFullscreen = () => {
    setFullscreenMode(true)
    setCameraPreset('isometric')
  }

  const handleExitFullscreen = () => {
    setFullscreenMode(false)
    setCameraPreset('free')
  }

  const handleCameraPreset = (preset) => {
    setCameraPreset(preset)
  }

  // ── Fetch cell catalogue on mount ──
  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await apiService.getCells()
        setCells(data)
        if (data.length > 0) setSelectedId(data[0].id)
      } catch (e) {
        setApiError('Cannot reach the API. Make sure FastAPI is running on port 8000.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // ── Zoom-to-fit: scale down when viewport is shorter than content ──
  const wrapperRef = useRef(null)
  useEffect(() => {
    const DESIGN_HEIGHT = 760   // recalibrated for tighter 360px row height
    const MIN_ZOOM      = 0.45  // never shrink below this

    const updateZoom = () => {
      const vh = window.innerHeight
      const zoom = Math.min(1, Math.max(MIN_ZOOM, vh / DESIGN_HEIGHT))
      if (wrapperRef.current) {
        wrapperRef.current.style.zoom = zoom
      }
    }

    updateZoom()
    window.addEventListener('resize', updateZoom)
    return () => window.removeEventListener('resize', updateZoom)
  }, [])

  const cell = cells.find(c => c.id === selectedId) ?? null

  // Swelling normalised for display
  const swellingLabel = cell?.taux_swelling_pct != null
    ? cell.taux_swelling_pct > 1
      ? `${cell.taux_swelling_pct.toFixed(1)} %`
      : `${(cell.taux_swelling_pct * 100).toFixed(1)} %`
    : '—'

  const masseKg = cell?.masse_g != null
    ? (cell.masse_g / 1000).toFixed(3)
    : '—'

  // ── POST /api/v1/calculate ──
  const handleCalculate = useCallback(async () => {
    if (!cell) return
    setCalculating(true)
    setCalcError(null)
    setResult(null)

    const energieOpt = toOptNum(form.energie_cible_wh)
    const tensionOpt = toOptNum(form.tension_cible_v)

    if ((tensionOpt == null) !== (energieOpt == null)) {
      setCalcError('Energy target (Wh) and voltage target (V) must be provided together.')
      setCalculating(false)
      return
    }

    const payload = {
      cell_id:            cell.id,
      energie_cible_wh:   energieOpt,
      tension_cible_v:    tensionOpt,
      courant_cible_a:    toNum(form.courant_cible_a),
      housing_l:          toNum(form.housing_l),
      housing_l_small:    toNum(form.housing_l_small),
      housing_h:          toNum(form.housing_h),
      marge_mm:           toNum(form.marge_mm, 15),
      depth_of_discharge: toNum(form.depth_of_discharge, 80),
      config_mode:        form.config_mode,
      ...(form.config_mode === 'manual' && {
        manual_series:   parseInt(form.manual_series)   || undefined,
        manual_parallel: parseInt(form.manual_parallel) || undefined,
      }),
    }

    try {
      const { data } = await apiService.calculate(payload)
      setResult(data)
    } catch (e) {
      const detail = e?.response?.data?.detail
      setCalcError(
        Array.isArray(detail)
          ? detail.map(d => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join(' · ')
          : detail ?? e.message ?? 'Calculation failed'
      )
    } finally {
      setCalculating(false)
    }
  }, [cell, form])

  // ── Loading / error screens ──
  if (loading) {
    return (
      <div className="page-wrapper loading-screen">
        <div className="loading-icon">🔋</div>
        <p className="loading-text">Loading cell catalogue…</p>
      </div>
    )
  }

  if (apiError) {
    return (
      <div className="page-wrapper error-screen">
        <div className="error-icon">⚠️</div>
        <p className="error-text">{apiError}</p>
        <button
          className="modern-btn modern-btn-primary"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="page-wrapper" ref={wrapperRef}>

      <Header />

      <main className="page-content">
        <div className="bento-grid" id="bento-main">

          {/* ── LEFT TOP — Cell selector card ── */}
          <CellSelectorCard
            cells={cells}
            selectedId={selectedId}
            onSelectCell={handleSelectCell}
            cell={cell}
            masseKg={masseKg}
            swellingLabel={swellingLabel}
          />

          {/* ── CENTER — Constraints form ── */}
          <ConstraintsForm
            form={form}
            onFieldChange={handleFieldChange}
          />

          {/* ── RIGHT — 3D Pack visualization ── */}
          <div className="photo-card" aria-label="3D Visualization" style={{ padding: 0 }}>
            <Suspense fallback={<PackViewer3DSkeleton />}>
              <PackViewer3D
                housingL={form.housing_l}
                housingW={form.housing_l_small}
                housingH={form.housing_h}
                result={result}
                cameraPreset={fullscreenMode ? cameraPreset : 'free'}
                onFullscreenClick={handleEnterFullscreen}
                isFullscreen={false}
              />
            </Suspense>
          </div>

          {/* ── LEFT BOTTOM — Action buttons ── */}
          <CellActionCard
            cell={cell}
            calculating={calculating}
            onCalculate={handleCalculate}
            calcError={calcError}
          />

          {/* ── BOTTOM ROW — Results ── */}
          <ResultsPanel result={result} margeMm={form.marge_mm} />

        </div>
      </main>

      {/* ── Fullscreen 3D Viewer Modal ── */}
      {fullscreenMode && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: '#0f0f0f',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header bar with close button */}
          <div style={{
            backgroundColor: '#1a1c23',
            borderBottom: '1px solid #2a2c33',
            padding: '16px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h2 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '1.2rem' }}>3D Pack Visualization</h2>
              <p style={{ margin: 0, color: '#999', fontSize: '0.85rem' }}>Click camera presets to change views</p>
            </div>
            <button
              onClick={handleExitFullscreen}
              style={{
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: '1.5rem',
                cursor: 'pointer',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Exit fullscreen"
            >
              ✕
            </button>
          </div>

          {/* Camera preset controls */}
          <div style={{
            backgroundColor: '#1a1c23',
            borderBottom: '1px solid #2a2c33',
            padding: '12px 24px',
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <span style={{ color: '#999', fontSize: '0.9rem', marginRight: '8px' }}>Camera:</span>
            {[
              { label: 'Front', value: 'front' },
              { label: 'Back', value: 'back' },
              { label: 'Top', value: 'top' },
              { label: 'Bottom', value: 'bottom' },
              { label: 'Left', value: 'left' },
              { label: 'Right', value: 'right' },
              { label: 'Isometric', value: 'isometric' },
              { label: 'Free Orbit', value: 'free' }
            ].map(preset => (
              <button
                key={preset.value}
                onClick={() => handleCameraPreset(preset.value)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '4px',
                  border: cameraPreset === preset.value ? '2px solid #3b82f6' : '1px solid #2a2c33',
                  backgroundColor: cameraPreset === preset.value ? 'rgba(59,130,246,0.2)' : '#2a2c33',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                  hover: { backgroundColor: '#3a3c43' }
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* 3D Viewer */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Suspense fallback={<PackViewer3DSkeleton />}>
              <PackViewer3D
                housingL={form.housing_l}
                housingW={form.housing_l_small}
                housingH={form.housing_h}
                result={result}
                cameraPreset={cameraPreset}
                isFullscreen={true}
              />
            </Suspense>
          </div>

          {/* Footer with return button */}
          <div style={{
            backgroundColor: '#1a1c23',
            borderTop: '1px solid #2a2c33',
            padding: '16px 24px',
            display: 'flex',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={handleExitFullscreen}
              style={{
                padding: '10px 24px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: '#3b82f6',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 600
              }}
            >
              Return to Layout
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}