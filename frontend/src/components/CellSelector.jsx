import React from 'react'
import { apiService } from '../services/api'

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

export default function CellActionCard({ cell, calculating, onCalculate, calcError, form, result }) {
  const handleExportPdf = async () => {
    if (!result || !cell) {
      alert('Please calculate the configuration first')
      return
    }

    try {
      const payload = {
        cell_id: cell.id,
        energie_cible_wh: form.energie_cible_wh,
        tension_cible_v: form.tension_cible_v,
        courant_cible_a: form.courant_cible_a,
        housing_l: form.housing_l,
        housing_l_small: form.housing_l_small,
        housing_h: form.housing_h,
        marge_mm: form.marge_mm,
        depth_of_discharge: form.depth_of_discharge,
        config_mode: form.config_mode,
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
        <button
          type="button"
          className="modern-btn modern-btn-secondary"
          style={{ width: '100%' }}
          disabled={!result}
          onClick={handleExportPdf}
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
