import * as THREE from 'three'

const isElectronCtx = typeof window !== 'undefined' && window.electronAPI != null

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
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  setLayerVisible(name, visible) {
    const g = this.groups.get(name)
    if (g) g.visible = visible
  }

  buildHousing(housingL, housingW, housingH) {
    const group = new THREE.Group()
    group.name = 'housing'

    const housingMat = this.isElectron
      ? new THREE.MeshStandardMaterial({
          color: new THREE.Color('#3b82f6'),
          transparent: true, opacity: 0.3,
          roughness: 0.3, metalness: 0.1,
          side: THREE.DoubleSide,
        })
      : new THREE.MeshPhysicalMaterial({
          color: new THREE.Color('#3b82f6'),
          transparent: true, opacity: 0.25,
          roughness: 0.1, transmission: 0.9,
          thickness: 2.0, clearcoat: 1.0,
          clearcoatRoughness: 0.1,
          side: THREE.DoubleSide,
        })

    const wall = 2
    const addWall = (w, h, d, x, y, z) => {
      const geom = new THREE.BoxGeometry(w, h, d)
      const mesh = new THREE.Mesh(geom, housingMat)
      mesh.position.set(x, y, z)
      if (!this.isElectron) { mesh.castShadow = true; mesh.receiveShadow = true }
      const edgeMat = new THREE.LineBasicMaterial({ color: '#60a5fa', opacity: 0.8, transparent: true })
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

    const { nb_serie: S, nb_parallele: P, cell_used, dimensions_array } = result
    const type = (cell_used.type_cellule || 'Pouch').toLowerCase()
    const isCylindrical = type === 'cylindrical'

    isCylindrical
      ? this._buildCylindricalCells(S, P, cell_used, dimensions_array, housingH, result.verdict)
      : this._buildPrismaticCells(S, P, cell_used, dimensions_array, housingH, result.verdict)
  }

  buildBusbars(housingH, result) {
    if (!result?.cell_used || !result?.dimensions_array || result.nb_serie <= 0 || result.nb_parallele <= 0) return

    const { nb_serie: S, nb_parallele: P, cell_used, dimensions_array } = result
    const type = (cell_used.type_cellule || 'Pouch').toLowerCase()
    const isCylindrical = type === 'cylindrical'

    isCylindrical
      ? this._buildNickelStrips(S, P, cell_used, dimensions_array, housingH)
      : this._buildPrismaticBusbars(S, P, cell_used, dimensions_array, housingH)
  }

  dispose() {
    this.groups.forEach(group => {
      this.scene.remove(group)
      this._disposeGroup(group)
    })
    this.groups.clear()
  }

  // ─── Private Builders ──────────────────────────────────────────────────────

  _buildCylindricalCells(S, P, cell_used, dimensions_array, housingH, verdict) {
    const totalCells = S * P
    const diameter = cell_used.diameter_mm || cell_used.longueur_mm
    const height = cell_used.hauteur_mm
    const stepX = dimensions_array.longueur_mm / S
    const stepZ = dimensions_array.largeur_mm / P
    const wall = 2

    const bodyH   = height * 0.93       // body leaves room for terminals + insulation ring
    const termH   = height * 0.028      // positive nub height (slim, realistic)
    const termR   = diameter * 0.22     // positive nub radius (~22% of dia — matches 18650 spec)
    const negH    = Math.max(1.0, height * 0.008)  // negative flat cap — visible but thin
    const negR    = diameter / 2 - 0.2  // negative cap covers full bottom face
    const ringH   = height * 0.018      // dark insulation/crimp ring at positive end
    const ringR   = diameter / 2 + 0.3  // slightly wider than body to be visible

    // Geometries
    const bodyGeom    = new THREE.CylinderGeometry(diameter / 2, diameter / 2, bodyH, 24)
    const posTermGeom = new THREE.CylinderGeometry(termR * 0.8, termR, termH, 12) // slightly tapered nub
    const negTermGeom = new THREE.CylinderGeometry(negR, negR, negH, 24)
    const ringGeom    = new THREE.CylinderGeometry(ringR, ringR, ringH, 24)

    // Materials
    const ok = verdict === 'ACCEPT'
    // PVC shrink-wrap body — matte, deep blue matching reference cell
    const bodyMat = this.isElectron
      ? new THREE.MeshStandardMaterial({ color: new THREE.Color(ok ? '#1d4ed8' : '#ef4444'), metalness: 0.0, roughness: 0.55 })
      : new THREE.MeshPhysicalMaterial({ color: new THREE.Color(ok ? '#1d4ed8' : '#ef4444'), metalness: 0.0, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.4 })
    // Positive (+) terminal: bright silver/nickel — nub shape marks it as +
    const posTermMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#d4d4d4'), metalness: 0.8, roughness: 0.25 })
    // Negative (-) terminal: medium grey — flat cap shape marks it as −
    const negTermMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#b0b0b0'), metalness: 0.8, roughness: 0.3 })
    // Dark insulation/crimp ring separating body from positive terminal
    const ringMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#1e293b'), metalness: 0.1, roughness: 0.9 })

    // Instanced meshes
    const bodyMesh    = new THREE.InstancedMesh(bodyGeom, bodyMat, totalCells)
    const posTermMesh = new THREE.InstancedMesh(posTermGeom, posTermMat, totalCells)
    const negTermMesh = new THREE.InstancedMesh(negTermGeom, negTermMat, totalCells)
    const ringMesh    = new THREE.InstancedMesh(ringGeom, ringMat, totalCells)
    if (!this.isElectron) {
      bodyMesh.castShadow = bodyMesh.receiveShadow = true
      posTermMesh.castShadow = true
      negTermMesh.castShadow = true
    }

    const startX = -(S * stepX) / 2 + stepX / 2
    const startZ = -(P * stepZ) / 2 + stepZ / 2
    const yCenter = (-housingH / 2) + wall + bodyH / 2

    // Quaternion to flip cell 180° (positive end faces down)
    const qFlip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI)
    const qNorm = new THREE.Quaternion() // identity
    const scale1 = new THREE.Vector3(1, 1, 1)

    let i = 0
    for (let s = 0; s < S; s++) {
      const x = startX + s * stepX
      const flipped = s % 2 === 1  // alternate orientation every series column

      for (let p = 0; p < P; p++) {
        const z = startZ + p * stepZ
        const pos = new THREE.Vector3(x, yCenter, z)

        bodyMesh.setMatrixAt(i, new THREE.Matrix4().compose(pos, flipped ? qFlip : qNorm, scale1))

        if (flipped) {
          // Positive end faces down — nub at bottom, insulation ring at bottom edge
          posTermMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, yCenter - bodyH / 2 - termH / 2, z))
          negTermMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, yCenter + bodyH / 2 + negH / 2, z))
          ringMesh.setMatrixAt(i,    new THREE.Matrix4().makeTranslation(x, yCenter - bodyH / 2 + ringH / 2, z))
        } else {
          // Normal — positive nub on top, insulation ring at top edge
          posTermMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, yCenter + bodyH / 2 + termH / 2, z))
          negTermMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, yCenter - bodyH / 2 - negH / 2, z))
          ringMesh.setMatrixAt(i,    new THREE.Matrix4().makeTranslation(x, yCenter + bodyH / 2 - ringH / 2, z))
        }

        i++
      }
    }

    bodyMesh.instanceMatrix.needsUpdate = true
    posTermMesh.instanceMatrix.needsUpdate = true
    negTermMesh.instanceMatrix.needsUpdate = true
    ringMesh.instanceMatrix.needsUpdate = true

    const cellGroup = new THREE.Group()
    cellGroup.name = 'cells'
    cellGroup.add(bodyMesh, ringMesh)

    const termGroup = new THREE.Group()
    termGroup.name = 'terminals'
    termGroup.add(posTermMesh, negTermMesh)

    this._addGroup('cells', cellGroup)
    this._addGroup('terminals', termGroup)
  }

  _buildPrismaticCells(S, P, cell_used, dimensions_array, housingH, verdict) {
    const totalCells = S * P
    const wall = 2

    // Cell stands upright — wide face (largeur × longueur) faces X direction:
    //   X = hauteur_mm  — series cells stack along their thickness
    //   Y = longueur_mm — L is vertical
    //   Z = largeur_mm  — parallel cells spread left/right in Z
    const sizeX = cell_used.hauteur_mm
    const sizeZ = cell_used.largeur_mm
    const bodyH = cell_used.longueur_mm * 0.95

    // Derive step from engine-reported dimensions (includes swelling spacing)
    const stepX = dimensions_array.longueur_mm / S   // series pitch in X
    const stepZ = dimensions_array.largeur_mm / P    // parallel pitch in Z

    // Terminals on top of the narrow face — offset across sizeZ (largeur_mm)
    const termW = Math.min(sizeZ * 0.15, 22)
    const termD = Math.min(sizeX * 0.8, 14)
    const termH = Math.max(8, cell_used.longueur_mm * 0.07)

    const posOffZ =  sizeZ * 0.22
    const negOffZ = -sizeZ * 0.22

    // Geometries
    const bodyGeom    = new THREE.BoxGeometry(sizeX, bodyH, sizeZ)
    const posTermGeom = new THREE.BoxGeometry(termD, termH, termW)
    const negTermGeom = new THREE.BoxGeometry(termD, termH, termW)

    // Materials
    const ok = verdict === 'ACCEPT'
    const bodyMat = this.isElectron
      ? new THREE.MeshStandardMaterial({ color: new THREE.Color(ok ? '#1d4ed8' : '#ef4444'), metalness: 0.0, roughness: 0.55 })
      : new THREE.MeshPhysicalMaterial({ color: new THREE.Color(ok ? '#1d4ed8' : '#ef4444'), metalness: 0.0, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.4 })
    const posTermMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#d4d4d4'), metalness: 0.8, roughness: 0.25 })
    const negTermMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#b0b0b0'), metalness: 0.8, roughness: 0.3 })

    const bodyMesh    = new THREE.InstancedMesh(bodyGeom, bodyMat, totalCells)
    const posTermMesh = new THREE.InstancedMesh(posTermGeom, posTermMat, totalCells)
    const negTermMesh = new THREE.InstancedMesh(negTermGeom, negTermMat, totalCells)
    if (!this.isElectron) {
      bodyMesh.castShadow = bodyMesh.receiveShadow = true
      posTermMesh.castShadow = true
      negTermMesh.castShadow = true
    }

    // Series (S) stacks into X, Parallel (P) spreads in Z.
    const startX  = -(S * stepX) / 2 + stepX / 2
    const startZ  = -(P * stepZ) / 2 + stepZ / 2
    const yCenter = (-housingH / 2) + wall + bodyH / 2
    const termY   = yCenter + bodyH / 2 + termH / 2

    const baseEdge = new THREE.EdgesGeometry(new THREE.BoxGeometry(sizeX, bodyH, sizeZ))
    const basePts  = baseEdge.getAttribute('position').array
    const edgePts  = []

    let i = 0
    for (let s = 0; s < S; s++) {
      const x = startX + s * stepX
      
      for (let p = 0; p < P; p++) {
        const z = startZ + p * stepZ
        
        // Flipped orientation alternates only along series (s) direction.
        // Parallel rows keep the same orientation so terminals face each other across rows.
        const flipped = s % 2 === 1
        const actualPosOffZ = flipped ? negOffZ : posOffZ
        const actualNegOffZ = flipped ? posOffZ : negOffZ

        bodyMesh.setMatrixAt(i,    new THREE.Matrix4().makeTranslation(x, yCenter, z))
        posTermMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, termY, z + actualPosOffZ))
        negTermMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, termY, z + actualNegOffZ))

        for (let v = 0; v < basePts.length; v += 3) {
          edgePts.push(basePts[v] + x, basePts[v + 1] + yCenter, basePts[v + 2] + z)
        }

        i++
      }
    }

    bodyMesh.instanceMatrix.needsUpdate = true
    posTermMesh.instanceMatrix.needsUpdate = true
    negTermMesh.instanceMatrix.needsUpdate = true

    baseEdge.dispose()

    const edgeGeom = new THREE.BufferGeometry()
    edgeGeom.setAttribute('position', new THREE.Float32BufferAttribute(edgePts, 3))
    const edgeMat = new THREE.LineBasicMaterial({ color: '#93c5fd', opacity: 0.7, transparent: true })
    const edgeLines = new THREE.LineSegments(edgeGeom, edgeMat)

    const cellGroup = new THREE.Group()
    cellGroup.name = 'cells'
    cellGroup.add(bodyMesh, edgeLines)

    const termGroup = new THREE.Group()
    termGroup.name = 'terminals'
    termGroup.add(posTermMesh, negTermMesh)

    this._addGroup('cells', cellGroup)
    this._addGroup('terminals', termGroup)
  }

  _buildNickelStrips(S, P, cell_used, dimensions_array, housingH) {
    const diameter = cell_used.diameter_mm || cell_used.longueur_mm
    const height = cell_used.hauteur_mm
    const stepX = dimensions_array.longueur_mm / S
    const stepZ = dimensions_array.largeur_mm / P
    const wall = 2

    const bodyH = height * 0.93
    const termH = height * 0.028
    const negH = Math.max(1.0, height * 0.008)

    const yCenter = (-housingH / 2) + wall + bodyH / 2
    const yTop = yCenter + bodyH / 2 + termH + 0.1
    const yBottom = yCenter - bodyH / 2 - negH - 0.1
    
    // Grid pattern: continuous parallel strips along Z, and discrete jumper links along X.
    const stripThickness = 0.15
    const pWidth = diameter * 0.45
    const pLength = P > 1 ? (P - 1) * stepZ + pWidth : pWidth
    const pStrGeom = new THREE.BoxGeometry(pWidth, stripThickness, pLength)
    
    const jLength = stepX
    const jWidth = diameter * 0.25
    const jGeom = new THREE.BoxGeometry(jLength, stripThickness, jWidth)

    const mat = this.isElectron
      ? new THREE.MeshStandardMaterial({ color: '#e5e7eb', metalness: 0.8, roughness: 0.3 })
      : new THREE.MeshPhysicalMaterial({ color: '#e5e7eb', metalness: 0.8, roughness: 0.2, clearcoat: 0.5 })

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
      
      // Top parallel strip
      pMesh.setMatrixAt(pIdx++, new THREE.Matrix4().makeTranslation(x, yTop, 0))
      // Bottom parallel strip
      pMesh.setMatrixAt(pIdx++, new THREE.Matrix4().makeTranslation(x, yBottom, 0))

      // Series jumpers
      if (s < S - 1) {
        const isTop = s % 2 === 0
        const yBase = isTop ? yTop : yBottom
        // Place jumper slightly above/below parallel strip so they overlap cleanly
        const jY = isTop ? yBase + 0.2 : yBase - 0.2
        const jX = x + stepX / 2
        
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

  _buildPrismaticBusbars(S, P, cell_used, dimensions_array, housingH) {
    const wall = 2
    const sizeX = cell_used.hauteur_mm
    const sizeZ = cell_used.largeur_mm
    const bodyH = cell_used.longueur_mm * 0.95
    const stepX = dimensions_array.longueur_mm / S
    const stepZ = dimensions_array.largeur_mm / P

    const termW = Math.min(sizeZ * 0.15, 22)
    const termD = Math.min(sizeX * 0.8, 14)
    const termH = Math.max(8, cell_used.longueur_mm * 0.07)

    const posOffZ = sizeZ * 0.22
    const negOffZ = -sizeZ * 0.22

    const yCenter = (-housingH / 2) + wall + bodyH / 2
    const termY = yCenter + bodyH / 2 + termH / 2
    const busbarY = termY + termH / 2 + 0.5
    const busbarThickness = 1.0

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
