import React, { useState, useEffect, useCallback } from 'react'
import { apiService } from './services/api'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v, unit = '', d = 2) =>
  v != null ? `${Number(v).toFixed(d)} ${unit}`.trim() : '—'

const toNum = (v, fallback = 0) => {
  const n = parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? fallback : n
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusPill() {
  return (
    <li style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
      padding: '3px 10px', borderRadius: 'var(--radius-full)',
      background: 'rgba(34,197,94,0.1)', color: '#16a34a',
      border: '1px solid rgba(34,197,94,0.25)',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
      API Online
    </li>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.1em', color: 'var(--color-muted)',
      marginBottom: 10, paddingBottom: 6,
      borderBottom: '1px solid var(--color-border)',
    }}>
      {children}
    </div>
  )
}

function InputRow({ label, unit, value, onChange, min = 0, step = 'any' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <label style={{
        fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: 'rgba(0,0,0,0.55)',
        minWidth: 110, flexShrink: 0, lineHeight: 1.3,
      }}>
        {label}
        {unit && <span style={{ fontWeight: 400, color: 'rgba(0,0,0,0.35)', marginLeft: 2 }}>({unit})</span>}
      </label>
      <input
        type="number" min={min} step={step}
        className="modern-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ flex: 1 }}
      />
    </div>
  )
}

function ResultRow({ label, value, highlight = false, last = false }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      paddingBottom: last ? 0 : 6, marginBottom: last ? 0 : 6,
      borderBottom: last ? 'none' : '1px solid var(--color-overlay)',
    }}>
      <span style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)' }}>{label}</span>
      <span style={{
        fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)',
        color: highlight ? 'var(--color-accent)' : 'var(--color-text)',
      }}>
        {value}
      </span>
    </div>
  )
}

