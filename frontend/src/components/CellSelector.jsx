import React, { useState, useMemo, useRef } from 'react'
import { apiService } from '../services/api'

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
    if (!searchTerm.trim()) return cells // Show all cells when no search
    const term = searchTerm.toLowerCase()
    return cells.filter(c =>
      c.nom.toLowerCase().includes(term) ||
      c.type_cellule.toLowerCase().includes(term)
    ) // Show all matching results
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
                      onMouseDown={(e) => e.preventDefault()} // Prevent blur before click
                      onClick={() => handleSelect(c.id)}
                    >
                      <span className="cell-search-name">{c.nom}</span>
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

        {/* Search selector */}
        <CellSearchSelector
          cells={cells}
          selectedId={selectedId}
          onSelectCell={onSelectCell}
        />

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
              <div>{formatDimensions(cell)}</div>
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
    </div>
  )
}
