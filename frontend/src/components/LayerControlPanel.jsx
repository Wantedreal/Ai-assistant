import React from 'react'
import { useT } from '../i18n'

const LAYER_GROUPS = [
  {
    categoryKey: 'layer.cat.structure',
    items: [
      { name: 'housing',       labelKey: 'layer.housing',       types: ['cylindrical', 'prismatic', 'pouch'] },
      { name: 'dimensions',    labelKey: 'layer.dimensions',    types: ['cylindrical', 'prismatic', 'pouch'] },
      { name: 'end_plates',    labelKey: 'layer.end_plates',    types: ['prismatic', 'pouch'] },
      { name: 'side_supports', labelKey: 'layer.side_supports', types: ['prismatic', 'pouch'] },
      { name: 'brackets',      labelKey: 'layer.brackets',      types: ['cylindrical'] },
    ],
  },
  {
    categoryKey: 'layer.cat.electrical',
    items: [
      { name: 'cells',     labelKey: 'layer.cells',     types: ['cylindrical', 'prismatic', 'pouch'] },
      { name: 'terminals', labelKey: 'layer.terminals', types: ['cylindrical', 'prismatic', 'pouch'] },
      { name: 'busbars',   labelKey: 'layer.busbars',   types: ['cylindrical', 'prismatic', 'pouch'] },
    ],
  },
  {
    categoryKey: 'layer.cat.insulation',
    items: [
      { name: 'separator_cards', labelKey: 'layer.separator_cards', types: ['prismatic', 'pouch'] },
    ],
  },
]

const btnStyle = (bg) => ({
  flex: 1, padding: '4px 0', borderRadius: 4, border: 'none',
  backgroundColor: bg, color: '#fff', fontSize: '0.7rem',
  cursor: 'pointer', fontWeight: 600,
})

const sectionLabel = {
  fontSize: '0.62rem', color: '#475569',
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
}

export default function LayerControlPanel({ layers, onToggle, cellType, cellGap, onCellGapChange, endPlateThickness, onEndPlateChange, busbarHeight, onBusbarHeightChange }) {
  const t = useT()
  const type = (cellType || '').toLowerCase()
  const allNames = Object.keys(layers)
  const isPrismatic = type !== 'cylindrical'

  const hasSettings = onCellGapChange || (isPrismatic && onEndPlateChange)

  return (
    <div style={{
      position: 'absolute', top: 16, right: 16,
      backgroundColor: 'rgba(10, 12, 20, 0.88)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      color: '#e2e8f0',
      fontSize: '0.75rem',
      minWidth: 185,
      maxHeight: 'calc(100% - 32px)',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
      zIndex: 10,
    }}>

      {/* ── Scrollable layer-toggle list ──────────────────────────────────────── */}
      <div style={{ padding: '12px 14px 8px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
        <div style={{
          fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
          marginBottom: 10, opacity: 0.7, fontSize: '0.7rem',
        }}>
          {t('layer.title')}
        </div>

        {LAYER_GROUPS.map(group => {
          const visibleItems = group.items.filter(i => i.types.includes(type))
          if (visibleItems.length === 0) return null
          return (
            <div key={group.categoryKey} style={{ marginBottom: 8 }}>
              <div style={{
                fontSize: '0.62rem', color: '#475569',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
              }}>
                {t(group.categoryKey)}
              </div>
              {visibleItems.map(item => {
                const checked = layers[item.name] !== false
                return (
                  <label key={item.name} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    cursor: 'pointer', padding: '3px 0',
                  }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => onToggle(item.name, e.target.checked)}
                      style={{ accentColor: '#3b82f6', cursor: 'pointer', width: 13, height: 13 }}
                    />
                    <span style={{ opacity: checked ? 1 : 0.45 }}>{t(item.labelKey)}</span>
                  </label>
                )
              })}
            </div>
          )
        })}

        <div style={{
          display: 'flex', gap: 6, marginTop: 8,
          borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8,
        }}>
          <button onClick={() => allNames.forEach(n => onToggle(n, true))}  style={btnStyle('#3b82f6')}>{t('layer.show_all')}</button>
          <button onClick={() => allNames.forEach(n => onToggle(n, false))} style={btnStyle('#374151')}>{t('layer.hide_all')}</button>
        </div>
      </div>

      {/* ── Fixed settings section — always visible at the bottom ─────────────── */}
      {hasSettings && (
        <div style={{
          padding: '10px 14px 12px',
          borderTop: '1px solid rgba(255,255,255,0.12)',
          flexShrink: 0,
        }}>
          <div style={sectionLabel}>{t('layer.settings')}</div>

          {onCellGapChange && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>{t('layer.cell_gap')}</span>
                <span style={{ color: '#3b82f6', fontWeight: 600 }}>{cellGap.toFixed(1)} mm</span>
              </div>
              <input type="range" min="0" max="5" step="0.1" value={cellGap}
                onChange={e => onCellGapChange(parseFloat(e.target.value))}
                style={{ width: '100%', height: 4, cursor: 'pointer', accentColor: '#3b82f6' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', color: '#475569', marginTop: 2 }}>
                <span>0 mm</span><span>5 mm</span>
              </div>
            </div>
          )}

          {isPrismatic && onEndPlateChange && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>{t('layer.end_plate')}</span>
                <span style={{ color: '#3b82f6', fontWeight: 600 }}>{endPlateThickness.toFixed(0)} mm</span>
              </div>
              <input type="range" min="0" max="30" step="1" value={endPlateThickness}
                onChange={e => onEndPlateChange(parseFloat(e.target.value))}
                style={{ width: '100%', height: 4, cursor: 'pointer', accentColor: '#3b82f6' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', color: '#475569', marginTop: 2 }}>
                <span>0 mm</span><span>30 mm</span>
              </div>
            </div>
          )}

          {isPrismatic && onBusbarHeightChange && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>{t('layer.busbar_width')}</span>
                <span style={{ color: '#3b82f6', fontWeight: 600 }}>{busbarHeight.toFixed(0)} mm</span>
              </div>
              <input type="range" min="5" max="60" step="1" value={busbarHeight}
                onChange={e => onBusbarHeightChange(parseFloat(e.target.value))}
                style={{ width: '100%', height: 4, cursor: 'pointer', accentColor: '#3b82f6' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', color: '#475569', marginTop: 2 }}>
                <span>5 mm</span><span>60 mm</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
