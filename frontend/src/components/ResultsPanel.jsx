import React from 'react'
import { useT } from '../i18n'

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
  const t = useT()
  return (
    <div className="bottom-row">

      {/* Electrical */}
      <div className="bio-card">
        <div className="results-header">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          {t('results.electrical')}
        </div>

        {result ? (
          <div className="results-scroll-area">
            <ResultRow label={t('results.config')}        value={`${result.nb_serie}S / ${result.nb_parallele}P`} highlight />
            <ResultRow label={t('results.total_cells')}   value={result.total_cells} />
            <ResultRow label={t('results.pack_voltage')}  value={fmt(result.tension_totale_v, 'V')} />
            <ResultRow label={t('results.pack_current')}  value={fmt(result.courant_total_a, 'A', 1)} />
            <ResultRow label={t('results.usable_energy')} value={fmt(result.electrical?.usable_energy_wh, 'Wh', 1)} />
            <ResultRow label={t('results.total_weight')}  value={fmt(result.electrical?.total_weight_kg, 'kg', 2)} last />
          </div>
        ) : (
          <div className="results-placeholder">
            {t('results.placeholder_elec')}
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
          {t('results.mechanical')}
        </div>

        {result ? (
          <div className="results-scroll-area">
            <ResultRow label={t('results.final_L')} value={fmt(result.dimensions_raw.longueur_mm, 'mm')} highlight />
            <ResultRow label={t('results.final_W')} value={fmt(result.dimensions_raw.largeur_mm,  'mm')} highlight />
            <ResultRow label={t('results.final_H')} value={fmt(result.dimensions_raw.hauteur_mm,  'mm')} highlight />
            <ResultRow label={t('results.margin_L')} value={fmt(result.marges_reelles?.L, 'mm')} />
            <ResultRow label={t('results.margin_W')} value={fmt(result.marges_reelles?.W, 'mm')} />
            <ResultRow label={t('results.margin_H')} value={fmt(result.marges_reelles?.H, 'mm')} last />
          </div>
        ) : (
          <div className="results-placeholder">
            {t('results.placeholder_mech')}
          </div>
        )}
      </div>

    </div>
  )
}
