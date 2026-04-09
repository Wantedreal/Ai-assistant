import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const isElectronCtx = typeof window !== 'undefined' && window.electronAPI != null

/** Housing wall thickness (mm) — used in every yCenter calculation. Change here to affect all builders. */
const WALL_MM = 2
/** Prismatic terminal Z-offset ratio relative to cell width — positive terminal side. */
const TERM_OFFSET_RATIO = 0.22
/** Cylindrical cell bracket height (mm) — shared between bracket builder and nickel strip positioner. */
const BRACKET_H = 10

/**
 * Builds the 3D battery pack assembly scene.
 * Each component type is a named THREE.Group stored in this.groups.
 * Use setLayerVisible(name, bool) to toggle groups.
 */
export class PackAssemblyBuilder {
  constructor(scene, isElectron = isElectronCtx) {
    this.scene = scene
    this.isElectron = isElectron
    this.groups = new Map()
    this.cellGap = 1.5
    this._bmsPos = null
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  setLayerVisible(name, visible) {
    const g = this.groups.get(name)
    if (g) g.visible = visible
  }

  setCellGap(gapMm) {
    this.cellGap = gapMm
  }

  /** Provide a pre-loaded GLTF object (from GLTFLoader) for mesh-based cylindrical cells. */
  setCellModel(gltf) {
    this._cellGltf = gltf
  }


  buildHousing(housingL, housingW, housingH, verdict) {
    const group = new THREE.Group()
    group.name = 'housing'

    const colorHex = verdict === 'REJECT' ? '#ef4444' : '#3b82f6'

    const housingMat = this.isElectron
      ? new THREE.MeshStandardMaterial({
          color: new THREE.Color(colorHex),
          transparent: true, opacity: 0.3,
          roughness: 0.3, metalness: 0.1,
          side: THREE.DoubleSide,
        })
      : new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(colorHex),
          transparent: true, opacity: 0.25,
          roughness: 0.1, transmission: 0.9,
          thickness: 2.0, clearcoat: 1.0,
          clearcoatRoughness: 0.1,
          side: THREE.DoubleSide,
        })

