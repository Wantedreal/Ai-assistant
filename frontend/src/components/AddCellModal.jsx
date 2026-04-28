import React, { useState, useEffect, useRef } from 'react'
import { apiService } from '../services/api'
import { useT } from '../i18n'

const CELL_TYPES  = ['Prismatic', 'Cylindrical', 'Pouch']
const CHEMISTRIES = ['NMC', 'LFP', 'NCA', 'LTO', 'LCO']

const SWELLING_DEFAULTS = { NMC: 8, LFP: 3, NCA: 8, LTO: 1, LCO: 5 }

const EMPTY = {
  nom: '', type_cellule: 'Prismatic', chimie: '', fabricant: '',
  tension_nominale: '', capacite_ah: '', courant_max_a: '',
  longueur_mm: '', largeur_mm: '', hauteur_mm: '', diameter_mm: '',
  masse_g: '', taux_swelling_pct: '8',
  cycle_life: '', dod_reference_pct: '',
  c_rate_max_discharge: '', c_rate_max_charge: '',
  eol_capacity_pct: '', cutoff_voltage_v: '',
  temp_min_c: '', temp_max_c: '', temp_max_charge_c: '', v_charge_max: '',
}

function Field({ label, required, children, hint }) {
  return (
    <div className="add-cell__field">
      <label className="add-cell__label">
        {label}
        {required && <span className="add-cell__req" aria-label="required"> *</span>}
      </label>
      {children}
      {hint && <span className="add-cell__hint">{hint}</span>}
    </div>
  )
}

