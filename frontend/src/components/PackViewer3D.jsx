import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { PackAssemblyBuilder } from '../3d/PackAssemblyBuilder.js'
import LayerControlPanel from './LayerControlPanel.jsx'

const isElectron = typeof window !== 'undefined' && window.electronAPI != null

export default function PackViewer3D({ housingL, housingW, housingH, result, cameraPreset = 'free', onFullscreenClick, isFullscreen = false }) {
  const mountRef = useRef(null)
  const controlsRef = useRef(null)
  const cameraRef = useRef(null)
  const builderRef = useRef(null)
  const [webglError, setWebglError] = useState(null)
  const [layers, setLayers] = useState({
    housing: true, cells: true, terminals: true, busbars: true,
    brackets: true, insulation_cards: true, side_plates: true,
  })

  const hasValidResult = result?.cell_used && result?.dimensions_array && result.nb_serie > 0 && result.nb_parallele > 0

  // ─── Main scene setup ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mountRef.current) return

    try {
      const width  = mountRef.current.clientWidth
      const height = mountRef.current.clientHeight

      // Scene
      const scene = new THREE.Scene()
      scene.background = new THREE.Color('#1a1c23')

      // Camera
      const camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000)
      cameraRef.current = camera

      // Renderer
      const renderer = new THREE.WebGLRenderer({
        antialias: !isElectron,
        powerPreference: isElectron ? 'default' : 'high-performance',
        failIfMajorPerformanceCaveat: false,
      })
      renderer.setSize(width, height)
      renderer.setPixelRatio(isElectron ? 1 : Math.min(window.devicePixelRatio, 2))
      if (!isElectron) {
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.1
      }
      mountRef.current.innerHTML = ''
      mountRef.current.appendChild(renderer.domElement)

      // Lights
      scene.add(new THREE.AmbientLight(0xffffff, 0.6))

      const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4)
      hemi.position.set(0, 2000, 0)
      scene.add(hemi)

      const dir = new THREE.DirectionalLight(0xffffff, 1.2)
      dir.position.set(1000, 2000, 1000)
      if (!isElectron) {
        dir.castShadow = true
        dir.shadow.mapSize.set(1024, 1024)
        dir.shadow.camera.near = 10
        dir.shadow.camera.far = 5000
        dir.shadow.camera.left = dir.shadow.camera.bottom = -1000
        dir.shadow.camera.right = dir.shadow.camera.top = 1000
        dir.shadow.bias = -0.0001
      }
      scene.add(dir)

      const point = new THREE.PointLight(0xffffff, 0.5)
      point.position.set(-1000, 1500, -1000)
      scene.add(point)

      // Shadow floor (non-Electron only)
      if (!isElectron) {
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(10000, 10000),
          new THREE.ShadowMaterial({ opacity: 0.4 })
        )
        plane.rotation.x = -Math.PI / 2
        plane.position.y = -housingH / 2 - 1
        plane.receiveShadow = true
        scene.add(plane)
      }

      // Assembly builder
      const builder = new PackAssemblyBuilder(scene, isElectron)
      builder.buildHousing(housingL, housingW, housingH)
      builder.buildCells(housingH, result)
      builder.buildBusbars(housingH, result)
      builder.buildBracketsAndCards(housingH, result)
      builder.buildSidePlates(housingH, result)
      builderRef.current = builder

      // Apply any layer toggles that were set before this rebuild
      Object.entries(layers).forEach(([name, vis]) => builder.setLayerVisible(name, vis))

      // Camera position
      const dist = Math.max(housingL, housingW, housingH) * 1.5
      camera.position.set(dist, dist * 0.8, dist)

      // Controls
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.autoRotate = true
      controls.autoRotateSpeed = 1.0
      controlsRef.current = controls

      // Animation loop
      let rafId
      const animate = () => {
        rafId = requestAnimationFrame(animate)
        controls.update()
        renderer.render(scene, camera)
      }
      animate()

      // Resize
      const onResize = () => {
        if (!mountRef.current) return
        const w = mountRef.current.clientWidth
        const h = mountRef.current.clientHeight
        renderer.setSize(w, h)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
      }
      const ro = new ResizeObserver(onResize)
      ro.observe(mountRef.current)

      return () => {
        builderRef.current = null
        cancelAnimationFrame(rafId)
        ro.disconnect()
        controls.dispose()
        builder.dispose()
        renderer.dispose()
        renderer.forceContextLoss()
        if (mountRef.current) mountRef.current.innerHTML = ''
        scene.clear()
      }
    } catch (error) {
      console.error('PackViewer3D error:', error)
      setWebglError(error.message || 'Failed to initialize 3D viewer')
      if (mountRef.current) {
        mountRef.current.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#1a1c23;color:#999;text-align:center;padding:20px"><div><div style="font-size:48px;margin-bottom:10px">⚠️</div><div>3D Viewer unavailable</div><div style="font-size:12px;margin-top:8px;color:#666">${error.message}</div></div></div>`
      }
    }
  }, [housingL, housingW, housingH, result])

  // ─── Camera preset animation ────────────────────────────────────────────────
  useEffect(() => {
    if (!controlsRef.current || !cameraRef.current || !cameraPreset) return

    const dist = Math.max(housingL, housingW, housingH) * 1.5
    const presets = {
      front:     { pos: new THREE.Vector3(0, dist * 0.5,  dist) },
      back:      { pos: new THREE.Vector3(0, dist * 0.5, -dist) },
      left:      { pos: new THREE.Vector3(-dist, dist * 0.5, 0) },
      right:     { pos: new THREE.Vector3( dist, dist * 0.5, 0) },
      top:       { pos: new THREE.Vector3(0, dist * 1.5, 0) },
      bottom:    { pos: new THREE.Vector3(0, -dist * 0.5, 0) },
      isometric: { pos: new THREE.Vector3(dist * 0.7, dist * 0.7, dist * 0.7) },
      free:      { pos: new THREE.Vector3(dist, dist * 0.8, dist) },
    }
    if (!presets[cameraPreset]) return

    const camera   = cameraRef.current
    const controls = controlsRef.current
    const startPos = camera.position.clone()
    const endPos   = presets[cameraPreset].pos
    const origin   = new THREE.Vector3(0, 0, 0)
    const duration = 1000
    const startTime = Date.now()
    let animating = true

    controls.autoRotate = false

    const frame = () => {
      if (!animating) return
      const t = Math.min((Date.now() - startTime) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      camera.position.lerpVectors(startPos, endPos, ease)
      controls.target.copy(origin)
      controls.update()
      if (t < 1) requestAnimationFrame(frame)
      else {
        animating = false
        controls.autoRotate = cameraPreset === 'free'
      }
    }
    frame()
  }, [cameraPreset, housingL, housingW, housingH])

  // ─── Layer sync ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!builderRef.current) return
    Object.entries(layers).forEach(([name, vis]) => builderRef.current.setLayerVisible(name, vis))
  }, [layers])

  const handleToggle = useCallback((name, visible) => {
    setLayers(prev => ({ ...prev, [name]: visible }))
  }, [])

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        ref={mountRef}
        onClick={!isFullscreen ? onFullscreenClick : undefined}
        style={{
          width: '100%', height: '100%', minHeight: '300px',
          borderRadius: 'inherit', overflow: 'hidden',
          cursor: !isFullscreen ? 'pointer' : 'grab',
        }}
      />

      {/* Layer toggle panel (fullscreen only) */}
      {isFullscreen && hasValidResult && (
        <LayerControlPanel
          layers={layers}
          onToggle={handleToggle}
          cellType={result?.cell_used?.type_cellule}
        />
      )}

      {/* Title */}
      <div style={{
        position: 'absolute', top: 16, left: 16,
        pointerEvents: 'none', color: '#fff',
        textShadow: '0 2px 4px rgba(0,0,0,0.5)',
        fontFamily: 'var(--font-primary, sans-serif)',
      }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', opacity: 0.8 }}>
          3D Pack visualization
        </div>
        <div style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: 4 }}>
          {hasValidResult ? 'Housing vs Computed Array' : 'Target Housing Geometry'}
        </div>
      </div>

      {/* Placeholder when no result */}
      {!hasValidResult && (
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(26,28,35,0.7)',
          color: '#888', fontSize: '14px', textAlign: 'center',
          padding: '20px', pointerEvents: 'none',
        }} />
      )}

      {/* Fullscreen hint */}
      {!isFullscreen && onFullscreenClick && (
        <div style={{
          position: 'absolute', bottom: 16, left: 16,
          pointerEvents: 'none', color: '#fff',
          fontSize: '0.75rem', opacity: 0.6, fontStyle: 'italic',
          textShadow: '0 2px 4px rgba(0,0,0,0.5)',
        }}>
          Click to view fullscreen
        </div>
      )}

      {/* Verdict badge */}
      {hasValidResult && (
        <div style={{
          position: 'absolute', bottom: 16, right: 16,
          pointerEvents: 'none',
          backgroundColor: result.verdict === 'ACCEPT' ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)',
          color: 'white', padding: '6px 12px', borderRadius: '4px',
          fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}>
          {result.verdict}
        </div>
      )}
    </div>
  )
}