function VerdictBadge({ verdict, justification }) {
  if (!verdict) return null
  const ok = verdict === 'ACCEPT'
  return (
    <div style={{
      marginTop: 12, borderRadius: 'var(--radius-sm)', overflow: 'hidden',
      border: `1.5px solid ${ok ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
        background: ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
      }}>
        <span style={{ fontSize: '1rem' }}>{ok ? '✓' : '✗'}</span>
        <span style={{ fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.1em', color: ok ? '#16a34a' : '#dc2626' }}>
          {verdict}
        </span>
      </div>
      {!ok && (
        <div style={{
          padding: '6px 12px 8px', fontSize: '0.72rem', color: '#dc2626',
          lineHeight: 1.5, background: 'rgba(239,68,68,0.04)',
        }}>
          {justification}
        </div>
      )}
    </div>
  )
}

function PackPreview({ result }) {
  const ok     = result.verdict === 'ACCEPT'
  const stroke = ok ? '#22c55e' : '#ef4444'
  const fill   = ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'
  const d      = result.dimensions_array
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg,#0f172a 0%,#1e293b 100%)',
      padding: 24, boxSizing: 'border-box', gap: 14,
    }}>
      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        Pack dimensions (with margins)
      </div>
      <svg viewBox="0 0 220 160" width="200" style={{ overflow: 'visible' }}>
        <rect x="35" y="55" width="115" height="75" rx="3" fill={fill} stroke={stroke} strokeWidth="1.2" strokeOpacity="0.85" />
        <path d="M35 55 L62 30 L177 30 L150 55 Z" fill={fill} stroke={stroke} strokeWidth="1.2" strokeOpacity="0.65" />
        <path d="M150 55 L177 30 L177 105 L150 130 Z" fill={fill} stroke={stroke} strokeWidth="1.2" strokeOpacity="0.5" />
        <text x="92"  y="152" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="9" fontFamily="inherit">L {d.longueur_mm} mm</text>
        <text x="185" y="72"  textAnchor="start"  fill="rgba(255,255,255,0.45)" fontSize="9" fontFamily="inherit">H {d.hauteur_mm}</text>
        <text x="10"  y="100" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="9" fontFamily="inherit" transform="rotate(-90,10,100)">W {d.largeur_mm}</text>
      </svg>
      <div style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '0.12em', color: ok ? '#22c55e' : '#ef4444' }}>
        {result.verdict}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.68rem', textAlign: 'center', maxWidth: 170, lineHeight: 1.5 }}>
        {ok ? 'All margins satisfied on 3 axes' : result.justification}
      </div>
    </div>
  )
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
    energie_cible_kwh:  55,
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

  const set = key => val => setForm(f => ({ ...f, [key]: val }))

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

    const payload = {
      cell_id:            cell.id,
      energie_cible_kwh:  toNum(form.energie_cible_kwh),
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
      // Pydantic 422 detail or generic message
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
      <div className="page-wrapper" style={{ justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: '2rem' }}>🔋</div>
        <p style={{ color: 'var(--color-muted)' }}>Loading cell catalogue…</p>
      </div>
    )
  }

  if (apiError) {
    return (
      <div className="page-wrapper" style={{ justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: '2rem' }}>⚠️</div>
        <p style={{ color: '#dc2626', fontWeight: 600 }}>{apiError}</p>
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

      {/* ── HEADER ── */}
      <header id="site-header">
        <nav className="nav-card" role="navigation" aria-label="Main navigation">
          <a href="/" className="nav-logo" aria-label="Battery Pack Designer — home">
            <span className="nav-logo__first">Battery</span>
            <span className="nav-logo__last">Designer</span>
          </a>
          <ul className="nav-links" role="list">
            <li><a href="#projects">Projects</a></li>
            <li><a href="#about">About</a></li>
            <li><a href="#contact">Contact</a></li>
            <StatusPill />
          </ul>
        </nav>
      </header>

      <main className="page-content">
        <div className="bento-grid" id="bento-main">

          {/* ── LEFT — Cell selector ── */}
          <div className="left-col">
            <div className="projects-card">
              <div className="projects-card__header">
                <span className="projects-card__label">Cell Selector</span>
              </div>

              {/* Dropdown */}
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
                <label style={{
                  fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
                  display: 'block', marginBottom: 6,
                  textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-muted)',
                }}>
                  Select cell
                </label>
                <select
                  className="modern-select"
                  value={selectedId ?? ''}
                  onChange={e => {
                    setSelectedId(parseInt(e.target.value, 10))
                    setResult(null)
                  }}
                >
                  {cells.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>

              {/* Cell thumbnail */}
              <div className="projects-card__thumb" role="img" aria-label="Cell preview">
                <img src="/images/Projectscard.png" alt="Cell" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>

              {/* Spec badges */}
              <div style={{ padding: '14px 20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div className="spec-badge">
                    <span className="spec-badge__label">Weight</span>
                    <span className="spec-badge__value">{masseKg} kg</span>
                  </div>
                  <div className="spec-badge">
                    <span className="spec-badge__label">Capacity</span>
                    <span className="spec-badge__value">{fmt(cell?.capacite_ah, 'Ah', 1)}</span>
                  </div>
                  <div className="spec-badge">
                    <span className="spec-badge__label">Max current</span>
                    <span className="spec-badge__value">{fmt(cell?.courant_max_a, 'A', 1)}</span>
                  </div>
                  <div className="spec-badge">
                    <span className="spec-badge__label">Voltage</span>
                    <span className="spec-badge__value">{fmt(cell?.tension_nominale, 'V', 2)}</span>
                  </div>
                </div>

                {cell && (
                  <div style={{
                    fontSize: 'var(--text-xs)', color: 'var(--color-muted)',
                    lineHeight: 'var(--leading-loose)',
                    paddingTop: 10, borderTop: '1px solid var(--color-border)',
                  }}>
                    <div>
                      <strong style={{ color: 'var(--color-text)' }}>{cell.nom}</strong>
                      {' '}
                      <span style={{
                        display: 'inline-block', fontSize: '0.65rem', padding: '1px 7px',
                        borderRadius: 'var(--radius-full)', fontWeight: 600,
                        background: 'var(--color-overlay)', color: 'var(--color-muted)',
                        border: '1px solid var(--color-border)',
                      }}>
                        {cell.type_cellule}
                      </span>
                    </div>
                    <div>{cell.longueur_mm} × {cell.largeur_mm} × {cell.hauteur_mm} mm</div>
                    <div>Swelling: {swellingLabel}</div>
                  </div>
                )}
              </div>
              <ul className="projects-list" role="list" />
            </div>

            {/* Action buttons */}
            <div className="social-card">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                <button
                  type="button"
                  className="modern-btn modern-btn-primary"
                  style={{ width: '100%' }}
                  disabled={calculating || !cell}
                  onClick={handleCalculate}
                >
                  {calculating
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          width: 13, height: 13,
                          border: '2px solid rgba(255,255,255,0.4)',
                          borderTopColor: '#fff', borderRadius: '50%',
                          animation: 'spin 0.7s linear infinite', display: 'inline-block',
                        }} />
                        Calculating…
                      </span>
                    : 'Calculate'
                  }
                </button>
                <button
                  type="button"
                  className="modern-btn modern-btn-secondary"
                  style={{ width: '100%' }}
                  onClick={() => alert('PDF export — Sprint 5')}
                >
                  Export PDF
                </button>
              </div>

              {calcError && (
                <div style={{
                  marginTop: 10, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                  fontSize: 'var(--text-xs)', color: '#dc2626',
                }}>
                  ⚠ {calcError}
                </div>
              )}
            </div>
          </div>

          {/* ── CENTER — Constraints form ── */}
          <div className="headline-card" style={{ minHeight: 'auto' }}>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <h2 style={{
                fontSize: '1rem', fontWeight: 'var(--weight-extrabold)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                textAlign: 'center', margin: 0, color: 'var(--color-text)',
              }}>
                Constraints
              </h2>

              <div>
                <SectionLabel>Electrical targets</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <InputRow label="Energy"  unit="kWh" value={form.energie_cible_kwh}  onChange={set('energie_cible_kwh')} min={0.001} />
                  <InputRow label="Current" unit="A"   value={form.courant_cible_a}     onChange={set('courant_cible_a')}   min={0.001} />
                  <InputRow label="DoD"     unit="%"   value={form.depth_of_discharge}  onChange={set('depth_of_discharge')} min={1} step={1} />
                </div>
              </div>

              <div>
                <SectionLabel>Housing dimensions</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <InputRow label="Length L" unit="mm" value={form.housing_l}       onChange={set('housing_l')}       min={1} />
                  <InputRow label="Width l"  unit="mm" value={form.housing_l_small} onChange={set('housing_l_small')} min={1} />
                  <InputRow label="Height h" unit="mm" value={form.housing_h}       onChange={set('housing_h')}       min={1} />
                  <InputRow label="Margin"   unit="mm" value={form.marge_mm}        onChange={set('marge_mm')}        min={0} />
                </div>
              </div>

              <div>
                <SectionLabel>Configuration mode</SectionLabel>
                <div style={{ display: 'flex', gap: 6, marginBottom: form.config_mode === 'manual' ? 10 : 0 }}>
                  {['auto', 'manual'].map(mode => (
                    <button key={mode} type="button" onClick={() => set('config_mode')(mode)} style={{
                      flex: 1, padding: '7px 0', border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase',
                      letterSpacing: '0.06em', cursor: 'pointer', transition: 'all 0.15s',
                      background: form.config_mode === mode ? 'var(--color-text)' : 'var(--color-overlay)',
                      color: form.config_mode === mode ? '#fff' : 'var(--color-muted)',
                    }}>
                      {mode}
                    </button>
                  ))}
                </div>
                {form.config_mode === 'manual' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <InputRow label="Series S"   value={form.manual_series}   onChange={set('manual_series')}   min={1} step={1} />
                    <InputRow label="Parallel P" value={form.manual_parallel} onChange={set('manual_parallel')} min={1} step={1} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT — Pack preview ── */}
          <div className="photo-card" role="img" aria-label="Visualization" style={{ overflow: 'hidden' }}>
            {result
              ? <PackPreview result={result} />
              : <img src="/images/ImageCard.png" alt="Visualization" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            }
          </div>

          {/* ── BOTTOM ROW — Results ── */}
          <div className="bottom-row">

            {/* Electrical */}
            <div className="bio-card">
              <div style={{
                fontSize: '0.8rem', fontWeight: 'var(--weight-extrabold)',
                textTransform: 'uppercase', letterSpacing: '0.07em',
                color: 'var(--color-accent)', marginBottom: 12,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                Electrical Results
              </div>

              {result ? (
                <>
                  <ResultRow label="Configuration"  value={`${result.nb_serie}S / ${result.nb_parallele}P`} highlight />
                  <ResultRow label="Total cells"    value={result.total_cells} />
                  <ResultRow label="Pack voltage"   value={fmt(result.tension_totale_v, 'V')} />
                  <ResultRow label="Pack current"   value={fmt(result.courant_total_a, 'A')} />
                  <ResultRow label="Real energy"    value={fmt(result.energie_reelle_kwh, 'kWh')} />
                  <ResultRow label="Capacity"       value={fmt(result.electrical.actual_capacity_ah, 'Ah')} />
                  <ResultRow label="Usable energy"  value={fmt(result.electrical.usable_energy_wh / 1000, 'kWh')} />
                  <ResultRow label="Pack weight"    value={fmt(result.electrical.total_weight_kg, 'kg')} />
                  <ResultRow label="Energy density" value={fmt(result.electrical.energy_density_wh_kg, 'Wh/kg')} last />
                  <VerdictBadge verdict={result.verdict} justification={result.justification} />
                </>
              ) : (
                <div style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', fontStyle: 'italic', textAlign: 'center', padding: '24px 0' }}>
                  Set constraints and click Calculate
                </div>
              )}
            </div>

            {/* Mechanical */}
            <div className="contact-card">
              <div style={{
                fontSize: '0.8rem', fontWeight: 'var(--weight-extrabold)',
                textTransform: 'uppercase', letterSpacing: '0.07em',
                color: 'var(--color-accent)', marginBottom: 12,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
                Mechanical Results
              </div>

              {result ? (
                <>
                  <ResultRow label="Final L"             value={fmt(result.dimensions_array.longueur_mm, 'mm')} highlight />
                  <ResultRow label="Final W"             value={fmt(result.dimensions_array.largeur_mm,  'mm')} highlight />
                  <ResultRow label="Final H"             value={fmt(result.dimensions_array.hauteur_mm,  'mm')} highlight />
                  <ResultRow label="Raw L (no margin)"   value={fmt(result.dimensions_raw.longueur_mm,   'mm')} />
                  <ResultRow label="Raw W (no margin)"   value={fmt(result.dimensions_raw.largeur_mm,    'mm')} />
                  <ResultRow label="Margin / face"       value={fmt(form.marge_mm, 'mm', 0)} />
                  <ResultRow label="Mode"                value={result.config_mode} last />

                  {result.validation_errors?.length > 0 && (
                    <div style={{
                      marginTop: 10, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                      background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)',
                      fontSize: 'var(--text-xs)', color: '#dc2626', lineHeight: 1.6,
                    }}>
                      {result.validation_errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', fontStyle: 'italic', textAlign: 'center', padding: '24px 0' }}>
                  Results will appear after calculation
                </div>
              )}
            </div>

          </div>
        </div>
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}