export default function AddCellModal({ onClose, onAdded, onReloadCells }) {
  const t = useT()
  const [form, setForm]         = useState(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)
  const [excelWarn, setExcelWarn] = useState(null)
  const [showOptional, setShowOptional] = useState(false)
  const [sourcePath, setSourcePath]     = useState(undefined)  // undefined = loading, null = none
  const [importing, setImporting]   = useState(false)
  const [pendingPath, setPendingPath] = useState('')
  const [savingPath, setSavingPath] = useState(false)
  const [pathError, setPathError]   = useState(null)
  const fileInputRef = useRef(null)

  const loadPath = () =>
    apiService.getImportConfig()
      .then(r => { setSourcePath(r.data.source_path || null); return !!r.data.source_path })
      .catch(() => { setSourcePath(null); return false })

  useEffect(() => { loadPath() }, [])

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setPendingPath('')
    setPathError(null)
    try {
      // file.path works in Electron ≤28; webUtils.getPathForFile works in Electron ≥29
      const electronPath = file.path || window.electronAPI?.getFilePath?.(file) || null
      await apiService.importCells(file, electronPath)
      onReloadCells?.()
      const saved = await loadPath()
      if (!saved) setPendingPath(file.name)
    } catch (err) {
      await loadPath()
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const handleSavePath = async () => {
    const p = pendingPath.trim()
    if (!p) return
    setSavingPath(true)
    setPathError(null)
    try {
      await apiService.setImportConfig(p)
      await loadPath()
      setPendingPath('')
    } catch (e) {
      setPathError(e?.response?.data?.detail ?? 'Invalid path')
    } finally {
      setSavingPath(false)
    }
  }

  const isCyl = form.type_cellule === 'Cylindrical'

  const set = (key, val) => {
    setForm(f => {
      const next = { ...f, [key]: val }
      // Auto-fill swelling when chemistry changes
      if (key === 'chimie' && SWELLING_DEFAULTS[val] != null) {
        next.taux_swelling_pct = String(SWELLING_DEFAULTS[val])
      }
      // For cylindrical, mirror diameter to longueur + largeur
      if (key === 'diameter_mm') {
        next.longueur_mm = val
        next.largeur_mm  = val
      }
      return next
    })
  }

  const toNum  = (v) => { const n = parseFloat(v); return isNaN(n) ? undefined : n }
  const toInt  = (v) => { const n = parseInt(v, 10); return isNaN(n) ? undefined : n }

  const validate = () => {
    const req = ['nom', 'type_cellule', 'tension_nominale', 'capacite_ah',
                 'courant_max_a', 'masse_g', 'hauteur_mm', 'taux_swelling_pct']
    if (isCyl) req.push('diameter_mm')
    else req.push('longueur_mm', 'largeur_mm')
    for (const k of req) {
      if (form[k] == null || String(form[k]).trim() === '') return `"${k}" is required`
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setError(null)
    setSaving(true)
    try {
      const payload = {
        nom:               form.nom.trim(),
        type_cellule:      form.type_cellule,
        tension_nominale:  toNum(form.tension_nominale),
        capacite_ah:       toNum(form.capacite_ah),
        courant_max_a:     toNum(form.courant_max_a),
        longueur_mm:       toNum(isCyl ? form.diameter_mm : form.longueur_mm),
        largeur_mm:        toNum(isCyl ? form.diameter_mm : form.largeur_mm),
        hauteur_mm:        toNum(form.hauteur_mm),
        masse_g:           toNum(form.masse_g),
        taux_swelling_pct: toNum(form.taux_swelling_pct) ?? 8,
        diameter_mm:       isCyl ? toNum(form.diameter_mm) : undefined,
        fabricant:         form.fabricant.trim() || undefined,
        chimie:            form.chimie || undefined,
        cycle_life:        toInt(form.cycle_life),
        dod_reference_pct: toNum(form.dod_reference_pct),
        c_rate_max_discharge: toNum(form.c_rate_max_discharge),
        c_rate_max_charge:    toNum(form.c_rate_max_charge),
        eol_capacity_pct:     toNum(form.eol_capacity_pct),
        cutoff_voltage_v:     toNum(form.cutoff_voltage_v),
        temp_min_c:           toNum(form.temp_min_c),
        temp_max_c:           toNum(form.temp_max_c),
        temp_max_charge_c:    toNum(form.temp_max_charge_c),
        v_charge_max:         toNum(form.v_charge_max),
      }
      const { data } = await apiService.addCell(payload)
      onAdded?.(data)
      if (!data.excel_updated && data.excel_warning) {
        // Cell saved to DB; Excel couldn't be updated — show amber warning, keep modal open
        setExcelWarn(data.excel_warning)
        setSaving(false)
        return
      }
      onClose()
    } catch (e) {
      setError(e?.response?.data?.detail ?? e.message ?? 'Failed to add cell')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="add-cell-modal" role="dialog" aria-modal="true" aria-label="Add cell">
        <div className="add-cell-modal__header">
          <h2 className="add-cell-modal__title">{t('add_cell.title')}</h2>
          <button className="add-cell-modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ── Excel sync status banner ── */}
        {sourcePath === undefined ? null : sourcePath ? (
          <div style={bannerStyle.ok}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontWeight: 600 }}>{t('add_cell.sync_ok')} </span>
              <span style={{ wordBreak: 'break-all', opacity: 0.85 }}>{sourcePath}</span>
            </div>
          </div>
        ) : (
          <div style={bannerStyle.warn}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 600 }}>{t('add_cell.sync_warn')}</span>
              {' '}{t('add_cell.sync_warn2')}
              <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="C:\path\to\battery_cells.xlsx"
                  value={pendingPath}
                  onChange={e => { setPendingPath(e.target.value); setPathError(null) }}
                  style={{
                    flex: 1, fontSize: '0.75rem', padding: '4px 8px',
                    background: '#0f111a', border: '1px solid #374151',
                    borderRadius: 4, color: '#e2e8f0', outline: 'none',
                  }}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSavePath())}
                />
                <button
                  type="button"
                  disabled={savingPath || !pendingPath.trim()}
                  onClick={handleSavePath}
                  style={{ ...bannerStyle.linkBtn, flexShrink: 0 }}
                >
                  {savingPath ? '…' : t('add_cell.sync_save')}
                </button>
              </div>
              {pathError && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: 4 }}>{pathError}</div>}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
            <button
              type="button"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
              style={{ ...bannerStyle.linkBtn, flexShrink: 0, alignSelf: 'flex-start' }}
            >
              {importing ? t('add_cell.importing') : t('add_cell.import_file')}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="add-cell-modal__body" noValidate>

          {/* ── Required section ── */}
          <div className="add-cell__section-label">{t('add_cell.required')}</div>

          <div className="add-cell__row">
            <Field label={t('add_cell.f.name')} required>
              <input
                className="add-cell__input"
                placeholder="e.g. SVOLT-135Ah"
                value={form.nom}
                onChange={e => set('nom', e.target.value)}
                autoFocus
              />
            </Field>
            <Field label={t('add_cell.f.type')} required>
              <select className="add-cell__input" value={form.type_cellule} onChange={e => set('type_cellule', e.target.value)}>
                {CELL_TYPES.map(ct => <option key={ct} value={ct}>{ct}</option>)}
              </select>
            </Field>
          </div>

          <div className="add-cell__row">
            <Field label={t('add_cell.f.voltage')} required>
              <input type="number" step="0.01" className="add-cell__input" placeholder="3.6"
                value={form.tension_nominale} onChange={e => set('tension_nominale', e.target.value)} />
            </Field>
            <Field label={t('add_cell.f.capacity')} required>
              <input type="number" step="0.1" className="add-cell__input" placeholder="100"
                value={form.capacite_ah} onChange={e => set('capacite_ah', e.target.value)} />
            </Field>
            <Field label={t('add_cell.f.max_current')} required>
              <input type="number" step="0.1" className="add-cell__input" placeholder="300"
                value={form.courant_max_a} onChange={e => set('courant_max_a', e.target.value)} />
            </Field>
          </div>

          {isCyl ? (
            <div className="add-cell__row">
              <Field label={t('add_cell.f.diameter')} required hint={t('add_cell.f.diameter_hint')}>
                <input type="number" step="0.1" className="add-cell__input" placeholder="21"
                  value={form.diameter_mm} onChange={e => set('diameter_mm', e.target.value)} />
              </Field>
              <Field label={t('add_cell.f.height')} required>
                <input type="number" step="0.1" className="add-cell__input" placeholder="70"
                  value={form.hauteur_mm} onChange={e => set('hauteur_mm', e.target.value)} />
              </Field>
            </div>
          ) : (
            <div className="add-cell__row">
              <Field label={t('add_cell.f.length')} required hint={t('add_cell.f.length_hint')}>
                <input type="number" step="0.1" className="add-cell__input" placeholder="102"
                  value={form.longueur_mm} onChange={e => set('longueur_mm', e.target.value)} />
              </Field>
              <Field label={t('add_cell.f.width')} required hint={t('add_cell.f.width_hint')}>
                <input type="number" step="0.1" className="add-cell__input" placeholder="210"
                  value={form.largeur_mm} onChange={e => set('largeur_mm', e.target.value)} />
              </Field>
              <Field label={t('add_cell.f.height')} required hint={t('add_cell.f.height_hint')}>
                <input type="number" step="0.1" className="add-cell__input" placeholder="174"
                  value={form.hauteur_mm} onChange={e => set('hauteur_mm', e.target.value)} />
              </Field>
            </div>
          )}

          <div className="add-cell__row">
            <Field label={t('add_cell.f.mass')} required>
              <input type="number" step="0.1" className="add-cell__input" placeholder="2250"
                value={form.masse_g} onChange={e => set('masse_g', e.target.value)} />
            </Field>
            <Field label={t('add_cell.f.swelling')} required hint={t('add_cell.f.swelling_hint')}>
              <input type="number" step="0.1" className="add-cell__input" placeholder="8"
                value={form.taux_swelling_pct} onChange={e => set('taux_swelling_pct', e.target.value)} />
            </Field>
          </div>

          {/* ── Optional section ── */}
          <button
            type="button"
            className="add-cell__optional-toggle"
            onClick={() => setShowOptional(o => !o)}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ transform: showOptional ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
            {showOptional ? t('add_cell.hide_opt') : t('add_cell.show_opt')}
          </button>

          {showOptional && (
            <>
              <div className="add-cell__section-label" style={{ marginTop: 8 }}>{t('add_cell.optional')}</div>

              <div className="add-cell__row">
                <Field label={t('add_cell.f.maker')}>
                  <input className="add-cell__input" placeholder="CATL"
                    value={form.fabricant} onChange={e => set('fabricant', e.target.value)} />
                </Field>
                <Field label={t('add_cell.f.chemistry')}>
                  <select className="add-cell__input" value={form.chimie} onChange={e => set('chimie', e.target.value)}>
                    <option value="">— Unknown —</option>
                    {CHEMISTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>

              <div className="add-cell__row">
                <Field label={t('add_cell.f.cycle_life')}>
                  <input type="number" className="add-cell__input" placeholder="3000"
                    value={form.cycle_life} onChange={e => set('cycle_life', e.target.value)} />
                </Field>
                <Field label={t('add_cell.f.dod')}>
                  <input type="number" step="1" className="add-cell__input" placeholder="80"
                    value={form.dod_reference_pct} onChange={e => set('dod_reference_pct', e.target.value)} />
                </Field>
                <Field label={t('add_cell.f.eol')}>
                  <input type="number" step="1" className="add-cell__input" placeholder="80"
                    value={form.eol_capacity_pct} onChange={e => set('eol_capacity_pct', e.target.value)} />
                </Field>
              </div>

              <div className="add-cell__row">
                <Field label={t('add_cell.f.c_discharge')}>
                  <input type="number" step="0.1" className="add-cell__input" placeholder="3"
                    value={form.c_rate_max_discharge} onChange={e => set('c_rate_max_discharge', e.target.value)} />
                </Field>
                <Field label={t('add_cell.f.c_charge')}>
                  <input type="number" step="0.1" className="add-cell__input" placeholder="1"
                    value={form.c_rate_max_charge} onChange={e => set('c_rate_max_charge', e.target.value)} />
                </Field>
                <Field label={t('add_cell.f.cutoff')}>
                  <input type="number" step="0.01" className="add-cell__input" placeholder="2.5"
                    value={form.cutoff_voltage_v} onChange={e => set('cutoff_voltage_v', e.target.value)} />
                </Field>
              </div>

              <div className="add-cell__row">
                <Field label={t('add_cell.f.temp_min')}>
                  <input type="number" className="add-cell__input" placeholder="-20"
                    value={form.temp_min_c} onChange={e => set('temp_min_c', e.target.value)} />
                </Field>
                <Field label={t('add_cell.f.temp_max')}>
                  <input type="number" className="add-cell__input" placeholder="60"
                    value={form.temp_max_c} onChange={e => set('temp_max_c', e.target.value)} />
                </Field>
                <Field label={t('add_cell.f.temp_charge')}>
                  <input type="number" className="add-cell__input" placeholder="45"
                    value={form.temp_max_charge_c} onChange={e => set('temp_max_charge_c', e.target.value)} />
                </Field>
              </div>

              <div className="add-cell__row">
                <Field label={t('add_cell.f.v_charge')}>
                  <input type="number" step="0.01" className="add-cell__input" placeholder="3.65"
                    value={form.v_charge_max} onChange={e => set('v_charge_max', e.target.value)} />
                </Field>
              </div>
            </>
          )}

          {error && <div className="add-cell__error">⚠ {error}</div>}

          {excelWarn && (
            <div style={{
              background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.35)',
              borderRadius: 6, padding: '8px 12px', fontSize: '0.8rem',
              color: '#fbbf24', lineHeight: 1.5,
            }}>
              <strong>Cell saved.</strong> {excelWarn}
            </div>
          )}

          <div className="add-cell-modal__footer">
            <button type="button" className="add-cell__btn add-cell__btn--cancel" onClick={onClose}>
              {t('add_cell.cancel')}
            </button>
            {!excelWarn && (
              <button type="submit" className="add-cell__btn add-cell__btn--save" disabled={saving}>
                {saving ? t('add_cell.saving') : t('add_cell.save')}
              </button>
            )}
            {excelWarn && (
              <button type="button" className="add-cell__btn add-cell__btn--save" onClick={onClose}>
                {t('add_cell.cancel')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

const bannerStyle = {
  ok: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    margin: '0 0 0 0',
    padding: '10px 20px',
    background: 'rgba(34,197,94,0.08)',
    borderBottom: '1px solid rgba(34,197,94,0.18)',
    color: '#86efac',
    fontSize: '0.78rem',
    lineHeight: 1.5,
  },
  warn: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    padding: '10px 20px',
    background: 'rgba(245,158,11,0.08)',
    borderBottom: '1px solid rgba(245,158,11,0.18)',
    color: '#fcd34d',
    fontSize: '0.78rem',
    lineHeight: 1.5,
  },
  linkBtn: {
    background: 'rgba(245,158,11,0.15)',
    border: '1px solid rgba(245,158,11,0.35)',
    borderRadius: 4,
    color: '#fcd34d',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '3px 10px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
}
