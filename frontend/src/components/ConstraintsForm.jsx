import React from 'react'
import { useT } from '../i18n'

function SectionLabel({ children }) {
  return <div className="section-label">{children}</div>
}

function InputRow({ label, unit, value, onChange, min = 0, step = 'any' }) {
  return (
    <div className="input-row">
      <label className="input-row__label">
        {label}
        {unit && <span className="input-row__unit">({unit})</span>}
      </label>
      <input
        type="number" min={min} step={step}
        className="modern-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ flex: 1 }}
      />
    </div>
  )
}

export default function ConstraintsForm({ form, onFieldChange, cell }) {
  const t = useT()
  const set = key => val => onFieldChange(key, val)
  const isPrismatic = !cell || (cell.type_cellule || '').toLowerCase() !== 'cylindrical'

  return (
    <div className="headline-card">
      <div className="constraints-body">
        <h2 className="constraints-title">{t('form.title')}</h2>

        <div>
          <SectionLabel>{t('form.electrical')}</SectionLabel>
          <div className="field-group">
            <InputRow label={t('form.energy')}   unit="Wh" value={form.energie_cible_wh}  onChange={set('energie_cible_wh')} min={1} />
            <InputRow label={t('form.voltage')}  unit="V"   value={form.tension_cible_v}   onChange={set('tension_cible_v')}   min={0.001} />
            <InputRow label={t('form.current')}  unit="A"   value={form.courant_cible_a}   onChange={set('courant_cible_a')}   min={0.001} />
            <InputRow label={t('form.dod')}      unit="%"   value={form.depth_of_discharge} onChange={set('depth_of_discharge')} min={1} step={1} />
          </div>
        </div>

        <div>
          <SectionLabel>{t('form.housing')}</SectionLabel>
          <div className="field-group">
            <InputRow label={t('form.length_L')}    unit="mm" value={form.housing_l}       onChange={set('housing_l')}       min={1} />
            <InputRow label={t('form.width_l')}     unit="mm" value={form.housing_l_small} onChange={set('housing_l_small')} min={1} />
            <InputRow label={t('form.height_h')}    unit="mm" value={form.housing_h}       onChange={set('housing_h')}       min={1} />
            <InputRow label={t('form.margin')}      unit="mm" value={form.marge_mm}        onChange={set('marge_mm')}        min={0} />
            <InputRow label={t('form.cell_gap')}    unit="mm" value={form.cell_gap_mm}     onChange={set('cell_gap_mm')}     min={0} step={0.1} />
            {isPrismatic && <>
              <InputRow label={t('form.end_plate')}    unit="mm" value={form.end_plate_thickness_mm} onChange={set('end_plate_thickness_mm')} min={0} step={1} />
              <InputRow label={t('form.busbar_width')} unit="mm" value={form.busbar_thickness_mm}   onChange={set('busbar_thickness_mm')}    min={0} step={1} />
            </>}
          </div>
        </div>

        <div>
          <SectionLabel>{t('form.config_mode')}</SectionLabel>
          <div className="mode-toggle" style={{ marginBottom: form.config_mode === 'manual' ? 10 : 0 }}>
            {['auto', 'manual'].map(mode => (
              <button
                key={mode}
                type="button"
                className={`mode-toggle__btn ${form.config_mode === mode ? 'mode-toggle__btn--active' : 'mode-toggle__btn--inactive'}`}
                onClick={() => set('config_mode')(mode)}
              >
                {mode === 'auto' ? t('form.mode_auto') : t('form.mode_manual')}
              </button>
            ))}
          </div>
          {form.config_mode === 'manual' && (
            <div className="field-group">
              <InputRow label={t('form.series')}   value={form.manual_series}   onChange={set('manual_series')}   min={1} step={1} />
              <InputRow label={t('form.parallel')} value={form.manual_parallel} onChange={set('manual_parallel')} min={1} step={1} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
