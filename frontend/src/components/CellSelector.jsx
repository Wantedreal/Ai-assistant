import React, { useState, useMemo, useRef, useEffect } from 'react'
import { apiService } from '../services/api'
import CellSchematic from './CellSchematic'
import { useT, useLang } from '../i18n'

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
  const t = useT()
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
      <label className="cell-dropdown-label">{t('cell.search_label')}</label>
      <div className="cell-search-container">
        <input
          ref={inputRef}
          type="text"
          className="cell-search-input"
          placeholder={selectedCell ? selectedCell.nom : t('cell.search_placeholder')}
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
              <div className="cell-search-no-results">{t('cell.no_results')}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function BestMatches({ form, selectedId, onSelectCell }) {
  const t = useT()
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
        {t('cell.best_matches')}&nbsp;
        <span className="best-matches__caret">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="best-matches__list">
          {loading && <div className="best-matches__state">{t('cell.bm_loading')}</div>}
          {error   && <div className="best-matches__state best-matches__state--err">{t('cell.bm_error')}</div>}
          {!loading && !error && matches.length === 0 && (
            <div className="best-matches__state">{t('cell.bm_empty')}</div>
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
                    ? <span className="best-matches__near-tag">{t('cell.bm_near')}</span>
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
                    ? `${m.nb_serie}S/${m.nb_parallele}P · ${t('cell.bm_short')} ${Math.abs(minMargin).toFixed(0)} mm`
                    : `${t('cell.bm_fill')} ${m.fill_ratio_pct.toFixed(1)}% · ${t('cell.bm_margin')} L ${m.margin_l_mm.toFixed(0)} W ${m.margin_w_mm.toFixed(0)} H ${m.margin_h_mm.toFixed(0)} mm`
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
  const t = useT()
  const fileInputRef = useRef(null)
  const [importing, setImporting] = useState(false)
  const [syncing, setSyncing]         = useState(false)
  const [syncMsg, setSyncMsg]         = useState(null)
  const [hasSyncPath, setHasSyncPath] = useState(false)
  const [pendingPath, setPendingPath] = useState('')     // shown after import when path not auto-saved
  const [savingPath, setSavingPath]   = useState(false)
  const [pathError, setPathError]     = useState(null)

  const refreshSyncPath = () =>
    apiService.getImportConfig()
      .then(({ data }) => { setHasSyncPath(!!data.source_path); return !!data.source_path })
      .catch(() => false)

  useEffect(() => { refreshSyncPath() }, [])

  const showMsg = (ok, text) => {
    setSyncMsg({ ok, text })
    setTimeout(() => setSyncMsg(null), 3500)
  }

  const handleImportClick = () => fileInputRef.current?.click()

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    // file.path works in Electron ≤28; webUtils.getPathForFile works in Electron ≥29
    const electronPath = file.path || window.electronAPI?.getFilePath?.(file) || null

    setImporting(true)
    setPendingPath('')
    setPathError(null)
    try {
      const { data } = await apiService.importCells(file, electronPath)
      showMsg(true, `Imported ${data.imported} cells`)
      onReloadCells?.()
      const saved = await refreshSyncPath()
      // If path wasn't auto-saved (pure browser, no file.path), prompt user
      if (!saved) setPendingPath(file.name)
    } catch (err) {
      showMsg(false, err.response?.data?.detail ?? 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const handleSavePath = async () => {
    const p = pendingPath.trim()
    if (!p) return
    setSavingPath(true)
    setPathError(null)
    try {
      await apiService.setImportConfig(p)
      await refreshSyncPath()
      setPendingPath('')
    } catch (e) {
      setPathError(e?.response?.data?.detail ?? 'Invalid path')
    } finally {
      setSavingPath(false)
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
          <span className="projects-card__label">{t('cell.title')}</span>
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
              <span className="spec-badge__label">{t('cell.weight')}</span>
              <span className="spec-badge__value">{masseKg} kg</span>
            </div>
            <div className="spec-badge">
              <span className="spec-badge__label">{t('cell.capacity')}</span>
              <span className="spec-badge__value">{fmt(cell?.capacite_ah, 'Ah', 1)}</span>
            </div>
            <div className="spec-badge">
              <span className="spec-badge__label">{t('cell.max_current')}</span>
              <span className="spec-badge__value">{fmt(cell?.courant_max_a, 'A', 1)}</span>
            </div>
            <div className="spec-badge">
              <span className="spec-badge__label">{t('cell.voltage')}</span>
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
                  <dt>{t('cell.chemistry')}</dt>
                  <dd>{cell.chimie ?? '—'}</dd>
                </div>
                <div className="cell-kv__row">
                  <dt>{t('cell.dimensions')}</dt>
                  <dd>{formatDimensions(cell)}</dd>
                </div>
                <div className="cell-kv__row">
                  <dt>{t('cell.swelling')}</dt>
                  <dd>{swellingLabel}</dd>
                </div>
                <div className="cell-kv__row">
                  <dt>{t('cell.cycle_life')}</dt>
                  <dd>
                    {cell.cycle_life
                      ? `${cell.cycle_life.toLocaleString()} cycles${cell.dod_reference_pct ? ` @ ${cell.dod_reference_pct}% DoD` : ''}`
                      : '—'}
                  </dd>
                </div>
                <div className="cell-kv__row">
                  <dt>{t('cell.discharge')}</dt>
                  <dd>{cell.c_rate_max_discharge != null ? `${cell.c_rate_max_discharge}C max` : '—'}</dd>
                </div>
                <div className="cell-kv__row">
                  <dt>{t('cell.charge')}</dt>
                  <dd>{cell.c_rate_max_charge != null ? `${cell.c_rate_max_charge}C max` : '—'}</dd>
                </div>
                <div className="cell-kv__row">
                  <dt>{t('cell.cutoff_v')}</dt>
                  <dd>{cell.cutoff_voltage_v != null ? `${cell.cutoff_voltage_v} V` : '—'}</dd>
                </div>
                <div className="cell-kv__row">
                  <dt>{t('cell.temp_range')}</dt>
                  <dd>
                    {cell.temp_min_c != null ? `${cell.temp_min_c} °C` : '—'}
                    {' → '}
                    {cell.temp_max_c != null ? `${cell.temp_max_c} °C` : '—'}
                  </dd>
                </div>
                <div className="cell-kv__row">
                  <dt>{t('cell.max_charge_t')}</dt>
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
            {importing ? t('btn.importing') : t('btn.import')}
          </button>
          <button
            type="button"
            className="modern-btn modern-btn-secondary"
            style={{ width: '100%' }}
            onClick={handleSync}
            disabled={syncing || !hasSyncPath}
            title={!hasSyncPath ? 'Import a file first to enable Sync' : undefined}
          >
            {syncing ? t('btn.syncing') : t('btn.sync')}
          </button>
        </div>

        {syncMsg && (
          <div className={`db-sync-msg ${syncMsg.ok ? 'db-sync-msg--ok' : 'db-sync-msg--err'}`}>
            {syncMsg.ok ? '✓' : '✗'} {syncMsg.text}
          </div>
        )}

        {/* Shown after import when path wasn't auto-saved (browser mode) */}
        {pendingPath && (
          <div style={{
            marginTop: 8, padding: '8px 10px',
            background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)',
            borderRadius: 6, fontSize: '0.78rem', color: '#fbbf24',
          }}>
            <div style={{ marginBottom: 6, lineHeight: 1.4 }}>
              Enter the full path to <strong>{pendingPath}</strong> to enable Sync:
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={pendingPath}
                onChange={e => { setPendingPath(e.target.value); setPathError(null) }}
                onKeyDown={e => e.key === 'Enter' && handleSavePath()}
                placeholder="C:\path\to\battery_cells.xlsx"
                style={{
                  flex: 1, fontSize: '0.75rem', padding: '4px 8px',
                  background: '#0f111a', border: '1px solid #374151',
                  borderRadius: 4, color: '#e2e8f0', outline: 'none',
                }}
              />
              <button
                type="button"
                className="modern-btn modern-btn-primary"
                style={{ padding: '4px 10px', fontSize: '0.75rem', height: 'auto' }}
                onClick={handleSavePath}
                disabled={savingPath}
              >
                {savingPath ? '…' : 'Save'}
              </button>
            </div>
            {pathError && <div style={{ color: '#f87171', marginTop: 4 }}>{pathError}</div>}
          </div>
        )}

        <ul className="projects-list" role="list" />
      </div>
  )
}


export default function CellActionCard({ cell, calculating, onCalculate, calcError, form, result, onOpenAddCell }) {
  const t = useT()
  const { lang } = useLang()
  const handleExportPdf = async () => {
    if (!result || !cell) {
      alert('Please calculate the configuration first')
      return
    }

    try {
      const toNum = (v, fb = 0) => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? fb : n }
      const payload = {
        cell_id:            cell.id,
        lang,
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
      const safeName = (cell.nom || 'cell').replace(/[^a-zA-Z0-9_\-]/g, '_')
      link.setAttribute('download', `${safeName}_report.pdf`)
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
                {t('btn.calculating')}
              </span>
            : t('btn.calculate')
          }
        </button>
        <button
          type="button"
          className="modern-btn modern-btn-secondary"
          style={{ width: '100%' }}
          disabled={!result}
          onClick={handleExportPdf}
        >
          {t('btn.export_pdf')}
        </button>
      </div>

      {calcError && (
        <div className="error-box">⚠ {calcError}</div>
      )}

      {result && (
        <div className="verdict-block">
          <span className={`verdict-block__text verdict-block__text--${result.verdict === 'ACCEPT' ? 'accept' : 'reject'}`}>
            {result.verdict === 'ACCEPT' ? t('verdict.accept') : t('verdict.reject')}
          </span>
          {result.verdict !== 'ACCEPT' && result.justification && (
            <p className="verdict-block__reason">{result.justification}</p>
          )}
        </div>
      )}

    </div>
  )
}
