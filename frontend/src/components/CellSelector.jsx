import React from 'react'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v, unit = '', d = 2) =>
  v != null ? `${Number(v).toFixed(d)} ${unit}`.trim() : '—'

export function CellSelectorCard({
  cells,
  selectedId,
  onSelectCell,
  cell,
  masseKg,
  swellingLabel,
}) {
  return (
      <div className="projects-card">
        <div className="projects-card__header">
          <span className="projects-card__label">Cell Selector</span>
        </div>

        {/* Dropdown */}
        <div className="cell-dropdown-wrapper">
          <label className="cell-dropdown-label">Select cell</label>
          <select
            className="modern-select"
            value={selectedId ?? ''}
            onChange={e => onSelectCell(parseInt(e.target.value, 10))}
          >
            {cells.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>

        {/* Cell thumbnail */}
        <div className="projects-card__thumb" role="img" aria-label="Cell preview">
          <img src="/images/Projectscard.png" alt="Cell" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
              <div>
                <strong className="cell-detail__name">{cell.nom}</strong>
                {' '}
                <span className="cell-type-badge">{cell.type_cellule}</span>
              </div>
              <div>{cell.longueur_mm} × {cell.largeur_mm} × {cell.hauteur_mm} mm</div>
              <div>Swelling: {swellingLabel}</div>
            </div>
          )}
        </div>
        <ul className="projects-list" role="list" />
      </div>
  )
}

export default function CellActionCard({ cell, calculating, onCalculate, calcError }) {
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
        <div className="error-box">⚠ {calcError}</div>
      )}
    </div>
  )
}
