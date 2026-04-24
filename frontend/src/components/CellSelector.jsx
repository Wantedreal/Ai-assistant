import React, { useState, useMemo, useRef, useEffect } from 'react'
import { apiService } from '../services/api'
import CellSchematic from './CellSchematic'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v, unit = '', d = 2) =>
  v != null ? `${Number(v).toFixed(d)} ${unit}`.trim() : '—'

function formatDimensions(cell) {
  if (!cell) return '—'
  if (cell.type_cellule === 'Cylindrical') {
    const diameter = cell.diameter_mm || cell.longueur_mm
    return `Diameter: ${diameter} mm × Height: ${cell.hauteur_mm} mm`
  }
  return `${cell.longueur_mm} × ${cell.largeur_mm} × ${cell.hauteur_mm} mm`
}

function CellSearchSelector({ cells, selectedId, onSelectCell }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef(null)

  const selectedCell = useMemo(
    () => cells.find(c => c.id === selectedId),
    [cells, selectedId]
  )

  const filteredCells = useMemo(() => {
    if (!searchTerm.trim()) return cells
    const term = searchTerm.toLowerCase()
    return cells.filter(c =>
      c.nom.toLowerCase().includes(term) ||
      c.type_cellule.toLowerCase().includes(term) ||
      (c.fabricant && c.fabricant.toLowerCase().includes(term)) ||
      (c.chimie && c.chimie.toLowerCase().includes(term))
    )
  }, [cells, searchTerm])

  const groupedCells = useMemo(() => {
    const groups = { Cylindrical: [], Prismatic: [], Pouch: [] }
    filteredCells.forEach(c => {
      const type = c.type_cellule || 'Other'
      if (!groups[type]) groups[type] = []
      groups[type].push(c)
    })
    return groups
  }, [filteredCells])

  const handleSelect = (cellId) => {
    onSelectCell(cellId)
    setSearchTerm('')
    setIsOpen(false)
  }

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value)
    if (!isOpen) setIsOpen(true)
  }

  const handleFocus = () => {
    setIsOpen(true)
  }

  const handleBlur = () => {
    // Delay blur to allow click on items
    setTimeout(() => {
      setIsOpen(false)
      // Clear search when closing
      setSearchTerm('')
    }, 150)
  }

  return (
    <div className="cell-search-wrapper">
      <label className="cell-dropdown-label">Search cell</label>
      <div className="cell-search-container">
        <input
          ref={inputRef}
          type="text"
          className="cell-search-input"
          placeholder={selectedCell ? selectedCell.nom : 'Type to search...'}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {isOpen && (
          <div className="cell-search-dropdown">
            {Object.entries(groupedCells).map(([type, typeCells]) => {
              if (typeCells.length === 0) return null
              return (
                <div key={type} className="cell-search-group">
                  <div className="cell-search-group-header">{type} ({typeCells.length})</div>
                  {typeCells.map(c => (
                    <div
                      key={c.id}
                      className={`cell-search-item ${c.id === selectedId ? 'selected' : ''}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelect(c.id)}
                    >
                      <span className="cell-search-name">
                        {c.nom}
                        {c.chimie && <span className="cell-chem-pill" data-chem={c.chimie}>{c.chimie}</span>}
                      </span>
                      {c.fabricant && <span className="cell-search-fabricant">{c.fabricant}</span>}
                      <span className="cell-search-specs">
                        {c.type_cellule === 'Cylindrical'
                          ? `${c.diameter_mm || c.longueur_mm}×${c.hauteur_mm}mm`
                          : `${c.longueur_mm}×${c.largeur_mm}×${c.hauteur_mm}mm`
                        }
                        {' | '}{c.capacite_ah}Ah
                      </span>
                    </div>
                  ))}
                </div>
              )
            })}
            {filteredCells.length === 0 && (
              <div className="cell-search-no-results">No cells found</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function BestMatches({ form, selectedId, onSelectCell }) {
  const [open, setOpen]       = useState(false)
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const fetchMatches = async () => {
    setLoading(true)
    setError(null)
    const toN = (v, fb = 0) => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? fb : n }
    const toOpt = (v) => { const n = parseFloat(String(v)); return isNaN(n) || v === '' ? undefined : n }
    try {
      const payload = {
        courant_cible_a:    toN(form.courant_cible_a, 100),
        energie_cible_wh:   toOpt(form.energie_cible_wh),
        tension_cible_v:    toOpt(form.tension_cible_v),
        housing_l:          toN(form.housing_l, 700),
        housing_l_small:    toN(form.housing_l_small, 300),
        housing_h:          toN(form.housing_h, 70),
        marge_mm:           toN(form.marge_mm, 15),
        cell_gap_mm:        toN(form.cell_gap_mm, 0),
        depth_of_discharge: toN(form.depth_of_discharge, 80),
        cycles_per_day:     toN(form.cycles_per_day, 1),
        config_mode:        form.config_mode || 'auto',
        ...(form.config_mode === 'manual' && {
          manual_series:   parseInt(form.manual_series)   || undefined,
          manual_parallel: parseInt(form.manual_parallel) || undefined,
        }),
      }
      // Remove undefined keys so Pydantic doesn't reject them
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])
      const { data } = await apiService.recommendCells(payload)
      setMatches(data.matches)
    } catch {
      setError('Recommendations unavailable')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = () => {
    if (!open) fetchMatches()
    setOpen(v => !v)
  }

  return (
    <div className="best-matches">
      <button className="best-matches__toggle" onClick={handleToggle} type="button">
        Best matches&nbsp;
        <span className="best-matches__caret">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="best-matches__list">
          {loading && <div className="best-matches__state">Loading…</div>}
          {error   && <div className="best-matches__state best-matches__state--err">{error}</div>}
          {!loading && !error && matches.length === 0 && (
            <div className="best-matches__state">No cells fit these constraints</div>
          )}
          {!loading && !error && matches.map((m, i) => {
            const isNear = m.near_miss
            const minMargin = Math.min(m.margin_l_mm, m.margin_w_mm, m.margin_h_mm)
            return (
              <div
                key={m.cell.id}
                className={[
                  'best-matches__item',
                  isNear ? 'best-matches__item--near' : '',
                  m.cell.id === selectedId ? 'best-matches__item--active' : '',
                ].join(' ').trim()}
                onClick={() => onSelectCell(m.cell.id)}
              >
                <div className="best-matches__row">
                  <span className="best-matches__rank">#{i + 1}</span>
                  <span className="best-matches__name">{m.cell.nom}</span>
                  {m.cell.chimie && (
                    <span className="cell-chem-pill" data-chem={m.cell.chimie}>{m.cell.chimie}</span>
                  )}
                  {isNear
                    ? <span className="best-matches__near-tag">near fit</span>
                    : <span className="best-matches__config">{m.nb_serie}S/{m.nb_parallele}P</span>
                  }
                </div>
                <div className="best-matches__bar-track">
                  <div
                    className={`best-matches__bar-fill${isNear ? ' best-matches__bar-fill--near' : ''}`}
                    style={{ width: `${Math.max(0, Math.min(100, m.fill_ratio_pct))}%` }}
                  />
                </div>
                <div className="best-matches__reason">
                  {isNear
                    ? `${m.nb_serie}S/${m.nb_parallele}P · Short by ${Math.abs(minMargin).toFixed(0)} mm`
                    : `Fill ${m.fill_ratio_pct.toFixed(1)}% · Margin L ${m.margin_l_mm.toFixed(0)} W ${m.margin_w_mm.toFixed(0)} H ${m.margin_h_mm.toFixed(0)} mm`
                  }
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function CellSelectorCard({
  cells,
  selectedId,
  onSelectCell,
  cell,
  masseKg,
  swellingLabel,
  onReloadCells,
  form,
}) {
  const fileInputRef = useRef(null)
  const [importing, setImporting] = useState(false)
  const [syncing, setSyncing]     = useState(false)
  const [syncMsg, setSyncMsg]     = useState(null)   // { ok: bool, text: string }
  const [hasSyncPath, setHasSyncPath] = useState(false)

  useEffect(() => {
    apiService.getImportConfig()
      .then(({ data }) => setHasSyncPath(!!data.source_path))
      .catch(() => {})
  }, [])

  const showMsg = (ok, text) => {
    setSyncMsg({ ok, text })
    setTimeout(() => setSyncMsg(null), 3500)
  }

  const handleImportClick = () => fileInputRef.current?.click()

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const sourcePath = window.electronAPI?.getFilePath?.(file) ?? null

    setImporting(true)
    try {
      const { data } = await apiService.importCells(file, sourcePath)
      if (sourcePath) setHasSyncPath(true)
      showMsg(true, `Imported ${data.imported} cells`)
      onReloadCells?.()
    } catch (err) {
      showMsg(false, err.response?.data?.detail ?? 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const { data } = await apiService.syncCells()
      showMsg(true, `Synced ${data.imported} cells`)
      onReloadCells?.()
    } catch (err) {
      showMsg(false, err.response?.data?.detail ?? 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  return (
      <div className="projects-card">
        <div className="projects-card__header">
          <span className="projects-card__label">Cell Selector</span>
        </div>

        {/* Best matches */}
        {form && (
          <BestMatches form={form} selectedId={selectedId} onSelectCell={onSelectCell} />
        )}

        {/* Search selector */}
        <CellSearchSelector
          cells={cells}
          selectedId={selectedId}
          onSelectCell={onSelectCell}
        />

        {/* Cell schematic */}
        <div className="projects-card__thumb" role="img" aria-label="Cell schematic">
          <CellSchematic cell={cell} />
        </div>

        {/* Spec badges */}
        <div className="cell-specs-wrapper">
          <div className="cell-specs-grid">
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
            <div className="cell-detail">
              <div className="cell-detail__header">
                <strong className="cell-detail__name">{cell.nom}</strong>
                <span className="cell-type-badge">{cell.type_cellule}</span>
                {cell.chimie && <span className="cell-chem-pill" data-chem={cell.chimie}>{cell.chimie}</span>}
              </div>
              {cell.fabricant && <div className="cell-detail__fabricant">{cell.fabricant}</div>}
              <dl className="cell-kv">
                <div className="cell-kv__row">
                  <dt>Chemistry</dt>
                  <dd>{cell.chimie ?? '—'}</dd>
                </div>
                <div className="cell-kv__row">
                  <dt>Dimensions</dt>
                  <dd>{formatDimensions(cell)}</dd>
                </div>
                <div className="cell-kv__row">
                  <dt>Swelling</dt>
                  <dd>{swellingLabel}</dd>
                </div>
                <div className="cell-kv__row">
                  <dt>Cycle life</dt>
                  <dd>
                    {cell.cycle_life
                      ? `${cell.cycle_life.toLocaleString()} cycles${cell.dod_reference_pct ? ` @ ${cell.dod_reference_pct}% DoD` : ''}`
                      : '—'}
                  </dd>
                </div>
                <div className="cell-kv__row">
                  <dt>Discharge</dt>
                  <dd>{cell.c_rate_max_discharge != null ? `${cell.c_rate_max_discharge}C max` : '—'}</dd>
                </div>
                <div className="cell-kv__row">
                  <dt>Charge</dt>
                  <dd>{cell.c_rate_max_charge != null ? `${cell.c_rate_max_charge}C max` : '—'}</dd>
                </div>
                <div className="cell-kv__row">
                  <dt>Cutoff V</dt>
                  <dd>{cell.cutoff_voltage_v != null ? `${cell.cutoff_voltage_v} V` : '—'}</dd>
                </div>
                <div className="cell-kv__row">
                  <dt>Temp range</dt>
                  <dd>
                    {cell.temp_min_c != null ? `${cell.temp_min_c} °C` : '—'}
                    {' → '}
                    {cell.temp_max_c != null ? `${cell.temp_max_c} °C` : '—'}
                  </dd>
                </div>
                <div className="cell-kv__row">
                  <dt>Max charge T</dt>
                  <dd>{cell.temp_max_charge_c != null ? `${cell.temp_max_charge_c} °C` : '—'}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
        {/* Import / Sync buttons */}
        <div className="db-action-buttons">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="modern-btn modern-btn-primary"
            style={{ width: '100%' }}
            onClick={handleImportClick}
            disabled={importing}
          >
            {importing ? 'Importing...' : 'Import'}
          </button>
          <button
            type="button"
            className="modern-btn modern-btn-secondary"
            style={{ width: '100%' }}
            onClick={handleSync}
            disabled={syncing || !hasSyncPath}
            title={!hasSyncPath ? 'Import a file first to enable Sync' : undefined}
          >
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
        </div>

        {syncMsg && (
          <div className={`db-sync-msg ${syncMsg.ok ? 'db-sync-msg--ok' : 'db-sync-msg--err'}`}>
            {syncMsg.ok ? '✓' : '✗'} {syncMsg.text}
          </div>
        )}

        <ul className="projects-list" role="list" />
      </div>
  )
}


export function AIFab({ result, cell, form }) {
  const [open, setOpen]     = useState(false)
  const [loading, setLoading] = useState(false)
  const [text, setText]     = useState(null)
  const [error, setError]   = useState(null)
  const fetchedForRef       = useRef(null)

  const resultKey = `${result?.nb_serie}-${result?.nb_parallele}-${cell?.id}-${result?.verdict}`

  const toNum = (v, fb = 0) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? fb : n }

  const fetchExplanation = async () => {
    if (fetchedForRef.current === resultKey) return
    setLoading(true)
    setText(null)
    setError(null)
    const payload = {
      cell_id:             cell.id,
      // constraints
      energie_cible_wh:    form.energie_cible_wh != null && form.energie_cible_wh !== '' ? toNum(form.energie_cible_wh) : undefined,
      tension_cible_v:     form.tension_cible_v  != null && form.tension_cible_v  !== '' ? toNum(form.tension_cible_v)  : undefined,
      courant_cible_a:     toNum(form.courant_cible_a),
      depth_of_discharge:  toNum(form.depth_of_discharge, 80),
      cycles_per_day:      toNum(form.cycles_per_day, 1),
      housing_l:           toNum(form.housing_l),
      housing_l_small:     toNum(form.housing_l_small),
      housing_h:           toNum(form.housing_h),
      // result
      nb_serie:            result.nb_serie,
      nb_parallele:        result.nb_parallele,
      verdict:             result.verdict,
      justification:       result.justification       ?? undefined,
      tension_totale_v:    result.tension_totale_v    ?? undefined,
      energie_reelle_wh:   result.energie_reelle_wh   ?? undefined,
      pack_l_mm:           result.dimensions_raw?.longueur_mm ?? undefined,
      pack_w_mm:           result.dimensions_raw?.largeur_mm  ?? undefined,
      pack_h_mm:           result.dimensions_raw?.hauteur_mm  ?? undefined,
      margin_l_mm:         result.marges_reelles?.L   ?? undefined,
      margin_w_mm:         result.marges_reelles?.W   ?? undefined,
      margin_h_mm:         result.marges_reelles?.H   ?? undefined,
      lifetime_years:      result.lifetime_years      ?? undefined,
      c_rate_actual:       result.c_rate_actual       ?? undefined,
      derating_factor_pct: result.derating_factor_pct ?? undefined,
      c_rate_warning:      result.c_rate_warning      ?? undefined,
    }
    try {
      const { data } = await apiService.explainResult(payload)
      setText(data.explanation)
      fetchedForRef.current = resultKey
    } catch (e) {
      const detail = e.response?.data?.detail ?? ''
      setError(detail.includes('rate-limited') ? 'AI models busy — try again shortly' : detail || 'AI analysis unavailable')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = () => {
    if (!open) fetchExplanation()
    setOpen(v => !v)
  }


  if (!result) return null

  return (
    <div className="ai-fab-wrapper">
      {open && (
        <div className="ai-fab-popover">
          <div className="ai-fab-popover__header">
            <span className="ai-fab-popover__badge">AI Analysis</span>
            <button className="ai-fab-popover__close" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="ai-fab-popover__body">
            {loading && (
              <div className="ai-fab-popover__skeleton">
                {[95, 88, 92, 70].map((w, i) => (
                  <div key={i} className="ai-fab-popover__skel-line" style={{ width: `${w}%` }} />
                ))}
              </div>
            )}
            {error && <p className="ai-fab-popover__error">{error}</p>}
            {text  && <p className="ai-fab-popover__text">{text}</p>}
          </div>
        </div>
      )}

      <button className={`ai-fab ${open ? 'ai-fab--open' : ''}`} onClick={handleToggle} title="AI Analysis">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
        </svg>
      </button>
    </div>
  )
}

export default function CellActionCard({ cell, calculating, onCalculate, calcError, form, result }) {
  const handleExportPdf = async () => {
    if (!result || !cell) {
      alert('Please calculate the configuration first')
      return
    }

    try {
      const toNum = (v, fb = 0) => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? fb : n }
      const payload = {
        cell_id:            cell.id,
        energie_cible_wh:   form.energie_cible_wh  != null && form.energie_cible_wh  !== '' ? toNum(form.energie_cible_wh)  : undefined,
        tension_cible_v:    form.tension_cible_v    != null && form.tension_cible_v    !== '' ? toNum(form.tension_cible_v)    : undefined,
        courant_cible_a:    toNum(form.courant_cible_a),
        housing_l:          toNum(form.housing_l),
        housing_l_small:    toNum(form.housing_l_small),
        housing_h:          toNum(form.housing_h),
        marge_mm:           toNum(form.marge_mm, 15),
        depth_of_discharge: toNum(form.depth_of_discharge, 80),
        cell_gap_mm:             toNum(form.cell_gap_mm, 0),
        end_plate_thickness_mm:  toNum(form.end_plate_thickness_mm, 10),
        cycles_per_day:          toNum(form.cycles_per_day, 1),
        config_mode:        form.config_mode,
        ...(form.config_mode === 'manual' && {
          manual_series:   parseInt(form.manual_series, 10) || undefined,
          manual_parallel: parseInt(form.manual_parallel, 10) || undefined,
        }),
      }

      const response = await apiService.generatePdf(payload)
      
      // Create a blob and download
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `battery_report_${new Date().toISOString().split('T')[0]}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (e) {
      console.error('PDF generation failed:', e)
      alert('Failed to generate PDF: ' + (e.response?.data?.detail || e.message))
    }
  }

  return (
    <div className="social-card">
      <div className="action-buttons">
        <button
          type="button"
          className="modern-btn modern-btn-primary"
          style={{ width: '100%' }}
          disabled={calculating || !cell}
          onClick={onCalculate}
        >
          {calculating
            ? <span className="calc-spinner-wrapper">
                <span className="calc-spinner" />
                Calculating…
              </span>
            : 'Calculate'
          }
        </button>
        {/* COMMENTED OUT FOR DEMO: PDF export button hidden for progress presentation */}
        {true && (
          <button
            type="button"
            className="modern-btn modern-btn-secondary"
            style={{ width: '100%' }}
            disabled={!result}
            onClick={handleExportPdf}
          >
            Export PDF
          </button>
        )}
      </div>

      {calcError && (
        <div className="error-box">⚠ {calcError}</div>
      )}

      {result && (
        <div className="verdict-block">
          <span className={`verdict-block__text verdict-block__text--${result.verdict === 'ACCEPT' ? 'accept' : 'reject'}`}>
            {result.verdict === 'ACCEPT' ? '✓ ACCEPT' : '✗ REJECT'}
          </span>
          {result.verdict !== 'ACCEPT' && result.justification && (
            <p className="verdict-block__reason">{result.justification}</p>
          )}
        </div>
      )}
    </div>
  )
}
