import React, { useState, useMemo } from 'react'
import AddCellModal from './AddCellModal'
import { useT } from '../i18n'

const CHEM_COLORS = {
  NMC: '#3b82f6', LFP: '#22c55e', NCA: '#f59e0b',
  LTO: '#8b5cf6', LCO: '#ef4444',
}

const TYPE_ICONS = { Cylindrical: '⬤', Prismatic: '▬', Pouch: '▭' }

function fmt(v, unit = '', d = 1) {
  return v != null ? `${Number(v).toFixed(d)} ${unit}`.trim() : '—'
}

function ChemBadge({ chem }) {
  if (!chem) return null
  const color = CHEM_COLORS[chem] ?? '#64748b'
  return (
    <span style={{
      display: 'inline-block', borderRadius: 3,
      padding: '1px 6px', fontSize: '0.65rem', fontWeight: 700,
      background: color + '28', color,
    }}>{chem}</span>
  )
}

export default function CataloguePanel({ cells, onClose, onSelectCell, onReloadCells }) {
  const t = useT()
  const [search, setSearch]       = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [addOpen, setAddOpen]     = useState(false)
  const [sortKey, setSortKey]     = useState('nom')
  const [sortAsc, setSortAsc]     = useState(true)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return cells.filter(c => {
      if (typeFilter !== 'All' && c.type_cellule !== typeFilter) return false
      if (!q) return true
      return (
        c.nom.toLowerCase().includes(q) ||
        (c.fabricant ?? '').toLowerCase().includes(q) ||
        (c.chimie ?? '').toLowerCase().includes(q) ||
        c.type_cellule.toLowerCase().includes(q)
      )
    })
  }, [cells, search, typeFilter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = a[sortKey] ?? ''
      const vb = b[sortKey] ?? ''
      if (typeof va === 'string') {
        return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      return sortAsc ? (va - vb) : (vb - va)
    })
  }, [filtered, sortKey, sortAsc])

  const handleSort = (key) => {
    if (key === sortKey) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(true) }
  }

  const handleSelect = (cell) => {
    onSelectCell?.(cell.id)
    onClose()
  }

  const counts = useMemo(() => ({
    All: cells.length,
    Cylindrical: cells.filter(c => c.type_cellule === 'Cylindrical').length,
    Prismatic:   cells.filter(c => c.type_cellule === 'Prismatic').length,
    Pouch:       cells.filter(c => c.type_cellule === 'Pouch').length,
  }), [cells])

  const SortArrow = ({ col }) => {
    if (sortKey !== col) return <span style={{ opacity: 0.25, marginLeft: 4 }}>↕</span>
    return <span style={{ marginLeft: 4, color: '#3b82f6' }}>{sortAsc ? '↑' : '↓'}</span>
  }

  const TH = ({ col, label, style = {} }) => (
    <th
      onClick={() => handleSort(col)}
      style={{
        padding: '10px 12px', textAlign: 'left',
        color: sortKey === col ? '#93c5fd' : '#64748b',
        fontWeight: 600, fontSize: '0.72rem',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        borderBottom: '1px solid #2a2c33', cursor: 'pointer',
        userSelect: 'none', whiteSpace: 'nowrap', background: '#151720',
        ...style,
      }}
    >
      {label}<SortArrow col={col} />
    </th>
  )

  return (
    <>
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.72)',
        zIndex: 3000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '32px 20px', overflowY: 'auto',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: '#1a1c23',
        border: '1px solid #2a2c33',
        borderRadius: 14,
        width: '100%', maxWidth: 980,
        boxShadow: '0 32px 80px rgba(0,0,0,0.65)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '86vh', overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '18px 20px 14px',
          borderBottom: '1px solid #2a2c33', flexShrink: 0,
        }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9' }}>
              {t('catalogue.title')}
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: '#475569' }}>
              {filtered.length} / {cells.length} {t('catalogue.cells')} — {t('catalogue.hint')}
            </p>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', width: 220 }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              autoFocus
              type="text"
              placeholder={t('catalogue.search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#0f1117', border: '1px solid #2a2c33',
                borderRadius: 7, padding: '8px 10px 8px 32px',
                color: '#e2e8f0', fontSize: '0.82rem', outline: 'none',
              }}
            />
          </div>

          {/* Add Cell button */}
          <button
            onClick={() => setAddOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px',
              background: 'linear-gradient(135deg,#0070AD,#005A8A)',
              color: '#fff', border: 'none', borderRadius: 7,
              fontWeight: 700, fontSize: '0.82rem',
              cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0,112,173,0.3)',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {t('catalogue.add')}
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#475569',
              fontSize: '1.1rem', cursor: 'pointer', padding: '4px 8px',
              borderRadius: 4, lineHeight: 1, transition: 'color 0.15s',
            }}
          >✕</button>
        </div>

        {/* ── Type filter pills ── */}
        <div style={{
          display: 'flex', gap: 6, padding: '10px 20px',
          borderBottom: '1px solid #1e2130', flexShrink: 0, flexWrap: 'wrap',
        }}>
          {[
            { key: 'All',        label: t('catalogue.filter.all') },
            { key: 'Prismatic',  label: t('catalogue.filter.prismatic') },
            { key: 'Cylindrical',label: t('catalogue.filter.cylindrical') },
            { key: 'Pouch',      label: t('catalogue.filter.pouch') },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTypeFilter(key)}
              style={{
                padding: '4px 12px', borderRadius: 20, border: 'none',
                background: typeFilter === key ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                color: typeFilter === key ? '#fff' : '#64748b',
                fontSize: '0.75rem', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {label} <span style={{ opacity: 0.7 }}>({counts[key]})</span>
            </button>
          ))}
        </div>

        {/* ── Table ── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.80rem' }}>
            <thead>
              <tr>
                <TH col="nom"              label={t('catalogue.col.name')}      style={{ paddingLeft: 20 }} />
                <TH col="type_cellule"     label={t('catalogue.col.type')}      />
                <TH col="chimie"           label={t('catalogue.col.chemistry')} />
                <TH col="fabricant"        label={t('catalogue.col.maker')}     />
                <TH col="tension_nominale" label={t('catalogue.col.voltage')}   />
                <TH col="capacite_ah"      label={t('catalogue.col.capacity')}  />
                <TH col="courant_max_a"    label={t('catalogue.col.max_a')}     />
                <TH col="masse_g"          label={t('catalogue.col.mass')}      />
                <TH col="cycle_life"       label={t('catalogue.col.cycles')}    />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#475569', fontSize: '0.82rem' }}>
                    {t('catalogue.no_match')}
                  </td>
                </tr>
              )}
              {sorted.map((c, i) => (
                <tr
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  style={{
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'}
                >
                  <td style={{ padding: '9px 12px 9px 20px', color: '#e2e8f0', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {c.nom}
                  </td>
                  <td style={{ padding: '9px 12px', color: '#94a3b8', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ marginRight: 5, opacity: 0.7 }}>{TYPE_ICONS[c.type_cellule]}</span>
                    {c.type_cellule}
                  </td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <ChemBadge chem={c.chimie} />
                  </td>
                  <td style={{ padding: '9px 12px', color: '#64748b', fontSize: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {c.fabricant ?? '—'}
                  </td>
                  <td style={{ padding: '9px 12px', color: '#cbd5e1', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {fmt(c.tension_nominale, 'V', 2)}
                  </td>
                  <td style={{ padding: '9px 12px', color: '#cbd5e1', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {fmt(c.capacite_ah, 'Ah', 1)}
                  </td>
                  <td style={{ padding: '9px 12px', color: '#cbd5e1', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {fmt(c.courant_max_a, 'A', 0)}
                  </td>
                  <td style={{ padding: '9px 12px', color: '#94a3b8', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {c.masse_g != null ? c.masse_g : '—'}
                  </td>
                  <td style={{ padding: '9px 12px 9px 12px', color: '#64748b', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {c.cycle_life ? c.cycle_life.toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px', borderTop: '1px solid #2a2c33',
          flexShrink: 0, background: '#151720',
        }}>
          <span style={{ color: '#475569', fontSize: '0.75rem' }}>
            {t('catalogue.showing')} {sorted.length} {t('catalogue.cells')}
          </span>
        </div>
      </div>
    </div>

    {addOpen && (
      <AddCellModal
        onClose={() => setAddOpen(false)}
        onAdded={() => { onReloadCells?.(); setAddOpen(false) }}
        onReloadCells={onReloadCells}
      />
    )}
    </>
  )
}
