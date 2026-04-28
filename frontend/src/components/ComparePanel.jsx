import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useT } from '../i18n'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v, unit = '', d = 2) =>
  v != null ? `${Number(v).toFixed(d)} ${unit}`.trim() : '—'

const CHEM_COLORS = {
  NMC: '#3b82f6', LFP: '#22c55e', NCA: '#f59e0b',
  LTO: '#8b5cf6', LCO: '#ef4444',
}
const chemColor = (c) => CHEM_COLORS[c] ?? '#64748b'

// ─── Spec row definitions (labels resolved at render time via t()) ────────────
// Each entry: key, labelKey (resolved via t()), extract fn, optional num fn, compare
const SPEC_DEFS = [
  { key: 'type',           labelKey: 'spec.type',         extract: c => c.type_cellule,        compare: null },
  { key: 'chimie',         labelKey: 'spec.chimie',        extract: c => c.chimie ?? '—',       compare: null },
  { key: 'fabricant',      labelKey: 'spec.fabricant',     extract: c => c.fabricant ?? '—',    compare: null },
  { key: 'tension',        labelKey: 'spec.tension',       extract: c => fmt(c.tension_nominale, 'V'),        num: c => c.tension_nominale,          compare: null },
  { key: 'capacite',       labelKey: 'spec.capacite',      extract: c => fmt(c.capacite_ah, 'Ah'),            num: c => c.capacite_ah,               compare: 'higher' },
  { key: 'courant_max',    labelKey: 'spec.courant_max',   extract: c => fmt(c.courant_max_a, 'A', 0),        num: c => c.courant_max_a,             compare: 'higher' },
  {
    key: 'dimensions', labelKey: 'spec.dimensions', compare: null,
    extract: c => c.type_cellule === 'Cylindrical'
      ? `⌀${c.diameter_mm ?? c.longueur_mm} × ${c.hauteur_mm} mm`
      : `${c.longueur_mm} × ${c.largeur_mm} × ${c.hauteur_mm} mm`,
  },
  { key: 'masse',          labelKey: 'spec.masse',         extract: c => fmt(c.masse_g, 'g', 0),              num: c => c.masse_g,                   compare: 'lower' },
  { key: 'energie_mass',   labelKey: 'spec.energie_mass',  extract: c => c.energie_massique_wh_kg != null ? fmt(c.energie_massique_wh_kg, 'Wh/kg', 0) : '—', num: c => c.energie_massique_wh_kg,  compare: 'higher' },
  { key: 'energie_vol',    labelKey: 'spec.energie_vol',   extract: c => c.energie_volumique_wh_l  != null ? fmt(c.energie_volumique_wh_l,  'Wh/L',  0) : '—', num: c => c.energie_volumique_wh_l,  compare: 'higher' },
  { key: 'cycle_life',     labelKey: 'spec.cycle_life',    extract: c => c.cycle_life != null ? `${c.cycle_life} cycles` : '—',            num: c => c.cycle_life,                compare: 'higher' },
  { key: 'dod',            labelKey: 'spec.dod',           extract: c => c.dod_reference_pct != null ? `${c.dod_reference_pct} %` : '—',  num: c => c.dod_reference_pct,         compare: null },
  { key: 'c_discharge',    labelKey: 'spec.c_discharge',   extract: c => c.c_rate_max_discharge != null ? `${c.c_rate_max_discharge} C` : '—', num: c => c.c_rate_max_discharge,  compare: 'higher' },
  { key: 'c_charge',       labelKey: 'spec.c_charge',      extract: c => c.c_rate_max_charge    != null ? `${c.c_rate_max_charge} C` : '—',    num: c => c.c_rate_max_charge,     compare: 'higher' },
  { key: 'cutoff',         labelKey: 'spec.cutoff',        extract: c => c.cutoff_voltage_v != null ? fmt(c.cutoff_voltage_v, 'V') : '—', compare: null },
  {
    key: 'temp_range', labelKey: 'spec.temp_range', compare: null,
    extract: c => c.temp_min_c != null && c.temp_max_c != null ? `${c.temp_min_c} → ${c.temp_max_c} °C` : '—',
  },
  {
    key: 'swelling', labelKey: 'spec.swelling', compare: null,
    extract: c => {
      if (c.taux_swelling_pct == null) return '—'
      const pct = c.taux_swelling_pct > 1 ? c.taux_swelling_pct : c.taux_swelling_pct * 100
      return `${pct.toFixed(1)} %`
    },
  },
]