    const edgeColorHex = verdict === 'REJECT' ? '#f87171' : '#60a5fa'
    const wall = WALL_MM
    const addWall = (w, h, d, x, y, z) => {
      const geom = new THREE.BoxGeometry(w, h, d)
      const mesh = new THREE.Mesh(geom, housingMat)
      mesh.position.set(x, y, z)
      if (!this.isElectron) { mesh.castShadow = true; mesh.receiveShadow = true }
      const edgeMat = new THREE.LineBasicMaterial({ color: edgeColorHex, opacity: 0.8, transparent: true })
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geom), edgeMat))
      group.add(mesh)
    }

    // Bottom plate
    addWall(housingL, wall, housingW, 0, -housingH / 2 + wall / 2, 0)

    // Front / Back walls
    const fbH = housingH / 2 - wall
    const fbY = -housingH / 2 + wall + fbH / 2
    addWall(housingL, fbH, wall, 0, fbY,  housingW / 2 - wall / 2)
    addWall(housingL, fbH, wall, 0, fbY, -housingW / 2 + wall / 2)

    // Left / Right walls
    const lrD = housingW - wall * 2
    addWall(wall, fbH, lrD,  housingL / 2 - wall / 2, fbY, 0)
    addWall(wall, fbH, lrD, -housingL / 2 + wall / 2, fbY, 0)

    this._addGroup('housing', group)
  }

  /**
   * Build the S×P cell array + terminals (Phase 0 + Phase 1).
   * Cylindrical cells alternate orientation every series column so that
   * adjacent series groups have opposite polarity facing each other.
   */
  buildCells(housingH, result) {
    if (!result?.cell_used || !result?.dimensions_array || result.nb_serie <= 0 || result.nb_parallele <= 0) return

    const { nb_serie: S, nb_parallele: P, cell_used } = result
    const type = (cell_used.type_cellule || 'Pouch').toLowerCase()
    const isCylindrical = type === 'cylindrical'

    isCylindrical
      ? this._buildCylindricalCells(S, P, cell_used, housingH, result.verdict)
      : this._buildPrismaticCells(S, P, cell_used, housingH, result.verdict)
  }

  buildBusbars(housingH, result) {
    if (!result?.cell_used || !result?.dimensions_array || result.nb_serie <= 0 || result.nb_parallele <= 0) return

    const { nb_serie: S, nb_parallele: P, cell_used } = result
    const type = (cell_used.type_cellule || 'Pouch').toLowerCase()
    const isCylindrical = type === 'cylindrical'

    isCylindrical
      ? this._buildNickelStrips(S, P, cell_used, housingH)
      : this._buildPrismaticBusbars(S, P, cell_used, housingH)
  }

  buildBracketsAndCards(housingH, result) {
    if (!result?.cell_used || !result?.dimensions_array || result.nb_serie <= 0 || result.nb_parallele <= 0) return

    const { nb_serie: S, nb_parallele: P, cell_used } = result
    const type = (cell_used.type_cellule || 'Pouch').toLowerCase()

    if (type === 'cylindrical') {
      this._buildCylindricalBrackets(S, P, cell_used, housingH)
    } else {
      this._buildPrismaticInsulationCards(S, P, cell_used, housingH)
    }
  }

  buildBMS(housingH, result) {
    if (!result?.cell_used || !result?.dimensions_array || result.nb_serie <= 0 || result.nb_parallele <= 0) return

    const { nb_serie: S, nb_parallele: P, cell_used } = result
    const isCylindrical = (cell_used.type_cellule || 'Pouch').toLowerCase() === 'cylindrical'

    this._buildBMSBoard(S, P, cell_used, housingH, isCylindrical)
    this._buildBalanceWires(S, P, cell_used, housingH, isCylindrical)
    this._buildMainCables(S, P, cell_used, housingH, isCylindrical)
  }

  buildSidePlates(housingH, result) {
    if (!result?.cell_used || !result?.dimensions_array || result.nb_serie <= 0 || result.nb_parallele <= 0) return

    const { nb_serie: S, nb_parallele: P, cell_used } = result
    const type = (cell_used.type_cellule || 'Pouch').toLowerCase()

    if (type !== 'cylindrical') {
      this._buildPrismaticSidePlates(S, P, cell_used, housingH)
    }
  }

  applyRotation() {
    // Rotates the entire cell array 90 degrees to fit the housing
    const groupsToRotate = ['cells', 'terminals', 'busbars', 'brackets', 'insulation_cards', 'side_plates', 'bms', 'balance_wires', 'cables']
    groupsToRotate.forEach(name => {
      const g = this.groups.get(name)
      if (g) {
        g.rotation.y = Math.PI / 2
      }
    })
  }

  /**
   * Returns an expanded Group of all currently visible layers for GLB.
   * Expands InstancedMesh into individual standard Meshes so it renders
   * accurately in basic 3D viewers that don't support GPU instancing extensions.
   */
  getExportGroup() {
    const root = new THREE.Group()
    root.name = 'battery_pack'
    const dummy = new THREE.Matrix4()

    this.groups.forEach(group => {
      if (!group.visible) return
      group.updateMatrixWorld(true)

      group.traverse(obj => {
        if (obj instanceof THREE.InstancedMesh) {
          for (let i = 0; i < obj.count; i++) {
            obj.getMatrixAt(i, dummy)
            const worldMat = new THREE.Matrix4().multiplyMatrices(obj.matrixWorld, dummy)
            
            const mesh = new THREE.Mesh(obj.geometry, obj.material)
            worldMat.decompose(mesh.position, mesh.quaternion, mesh.scale)
            mesh.name = `${obj.name || 'instance'}_${i}`
            root.add(mesh)
          }
        } else if (obj instanceof THREE.Mesh) {
          const mesh = new THREE.Mesh(obj.geometry, obj.material)
          obj.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale)
          mesh.name = obj.name || 'mesh'
          root.add(mesh)
        }
      })
    })

    return root
  }

  /**
   * Returns a flat Group where every InstancedMesh is expanded into individual
   * Meshes with world transforms baked directly into the geometry vertices — 
   * this guarantees flawless STLExporter output without needing scene updates.
   */
  getFlatGroupForSTL() {
    const root = new THREE.Group()
    root.name = 'battery_pack'
    const dummy = new THREE.Matrix4()

    this.groups.forEach(group => {
      if (!group.visible) return
      // Ensure world matrices are up to date for this group tree
      group.updateMatrixWorld(true)

      group.traverse(obj => {
        if (obj instanceof THREE.InstancedMesh) {
          for (let i = 0; i < obj.count; i++) {
            obj.getMatrixAt(i, dummy)
            // Compute final world matrix for this specific instance
            const worldMat = new THREE.Matrix4().multiplyMatrices(obj.matrixWorld, dummy)
            
            // Clone geometry and statically bake the world transform into its vertices
            const geom = obj.geometry.clone()
            geom.applyMatrix4(worldMat)
            
            const mesh = new THREE.Mesh(geom, obj.material)
            root.add(mesh)
          }
        } else if (obj instanceof THREE.Mesh) {
          // Normal meshes also need their world coordinates baked for the raw STL
          const geom = obj.geometry.clone()
          geom.applyMatrix4(obj.matrixWorld)
          
          const mesh = new THREE.Mesh(geom, obj.material)
          root.add(mesh)
        }
      })
    })

    return root
  }

  dispose() {
    this.groups.forEach(group => {
      this.scene.remove(group)
      this._disposeGroup(group)
    })
    this.groups.clear()
    this._bmsPos = null
  }

  // ─── Private Builders ──────────────────────────────────────────────────────

  _buildCylindricalCells(S, P, cell_used, housingH, verdict) {
    if (this._cellGltf) {
      this._buildCylindricalCellsFromGLTF(S, P, cell_used, housingH)
      return
    }
    const totalCells = S * P
    const diameter = cell_used.diameter_mm || cell_used.longueur_mm
    const height = cell_used.hauteur_mm
    const stepX = diameter + this.cellGap
    const stepZ = diameter + this.cellGap


    // The PVC wrap is the full visible body
    const bodyH = height * 0.96
    // Positive end: flat steel disc covering top face + tiny raised button cap
    const posDiscH = 0.3                         // thin steel disc flush on top
    const posDiscR = diameter / 2 - 0.3          // slightly inset from wrap edge
    const posBtnH  = 0.6                         // tiny raised button
    const posBtnR  = diameter * 0.18             // small center button
    // Negative end: flat steel disc covering bottom face
    const negDiscH = 0.3
    const negDiscR = diameter / 2 - 0.3

    // Geometries
    const bodyGeom    = new THREE.CylinderGeometry(diameter / 2, diameter / 2, bodyH, 24)
    const posDiscGeom = new THREE.CylinderGeometry(posDiscR, posDiscR, posDiscH, 24)
    const posBtnGeom  = new THREE.CylinderGeometry(posBtnR * 0.85, posBtnR, posBtnH, 16)
    const negDiscGeom = new THREE.CylinderGeometry(negDiscR, negDiscR, negDiscH, 24)

    // Materials
    const bodyMat = this.isElectron
      ? new THREE.MeshStandardMaterial({ color: new THREE.Color('#1d4ed8'), metalness: 0.0, roughness: 0.55 })
      : new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#1d4ed8'), metalness: 0.0, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.4 })
    const steelMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#c0c0c0'), metalness: 0.85, roughness: 0.2 })

    // Instanced meshes
    const bodyMesh    = new THREE.InstancedMesh(bodyGeom,    bodyMat,  totalCells)
    const posDiscMesh = new THREE.InstancedMesh(posDiscGeom, steelMat, totalCells)
    const posBtnMesh  = new THREE.InstancedMesh(posBtnGeom,  steelMat, totalCells)
    const negDiscMesh = new THREE.InstancedMesh(negDiscGeom, steelMat, totalCells)
    if (!this.isElectron) {
      bodyMesh.castShadow = bodyMesh.receiveShadow = true
      posDiscMesh.castShadow = true
      posBtnMesh.castShadow = true
      negDiscMesh.castShadow = true
    }

    const startX = -(S * stepX) / 2 + stepX / 2
    const startZ = -(P * stepZ) / 2 + stepZ / 2
    const yCenter = (-housingH / 2) + WALL_MM + bodyH / 2

    const qFlip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI)
    const qNorm = new THREE.Quaternion()
    const scale1 = new THREE.Vector3(1, 1, 1)

    let i = 0
    for (let s = 0; s < S; s++) {
      const x = startX + s * stepX
      const flipped = s % 2 === 1

      for (let p = 0; p < P; p++) {
        const z = startZ + p * stepZ
        const pos = new THREE.Vector3(x, yCenter, z)

        bodyMesh.setMatrixAt(i, new THREE.Matrix4().compose(pos, flipped ? qFlip : qNorm, scale1))

        // Positive end = disc + button, Negative end = disc only
        // Flush placement: disc sits right at body edge, no gap
        const posY = flipped ? yCenter - bodyH / 2 : yCenter + bodyH / 2
        const negY = flipped ? yCenter + bodyH / 2 : yCenter - bodyH / 2
        const posDir = flipped ? -1 : 1  // which direction positive end faces
        const negDir = -posDir

        posDiscMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, posY + posDir * posDiscH / 2, z))
        posBtnMesh.setMatrixAt(i,  new THREE.Matrix4().makeTranslation(x, posY + posDir * (posDiscH + posBtnH / 2), z))
        negDiscMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, negY + negDir * negDiscH / 2, z))

        i++
      }
    }

    bodyMesh.instanceMatrix.needsUpdate    = true
    posDiscMesh.instanceMatrix.needsUpdate = true
    posBtnMesh.instanceMatrix.needsUpdate  = true
    negDiscMesh.instanceMatrix.needsUpdate = true

    const cellGroup = new THREE.Group()
    cellGroup.name = 'cells'
    cellGroup.add(bodyMesh)

    const termGroup = new THREE.Group()
    termGroup.name = 'terminals'
    termGroup.add(posDiscMesh, posBtnMesh, negDiscMesh)

    this._addGroup('cells', cellGroup)
    this._addGroup('terminals', termGroup)
  }

  _buildCylindricalCellsFromGLTF(S, P, cell_used, housingH) {
    const diameter = cell_used.diameter_mm || cell_used.longueur_mm
    const height   = cell_used.hauteur_mm
    const stepX    = diameter + this.cellGap
    const stepZ    = diameter + this.cellGap
    const totalCells = S * P

    // ── Collect all Meshes from the GLTF scene ─────────────────────────────
    const gltfMeshes = []
    this._cellGltf.scene.updateMatrixWorld(true)
    this._cellGltf.scene.traverse(obj => {
      if (obj.isMesh) gltfMeshes.push(obj)
    })

    // ── Compute bounding box of the whole model ─────────────────────────────
    const box = new THREE.Box3()
    gltfMeshes.forEach(m => box.expandByObject(m))
    const modelSize   = new THREE.Vector3()
    const modelCenter = new THREE.Vector3()
    box.getSize(modelSize)
    box.getCenter(modelCenter)

    // Scale so model fits actual cell dimensions.
    // GLTF Y-up: model height → cell hauteur_mm, model XZ → cell diameter_mm.
    const scaleY  = modelSize.y > 0 ? height   / modelSize.y : 1
    const scaleXZ = Math.max(modelSize.x, modelSize.z) > 0
      ? diameter / Math.max(modelSize.x, modelSize.z) : 1

    // ── Group geometries by material, bake world transform + scale ──────────
    const matGroups = new Map() // THREE.Material → THREE.BufferGeometry[]

    gltfMeshes.forEach(m => {
      // Clone geometry and bake world transform so everything is in model-local space
      const geom = m.geometry.clone()
      geom.applyMatrix4(m.matrixWorld)

      // Re-center around origin
      geom.translate(-modelCenter.x, -modelCenter.y, -modelCenter.z)

      // Apply cell-dimension scale
      const pos = geom.attributes.position
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) * scaleXZ)
        pos.setY(i, pos.getY(i) * scaleY)
        pos.setZ(i, pos.getZ(i) * scaleXZ)
      }
      pos.needsUpdate = true
      geom.computeVertexNormals()

      const srcMat = Array.isArray(m.material) ? m.material[0] : m.material

      // Find existing slot for this source material uuid
      let targetMat = null
      for (const [mat] of matGroups) {
        if (mat._srcUuid === srcMat.uuid) { targetMat = mat; break }
      }

      if (!targetMat) {
        // Clone material so _disposeGroup can safely dispose it
        const cloned = srcMat.clone()
        cloned._srcUuid = srcMat.uuid

        const c = cloned.color
        const isWhite = c.r > 0.8 && c.g > 0.8 && c.b > 0.8
        const isGreen = c.g > c.r * 1.5 && c.g > c.b * 1.5

        if (isWhite) {
          // Terminal caps — steel look
          cloned.metalness = 0.85
          cloned.roughness = 0.2
        } else if (isGreen) {
          // Insulator band → cyan
          cloned.color.set('#0080FF')
          cloned.metalness = 0.0
          cloned.roughness = 0.5
        } else {
          // Body (PVC wrap) — matte plastic, no metalness
          cloned.metalness = 0.0
          cloned.roughness = 0.55
        }

        matGroups.set(cloned, [])
        targetMat = cloned
      }
      matGroups.get(targetMat).push(geom)
    })

    // ── Merge geometries within each material group ─────────────────────────
    const instancedMeshes = []
    matGroups.forEach((geoms, mat) => {
      const merged = mergeGeometries(geoms, false)
      geoms.forEach(g => g.dispose())
      const im = new THREE.InstancedMesh(merged, mat, totalCells)
      im.name = 'cell_gltf'
      if (!this.isElectron) { im.castShadow = true; im.receiveShadow = true }
      instancedMeshes.push(im)
    })

    // ── Position each instance ──────────────────────────────────────────────
    const startX  = -(S * stepX) / 2 + stepX / 2
    const startZ  = -(P * stepZ) / 2 + stepZ / 2
    const yCenter = (-housingH / 2) + WALL_MM + height / 2

    const qFlip  = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI)
    const qNorm  = new THREE.Quaternion()
    const scaleV = new THREE.Vector3(1, 1, 1)

    let idx = 0
    for (let s = 0; s < S; s++) {
      const x       = startX + s * stepX
      const flipped = s % 2 === 1
      for (let p = 0; p < P; p++) {
        const z    = startZ + p * stepZ
        const mat4 = new THREE.Matrix4().compose(
          new THREE.Vector3(x, yCenter, z),
          flipped ? qFlip : qNorm,
          scaleV
        )
        instancedMeshes.forEach(im => im.setMatrixAt(idx, mat4))
        idx++
      }
    }
    instancedMeshes.forEach(im => { im.instanceMatrix.needsUpdate = true })

    // Terminals are baked into the GLTF model; empty group keeps layer-toggle consistent
    const cellGroup = new THREE.Group()
    cellGroup.name = 'cells'
    instancedMeshes.forEach(im => cellGroup.add(im))

    const termGroup = new THREE.Group()
    termGroup.name = 'terminals'

    this._addGroup('cells', cellGroup)
    this._addGroup('terminals', termGroup)
  }

  _buildPrismaticCells(S, P, cell_used, housingH, verdict) {
    const totalCells = S * P


    const sizeX = cell_used.hauteur_mm
    const sizeZ = cell_used.largeur_mm
    const bodyH = cell_used.longueur_mm * 0.95

    const stepX = sizeX + this.cellGap
    const stepZ = sizeZ + this.cellGap

    const posOffZ =  sizeZ * TERM_OFFSET_RATIO
    const negOffZ = -sizeZ * TERM_OFFSET_RATIO

    // Dimensions for highly realistic components
    const wrapH = bodyH - 2
    const yCenter = (-housingH / 2) + WALL_MM + bodyH / 2
    const yWrap = (-housingH / 2) + WALL_MM + wrapH / 2
    const yCap  = yWrap + wrapH / 2 + 1     // cap is 2mm thick
    const termY = yCap + 1                  // top black surface

    // Geometries
    const wrapGeom = new THREE.BoxGeometry(sizeX, wrapH, sizeZ)
    const capGeom  = new THREE.BoxGeometry(sizeX, 2, sizeZ)
    // Terminal must fit within the cell's thin face (sizeX), not exceed half the cell thickness
    const termRadius = Math.min(sizeX * 0.32, sizeZ * 0.12, 7)
    const ringGeom = new THREE.CylinderGeometry(termRadius * 1.2, termRadius * 1.2, 1.5, 16)
    const baseGeom = new THREE.CylinderGeometry(termRadius, termRadius, 2.5, 16)
    const studGeom = new THREE.CylinderGeometry(Math.min(2.5, termRadius * 0.45), Math.min(2.5, termRadius * 0.45), 7, 12)
    const qrGeom   = new THREE.BoxGeometry(Math.min(8, sizeX * 0.6), 0.4, Math.min(8, sizeX * 0.6))
    const nutGeom  = new THREE.CylinderGeometry(Math.min(4, termRadius * 0.65), Math.min(4, termRadius * 0.65), 1.5, 6) // Hex nut

    // Materials
    const wrapMat = this.isElectron
      ? new THREE.MeshStandardMaterial({ color: '#2563eb', metalness: 0.1, roughness: 0.6 })
      : new THREE.MeshPhysicalMaterial({ color: '#2563eb', metalness: 0.1, roughness: 0.6, clearcoat: 0.5, clearcoatRoughness: 0.3 })
    const capMat     = new THREE.MeshStandardMaterial({ color: '#171717', metalness: 0.2, roughness: 0.7 })
    const termMat    = new THREE.MeshStandardMaterial({ color: '#d4d4d4', metalness: 0.8, roughness: 0.25 })
    const posRingMat = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.0, roughness: 1.0 }) // Pure White Pos
    const negRingMat = new THREE.MeshStandardMaterial({ color: '#000000', metalness: 0.0, roughness: 1.0 }) // Pure Black Neg
    const qrMat      = new THREE.MeshStandardMaterial({ color: '#e5e7eb', metalness: 0.2, roughness: 0.5 })

    const wrapMesh     = new THREE.InstancedMesh(wrapGeom, wrapMat, totalCells)
    const capMesh      = new THREE.InstancedMesh(capGeom, capMat, totalCells)
    const qrMesh       = new THREE.InstancedMesh(qrGeom, qrMat, totalCells)
    const posRingMesh  = new THREE.InstancedMesh(ringGeom, posRingMat, totalCells)
    const negRingMesh  = new THREE.InstancedMesh(ringGeom, negRingMat, totalCells)
    const termBaseMesh = new THREE.InstancedMesh(baseGeom, termMat, totalCells * 2)
    const termStudMesh = new THREE.InstancedMesh(studGeom, termMat, totalCells * 2)
    const nutMesh      = new THREE.InstancedMesh(nutGeom, termMat, totalCells * 2)

    if (!this.isElectron) {
      wrapMesh.castShadow = wrapMesh.receiveShadow = true
      termBaseMesh.castShadow = termStudMesh.castShadow = nutMesh.castShadow = true
    }

    const startX  = -(S * stepX) / 2 + stepX / 2
    const startZ  = -(P * stepZ) / 2 + stepZ / 2

    const baseEdge = new THREE.EdgesGeometry(new THREE.BoxGeometry(sizeX, bodyH, sizeZ))
    const basePts  = baseEdge.getAttribute('position').array
    const edgePts  = []

    let c = 0
    let t = 0
    for (let s = 0; s < S; s++) {
      const x = startX + s * stepX
      for (let p = 0; p < P; p++) {
        const z = startZ + p * stepZ
        const flipped = s % 2 === 1
        const pZ = z + (flipped ? negOffZ : posOffZ)
        const nZ = z + (flipped ? posOffZ : negOffZ)

        // Body + Cap
        wrapMesh.setMatrixAt(c, new THREE.Matrix4().makeTranslation(x, yWrap, z))
        capMesh.setMatrixAt(c, new THREE.Matrix4().makeTranslation(x, yCap, z))

        // QR Code
        qrMesh.setMatrixAt(c, new THREE.Matrix4().makeTranslation(x, termY + 0.2, z))

        // Insulator Rings (stark contrast)
        posRingMesh.setMatrixAt(c, new THREE.Matrix4().makeTranslation(x, termY + 0.75, pZ))
        negRingMesh.setMatrixAt(c, new THREE.Matrix4().makeTranslation(x, termY + 0.75, nZ))

        // POS Terminal
        termBaseMesh.setMatrixAt(t, new THREE.Matrix4().makeTranslation(x, termY + 1.25, pZ))
        termStudMesh.setMatrixAt(t, new THREE.Matrix4().makeTranslation(x, termY + 6.0, pZ))
        nutMesh.setMatrixAt(t, new THREE.Matrix4().makeTranslation(x, termY + 4.25, pZ))
        t++
        
        // NEG Terminal
        termBaseMesh.setMatrixAt(t, new THREE.Matrix4().makeTranslation(x, termY + 1.25, nZ))
        termStudMesh.setMatrixAt(t, new THREE.Matrix4().makeTranslation(x, termY + 6.0, nZ))
        nutMesh.setMatrixAt(t, new THREE.Matrix4().makeTranslation(x, termY + 4.25, nZ))
        t++

        for (let v = 0; v < basePts.length; v += 3) {
          edgePts.push(basePts[v] + x, basePts[v + 1] + yCenter, basePts[v + 2] + z)
        }
        c++
      }
    }

    [wrapMesh, capMesh, qrMesh, posRingMesh, negRingMesh, termBaseMesh, termStudMesh, nutMesh].forEach(m => {
      m.instanceMatrix.needsUpdate = true
    })
    baseEdge.dispose()

    const edgeGeom = new THREE.BufferGeometry()
    edgeGeom.setAttribute('position', new THREE.Float32BufferAttribute(edgePts, 3))
    const edgeMat = new THREE.LineBasicMaterial({ color: '#93c5fd', opacity: 0.7, transparent: true })
    const edgeLines = new THREE.LineSegments(edgeGeom, edgeMat)

    const cellGroup = new THREE.Group()
    cellGroup.name = 'cells'
    cellGroup.add(wrapMesh, capMesh, qrMesh, edgeLines)

    const termGroup = new THREE.Group()
    termGroup.name = 'terminals'
    termGroup.add(posRingMesh, negRingMesh, termBaseMesh, termStudMesh, nutMesh)

    this._addGroup('cells', cellGroup)
    this._addGroup('terminals', termGroup)
  }

  _buildNickelStrips(S, P, cell_used, housingH) {
    const diameter = cell_used.diameter_mm || cell_used.longueur_mm
    const height   = cell_used.hauteur_mm
    const stepX    = diameter + this.cellGap
    const stepZ    = diameter + this.cellGap

    // When the GLTF mesh is used the model spans the full cell height (terminals included).
    // When procedural, body is 96% of height with 0.3mm terminal discs on top/bottom.
    const bodyH    = this._cellGltf ? height      : height * 0.96
    const posDiscH = this._cellGltf ? 0           : 0.3
    const negDiscH = this._cellGltf ? 0           : 0.3

    const yCenter = (-housingH / 2) + WALL_MM + bodyH / 2
    // Bracket protrudes BRACKET_H*0.25 above/below the cell body end.
    // Nickel strips must sit on top of (above) the bracket, not inside it.
    const bracketProtrude = BRACKET_H * 0.25
    const yTop    = yCenter + bodyH / 2 + Math.max(posDiscH, bracketProtrude) + 0.3
    const yBottom = yCenter - bodyH / 2 - Math.max(negDiscH, bracketProtrude) - 0.3

    const stripThickness = 0.5              // visible but realistic (was 0.15 — too thin)
    const pWidth  = diameter * 0.6          // strip width in X (covers terminal area)
    // Parallel strip spans from leftmost to rightmost cell centre ± half a diameter
    const pLength = P > 1 ? (P - 1) * stepZ + diameter : diameter
    const pStrGeom = new THREE.BoxGeometry(pWidth, stripThickness, pLength)

    const jWidth  = diameter * 0.35         // jumper width in Z
    const jLength = stepX                   // jumper spans centre-to-centre of adjacent columns
    const jGeom   = new THREE.BoxGeometry(jLength, stripThickness, jWidth)

    const mat = this.isElectron
      ? new THREE.MeshStandardMaterial({ color: '#d4d4d4', metalness: 0.85, roughness: 0.25 })
      : new THREE.MeshPhysicalMaterial({ color: '#d4d4d4', metalness: 0.85, roughness: 0.2, clearcoat: 0.6 })

    const pMesh = new THREE.InstancedMesh(pStrGeom, mat, S * 2)
    const totalJumpers = (S - 1) * P
    const jMesh = totalJumpers > 0 ? new THREE.InstancedMesh(jGeom, mat, totalJumpers) : null

    if (!this.isElectron) {
      pMesh.castShadow = pMesh.receiveShadow = true
      if (jMesh) jMesh.castShadow = jMesh.receiveShadow = true
    }

    const startX = -(S * stepX) / 2 + stepX / 2
    const startZ = -(P * stepZ) / 2 + stepZ / 2

    let pIdx = 0
    let jIdx = 0

    for (let s = 0; s < S; s++) {
      const x = startX + s * stepX

      // Every series column gets a parallel strip at both ends.
      // Top strip: on the + terminals for normal cells (s even), on − terminals for flipped cells (s odd).
      // Bottom strip: the complementary pole.
      pMesh.setMatrixAt(pIdx++, new THREE.Matrix4().makeTranslation(x, yTop,    0))
      pMesh.setMatrixAt(pIdx++, new THREE.Matrix4().makeTranslation(x, yBottom, 0))

      // Series jumpers bridge the gap between column s and column s+1.
      // For s even: s has + on top and − on bottom.
      //   s(−) is at BOTTOM, s+1(+) is at BOTTOM (s+1 is flipped) → jumper at BOTTOM.
      // For s odd:  s has − on top.
      //   s(−) is at TOP, s+1(+) is at TOP (s+1 is normal) → jumper at TOP.
      if (s < S - 1) {
        const isTop = s % 2 === 1          // odd s → jumper on top; even s → jumper on bottom
        const jY    = isTop ? yTop + 0.25 : yBottom - 0.25
        const jX    = x + stepX / 2

        for (let p = 0; p < P; p++) {
          const z = startZ + p * stepZ
          jMesh.setMatrixAt(jIdx++, new THREE.Matrix4().makeTranslation(jX, jY, z))
        }
      }
    }

    pMesh.instanceMatrix.needsUpdate = true
    if (jMesh) jMesh.instanceMatrix.needsUpdate = true

    const group = new THREE.Group()
    group.name = 'busbars'
    group.add(pMesh)
    if (jMesh) group.add(jMesh)

    this._addGroup('busbars', group)
  }

  _buildPrismaticBusbars(S, P, cell_used, housingH) {

    const sizeX = cell_used.hauteur_mm
    const sizeZ = cell_used.largeur_mm
    const bodyH = cell_used.longueur_mm * 0.95
    const stepX = sizeX + this.cellGap
    const stepZ = sizeZ + this.cellGap

    const termW = Math.min(sizeZ * 0.15, 22)
    const termD = Math.min(sizeX * 0.8, 14)
    const termH = Math.max(8, cell_used.longueur_mm * 0.07)

    const posOffZ = sizeZ * TERM_OFFSET_RATIO
    const negOffZ = -sizeZ * TERM_OFFSET_RATIO

    const yCenter = (-housingH / 2) + WALL_MM + bodyH / 2
    // The top black surface is at yCenter + bodyH / 2 + 1
    // The metal base pad sits 1.25mm above that (total offset 2.25)
    // Busbar is 1mm thick, sits precisely on top of the base pad
    const busbarThickness = 1.0
    const busbarY = yCenter + bodyH / 2 + 2.25 + busbarThickness / 2

    const copperMat = this.isElectron
      ? new THREE.MeshStandardMaterial({ color: '#d97742', metalness: 0.8, roughness: 0.3 })
      : new THREE.MeshPhysicalMaterial({ color: '#d97742', metalness: 0.8, roughness: 0.2, clearcoat: 0.2 })

    const group = new THREE.Group()
    group.name = 'busbars'

    const startX = -(S * stepX) / 2 + stepX / 2
    const startZ = -(P * stepZ) / 2 + stepZ / 2

    // Build the snake path starting from bottom-right, zigzagging upward.
    // For 8S2P: row1 R->L, vertical at left edge, row0 L->R
    // Pack+ = first cell's pos (bottom-right), Pack- = last cell's neg (top-right)
    const snake = []
    for (let p = P - 1; p >= 0; p--) {
      const rowInSnake = P - 1 - p
      if (rowInSnake % 2 === 0) {
        for (let s = S - 1; s >= 0; s--) snake.push({ s, p })
      } else {
        for (let s = 0; s < S; s++) snake.push({ s, p })
      }
    }

    // Helper: get the world-space Z of the pos and neg terminals for a cell
    const termZ = (s, p) => {
      const flipped = s % 2 === 1
      const z = startZ + p * stepZ
      return {
        posZ: z + (flipped ? negOffZ : posOffZ),
        negZ: z + (flipped ? posOffZ : negOffZ)
      }
    }

    // For each consecutive pair in the snake, place exactly one busbar
    // connecting snake[i].neg -> snake[i+1].pos
    const hBars = []
    const vBars = []

    for (let i = 0; i < snake.length - 1; i++) {
      const a = snake[i]
      const b = snake[i + 1]
      const tA = termZ(a.s, a.p)
      const tB = termZ(b.s, b.p)

      if (a.p === b.p) {
        // Within-row: horizontal busbar
        const xA = startX + a.s * stepX
        const xB = startX + b.s * stepX
        hBars.push({ x: (xA + xB) / 2, z: tA.negZ })
      } else {
        // Row transition: vertical busbar at the edge
        const negZ = tA.negZ
        const posZ = tB.posZ
        const len = Math.abs(negZ - posZ)
        vBars.push({ x: startX + a.s * stepX, z: (negZ + posZ) / 2, len })
      }
    }

    // Render horizontal busbars (within-row links)
    if (hBars.length > 0) {
      const hGeom = new THREE.BoxGeometry(stepX, busbarThickness, termW * 0.8)
      const hMesh = new THREE.InstancedMesh(hGeom, copperMat, hBars.length)
      if (!this.isElectron) hMesh.castShadow = true
      hBars.forEach((b, idx) => {
        hMesh.setMatrixAt(idx, new THREE.Matrix4().makeTranslation(b.x, busbarY, b.z))
      })
      hMesh.instanceMatrix.needsUpdate = true
      group.add(hMesh)
    }

    // Render vertical busbars (row-transition links at the edges)
    // Each vBar may have a different length, so we create individual meshes
    if (vBars.length > 0) {
      const vGroup = new THREE.Group()
      vBars.forEach((b) => {
        const barLen = Math.max(b.len + termW * 0.3, termW)
        const vGeom = new THREE.BoxGeometry(termD * 0.8, busbarThickness, barLen)
        const vMeshSingle = new THREE.Mesh(vGeom, copperMat)
        vMeshSingle.position.set(b.x, busbarY, b.z)
        if (!this.isElectron) vMeshSingle.castShadow = true
        vGroup.add(vMeshSingle)
      })
      group.add(vGroup)
    }

    this._addGroup('busbars', group)
  }

  /**
   * Builds the top and bottom cell holder brackets as a cross-bar grid.
   * Each bracket is a lattice of dark plastic bars (P+1 bars in Z, S+1 bars in X).
   * The open squares in the grid are where cells poke through — no geometry covers the cell ends.
   *
   * Bottom bracket: cells sit in the recesses of the grid (negative end cradled).
   * Top bracket:    positive terminals protrude through the open slots.
   */
  _buildCylindricalBrackets(S, P, cell_used, housingH) {
    const diameter = cell_used.diameter_mm || cell_used.longueur_mm
    const height   = cell_used.hauteur_mm
    const stepX    = diameter + this.cellGap
    const stepZ    = diameter + this.cellGap

    const bodyH   = this._cellGltf ? height : height * 0.96
    const yCenter = (-housingH / 2) + WALL_MM + bodyH / 2
    const barH    = BRACKET_H
    const gap     = 0.4    // clearance between cells and bracket

    const totalX  = S * stepX
    const totalZ  = P * stepZ
    const startX  = -totalX / 2 + stepX / 2
    const startZ  = -totalZ / 2 + stepZ / 2

    // Bar width = the plastic between adjacent cell holes (gap between cell bodies)
    const barWx = Math.max(2.5, Math.min(6, stepX - diameter))
    const barWz = Math.max(2.5, Math.min(6, stepZ - diameter))

    const mat = new THREE.MeshStandardMaterial({ color: '#111827', metalness: 0.05, roughness: 0.9 })
    const group = new THREE.Group()
    group.name = 'brackets'

    const addGrid = (yBase) => {
      const yMid = yBase + barH / 2

      // P+1 bars running along X, spaced at every Z boundary between parallel rows
      for (let p = 0; p <= P; p++) {
        const z    = startZ + (p - 0.5) * stepZ
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(totalX + barWx * 2, barH, barWz), mat
        )
        mesh.position.set(0, yMid, z)
        if (!this.isElectron) { mesh.castShadow = true; mesh.receiveShadow = true }
        group.add(mesh)
      }

      // S+1 bars running along Z, spaced at every X boundary between series columns
      for (let s = 0; s <= S; s++) {
        const x    = startX + (s - 0.5) * stepX
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(barWx, barH, totalZ + barWz * 2), mat
        )
        mesh.position.set(x, yMid, 0)
        if (!this.isElectron) { mesh.castShadow = true; mesh.receiveShadow = true }
        group.add(mesh)
      }
    }

    // Bracket straddles the cell body end: 75% grips the cell body, 25% extends outward.
    // This makes the cells appear cradled inside the bracket as in the reference image.
    // yBase is the bracket's BOTTOM edge; bracket spans [yBase, yBase + barH].
    const grip = barH * 0.75   // how far the bracket extends INTO the cell body
    addGrid(yCenter + bodyH / 2 - grip)          // top bracket: grips top of cell body
    addGrid(yCenter - bodyH / 2 - barH + grip)   // bottom bracket: grips bottom of cell body

    this._addGroup('brackets', group)
  }

  _buildPrismaticInsulationCards(S, P, cell_used, housingH) {
    if (S < 2) return


    const bodyH = cell_used.longueur_mm * 0.95
    const sizeX = cell_used.hauteur_mm
    const sizeZ = cell_used.largeur_mm
    const stepX = sizeX + this.cellGap
    const stepZ = sizeZ + this.cellGap
    const startX = -(S * stepX) / 2 + stepX / 2
    const yCenter = (-housingH / 2) + WALL_MM + bodyH / 2
    const cardW = P * stepZ

    const geom = new THREE.BoxGeometry(0.3, bodyH, cardW)
    const mat  = new THREE.MeshStandardMaterial({ color: '#f97316', metalness: 0.0, roughness: 0.9 })
    const mesh = new THREE.InstancedMesh(geom, mat, S - 1)

    for (let s = 0; s < S - 1; s++) {
      const cardX = startX + s * stepX + stepX / 2
      mesh.setMatrixAt(s, new THREE.Matrix4().makeTranslation(cardX, yCenter, 0))
    }
    mesh.instanceMatrix.needsUpdate = true

    const group = new THREE.Group()
    group.name = 'insulation_cards'
    group.add(mesh)

    this._addGroup('insulation_cards', group)
  }

  _buildPrismaticSidePlates(S, P, cell_used, housingH) {

    const bodyH = cell_used.longueur_mm * 0.95
    const yCenter = (-housingH / 2) + WALL_MM + bodyH / 2
    const sizeX = cell_used.hauteur_mm
    const sizeZ = cell_used.largeur_mm
    const stepX = sizeX + this.cellGap
    const stepZ = sizeZ + this.cellGap
    // Outer face of the last cell (no phantom gap beyond the array)
    const arrayHalfX = (S * stepX - this.cellGap) / 2
    const arrayHalfZ = (P * stepZ - this.cellGap) / 2

    const mat = new THREE.MeshStandardMaterial({ color: '#6b7280', metalness: 0.4, roughness: 0.6 })

    const group = new THREE.Group()
    group.name = 'side_plates'

    // Side plates at Z extremes (clamp along Z axis)
    const sideGeom = new THREE.BoxGeometry(arrayHalfX * 2, bodyH, 3)
    const sideZ = arrayHalfZ + 1.5
    const sPlus  = new THREE.Mesh(sideGeom, mat)
    sPlus.position.set(0, yCenter,  sideZ)
    const sMinus = new THREE.Mesh(sideGeom, mat)
    sMinus.position.set(0, yCenter, -sideZ)
    group.add(sPlus, sMinus)

    // End plates at X extremes (thicker, clamp along X axis)
    const endGeom = new THREE.BoxGeometry(5, bodyH, arrayHalfZ * 2 + 6)
    const endX = arrayHalfX + 2.5
    const ePlus  = new THREE.Mesh(endGeom, mat)
    ePlus.position.set( endX, yCenter, 0)
    const eMinus = new THREE.Mesh(endGeom, mat)
    eMinus.position.set(-endX, yCenter, 0)
    group.add(ePlus, eMinus)

    this._addGroup('side_plates', group)
  }

  _buildBMSBoard(S, P, cell_used, housingH, isCylindrical) {

    let yCenter, totalX, totalZ

    if (isCylindrical) {
      const diameter = cell_used.diameter_mm || cell_used.longueur_mm
      const stepX = diameter + this.cellGap
      const stepZ = diameter + this.cellGap
      const bodyH = cell_used.hauteur_mm * 0.96
      yCenter = (-housingH / 2) + WALL_MM + bodyH / 2
      totalX = S * stepX
      totalZ = P * stepZ
    } else {
      const sizeX = cell_used.hauteur_mm
      const sizeZ = cell_used.largeur_mm
      const bodyH = cell_used.longueur_mm * 0.95
      const stepX = sizeX + this.cellGap
      const stepZ = sizeZ + this.cellGap
      yCenter = (-housingH / 2) + WALL_MM + bodyH / 2
      totalX = S * stepX
      totalZ = P * stepZ
    }

    // Daly-style Heatsink BMS - length scales with Series count to accommodate pins
    const bmsL     = Math.max(80, S * 8 + 30)
    const bmsW     = 50
    const bmsThick = 15

    // Mount vertically on the front face (+Z side)
    const bmsX = 0
    const bmsY = yCenter
    const bmsZ = totalZ / 2 + bmsThick / 2 + 1

    const group = new THREE.Group()
    group.name = 'bms'

    // Red aluminum heatsink body
    const redMat = new THREE.MeshStandardMaterial({ color: '#dc2626', metalness: 0.6, roughness: 0.4 })
    const bodyGeom = new THREE.BoxGeometry(bmsL - 10, bmsW, bmsThick)
    const body = new THREE.Mesh(bodyGeom, redMat)
    body.position.set(bmsX, bmsY, bmsZ)
    group.add(body)

    // Black plastic endcaps
    const blackMat = new THREE.MeshStandardMaterial({ color: '#111827', metalness: 0.1, roughness: 0.8 })
    const capGeom = new THREE.BoxGeometry(5, bmsW, bmsThick)
    
    const leftCap = new THREE.Mesh(capGeom, blackMat)
    leftCap.position.set(bmsX - bmsL / 2 + 2.5, bmsY, bmsZ)
    group.add(leftCap)

    const rightCap = new THREE.Mesh(capGeom, blackMat)
    rightCap.position.set(bmsX + bmsL / 2 - 2.5, bmsY, bmsZ)
    group.add(rightCap)

    // Dynamic S+1 Balance Pins along the top edge
    const brassMat = new THREE.MeshStandardMaterial({ color: '#d97706', metalness: 0.8, roughness: 0.2 })
    const pinGeom = new THREE.CylinderGeometry(0.8, 0.8, 3, 8)
    const topPins = []
    
    const pinStartX = bmsX - bmsL / 2 + 15
    const pinEndX   = bmsX + bmsL / 2 - 15
    for (let i = 0; i <= S; i++) {
        // distribute from left to right equally
        const px = pinStartX + (i / S) * (pinEndX - pinStartX)
        const py = bmsY + bmsW / 2 + 1.5
        const pz = bmsZ
        const pin = new THREE.Mesh(pinGeom, brassMat)
        pin.position.set(px, py, pz)
        group.add(pin)
        topPins.push(new THREE.Vector3(px, py, pz))
    }

    // Power Ports on the Left Edge
    const portGeom = new THREE.CylinderGeometry(2, 2, 4, 12)
    
    // C- (Charge Port, Top)
    const portC = new THREE.Mesh(portGeom, brassMat)
    portC.rotation.z = Math.PI / 2
    portC.position.set(bmsX - bmsL / 2 - 2, bmsY + 15, bmsZ)
    group.add(portC)

    // B- (Battery Power, Middle)
    const portB = new THREE.Mesh(portGeom, brassMat)
    portB.rotation.z = Math.PI / 2
    portB.position.set(bmsX - bmsL / 2 - 2, bmsY, bmsZ)
    group.add(portB)

    // P- (Load Power, Bottom)
    const portP = new THREE.Mesh(portGeom, brassMat)
    portP.rotation.z = Math.PI / 2
    portP.position.set(bmsX - bmsL / 2 - 2, bmsY - 15, bmsZ)
    group.add(portP)

    // Store BMS positions for precise wire routing
    this._bmsPos = {
      bmsX, bmsY, bmsL, bmsZ,
      topPins,
      portC: new THREE.Vector3(bmsX - bmsL / 2 - 4, bmsY + 15, bmsZ),
      portB: new THREE.Vector3(bmsX - bmsL / 2 - 4, bmsY,      bmsZ),
      portP: new THREE.Vector3(bmsX - bmsL / 2 - 4, bmsY - 15, bmsZ),
    }

    this._addGroup('bms', group)
  }

  _buildBalanceWires(S, P, cell_used, housingH, isCylindrical) {
    if (!this._bmsPos) return

    const { topPins } = this._bmsPos

    const wireR = 0.35
    const group = new THREE.Group()
    group.name = 'balance_wires'

    let startX, startZ, stepX, stepZ, yTop, yBottom, packFrontZ

    if (isCylindrical) {
      const diameter = cell_used.diameter_mm || cell_used.longueur_mm
      stepX = diameter + this.cellGap
      stepZ = stepX
      const bodyH = cell_used.hauteur_mm * 0.96
      const yCenter = (-housingH / 2) + WALL_MM + bodyH / 2
      yTop       = yCenter + bodyH / 2 + 1.2
      yBottom    = yCenter - bodyH / 2 - 0.6
      startX     = -(S * stepX) / 2 + stepX / 2
      startZ     = 0
      packFrontZ = (P * stepZ) / 2
    } else {
      const sizeX = cell_used.hauteur_mm
      const sizeZ = cell_used.largeur_mm
      const bodyH = cell_used.longueur_mm * 0.95
      const termH = Math.max(8, cell_used.longueur_mm * 0.07)
      stepX = sizeX + this.cellGap
      stepZ = sizeZ + this.cellGap
      const yCenter = (-housingH / 2) + WALL_MM + bodyH / 2
      yTop       = yCenter + bodyH / 2 + termH + 2.5
      yBottom    = yTop
      startX     = -(S * stepX) / 2 + stepX / 2
      startZ     = -(P * stepZ) / 2 + stepZ / 2
      packFrontZ = (P * stepZ) / 2
    }

    // Horizontal harness plane: wires rise to this Y, travel to the BMS front face, then fan to pins
    const harnessY = yTop + 14

    for (let i = 0; i <= S; i++) {
      const color = i === 0 ? '#111827' : '#ef4444'

      let tapX, tapZ, tapY
      if (isCylindrical) {
        tapX = i === 0 ? startX : startX + (i - 1) * stepX
        tapY = (i === 0 || (i - 1) % 2 === 0) ? yTop : yBottom
        tapZ = startZ
        // Wire 0 is pack−, always at the bottom of the first column
        if (i === 0) tapY = yBottom
      } else {
        const posOffZ =  cell_used.largeur_mm * TERM_OFFSET_RATIO
        const negOffZ = -cell_used.largeur_mm * TERM_OFFSET_RATIO
        tapY = yTop
        tapX = i === 0 ? startX : startX + (i - 1) * stepX
        tapZ = i === 0 ? startZ + negOffZ
                       : startZ + ((i - 1) % 2 === 1 ? negOffZ : posOffZ)
      }

      const pin = topPins[i]
      const points = [
        new THREE.Vector3(tapX,  tapY,        tapZ),        // at terminal tap
        new THREE.Vector3(tapX,  harnessY,    tapZ),        // rise straight up
        new THREE.Vector3(tapX,  harnessY,    packFrontZ),  // sweep to front edge of pack
        new THREE.Vector3(pin.x, harnessY,    pin.z),       // align to pin X at harness level
        new THREE.Vector3(pin.x, pin.y + 4,   pin.z),       // descend toward pin
        new THREE.Vector3(pin.x, pin.y,       pin.z),       // arrive at pin
      ]

      const wireMat = new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.7 })
      group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 28, wireR, 8, false), wireMat))
    }

    this._addGroup('balance_wires', group)
  }

  _buildMainCables(S, P, cell_used, housingH, isCylindrical) {
    if (!this._bmsPos) return

    const { portC, portB, portP, bmsX, bmsY, bmsL, bmsZ } = this._bmsPos

    const cableR = 2.5

    let packPlus, packMinus, packTop

    if (isCylindrical) {
      const diameter = cell_used.diameter_mm || cell_used.longueur_mm
      const stepX    = diameter + this.cellGap
      const bodyH    = cell_used.hauteur_mm * 0.96
      const yCenter  = (-housingH / 2) + WALL_MM + bodyH / 2
      packTop        = yCenter + bodyH / 2 + 1.2
      const yBottom  = yCenter - bodyH / 2 - 0.6
      const firstX   = -(S * stepX) / 2 + stepX / 2
      const lastX    = firstX + (S - 1) * stepX
      const lastFlipped = (S - 1) % 2 === 1
      packPlus  = new THREE.Vector3(lastX,  lastFlipped ? yBottom : packTop, 0)
      packMinus = new THREE.Vector3(firstX, yBottom, 0)
    } else {
      const sizeX = cell_used.hauteur_mm
      const sizeZ = cell_used.largeur_mm
      const stepX = sizeX + this.cellGap
      const stepZ = sizeZ + this.cellGap
      const bodyH = cell_used.longueur_mm * 0.95
      const termH = Math.max(8, cell_used.longueur_mm * 0.07)
      const yCenter = (-housingH / 2) + WALL_MM + bodyH / 2
      packTop = yCenter + bodyH / 2 + termH + 2.5
      const startX  = -(S * stepX) / 2 + stepX / 2
      const startZ  = -(P * stepZ) / 2 + stepZ / 2
      const posOffZ = sizeZ * TERM_OFFSET_RATIO
      const negOffZ = -sizeZ * TERM_OFFSET_RATIO
      const lastFlipped = (S - 1) % 2 === 1
      packMinus = new THREE.Vector3(startX,                    packTop, startZ + negOffZ)
      packPlus  = new THREE.Vector3(startX + (S - 1) * stepX, packTop, startZ + (lastFlipped ? negOffZ : posOffZ))
    }

    const group = new THREE.Group()
    group.name = 'cables'

    const redMat    = new THREE.MeshStandardMaterial({ color: '#dc2626', metalness: 0.15, roughness: 0.6 })
    const blackMat  = new THREE.MeshStandardMaterial({ color: '#111111', metalness: 0.1,  roughness: 0.7 })
    const orangeMat = new THREE.MeshStandardMaterial({ color: '#cc4400', metalness: 0.1,  roughness: 0.7 })
    const blueMat   = new THREE.MeshStandardMaterial({ color: '#1d4ed8', metalness: 0.1,  roughness: 0.7 })
    const brassMat  = new THREE.MeshStandardMaterial({ color: '#b45309', metalness: 0.85, roughness: 0.2 })

    // Common routing plane well above the pack
    const abovePack = packTop + 20
    // Output terminals bolted on the right side of the BMS (load+ and load-)
    const rightX      = bmsX + bmsL / 2 + 12
    const outLoad     = new THREE.Vector3(rightX, bmsY + 18, bmsZ)
    const outCharger  = new THREE.Vector3(rightX, bmsY - 18, bmsZ)

    // ─── Brass output bolt terminals ────────────────────────────────────────
    const boltGeom = new THREE.CylinderGeometry(4, 4, 6, 12)
    ;[outLoad, outCharger].forEach(pos => {
      const bolt = new THREE.Mesh(boltGeom, brassMat)
      bolt.position.copy(pos)
      bolt.rotation.z = Math.PI / 2
      group.add(bolt)
    })

    // ─── Cable + lug helper ─────────────────────────────────────────────────
    const addCable = (pts, mat) => {
      group.add(new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, cableR, 8, false), mat
      ))
    }
    const addLug = (pos, mat) => {
      const lug = new THREE.Mesh(new THREE.CylinderGeometry(cableR * 1.9, cableR * 1.9, 4, 10), mat)
      lug.position.copy(pos)
      group.add(lug)
    }

    // 1. B+ (Red): pack+ → above pack → output load terminal (positive bypasses BMS)
    addCable([
      packPlus,
      new THREE.Vector3(packPlus.x, abovePack, packPlus.z),
      new THREE.Vector3(outLoad.x,  abovePack, outLoad.z),
      outLoad,
    ], redMat)
    addLug(packPlus, redMat)
    addLug(outLoad,  redMat)

    // 2. B- (Black): pack− → rise above → travel to BMS portB (left edge)
    addCable([
      packMinus,
      new THREE.Vector3(packMinus.x, abovePack,     packMinus.z),
      new THREE.Vector3(portB.x + 5, abovePack,     portB.z),
      new THREE.Vector3(portB.x + 5, portB.y + 12,  portB.z),
      portB,
    ], blackMat)
    addLug(packMinus, blackMat)
    addLug(portB,     blackMat)

    // 3. P- (Orange): BMS portP → output load terminal (switched negative for load)
    addCable([
      portP,
      new THREE.Vector3(portP.x + 15,   portP.y,      portP.z),
      new THREE.Vector3(outLoad.x - 5,  portP.y + 15, outLoad.z),
      outLoad,
    ], orangeMat)
    addLug(portP, orangeMat)

    // 4. C- (Blue): BMS portC → charger output terminal
    addCable([
      portC,
      new THREE.Vector3(portC.x + 15,      portC.y,      portC.z),
      new THREE.Vector3(outCharger.x - 5,  portC.y - 10, outCharger.z),
      outCharger,
    ], blueMat)
    addLug(portC,      blueMat)
    addLug(outCharger, blueMat)

    this._addGroup('cables', group)
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  _addGroup(name, group) {
    const existing = this.groups.get(name)
    if (existing) {
      this.scene.remove(existing)
      this._disposeGroup(existing)
    }
    this.groups.set(name, group)
    this.scene.add(group)
  }

  _disposeGroup(group) {
    group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
        else obj.material.dispose()
      }
    })
  }
}
