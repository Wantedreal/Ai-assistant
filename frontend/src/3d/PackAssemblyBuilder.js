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

  buildBracketsAndCards(housingH, result) {
    if (!result?.cell_used || !result?.dimensions_array || result.nb_serie <= 0 || result.nb_parallele <= 0) return

    const { nb_serie: S, nb_parallele: P, cell_used, dimensions_array } = result
    const type = (cell_used.type_cellule || 'Pouch').toLowerCase()

    if (type === 'cylindrical') {
      this._buildCylindricalBrackets(S, P, cell_used, dimensions_array, housingH)
    } else {
      this._buildPrismaticInsulationCards(S, P, cell_used, dimensions_array, housingH)
    }
  }

  buildSidePlates(housingH, result) {
    if (!result?.cell_used || !result?.dimensions_array || result.nb_serie <= 0 || result.nb_parallele <= 0) return

    const { nb_serie: S, nb_parallele: P, cell_used, dimensions_array } = result
    const type = (cell_used.type_cellule || 'Pouch').toLowerCase()

    if (type !== 'cylindrical') {
      this._buildPrismaticSidePlates(S, P, cell_used, dimensions_array, housingH)
    }
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
    const ok = verdict === 'ACCEPT'
    const bodyMat = this.isElectron
      ? new THREE.MeshStandardMaterial({ color: new THREE.Color(ok ? '#1d4ed8' : '#ef4444'), metalness: 0.0, roughness: 0.55 })
      : new THREE.MeshPhysicalMaterial({ color: new THREE.Color(ok ? '#1d4ed8' : '#ef4444'), metalness: 0.0, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.4 })
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
    const yCenter = (-housingH / 2) + wall + bodyH / 2

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
    const height   = cell_used.hauteur_mm
    const stepX    = dimensions_array.longueur_mm / S
    const stepZ    = dimensions_array.largeur_mm / P
    const wall     = 2

    const bodyH = height * 0.96
    const posDiscH = 0.3   // must match _buildCylindricalCells
    const negDiscH = 0.3

    const yCenter = (-housingH / 2) + wall + bodyH / 2
    // Strips sit just above the flush terminal discs
    const yTop    = yCenter + bodyH / 2 + posDiscH + 0.2
    const yBottom = yCenter - bodyH / 2 - negDiscH - 0.2

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

  /**
   * Builds the top and bottom cell holder brackets as a cross-bar grid.
   * Each bracket is a lattice of dark plastic bars (P+1 bars in Z, S+1 bars in X).
   * The open squares in the grid are where cells poke through — no geometry covers the cell ends.
   *
   * Bottom bracket: cells sit in the recesses of the grid (negative end cradled).
   * Top bracket:    positive terminals protrude through the open slots.
   */
  _buildCylindricalBrackets(S, P, cell_used, dimensions_array, housingH) {
    const diameter = cell_used.diameter_mm || cell_used.longueur_mm
    const height   = cell_used.hauteur_mm
    const stepX    = dimensions_array.longueur_mm / S
    const stepZ    = dimensions_array.largeur_mm / P
    const wall     = 2

    const bodyH   = height * 0.96
    const yCenter = (-housingH / 2) + wall + bodyH / 2
    const barH    = 6.0    // bracket thickness — thick enough to grip cell ends
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
        group.add(mesh)
      }

      // S+1 bars running along Z, spaced at every X boundary between series columns
      for (let s = 0; s <= S; s++) {
        const x    = startX + (s - 0.5) * stepX
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(barWx, barH, totalZ + barWz * 2), mat
        )
        mesh.position.set(x, yMid, 0)
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

  _buildPrismaticInsulationCards(S, P, cell_used, dimensions_array, housingH) {
    if (S < 2) return

    const wall = 2
    const bodyH = cell_used.longueur_mm * 0.95
    const stepX = dimensions_array.longueur_mm / S
    const startX = -(S * stepX) / 2 + stepX / 2
    const yCenter = (-housingH / 2) + wall + bodyH / 2
    const cardW = dimensions_array.largeur_mm

    const geom = new THREE.BoxGeometry(0.3, bodyH, cardW)
    const mat = new THREE.MeshStandardMaterial({ color: '#f97316', metalness: 0.0, roughness: 0.9 })

    const group = new THREE.Group()
    group.name = 'insulation_cards'

    for (let s = 0; s < S - 1; s++) {
      const cardX = startX + s * stepX + stepX / 2
      const card = new THREE.Mesh(geom, mat)
      card.position.set(cardX, yCenter, 0)
      group.add(card)
    }

    this._addGroup('insulation_cards', group)
  }

  _buildPrismaticSidePlates(S, P, cell_used, dimensions_array, housingH) {
    const wall = 2
    const bodyH = cell_used.longueur_mm * 0.95
    const yCenter = (-housingH / 2) + wall + bodyH / 2
    const totalX = dimensions_array.longueur_mm
    const totalZ = dimensions_array.largeur_mm

    const mat = new THREE.MeshStandardMaterial({ color: '#6b7280', metalness: 0.4, roughness: 0.6 })

    const group = new THREE.Group()
    group.name = 'side_plates'

    // Side plates at Z extremes (clamp along Z axis)
    const sideGeom = new THREE.BoxGeometry(totalX, bodyH, 3)
    const sideZ = totalZ / 2 + 1.5
    const sPlus  = new THREE.Mesh(sideGeom, mat)
    sPlus.position.set(0, yCenter,  sideZ)
    const sMinus = new THREE.Mesh(sideGeom, mat)
    sMinus.position.set(0, yCenter, -sideZ)
    group.add(sPlus, sMinus)

    // End plates at X extremes (thicker, clamp along X axis)
    const endGeom = new THREE.BoxGeometry(5, bodyH, totalZ + 6)
    const endX = totalX / 2 + 2.5
    const ePlus  = new THREE.Mesh(endGeom, mat)
    ePlus.position.set( endX, yCenter, 0)
    const eMinus = new THREE.Mesh(endGeom, mat)
    eMinus.position.set(-endX, yCenter, 0)
    group.add(ePlus, eMinus)

    this._addGroup('side_plates', group)
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
