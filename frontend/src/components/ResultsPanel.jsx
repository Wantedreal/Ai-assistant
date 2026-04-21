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


function BMSCard({ result }) {
  const voltageRange = result?.bms_v_min_pack != null && result?.bms_v_max_pack != null
    ? `${result.bms_v_min_pack.toFixed(1)} V → ${result.bms_v_max_pack.toFixed(1)} V`
    : '—'

  const chargeLabel = result?.bms_i_charge_a != null
    ? `${result.bms_i_charge_a.toFixed(1)} A${result.bms_i_charge_estimated ? ' (est.)' : ''}`
    : '—'

  const chargeTempLabel = result?.bms_charge_cutoff_temp_c != null
    ? `${result.bms_charge_cutoff_temp_c} °C`
    : '—'

  const dischargeTempLabel = result?.bms_discharge_cutoff_temp_c != null
    ? `${result.bms_discharge_cutoff_temp_c} °C`
    : '— (no cell data)'

  return (
    <div className="perf-card">
      <div className="results-header">
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
          <line x1="12" y1="12" x2="12" y2="16" />
          <line x1="10" y1="14" x2="14" y2="14" />
        </svg>
        BMS Specification
      </div>

      {result ? (
        <div className="results-scroll-area">
          <ResultRow label="Voltage range"     value={voltageRange} highlight />
          <ResultRow label="Cont. discharge"   value={fmt(result.bms_i_continuous_a, 'A', 1)} />
          <ResultRow label="Max charge"        value={chargeLabel} />
          <ResultRow label="Balance channels"  value={result.bms_balance_channels ?? '—'} />
          <ResultRow label="Balance current"   value={fmt(result.bms_balance_current_a, 'A', 3)} />
          <ResultRow label="Temp sensors"      value={result.bms_temp_sensors ?? '—'} />
          <ResultRow label="Charge cutoff"     value={chargeTempLabel} />
          <ResultRow label="Discharge cutoff"  value={dischargeTempLabel} />
          <ResultRow label="Suggested BMS"     value={result.bms_suggestion ?? '—'} last />
        </div>
      ) : (
        <div className="results-placeholder">
          Results will appear after calculation
        </div>
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
            <ResultRow label="Final L"       value={fmt(result.dimensions_array.longueur_mm, 'mm')} highlight />
            <ResultRow label="Final W"       value={fmt(result.dimensions_array.largeur_mm,  'mm')} highlight />
            <ResultRow label="Final H"       value={fmt(result.dimensions_array.hauteur_mm,  'mm')} highlight />
            <ResultRow label="Margin L"      value={fmt(result.marges_reelles?.L, 'mm')} />
            <ResultRow label="Margin W"      value={fmt(result.marges_reelles?.W, 'mm')} />
            <ResultRow label="Margin H"      value={fmt(result.marges_reelles?.H, 'mm')} />
            <ResultRow label="Fill ratio"    value={fmt(result.taux_occupation_pct, '%', 1)} last />
          </div>
        ) : (
          <div className="results-placeholder">
            Results will appear after calculation
          </div>
        )}
      </div>

      {/* BMS Specification */}
      <BMSCard result={result} />

    </div>
  )
}