// ─── Single cell slot ─────────────────────────────────────────────────────────
function CellSlot({ index, cells, cellId, onSelect, onClear }) {
  const t = useT()
  const [search, setSearch] = useState('')
  const [open, setOpen]     = useState(false)

  const selected = useMemo(() => cells.find(c => c.id === cellId), [cells, cellId])

  const filtered = useMemo(() => {
    if (!search.trim()) return cells
    const q = search.toLowerCase()
    return cells.filter(c =>
      c.nom.toLowerCase().includes(q) ||
      (c.fabricant ?? '').toLowerCase().includes(q) ||
      (c.chimie ?? '').toLowerCase().includes(q) ||
      c.type_cellule.toLowerCase().includes(q)
    )
  }, [cells, search])

  const handleBlur = () => setTimeout(() => { setOpen(false); setSearch('') }, 150)

  if (selected) {
    return (
      <div style={slotStyles.selected}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={slotStyles.cellName}>{selected.nom}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              {selected.chimie && (
                <span style={{ ...slotStyles.badge, background: chemColor(selected.chimie) + '33', color: chemColor(selected.chimie) }}>
                  {selected.chimie}
                </span>
              )}
              <span style={slotStyles.dim}>{selected.type_cellule}</span>
            </div>
            {selected.fabricant && (
              <div style={slotStyles.muted}>{selected.fabricant}</div>
            )}
          </div>
          <button style={slotStyles.clearBtn} onClick={onClear} title="Remove">✕</button>
        </div>
      </div>
    )
  }

  return (
    <div style={slotStyles.empty}>
      <div style={slotStyles.slotLabel}>{t('compare.slot')} {index + 1}</div>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          placeholder={t('compare.search')}
          style={slotStyles.input}
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
        />
        {open && (
          <div style={slotStyles.dropdown}>
            {filtered.length === 0 && (
              <div style={slotStyles.dropdownEmpty}>{t('compare.no_results')}</div>
            )}
            {filtered.map(c => (
              <div
                key={c.id}
                style={slotStyles.dropdownItem}
                onMouseDown={() => { onSelect(c.id); setOpen(false); setSearch('') }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{c.nom}</span>
                {c.chimie && (
                  <span style={{ ...slotStyles.badge, background: chemColor(c.chimie) + '22', color: chemColor(c.chimie), marginLeft: 6 }}>
                    {c.chimie}
                  </span>
                )}
                <span style={{ ...slotStyles.muted, marginLeft: 'auto', fontSize: '0.7rem' }}>{c.type_cellule}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export default function ComparePanel({ cells, onClose }) {
  const t = useT()
  const MAX_SLOTS = 3
  const [slotIds, setSlotIds] = useState([null, null, null])

  const selectedCells = useMemo(
    () => slotIds.map(id => cells.find(c => c.id === id) ?? null),
    [slotIds, cells]
  )

  const filledCells = selectedCells.filter(Boolean)
  const canCompare  = filledCells.length >= 2

  // Per-spec winner index among filled cells
  const winners = useMemo(() => {
    if (filledCells.length < 2) return {}
    const map = {}
    SPEC_DEFS.forEach(s => {
      if (!s.compare || !s.num) return
      const nums = selectedCells.map(c => c ? s.num(c) : null)
      const valid = nums.filter(n => n != null)
      if (valid.length < 2) return
      const best = s.compare === 'higher' ? Math.max(...valid) : Math.min(...valid)
      const idx  = nums.findIndex(n => n === best)
      if (idx !== -1) map[s.key] = idx
    })
    return map
  }, [selectedCells, filledCells.length])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div style={panelStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={panelStyles.modal}>

        {/* Header */}
        <div style={panelStyles.header}>
          <div>
            <h2 style={panelStyles.title}>{t('compare.title')}</h2>
            <p style={panelStyles.subtitle}>{t('compare.subtitle')}</p>
          </div>
          <button style={panelStyles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Cell slots */}
        <div style={panelStyles.slotsRow}>
          {slotIds.map((id, i) => (
            <CellSlot
              key={i}
              index={i}
              cells={cells}
              cellId={id}
              onSelect={cid => setSlotIds(prev => {
                const next = [...prev]; next[i] = cid; return next
              })}
              onClear={() => setSlotIds(prev => {
                const next = [...prev]; next[i] = null; return next
              })}
            />
          ))}
        </div>

        {/* Hint when < 2 cells */}
        {!canCompare && (
          <div style={panelStyles.hint}>
            {t('compare.hint')}
          </div>
        )}

        {/* Comparison table — shown immediately when 2+ cells selected */}
        {canCompare && (
          <div style={panelStyles.tableWrap}>
            <table style={panelStyles.table}>
              <thead>
                <tr>
                  <th style={{ ...panelStyles.th, ...panelStyles.rowHeader }}></th>
                  {selectedCells.map((c, i) => {
                    if (!c) {
                      return (
                        <th key={i} style={panelStyles.th}>
                          <div style={{ color: '#475569', fontStyle: 'italic', fontSize: '0.8rem' }}>—</div>
                        </th>
                      )
                    }
                    return (
                      <th key={i} style={panelStyles.th}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#e2e8f0' }}>{c.nom}</div>
                        {c.chimie && (
                          <span style={{ ...panelStyles.chemBadge, background: chemColor(c.chimie) + '33', color: chemColor(c.chimie) }}>
                            {c.chimie}
                          </span>
                        )}
                        {c.fabricant && (
                          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2 }}>{c.fabricant}</div>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {SPEC_DEFS.map((s, si) => (
                  <tr key={s.key} style={{ background: si % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                    <td style={{ ...panelStyles.td, ...panelStyles.rowHeader }}>{t(s.labelKey)}</td>
                    {selectedCells.map((c, i) => {
                      if (!c) return <td key={i} style={panelStyles.td}>—</td>
                      const isWinner = winners[s.key] === i
                      const val = s.extract(c)
                      return (
                        <td
                          key={i}
                          style={{
                            ...panelStyles.td,
                            ...(isWinner ? panelStyles.winner : {}),
                            fontWeight: isWinner ? 700 : 400,
                          }}
                        >
                          {val}
                          {isWinner && <span style={panelStyles.winnerDot} title="Best">●</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const panelStyles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.7)',
    zIndex: 10000,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '40px 20px',
    overflowY: 'auto',
  },
  modal: {
    background: '#1a1c23',
    border: '1px solid #2a2c33',
    borderRadius: 12,
    width: '100%',
    maxWidth: 900,
    boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '24px 24px 16px',
    borderBottom: '1px solid #2a2c33',
  },
  title: { margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#f1f5f9' },
  subtitle: { margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' },
  closeBtn: {
    background: 'none', border: 'none', color: '#64748b',
    fontSize: '1.1rem', cursor: 'pointer', padding: '4px 8px',
    borderRadius: 4, lineHeight: 1,
  },
  slotsRow: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16, padding: '20px 24px',
  },
  hint: {
    textAlign: 'center', padding: '24px',
    color: '#475569', fontSize: '0.85rem',
    borderTop: '1px solid #2a2c33',
  },
  tableWrap: {
    overflowX: 'auto',
    padding: '0 24px 24px',
    borderTop: '1px solid #2a2c33',
  },
  table: {
    width: '100%', borderCollapse: 'collapse',
    fontSize: '0.82rem', color: '#cbd5e1',
    marginTop: 16,
  },
  th: {
    padding: '10px 14px',
    borderBottom: '1px solid #2a2c33',
    textAlign: 'left', color: '#94a3b8',
    fontWeight: 600, fontSize: '0.78rem',
    verticalAlign: 'top',
  },
  td: {
    padding: '9px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    color: '#cbd5e1', verticalAlign: 'middle',
  },
  rowHeader: {
    color: '#64748b', fontWeight: 600,
    fontSize: '0.75rem', textTransform: 'uppercase',
    letterSpacing: '0.05em', whiteSpace: 'nowrap',
    width: 160, minWidth: 160,
  },
  winner: {
    color: '#4ade80',
    background: 'rgba(74,222,128,0.06)',
  },
  winnerDot: {
    fontSize: '0.5rem', marginLeft: 5,
    verticalAlign: 'middle', color: '#4ade80',
  },
  chemBadge: {
    display: 'inline-block', borderRadius: 4,
    padding: '1px 6px', fontSize: '0.68rem',
    fontWeight: 700, marginTop: 3,
  },
}

const slotStyles = {
  empty: {
    border: '1px dashed #2a2c33',
    borderRadius: 8, padding: '12px',
    background: 'rgba(255,255,255,0.02)',
    minHeight: 90,
  },
  selected: {
    border: '1px solid #3b82f6',
    borderRadius: 8, padding: '12px',
    background: 'rgba(59,130,246,0.06)',
    minHeight: 90,
  },
  slotLabel: {
    fontSize: '0.68rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.07em',
    color: '#475569', marginBottom: 8,
  },
  cellName: { fontSize: '0.85rem', fontWeight: 700, color: '#e2e8f0' },
  badge: {
    display: 'inline-block', borderRadius: 4,
    padding: '1px 6px', fontSize: '0.68rem', fontWeight: 700,
  },
  dim: { fontSize: '0.7rem', color: '#475569' },
  muted: { fontSize: '0.72rem', color: '#475569', marginTop: 3 },
  clearBtn: {
    background: 'none', border: 'none', color: '#475569',
    cursor: 'pointer', padding: '2px 4px', fontSize: '0.8rem',
    borderRadius: 4, lineHeight: 1, flexShrink: 0,
  },
  input: {
    width: '100%', boxSizing: 'border-box',
    background: '#0f1117', border: '1px solid #2a2c33',
    borderRadius: 6, padding: '8px 10px',
    color: '#e2e8f0', fontSize: '0.82rem',
    outline: 'none',
  },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0,
    background: '#1e2130', border: '1px solid #2a2c33',
    borderRadius: 6, zIndex: 100,
    maxHeight: 220, overflowY: 'auto',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    marginTop: 2,
  },
  dropdownItem: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap',
    padding: '8px 10px', cursor: 'pointer', color: '#cbd5e1',
    transition: 'background 0.1s',
    gap: 4,
  },
  dropdownEmpty: { padding: '10px 12px', color: '#475569', fontSize: '0.8rem' },
}
