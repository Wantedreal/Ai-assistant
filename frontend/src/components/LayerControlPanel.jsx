import React from 'react'

const LAYER_GROUPS = [
  {
    category: 'STRUCTURE',
    items: [
      { name: 'housing',     label: 'Housing',       types: ['cylindrical', 'prismatic', 'pouch'] },
      { name: 'side_plates', label: 'Side Plates',   types: ['prismatic', 'pouch'] },
      { name: 'brackets',    label: 'Cell Brackets', types: ['cylindrical'] },
    ],
  },
  {
    category: 'ELECTRICAL',
    items: [
      { name: 'cells',     label: 'Cells',            types: ['cylindrical', 'prismatic', 'pouch'] },
      { name: 'terminals', label: 'Terminals (+/−)',  types: ['cylindrical', 'prismatic', 'pouch'] },
      { name: 'busbars',   label: 'Busbars / Strips', types: ['cylindrical', 'prismatic', 'pouch'] },
    ],
  },
  {
    category: 'ELECTRONICS',
    items: [
      { name: 'bms',            label: 'BMS / PCB',      types: ['cylindrical', 'prismatic', 'pouch'] },
      { name: 'balance_wires',  label: 'Balance Wires',  types: ['cylindrical', 'prismatic', 'pouch'] },
      { name: 'cables',         label: 'Main Cables',    types: ['cylindrical', 'prismatic', 'pouch'] },
    ],
  },
  {
    category: 'INSULATION',
    items: [
      { name: 'insulation_cards', label: 'Insulation Cards', types: ['prismatic', 'pouch'] },
    ],
  },
]

const btnStyle = (bg) => ({
  flex: 1, padding: '4px 0', borderRadius: 4, border: 'none',
  backgroundColor: bg, color: '#fff', fontSize: '0.7rem',
  cursor: 'pointer', fontWeight: 600,
})

/**
 * Overlay panel for toggling 3D layer visibility.
 * Renders only in fullscreen mode; conditionally shows layers based on cell type.
 */
export default function LayerControlPanel({ layers, onToggle, cellType, cellGap, onCellGapChange }) {
  const type = (cellType || '').toLowerCase()
  const allNames = Object.keys(layers)
  const isCylindrical = type === 'cylindrical'

  return (
    <div style={{
      position: 'absolute', top: 16, right: 16,
      backgroundColor: 'rgba(10, 12, 20, 0.88)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      padding: '12px 14px',
      color: '#e2e8f0',
      fontSize: '0.75rem',
      minWidth: 185,
      userSelect: 'none',
      zIndex: 10,
    }}>
      <div style={{
        fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
        marginBottom: 10, opacity: 0.7, fontSize: '0.7rem',
      }}>
        Layers
      </div>

      {LAYER_GROUPS.map(group => {
        const visibleItems = group.items.filter(i => i.types.includes(type))
        if (visibleItems.length === 0) return null
        return (
          <div key={group.category} style={{ marginBottom: 8 }}>
            <div style={{
              fontSize: '0.62rem', color: '#475569',
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
            }}>
              {group.category}
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
                  <span style={{ opacity: checked ? 1 : 0.45 }}>{item.label}</span>
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
        <button onClick={() => allNames.forEach(n => onToggle(n, true))}  style={btnStyle('#3b82f6')}>Show all</button>
        <button onClick={() => allNames.forEach(n => onToggle(n, false))} style={btnStyle('#374151')}>Hide all</button>
      </div>

      {/* Cell gap slider */}
      {onCellGapChange && (
        <div style={{
          marginTop: 10,
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingTop: 10,
        }}>
          <div style={{
            fontSize: '0.62rem', color: '#475569',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
          }}>
            SETTINGS
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span>Cell Gap</span>
            <span style={{ color: '#3b82f6', fontWeight: 600 }}>{cellGap.toFixed(1)} mm</span>
          </div>
          <input
            type="range"
            min="0"
            max="5"
            step="0.1"
            value={cellGap}
            onChange={e => onCellGapChange(parseFloat(e.target.value))}
            style={{
              width: '100%', height: 4, cursor: 'pointer',
              accentColor: '#3b82f6',
            }}
          />
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: '0.58rem', color: '#475569', marginTop: 2,
          }}>
            <span>0 mm</span>
            <span>5 mm</span>
          </div>
        </div>
      )}
    </div>
  )
}
