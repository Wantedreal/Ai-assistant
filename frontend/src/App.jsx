import React, { useState, useEffect, useCallback } from 'react'
import { apiService } from './services/api'

import Header from './components/Header'
import CellSelector from './components/CellSelector'
import ConstraintsForm from './components/ConstraintsForm'
import PackPreview from './components/PackPreview'
import ResultsPanel from './components/ResultsPanel'

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

  // Form — keys match CalculationRequest exactly
  const [form, setForm] = useState({
    energie_cible_wh:   55000,
    tension_cible_v:    '',
    courant_cible_a:    200,
    housing_l:          1200,
    housing_l_small:    900,
    housing_h:          300,
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
    <div className="page-wrapper">

      <Header />

      <main className="page-content">
        <div className="bento-grid" id="bento-main">

          {/* ── LEFT — Cell selector ── */}
          <CellSelector
            cells={cells}
            selectedId={selectedId}
            onSelectCell={handleSelectCell}
            cell={cell}
            masseKg={masseKg}
            swellingLabel={swellingLabel}
            calculating={calculating}
            onCalculate={handleCalculate}
            calcError={calcError}
          />

          {/* ── CENTER — Constraints form ── */}
          <ConstraintsForm
            form={form}
            onFieldChange={handleFieldChange}
          />

          {/* ── RIGHT — Pack preview ── */}
          <div className="photo-card" role="img" aria-label="Visualization" style={{ overflow: 'hidden' }}>
            {result
              ? <PackPreview result={result} />
              : <img src="/images/ImageCard.png" alt="Visualization" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            }
          </div>

          {/* ── BOTTOM ROW — Results ── */}
          <ResultsPanel result={result} margeMm={form.marge_mm} />

        </div>
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}