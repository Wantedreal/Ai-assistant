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

function VerdictBadge({ verdict, justification }) {
  if (!verdict) return null
  const ok = verdict === 'ACCEPT'
  const mod = ok ? 'accept' : 'reject'

  return (
    <div className={`verdict-badge verdict-badge--${mod}`}>
      <div className={`verdict-badge__header verdict-badge__header--${mod}`}>
        <span style={{ fontSize: '1rem' }}>{ok ? '✓' : '✗'}</span>
        <span className={`verdict-badge__text verdict-badge__text--${mod}`}>
          {verdict}
        </span>
      </div>
      {!ok && (
        <div className="verdict-badge__detail">{justification}</div>
      )}
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
          <>
            <ResultRow label="Configuration"  value={`${result.nb_serie}S / ${result.nb_parallele}P`} highlight />
            <ResultRow label="Pack voltage"   value={fmt(result.tension_totale_v, 'V')} />
            <ResultRow label="Pack current"   value={fmt(result.courant_total_a, 'A')} />
            <ResultRow label="Capacity"       value={fmt(result.electrical.actual_capacity_ah, 'Ah')} />
            <ResultRow label="Usable energy"  value={fmt(result.electrical.usable_energy_wh, 'Wh')} last />
            <VerdictBadge verdict={result.verdict} justification={result.justification} />

            {result.validation_errors?.length > 0 && (
              <div className="validation-errors" style={{ marginTop: 12 }}>
                {result.validation_errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
              </div>
            )}
          </>
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
          <>
            <ResultRow label="Final L"             value={fmt(result.dimensions_array.longueur_mm, 'mm')} highlight />
            <ResultRow label="Final W"             value={fmt(result.dimensions_array.largeur_mm,  'mm')} highlight />
            <ResultRow label="Final H"             value={fmt(result.dimensions_array.hauteur_mm,  'mm')} highlight />
            <ResultRow label="Raw L (no margin)"   value={fmt(result.dimensions_raw.longueur_mm,   'mm')} />
            <ResultRow label="Margin / face"       value={fmt(margeMm, 'mm', 0)} last />

            {/* validation_errors are also displayed in Electrical Results */}
          </>
        ) : (
          <div className="results-placeholder">
            Results will appear after calculation
          </div>
        )}
      </div>

    </div>
  )
}
