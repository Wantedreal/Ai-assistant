import React from 'react'

export default function ExportPanel({ onExportGLB, onExportSTL, onExportSTEP, stepPayload, exporting }) {
  const btn = (label, loadingLabel, key, onClick, enabled) => (
    <button
      onClick={enabled ? onClick : undefined}
      disabled={!enabled}
      style={{
        flex: 1,
        padding: '6px 4px',
        borderRadius: 4,
        border: '1px solid rgba(255,255,255,0.12)',
        backgroundColor: exporting === key ? '#1d4ed8' : '#1f2937',
        color: exporting === key ? '#fff' : enabled ? '#cbd5e1' : '#4b5563',
        fontSize: '0.7rem',
        fontWeight: 600,
        cursor: exporting === key ? 'wait' : exporting ? 'not-allowed' : enabled ? 'pointer' : 'not-allowed',
        opacity: exporting && exporting !== key ? 0.45 : 1,
        transition: 'background-color 0.15s',
        letterSpacing: '0.04em',
      }}
    >
      {exporting === key ? loadingLabel : label}
    </button>
  )

  return (
    <div style={{
      position: 'absolute', bottom: 16, left: 16,
      backgroundColor: 'rgba(10, 12, 20, 0.88)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      padding: '10px 12px',
      color: '#e2e8f0',
      userSelect: 'none',
      zIndex: 10,
      minWidth: 140,
    }}>
      <div style={{
        fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
        marginBottom: 8, opacity: 0.6, fontSize: '0.65rem',
      }}>
        Export 3D
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {btn('GLB',  'Exporting...', 'glb',  onExportGLB,  (!!onExportGLB  && !exporting) || exporting === 'glb')}
        {btn('STL',  'Exporting...', 'stl',  onExportSTL,  (!!onExportSTL  && !exporting) || exporting === 'stl')}
        {btn('STEP', 'Generating...','step', onExportSTEP, (!!stepPayload   && !exporting) || exporting === 'step')}
      </div>

      <div style={{
        marginTop: 6, fontSize: '0.58rem', color: '#475569', lineHeight: 1.4,
      }}>
        GLB → Blender / viewers<br />
        STL → slicers / CAD<br />
        STEP → SolidWorks / CATIA / Fusion
      </div>
    </div>
  )
}
