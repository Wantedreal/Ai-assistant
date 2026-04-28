import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react'
import { apiService } from './services/api'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { LanguageProvider, useT } from './i18n'

import Header from './components/Header'
import { CellSelectorCard } from './components/CellSelector'
import CellActionCard from './components/CellSelector'
import ConstraintsForm from './components/ConstraintsForm'
import PackViewer3DSkeleton from './components/PackViewer3DSkeleton'
import ResultsPanel from './components/ResultsPanel'
import ComparePanel from './components/ComparePanel'
import HistoryPanel from './components/HistoryPanel'
import CataloguePanel from './components/CataloguePanel'
import AIFab from './components/AIFab'
import { ErrorBoundary } from './components/ErrorBoundary'

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

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  return <LanguageProvider><AppInner /></LanguageProvider>
}

function AppInner() {
  const t = useT()
  const [cells, setCells]             = useState([])
  const [selectedId, setSelectedId]   = useState(null)
  const [loading, setLoading]         = useState(true)
  const [apiError, setApiError]       = useState(null)
  const [calculating, setCalculating]   = useState(false)
  const [calcError, setCalcError]       = useState(null)
  const [result, setResult]             = useState(null)
  const [lastPayload, setLastPayload]   = useState(null)
  const [fullscreenMode, setFullscreenMode] = useState(false)
  const [cameraPreset, setCameraPreset]     = useState('free')
  const [compareOpen, setCompareOpen]       = useState(false)
  const [historyOpen, setHistoryOpen]       = useState(false)
  const [historyCount, setHistoryCount]     = useState(0)
  const [catalogueOpen, setCatalogueOpen]   = useState(false)

  // Form — keys match CalculationRequest exactly
  const [form, setForm] = useState({
    energie_cible_wh:   3500,
    tension_cible_v:    70,
    courant_cible_a:    200,
    housing_l:          709,
    housing_l_small:    318,
    housing_h:          71,
    marge_mm:           15,
    cell_gap_mm:             1.5,
    end_plate_thickness_mm:  10,
    busbar_thickness_mm:     15,
    depth_of_discharge: 80,
    config_mode:        'auto',
    manual_series:      '',
    manual_parallel:    '',
    cycles_per_day:     1,
  })

  const handleFieldChange = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSelectCell = (id) => {
    setSelectedId(id)
    setResult(null)
  }

  const handleRestore = useCallback(({ payload, result: restoredResult, cellId }) => {
    setSelectedId(cellId)
    setResult(restoredResult)
    setLastPayload(payload)
    setForm(f => ({
      ...f,
      energie_cible_wh:        payload.energie_cible_wh   ?? f.energie_cible_wh,
      tension_cible_v:         payload.tension_cible_v    ?? f.tension_cible_v,
      courant_cible_a:         payload.courant_cible_a    ?? f.courant_cible_a,
      housing_l:               payload.housing_l          ?? f.housing_l,
      housing_l_small:         payload.housing_l_small    ?? f.housing_l_small,
      housing_h:               payload.housing_h          ?? f.housing_h,
      marge_mm:                payload.marge_mm           ?? f.marge_mm,
      depth_of_discharge:      payload.depth_of_discharge ?? f.depth_of_discharge,
      config_mode:             payload.config_mode        ?? f.config_mode,
      cell_gap_mm:             payload.cell_gap_mm        ?? f.cell_gap_mm,
      end_plate_thickness_mm:  payload.end_plate_thickness_mm ?? f.end_plate_thickness_mm,
      cycles_per_day:          payload.cycles_per_day     ?? f.cycles_per_day,
      manual_series:           payload.manual_series      ?? f.manual_series,
      manual_parallel:         payload.manual_parallel    ?? f.manual_parallel,
    }))
    setCalcError(null)
  }, [])

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

  // ── Export handlers (App-level so downloads survive fullscreen close) ──
  const [exporting, setExporting] = useState(null) // 'glb' | 'stl' | 'step' | null
  const builderRef = useRef(null)                   // shared ref to PackAssemblyBuilder

  const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 30000)
  }

  const handleExportGLB = useCallback(() => {
    if (!builderRef.current || exporting) return
    setExporting('glb')
    const group = builderRef.current.getExportGroup()
    new GLTFExporter().parse(
      group,
      (result) => { triggerDownload(new Blob([result], { type: 'model/gltf-binary' }), 'battery_pack.glb'); setExporting(null) },
      (err)    => { console.error('GLTFExporter:', err); setExporting(null) },
      { binary: true }
    )
  }, [exporting])

  const handleExportSTL = useCallback(() => {
    if (!builderRef.current || exporting) return
    setExporting('stl')
    let flatGroup = null
    try {
      flatGroup = builderRef.current.getFlatGroupForSTL()
      const result = new STLExporter().parse(flatGroup, { binary: true })
      triggerDownload(new Blob([result], { type: 'application/octet-stream' }), 'battery_pack.stl')
    } catch (err) {
      console.error('STLExporter:', err)
    } finally {
      if (flatGroup) flatGroup.traverse(obj => { if (obj.geometry) obj.geometry.dispose() })
      setExporting(null)
    }
  }, [exporting])

  const handleExportSTEP = useCallback(async () => {
    if (!lastPayload || exporting) return
    setExporting('step')
    try {
      const { data } = await apiService.exportStep(lastPayload)
      triggerDownload(new Blob([data], { type: 'application/step' }), 'battery_pack.step')
    } catch (err) {
      console.error('STEP export error:', err)
    } finally {
      setExporting(null)
    }
  }, [lastPayload, exporting])

  // ── Fetch cell catalogue (also called after import/sync) ──
  const loadCells = useCallback(async () => {
    try {
      const { data } = await apiService.getCells()
      setCells(data)
      if (data.length > 0) setSelectedId(prev => prev ?? data[0].id)
    } catch (e) {
      setApiError('Cannot reach the API. Make sure FastAPI is running on port 8000.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadCells() }, [loadCells])


  // ── Zoom-to-fit: scale down when viewport is shorter than design height ──
  const wrapperRef = useRef(null)
  useEffect(() => {
    const DESIGN_HEIGHT = 760
    const MIN_ZOOM      = 0.45

    const updateZoom = () => {
      const vh = window.innerHeight
      const zoom = Math.min(1, Math.max(MIN_ZOOM, vh / DESIGN_HEIGHT))
      if (wrapperRef.current) wrapperRef.current.style.zoom = zoom
    }

    // Apply immediately for a rough first paint, then re-apply after 300 ms
    // so Electron's fully-settled window height overwrites any stale value
    // reported during initial render (setTimeout(0) is not long enough).
    updateZoom()
    const t = setTimeout(updateZoom, 300)
    window.addEventListener('resize', updateZoom)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', updateZoom)
    }
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
      cell_gap_mm:             toNum(form.cell_gap_mm, 0),
      end_plate_thickness_mm:  toNum(form.end_plate_thickness_mm, 10),
      cycles_per_day:          toNum(form.cycles_per_day, 1),
      ...(form.config_mode === 'manual' && {
        manual_series:   parseInt(form.manual_series,   10) > 0 ? parseInt(form.manual_series,   10) : undefined,
        manual_parallel: parseInt(form.manual_parallel, 10) > 0 ? parseInt(form.manual_parallel, 10) : undefined,
      }),
    }

    try {
      const { data } = await apiService.calculate(payload)
      setResult(data)
      setLastPayload(payload)
      setHistoryCount(n => n + 1)
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
        <p className="loading-text">{t('app.loading')}</p>
      </div>
    )
  }

  if (apiError) {
    return (
      <div className="page-wrapper error-screen">
        <div className="error-icon">⚠️</div>
        <p className="error-text">{t('app.error')}</p>
        <button
          className="modern-btn modern-btn-primary"
          onClick={() => window.location.reload()}
        >
          {t('btn.retry')}
        </button>
      </div>
    )
  }

  return (
    <>
    <div className="page-wrapper" ref={wrapperRef}>

      <Header
        onOpenCompare={() => setCompareOpen(true)}
        onOpenHistory={() => setHistoryOpen(o => !o)}
        onOpenCatalogue={() => setCatalogueOpen(true)}
        historyCount={historyCount}
      />
      <HistoryPanel
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onRestore={handleRestore}
      />

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
            onReloadCells={loadCells}
            form={form}
          />

          {/* ── CENTER — Constraints form ── */}
          <ConstraintsForm
            form={form}
            onFieldChange={handleFieldChange}
            cell={cell}
          />

          {/* ── RIGHT — 3D Pack visualization ── */}
          <div className="photo-card" aria-label="3D Visualization" style={{ padding: 0 }}>
            <ErrorBoundary>
              <Suspense fallback={<PackViewer3DSkeleton />}>
                <PackViewer3D
                  housingL={form.housing_l}
                  housingW={form.housing_l_small}
                  housingH={form.housing_h}
                  result={result}
                  cameraPreset={fullscreenMode ? cameraPreset : 'free'}
                  onFullscreenClick={handleEnterFullscreen}
                  isFullscreen={false}
                  cellGap={toNum(form.cell_gap_mm, 0)}
                  onCellGapChange={v => handleFieldChange('cell_gap_mm', v)}
                  endPlateThickness={toNum(form.end_plate_thickness_mm, 10)}
                  onEndPlateChange={v => handleFieldChange('end_plate_thickness_mm', v)}
                  busbarThickness={toNum(form.busbar_thickness_mm, 1)}
                  onBusbarHeightChange={v => handleFieldChange('busbar_thickness_mm', v)}
                  stepPayload={lastPayload}
                />
              </Suspense>
            </ErrorBoundary>
          </div>

          {/* ── LEFT BOTTOM — Action buttons ── */}
          <CellActionCard
            cell={cell}
            calculating={calculating}
            onCalculate={handleCalculate}
            calcError={calcError}
            form={form}
            result={result}
          />

          {/* ── BOTTOM ROW — Results ── */}
          <ResultsPanel result={result} margeMm={form.marge_mm} />


        </div>
      </main>

      {/* ── Export in-progress toast (shown when export runs after fullscreen closes) ── */}
      {exporting && !fullscreenMode && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: '#1a1c23', border: '1px solid #2a2c33',
          borderRadius: 8, padding: '10px 16px',
          color: '#cbd5e1', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          {exporting === 'step' ? 'Generating STEP file…' : `Exporting ${exporting.toUpperCase()}…`}
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

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
              <h2 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '1.2rem' }}>{t('pack3d.title')}</h2>
              <p style={{ margin: 0, color: '#999', fontSize: '0.85rem' }}>{t('pack3d.fs_subtitle')}</p>
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
            <span style={{ color: '#999', fontSize: '0.9rem', marginRight: '8px' }}>{t('pack3d.fs_camera')}</span>
            {[
              { labelKey: 'pack3d.cam.front',     value: 'front' },
              { labelKey: 'pack3d.cam.back',      value: 'back' },
              { labelKey: 'pack3d.cam.top',       value: 'top' },
              { labelKey: 'pack3d.cam.bottom',    value: 'bottom' },
              { labelKey: 'pack3d.cam.left',      value: 'left' },
              { labelKey: 'pack3d.cam.right',     value: 'right' },
              { labelKey: 'pack3d.cam.isometric', value: 'isometric' },
              { labelKey: 'pack3d.cam.free',      value: 'free' },
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
                {t(preset.labelKey)}
              </button>
            ))}
          </div>

          {/* 3D Viewer */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <ErrorBoundary>
              <Suspense fallback={<PackViewer3DSkeleton />}>
                <PackViewer3D
                  housingL={form.housing_l}
                  housingW={form.housing_l_small}
                  housingH={form.housing_h}
                  result={result}
                  cameraPreset={cameraPreset}
                  isFullscreen={true}
                  cellGap={toNum(form.cell_gap_mm, 0)}
                  onCellGapChange={v => handleFieldChange('cell_gap_mm', v)}
                  endPlateThickness={toNum(form.end_plate_thickness_mm, 10)}
                  onEndPlateChange={v => handleFieldChange('end_plate_thickness_mm', v)}
                  busbarThickness={toNum(form.busbar_thickness_mm, 1)}
                  onBusbarHeightChange={v => handleFieldChange('busbar_thickness_mm', v)}
                  stepPayload={lastPayload}
                  externalBuilderRef={builderRef}
                  onExportGLB={handleExportGLB}
                  onExportSTL={handleExportSTL}
                  onExportSTEP={handleExportSTEP}
                  exporting={exporting}
                />
              </Suspense>
            </ErrorBoundary>
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
              {t('pack3d.fs_return')}
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>

    {!DEMO_MODE && <AIFab cell={cell} form={form} result={result} />}

    {compareOpen && (
      <ComparePanel
        cells={cells}
        onClose={() => setCompareOpen(false)}
      />
    )}

    {catalogueOpen && (
      <CataloguePanel
        cells={cells}
        onClose={() => setCatalogueOpen(false)}
        onSelectCell={(id) => { handleSelectCell(id); setCatalogueOpen(false) }}
        onReloadCells={loadCells}
      />
    )}
    </>
  )
}