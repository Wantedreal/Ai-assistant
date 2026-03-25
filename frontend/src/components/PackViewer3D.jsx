import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// Detect if we are running inside Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI != null

export default function PackViewer3D({ housingL, housingW, housingH, result, cameraPreset = 'free', onFullscreenClick, isFullscreen = false }) {
  const mountRef = useRef(null)
  const controlsRef = useRef(null)
  const cameraRef = useRef(null)
  const sceneRef = useRef(null)
  const [webglError, setWebglError] = useState(null)
  const [showPlaceholder, setShowPlaceholder] = useState(true)

  // Check if we have a valid result for cells
  const hasValidResult = result && result.cell_used && result.dimensions_array && result.nb_serie > 0 && result.nb_parallele > 0

  // Always call useEffect - it will handle showing placeholder or 3D scene
  useEffect(() => {
    if (!mountRef.current) return

    try {
      // ─── 1. Setup Scene, Camera, Renderer ─────────────────────────────────────
      const width = mountRef.current.clientWidth
      const height = mountRef.current.clientHeight

      const scene = new THREE.Scene()
      scene.background = new THREE.Color('#1a1c23') // Dark modern background

      const camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000)

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

      sceneRef.current = scene
      cameraRef.current = camera

      // Clear previous canvas if re-running effect
      mountRef.current.innerHTML = ''
      mountRef.current.appendChild(renderer.domElement)

    // ─── 2. Setup Lighting ────────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4)
    hemiLight.position.set(0, 2000, 0)
    scene.add(hemiLight)

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
    dirLight.position.set(1000, 2000, 1000)
    if (!isElectron) {
      dirLight.castShadow = true
      dirLight.shadow.mapSize.width = 1024
      dirLight.shadow.mapSize.height = 1024
      dirLight.shadow.camera.near = 10
      dirLight.shadow.camera.far = 5000
      dirLight.shadow.camera.left = -1000
      dirLight.shadow.camera.right = 1000
      dirLight.shadow.camera.top = 1000
      dirLight.shadow.camera.bottom = -1000
      dirLight.shadow.bias = -0.0001
    }
    scene.add(dirLight)

    const pointLight = new THREE.PointLight(0xffffff, 0.5)
    pointLight.position.set(-1000, 1500, -1000)
    scene.add(pointLight)

    // ─── 3. Add Housing Wireframe (Always shown) ─────────────────────────────
    // Housing wireframe always displays regardless of calculation result
      const housingGroup = new THREE.Group()
    
      // Create a frosted glass / acrylic material for the housing body
      // Use simpler materials in Electron to avoid GPU shader crashes
      const housingMat = isElectron
        ? new THREE.MeshStandardMaterial({
            color: new THREE.Color('#3b82f6'),
            transparent: true,
            opacity: 0.3,
            roughness: 0.3,
            metalness: 0.1,
            side: THREE.DoubleSide,
          })
        : new THREE.MeshPhysicalMaterial({
            color: new THREE.Color('#3b82f6'),
            transparent: true,
            opacity: 0.25,
            roughness: 0.1,
            transmission: 0.9,
            thickness: 2.0,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            side: THREE.DoubleSide,
          })
    
      const edgeMat = new THREE.LineBasicMaterial({ color: '#60a5fa', opacity: 0.8, transparent: true })
    
      // Helper to create a wall with edges
      const createWall = (w, h, d, x, y, z) => {
        const geom = new THREE.BoxGeometry(w, h, d)
        const mesh = new THREE.Mesh(geom, housingMat)
        mesh.position.set(x, y, z)
        if (!isElectron) {
          mesh.castShadow = true
          mesh.receiveShadow = true
        }
    
        const edges = new THREE.EdgesGeometry(geom)
        const lines = new THREE.LineSegments(edges, edgeMat)
        mesh.add(lines)
        return mesh
      }
    
      const wallThickness = 2 // Visual thickness of the tray walls
    
      // Bottom plate
      const bottomY = -housingH / 2 + wallThickness / 2
      housingGroup.add(createWall(housingL, wallThickness, housingW, 0, bottomY, 0))
    
      // Front & Back walls (along X axis)
      const fbW = housingL
      const fbH = (housingH / 2) - wallThickness
      const fbY = -housingH / 2 + wallThickness + fbH / 2
      housingGroup.add(createWall(fbW, fbH, wallThickness, 0, fbY, housingW / 2 - wallThickness / 2))
      housingGroup.add(createWall(fbW, fbH, wallThickness, 0, fbY, -housingW / 2 + wallThickness / 2))
    
      // Left & Right walls (along Z axis)
      const lrW = wallThickness
      const lrH = (housingH / 2) - wallThickness
      const lrD = housingW - wallThickness * 2
      const lrY = -housingH / 2 + wallThickness + lrH / 2
      housingGroup.add(createWall(lrW, lrH, lrD, housingL / 2 - wallThickness / 2, lrY, 0))
      housingGroup.add(createWall(lrW, lrH, lrD, -housingL / 2 + wallThickness / 2, lrY, 0))
    
      scene.add(housingGroup)


    // ─── 4. Add Battery Array (Only when result is available) ─────────────────
    if (result && result.cell_used && result.dimensions_array && result.nb_serie > 0 && result.nb_parallele > 0) {
      const { nb_serie: S, nb_parallele: P, cell_used, dimensions_array } = result
      const totalCells = S * P
      const type = (cell_used.type_cellule || 'Pouch').toLowerCase()

      const ok = result.verdict === 'ACCEPT'
      // Base color: blue/indigo for cylindrical wrap, silver for prismatic, red if reject
      const baseBodyColor = ok ? (type === 'cylindrical' ? '#1890ff' : '#bdc3c7') : '#ef4444'

      // Material for the plastic/painted body wrapper
      const bodyMat = isElectron
        ? new THREE.MeshStandardMaterial({
            color: new THREE.Color(baseBodyColor),
            metalness: type === 'cylindrical' ? 0.3 : 0.7,
            roughness: type === 'cylindrical' ? 0.3 : 0.2,
          })
        : new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(baseBodyColor),
            metalness: type === 'cylindrical' ? 0.3 : 0.8,
            roughness: type === 'cylindrical' ? 0.2 : 0.15,
            clearcoat: type === 'cylindrical' ? 1.0 : 0.5,
            clearcoatRoughness: 0.1,
            envMapIntensity: 1.0,
          })

      // Material for standard aluminum/steel terminals
      const metalMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#e0e0e0'),
        metalness: 1.0,
        roughness: 0.15,
      })

      // Material for copper negative/positive terminals (Prismatic)
      const copperMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#c57933'),
        metalness: 1.0,
        roughness: 0.2,
      })

      let bodyGeom, term1Geom, term2Geom
      let term1OffsetY = 0, term1OffsetX = 0
      let term2OffsetY = 0, term2OffsetX = 0
      let stepX, stepZ, bodyH

      if (type === 'cylindrical') {
        const diameter = cell_used.longueur_mm
        const height = cell_used.hauteur_mm

        stepX = dimensions_array.longueur_mm / S
        stepZ = dimensions_array.largeur_mm / P

        // Body: 96% of total height
        bodyH = height * 0.96
        bodyGeom = new THREE.CylinderGeometry(diameter / 2, diameter / 2, bodyH, 16)

        // Cap/Terminal: 4% of total height, slightly smaller radius
        const termH = height * 0.04
        term1Geom = new THREE.CylinderGeometry(diameter * 0.3, diameter * 0.3, termH, 12)
        term1OffsetY = (bodyH / 2) + (termH / 2)

        term2Geom = null // Only one top cap for cylindrical visual
      } else {
        // Prismatic / Pouch
        const sizeX = cell_used.longueur_mm
        const sizeZ = cell_used.largeur_mm
        const height = cell_used.hauteur_mm

        stepX = dimensions_array.longueur_mm / S
        stepZ = dimensions_array.largeur_mm / P

        // Body: 95% of total height
        bodyH = height * 0.95
        bodyGeom = new THREE.BoxGeometry(sizeX, bodyH, sizeZ)

        // Two structural terminals on top
        const termH = height * 0.05
        const termW = sizeX * 0.25
        const termD = Math.min(sizeZ * 0.4, 15)

        term1Geom = new THREE.BoxGeometry(termW, termH, termD) // Positive (Aluminum)
        term2Geom = new THREE.BoxGeometry(termW, termH, termD) // Negative (Copper)

        term1OffsetY = (bodyH / 2) + (termH / 2)
        term1OffsetX = (sizeX / 2) * 0.5 // Shift right

        term2OffsetY = (bodyH / 2) + (termH / 2)
        term2OffsetX = -(sizeX / 2) * 0.5 // Shift left
      }

      // Create Instanced Meshes
      const bodyMesh = new THREE.InstancedMesh(bodyGeom, bodyMat, totalCells)
      if (!isElectron) {
        bodyMesh.castShadow = true
        bodyMesh.receiveShadow = true
      }
      
      const term1Mesh = term1Geom ? new THREE.InstancedMesh(term1Geom, metalMat, totalCells) : null
      if (term1Mesh && !isElectron) {
        term1Mesh.castShadow = true
        term1Mesh.receiveShadow = true
      }
      
      const term2Mesh = term2Geom ? new THREE.InstancedMesh(term2Geom, copperMat, totalCells) : null
      if (term2Mesh && !isElectron) {
        term2Mesh.castShadow = true
        term2Mesh.receiveShadow = true
      }

      const matrixBody = new THREE.Matrix4()
      const matrixTerm1 = new THREE.Matrix4()
      const matrixTerm2 = new THREE.Matrix4()

      const posBody = new THREE.Vector3()
      const posTerm1 = new THREE.Vector3()
      const posTerm2 = new THREE.Vector3()

      // Center offset so the array is bounded centrally
      const startX = -(S * stepX) / 2 + stepX / 2
      const startZ = -(P * stepZ) / 2 + stepZ / 2

      let i = 0
      for (let s = 0; s < S; s++) {
        for (let p = 0; p < P; p++) {
          const x = startX + s * stepX
          const z = startZ + p * stepZ

          // Base Y position so the bottom of the cells touches the bottom plate
          // The bottom plate is at Y = -housingH / 2 + wallThickness.
          // The cell center needs to be half its height above that.
          const basePos = (-housingH / 2) + 2 // 2 is wallThickness
          const yCenter = basePos + (type === 'cylindrical' ? bodyH / 2 : bodyH / 2)

          // Set body position
          posBody.set(x, yCenter, z)
          matrixBody.setPosition(posBody)
          bodyMesh.setMatrixAt(i, matrixBody)

          // Set terminal 1 position
          if (term1Mesh) {
            posTerm1.set(x + term1OffsetX, yCenter + term1OffsetY - (bodyH / 2), z)
            matrixTerm1.setPosition(posTerm1)
            term1Mesh.setMatrixAt(i, matrixTerm1)
          }

          // Set terminal 2 position
          if (term2Mesh) {
            posTerm2.set(x + term2OffsetX, yCenter + term2OffsetY - (bodyH / 2), z)
            matrixTerm2.setPosition(posTerm2)
            term2Mesh.setMatrixAt(i, matrixTerm2)
          }

          i++
        }
      }

      bodyMesh.instanceMatrix.needsUpdate = true
      scene.add(bodyMesh)

      if (term1Mesh) {
        term1Mesh.instanceMatrix.needsUpdate = true
        scene.add(term1Mesh)
      }
      if (term2Mesh) {
        term2Mesh.instanceMatrix.needsUpdate = true
        scene.add(term2Mesh)
      }
    }

    // ─── 5. Grid/Floor helper ─────────────────────────────────────────────────
    // ─── 5. Floor shadow receiver ─────────────────────────────────────────────
    if (!isElectron) {
      // Shadow plane only needed when shadows are enabled
      const planeGeom = new THREE.PlaneGeometry(10000, 10000)
      const planeMat = new THREE.ShadowMaterial({ opacity: 0.4 })
      const planeMesh = new THREE.Mesh(planeGeom, planeMat)
      planeMesh.rotation.x = -Math.PI / 2
      planeMesh.position.y = -housingH / 2 - 1
      planeMesh.receiveShadow = true
      scene.add(planeMesh)
    }

    // ─── 6. Camera Positioning & Controls ─────────────────────────────────────
    // Calculate a good zoom level based on the housing size
    const distance = Math.max(housingL, housingW, housingH) * 1.5
    camera.position.set(distance, distance * 0.8, distance)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.autoRotate = true
    controls.autoRotateSpeed = 1.0
    controlsRef.current = controls

    // ─── 7. Animation Loop ────────────────────────────────────────────────────
    let animationFrameId
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // ─── 8. Handle Resize ─────────────────────────────────────────────────────
    const handleResize = () => {
      if (!mountRef.current) return
      const w = mountRef.current.clientWidth
      const h = mountRef.current.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }

    // Use ResizeObserver since the container might resize independently of window
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(mountRef.current)

    // ─── Cleanup ──────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animationFrameId)
      resizeObserver.disconnect()
      if (mountRef.current) {
        mountRef.current.innerHTML = ''
      }
      renderer.dispose()
      renderer.forceContextLoss()
      // Clean up meshes in group
      housingGroup.children.forEach(child => {
        if (child.geometry) child.geometry.dispose()
        if (child.material) child.material.dispose()
      })
      scene.clear()
    }
    } catch (error) {
      console.error('PackViewer3D error:', error)
      setWebglError(error.message || 'Failed to initialize 3D viewer')
      if (mountRef.current) {
        mountRef.current.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#1a1c23;color:#999;text-align:center;padding:20px"><div><div style="font-size:48px;margin-bottom:10px">⚠️</div><div>3D Viewer unavailable</div><div style="font-size:12px;margin-top:8px;color:#666">${error.message}</div></div></div>`
      }
    }
  }, [housingL, housingW, housingH, result]) // Re-run if dimensions or result changes

  // Handle camera preset changes
  useEffect(() => {
    if (controlsRef.current && cameraRef.current && cameraPreset) {
      const distance = Math.max(housingL, housingW, housingH) * 1.5
      const cameraTargets = {
        front: { pos: new THREE.Vector3(0, distance * 0.5, distance), target: new THREE.Vector3(0, 0, 0) },
        back: { pos: new THREE.Vector3(0, distance * 0.5, -distance), target: new THREE.Vector3(0, 0, 0) },
        left: { pos: new THREE.Vector3(-distance, distance * 0.5, 0), target: new THREE.Vector3(0, 0, 0) },
        right: { pos: new THREE.Vector3(distance, distance * 0.5, 0), target: new THREE.Vector3(0, 0, 0) },
        top: { pos: new THREE.Vector3(0, distance * 1.5, 0), target: new THREE.Vector3(0, 0, 0) },
        bottom: { pos: new THREE.Vector3(0, -distance * 0.5, 0), target: new THREE.Vector3(0, 0, 0) },
        isometric: { pos: new THREE.Vector3(distance * 0.7, distance * 0.7, distance * 0.7), target: new THREE.Vector3(0, 0, 0) },
        free: { pos: new THREE.Vector3(distance, distance * 0.8, distance), target: new THREE.Vector3(0, 0, 0) }
      }

      let cameraAnimating = false
      const animateCameraToPreset = (preset) => {
        if (cameraAnimating || !cameraTargets[preset]) return
        
        const target = cameraTargets[preset]
        const camera = cameraRef.current
        const controls = controlsRef.current
        const startPos = camera.position.clone()
        const endPos = target.pos
        const duration = 1000 // milliseconds
        const startTime = Date.now()

        cameraAnimating = true
        controls.autoRotate = false

        const animateFrame = () => {
          const elapsed = Date.now() - startTime
          const progress = Math.min(elapsed / duration, 1)

          // Ease-out cubic
          const easeProgress = 1 - Math.pow(1 - progress, 3)

          camera.position.lerpVectors(startPos, endPos, easeProgress)
          controls.target.copy(target.target)
          controls.update()

          if (progress < 1) {
            requestAnimationFrame(animateFrame)
          } else {
            cameraAnimating = false
            controls.autoRotate = preset === 'free' // Re-enable auto-rotate for free mode
          }
        }

        animateFrame()
      }

      animateCameraToPreset(cameraPreset)
    }
  }, [cameraPreset, housingL, housingW, housingH])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        ref={mountRef}
        onClick={!isFullscreen ? onFullscreenClick : undefined}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '300px',
          borderRadius: 'inherit',
          overflow: 'hidden',
          cursor: !isFullscreen ? 'pointer' : 'grab'
        }}
      />

      {/* UI Overlay */}
      <div style={{
        position: 'absolute',
        top: 16,
        left: 16,
        pointerEvents: 'none',
        color: '#fff',
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

      {/* Placeholder Overlay - shown when no valid result */}
      {!hasValidResult && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(26,28,35,0.7)',
          color: '#888',
          fontSize: '14px',
          textAlign: 'center',
          padding: '20px',
          pointerEvents: 'none'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.5 }}>📦</div>
          <div>Calculate a configuration</div>
          <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.6 }}>
            to view the 3D battery pack visualization
          </div>
        </div>
      )}

      {/* Click to Fullscreen Hint */}
      {!isFullscreen && onFullscreenClick && (
        <div style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          pointerEvents: 'none',
          color: '#fff',
          fontSize: '0.75rem',
          opacity: 0.6,
          fontStyle: 'italic',
          textShadow: '0 2px 4px rgba(0,0,0,0.5)'
        }}>
          💡 Click to view fullscreen
        </div>
      )}

      {/* Verdict Overlay */}
      {hasValidResult && (
        <div style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          pointerEvents: 'none',
          backgroundColor: result.verdict === 'ACCEPT' ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)',
          color: 'white',
          padding: '6px 12px',
          borderRadius: '4px',
          fontSize: '0.8rem',
          fontWeight: 700,
          letterSpacing: '0.05em',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>
          {result.verdict}
        </div>
      )}
    </div>
  )
}
