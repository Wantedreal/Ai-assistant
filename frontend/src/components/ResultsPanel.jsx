import React from 'react'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v, unit = '', d = 2) =>
  v != null ? `${Number(v).toFixed(d)} ${unit}`.trim() : '—'

function ResultRow({ label, value, highlight = false, last = false }) {
  return (
    <div className={`result-row ${last ? 'result-row--last' : ''}`}>
      <span className="result-row__label">{label}</span>
      <span className={`result-row__value ${highlight ? 'result-row__value--highlight' : ''}`}>
        {value}
      </span>
    </div>
  )
}


export default function ResultsPanel({ result, margeMm }) {
  return (
    <div className="bottom-row">

      {/* Electrical */}
      <div className="bio-card">
        <div className="results-header">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          Electrical Results
        </div>

        {result ? (
          <div className="results-scroll-area">
            <ResultRow label="Configuration"   value={`${result.nb_serie}S / ${result.nb_parallele}P`} highlight />
            <ResultRow label="Total cells"     value={result.total_cells} />
            <ResultRow label="Pack voltage"    value={fmt(result.tension_totale_v, 'V')} />
            <ResultRow label="Pack current"    value={fmt(result.courant_total_a, 'A', 1)} />
            <ResultRow label="Usable energy"   value={fmt(result.electrical?.usable_energy_wh, 'Wh', 1)} />
            <ResultRow label="Total weight"    value={fmt(result.electrical?.total_weight_kg, 'kg', 2)} last />
          </div>
        ) : (
          <div className="results-placeholder">
            Set constraints and click Calculate
          </div>
        )}
      </div>

      {/* Mechanical */}
      <div className="contact-card">
        <div className="results-header">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
          Mechanical Results
        </div>

        {result ? (
          <div className="results-scroll-area">
            <ResultRow label="Final L"       value={fmt(result.dimensions_raw.longueur_mm, 'mm')} highlight />
            <ResultRow label="Final W"       value={fmt(result.dimensions_raw.largeur_mm,  'mm')} highlight />
            <ResultRow label="Final H"       value={fmt(result.dimensions_raw.hauteur_mm,  'mm')} highlight />
            <ResultRow label="Margin L"      value={fmt(result.marges_reelles?.L, 'mm')} />
            <ResultRow label="Margin W"      value={fmt(result.marges_reelles?.W, 'mm')} />
            <ResultRow label="Margin H"      value={fmt(result.marges_reelles?.H, 'mm')} last />
          </div>
        ) : (
          <div className="results-placeholder">
            Results will appear after calculation
          </div>
        )}
      </div>

    </div>
  )
}
