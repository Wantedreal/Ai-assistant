import React, { useState } from 'react'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { apiService } from '../services/api.js'

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Floating export panel (fullscreen only).
 * GLB  — full fidelity, InstancedMesh preserved, opens in Blender / any GLTF viewer.
 * STL  — flat mesh, InstancedMesh expanded, opens in any slicer / CAD tool.
 */
export default function ExportPanel({ builderRef, stepPayload = null }) {
  const [exporting, setExporting] = useState(null)

  const exportGLB = () => {
    if (!builderRef.current || exporting) return
    setExporting('glb')
    const group = builderRef.current.getExportGroup()
    const exporter = new GLTFExporter()
    exporter.parse(
      group,
      (result) => {
        triggerDownload(new Blob([result], { type: 'model/gltf-binary' }), 'battery_pack.glb')
        setExporting(null)
      },
      (err) => { console.error('GLTFExporter:', err); setExporting(null) },
      { binary: true }
    )
  }

  const exportSTEP = async () => {
    if (!stepPayload || exporting) return
    setExporting('step')
    try {
      const { data } = await apiService.exportStep(stepPayload)
      triggerDownload(new Blob([data], { type: 'application/step' }), 'battery_pack.step')
    } catch (err) {
      console.error('STEP export error:', err)
    } finally {
      setExporting(null)
    }
  }

  const exportSTL = () => {
    if (!builderRef.current || exporting) return
    setExporting('stl')
    let flatGroup = null
    try {
      flatGroup = builderRef.current.getFlatGroupForSTL()
      const exporter = new STLExporter()
      const result = exporter.parse(flatGroup, { binary: true })
      triggerDownload(new Blob([result], { type: 'application/octet-stream' }), 'battery_pack.stl')
    } catch (err) {
      console.error('STLExporter:', err)
    } finally {
      // Dispose cloned geometries created by getFlatGroupForSTL to avoid GPU memory leak
      if (flatGroup) {
        flatGroup.traverse(obj => { if (obj.geometry) obj.geometry.dispose() })
      }
      setExporting(null)
    }
  }

  const btn = (label, loadingLabel, active, onClick) => (
    <button
      onClick={onClick ?? undefined}
      disabled={!onClick && !active}
      style={{
        flex: 1,
        padding: '6px 4px',
        borderRadius: 4,
        border: '1px solid rgba(255,255,255,0.12)',
        backgroundColor: active ? '#1d4ed8' : '#1f2937',
        color: active ? '#fff' : onClick ? '#cbd5e1' : '#4b5563',
        fontSize: '0.7rem',
        fontWeight: 600,
        cursor: active ? 'wait' : exporting ? 'not-allowed' : 'pointer',
        opacity: exporting && !active ? 0.45 : 1,
        transition: 'background-color 0.15s',
        letterSpacing: '0.04em',
      }}
    >
      {active ? loadingLabel : label}
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
        {btn('GLB', 'Exporting...', exporting === 'glb', exportGLB)}
        {btn('STL', 'Exporting...', exporting === 'stl', exportSTL)}
        {btn('STEP', 'Generating...', exporting === 'step', stepPayload ? exportSTEP : null)}
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
