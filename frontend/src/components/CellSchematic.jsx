import React from 'react'

const W = 340
const H = 200

// ── colour tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:       '#0f1117',
  body:     '#1e2535',
  bodyEdge: '#2e3a50',
  face:     '#253045',
  faceEdge: '#3a4a65',
  topFace:  '#2a3a55',
  wrap:     '#1a2030',
  termPos:  '#ef4444',
  termNeg:  '#60a5fa',
  dimLine:  '#475569',
  dimText:  '#94a3b8',
  label:    '#cbd5e1',
  labelSub: '#64748b',
  foil:     '#2d3a4a',
  foilEdge: '#4a5a70',
  tabMetal: '#8a9ab0',
}

function DimLine({ x1, y1, x2, y2, label, labelX, labelY, anchor = 'middle' }) {
  return (
    <g className="schematic-dim">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.dimLine} strokeWidth="0.8" strokeDasharray="3,2" />
      <text x={labelX} y={labelY} fill={C.dimText} fontSize="8.5" textAnchor={anchor} fontFamily="monospace">{label}</text>
    </g>
  )
}

// ── CYLINDRICAL ───────────────────────────────────────────────────────────────
function CylindricalSchematic({ cell }) {
  const rawD = cell.diameter_mm || cell.longueur_mm
  const rawH = cell.hauteur_mm

  const maxBodyW = W * 0.28
  const maxBodyH = H * 0.72
  const scale = Math.min(maxBodyW / rawD, maxBodyH / rawH)
  const bw = rawD * scale
  const bh = rawH * scale

  const cx = W * 0.38
  const cy = H / 2
  const top = cy - bh / 2
  const bot = cy + bh / 2
  const rx  = bw / 2
  const ry  = Math.max(rx * 0.22, 3)

  // positive cap: silver metallic disc spanning ~85% of diameter, slightly raised
  const capH   = Math.min(bh * 0.045, 5)
  const capRx  = rx * 0.85
  const capRy  = ry * 0.85
  // crimp ring radii (decorative concentric ring near edge)
  const crimpR = capRx * 0.88

  // top-view inset
  const tvR = Math.min(bw * 0.38, 22)
  const tvX = W * 0.79
  const tvY = H * 0.32

  return (
    <g>
      {/* ── body ── */}
      <rect x={cx - rx} y={top + capH} width={bw} height={bh - capH} rx="2"
        fill={C.body} stroke={C.bodyEdge} strokeWidth="1.2" />

      {/* wrap label lines */}
      {[0.28, 0.54, 0.78].map(f => (
        <line key={f}
          x1={cx - rx + 1} y1={top + capH + (bh - capH) * f}
          x2={cx + rx - 1} y2={top + capH + (bh - capH) * f}
          stroke={C.wrap} strokeWidth="0.6" />
      ))}

      {/* ── bottom cap ellipse ── */}
      <ellipse cx={cx} cy={bot} rx={rx} ry={ry}
        fill={C.body} stroke={C.bodyEdge} strokeWidth="1" />

      {/* ── negative top ring (full-width flat disc, dark) ── */}
      <ellipse cx={cx} cy={top + capH} rx={rx} ry={ry}
        fill="#161e2c" stroke="#2e3a50" strokeWidth="1.2" />

      {/* ── positive metallic cap (silver, slightly raised) ── */}
      {/* cap body — raised cylinder stub */}
      <rect x={cx - capRx} y={top} width={capRx * 2} height={capH}
        fill="url(#capGrad)" stroke="#7a8a9a" strokeWidth="0.7" />
      {/* cap top ellipse — shiny metallic */}
      <ellipse cx={cx} cy={top} rx={capRx} ry={capRy * 0.7}
        fill="url(#capTopGrad)" stroke="#8a9aaa" strokeWidth="0.8" />
      {/* crimp ring — subtle concentric groove */}
      <ellipse cx={cx} cy={top} rx={crimpR} ry={crimpR * (capRy * 0.7 / capRx)}
        fill="none" stroke="#5a6a7a" strokeWidth="0.6" opacity="0.7" />
      {/* vent centre dot */}
      <ellipse cx={cx} cy={top} rx={capRx * 0.22} ry={capRy * 0.7 * 0.22}
        fill="#4a5a6a" stroke="#5a6a7a" strokeWidth="0.5" />

      {/* gradients */}
      <defs>
        <linearGradient id="capGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b0bec5" />
          <stop offset="100%" stopColor="#78909c" />
        </linearGradient>
        <radialGradient id="capTopGrad" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#cfd8dc" />
          <stop offset="55%" stopColor="#90a4ae" />
          <stop offset="100%" stopColor="#546e7a" />
        </radialGradient>
      </defs>

      {/* ── dim lines ── */}
      <g className="schematic-dim">
        <DimLine x1={cx - rx} y1={bot + 16} x2={cx + rx} y2={bot + 16} label={`⌀${rawD} mm`} labelX={cx} labelY={bot + 26} />
        <line x1={cx - rx} y1={bot + 10} x2={cx - rx} y2={bot + 20} stroke={C.dimLine} strokeWidth="0.8" />
        <line x1={cx + rx} y1={bot + 10} x2={cx + rx} y2={bot + 20} stroke={C.dimLine} strokeWidth="0.8" />
        <DimLine x1={cx - rx - 14} y1={top} x2={cx - rx - 14} y2={bot} label={`${rawH} mm`} labelX={cx - rx - 18} labelY={cy + 3} anchor="end" />
        <line x1={cx - rx - 8} y1={top} x2={cx - rx - 18} y2={top} stroke={C.dimLine} strokeWidth="0.8" />
        <line x1={cx - rx - 8} y1={bot} x2={cx - rx - 18} y2={bot} stroke={C.dimLine} strokeWidth="0.8" />
      </g>

      {/* ── top-view inset ── */}
      <g className="schematic-topview">
        <circle cx={tvX} cy={tvY} r={tvR + 4} fill="#12161f" stroke={C.dimLine} strokeWidth="0.7" />
        <circle cx={tvX} cy={tvY} r={tvR} fill={C.body} stroke={C.bodyEdge} strokeWidth="1.2" />
        <circle cx={tvX} cy={tvY} r={tvR * 0.85} fill="url(#capTopGrad)" stroke="#7a8a9a" strokeWidth="0.8" />
        <circle cx={tvX} cy={tvY} r={tvR * 0.75} fill="none" stroke="#5a6a7a" strokeWidth="0.7" opacity="0.7" />
        <circle cx={tvX} cy={tvY} r={tvR * 0.20} fill="#4a5a6a" stroke="#5a6a7a" strokeWidth="0.5" />
        <text x={tvX} y={tvY + tvR + 14} fill={C.dimText} fontSize="7.5" textAnchor="middle" fontFamily="monospace">top view</text>
      </g>

      {/* ── labels ── */}
      <g className="schematic-label">
        <text x={W * 0.79} y={H * 0.68} fill={C.label} fontSize="10" fontWeight="600" textAnchor="middle" fontFamily="sans-serif">{cell.nom}</text>
        <text x={W * 0.79} y={H * 0.80} fill={C.labelSub} fontSize="8" textAnchor="middle" fontFamily="sans-serif">Cylindrical</text>
      </g>
    </g>
  )
}

// ── PRISMATIC ─────────────────────────────────────────────────────────────────
function PrismaticSchematic({ cell }) {
  // longueur = height (Y), largeur = width (Z), hauteur = thickness (X)
  const rH = cell.longueur_mm   // visual height
  const rW = cell.largeur_mm    // visual width (front face)
  const rT = cell.hauteur_mm    // thickness (depth)

  const maxFW = W * 0.32
  const maxFH = H * 0.65
  const scale = Math.min(maxFW / rW, maxFH / rH)
  const fw = rW * scale          // front face width
  const fh = rH * scale          // front face height

  // isometric offsets for top+side faces
  const iso = Math.min(rT * scale * 0.45, fw * 0.35)
  const isoH = iso * 0.5         // vertical component of iso offset

  const ox = W * 0.42 - fw / 2  // front-face top-left X
  const oy = H * 0.50 - fh / 2 + isoH  // front-face top-left Y

  // terminal geometry
  const termW = fw * 0.14
  const termH = fh * 0.07
  const termY = oy - termH
  const gap   = fw * 0.08
  const pX    = ox + fw * 0.30 - termW / 2
  const nX    = ox + fw * 0.70 - termW / 2

  return (
    <g>
      {/* ── top face ── */}
      <polygon
        points={`
          ${ox},${oy}
          ${ox + iso},${oy - isoH}
          ${ox + fw + iso},${oy - isoH}
          ${ox + fw},${oy}
        `}
        fill={C.topFace} stroke={C.faceEdge} strokeWidth="1"
      />

      {/* ── side face (right) ── */}
      <polygon
        points={`
          ${ox + fw},${oy}
          ${ox + fw + iso},${oy - isoH}
          ${ox + fw + iso},${oy + fh - isoH}
          ${ox + fw},${oy + fh}
        `}
        fill={C.face} stroke={C.faceEdge} strokeWidth="1"
      />

      {/* ── front face ── */}
      <rect x={ox} y={oy} width={fw} height={fh} fill={C.body} stroke={C.bodyEdge} strokeWidth="1.2" />

      {/* subtle centre line */}
      <line x1={ox + fw/2} y1={oy + fh * 0.1} x2={ox + fw/2} y2={oy + fh * 0.9} stroke={C.wrap} strokeWidth="0.6" />

      {/* ── positive terminal ── */}
      <rect x={pX} y={termY} width={termW} height={termH + 2} rx="1.5" fill={C.termPos} stroke="#c53030" strokeWidth="0.8" />
      <text x={pX + termW/2} y={termY - 3} fill={C.termPos} fontSize="7" textAnchor="middle" fontFamily="monospace">+</text>

      {/* ── negative terminal ── */}
      <rect x={nX} y={termY} width={termW} height={termH + 2} rx="1.5" fill={C.termNeg} stroke="#2563eb" strokeWidth="0.8" />
      <text x={nX + termW/2} y={termY - 3} fill={C.termNeg} fontSize="7" textAnchor="middle" fontFamily="monospace">−</text>

      {/* ── dim lines ── */}
      <g className="schematic-dim">
        {/* width */}
        <DimLine
          x1={ox} y1={oy + fh + 14} x2={ox + fw} y2={oy + fh + 14}
          label={`${rW} mm`} labelX={ox + fw/2} labelY={oy + fh + 24}
        />
        <line x1={ox}      y1={oy + fh + 8}  x2={ox}      y2={oy + fh + 18} stroke={C.dimLine} strokeWidth="0.8" />
        <line x1={ox + fw} y1={oy + fh + 8}  x2={ox + fw} y2={oy + fh + 18} stroke={C.dimLine} strokeWidth="0.8" />

        {/* height */}
        <DimLine
          x1={ox - 14} y1={oy} x2={ox - 14} y2={oy + fh}
          label={`${rH} mm`} labelX={ox - 18} labelY={oy + fh/2 + 3} anchor="end"
        />
        <line x1={ox - 8} y1={oy}      x2={ox - 18} y2={oy}      stroke={C.dimLine} strokeWidth="0.8" />
        <line x1={ox - 8} y1={oy + fh} x2={ox - 18} y2={oy + fh} stroke={C.dimLine} strokeWidth="0.8" />

        {/* thickness (iso) */}
        <DimLine
          x1={ox + fw} y1={oy} x2={ox + fw + iso} y2={oy - isoH}
          label={`${rT} mm`} labelX={ox + fw + iso + 18} labelY={oy - isoH - 2} anchor="start"
        />
      </g>

      {/* ── label ── */}
      <g className="schematic-label">
        <text x={W * 0.82} y={H * 0.68} fill={C.label} fontSize="10" fontWeight="600" textAnchor="middle" fontFamily="sans-serif">{cell.nom}</text>
        <text x={W * 0.82} y={H * 0.80} fill={C.labelSub} fontSize="8" textAnchor="middle" fontFamily="sans-serif">Prismatic</text>
      </g>
    </g>
  )
}

// ── POUCH ─────────────────────────────────────────────────────────────────────
function PouchSchematic({ cell }) {
  const rH = cell.longueur_mm
  const rW = cell.largeur_mm
  const rT = cell.hauteur_mm

  const maxFW = W * 0.34
  const maxFH = H * 0.58
  const scale = Math.min(maxFW / rW, maxFH / rH)
  const fw = rW * scale
  const fh = rH * scale

  const iso  = Math.min(rT * scale * 0.5, fw * 0.28)
  const isoH = iso * 0.45

  const ox = W * 0.42 - fw / 2
  const oy = H * 0.53 - fh / 2 + isoH

  // flat metal tabs — wide, thin rectangles protruding from top edge
  const tabW    = fw * 0.22        // wide flat strip
  const tabH    = fh * 0.14        // how far they stick up
  const tabThk  = 3                // visual "thickness" of the flat strip
  // positive tab (aluminium — silver-warm)
  const pTabX   = ox + fw * 0.22
  // negative tab (copper/nickel — slightly darker silver-cool)
  const nTabX   = ox + fw * 0.58

  const seamInset = 5   // heat-seal border inset
  const cornerR   = 5

  return (
    <g>
      <defs>
        {/* aluminium tab gradient */}
        <linearGradient id="tabAlGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#9eaab8" />
          <stop offset="40%"  stopColor="#d0dae4" />
          <stop offset="100%" stopColor="#8a96a4" />
        </linearGradient>
        {/* copper/nickel tab gradient */}
        <linearGradient id="tabCuGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#7a8896" />
          <stop offset="40%"  stopColor="#b0bcc8" />
          <stop offset="100%" stopColor="#6e7a88" />
        </linearGradient>
        {/* foil body gradient — subtle sheen */}
        <linearGradient id="foilGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#2a3848" />
          <stop offset="50%"  stopColor="#1e2c3c" />
          <stop offset="100%" stopColor="#1a2535" />
        </linearGradient>
      </defs>

      {/* ── top face (isometric) ── */}
      <polygon
        points={`
          ${ox + cornerR},${oy}
          ${ox + cornerR + iso},${oy - isoH}
          ${ox + fw + iso},${oy - isoH}
          ${ox + fw},${oy}
        `}
        fill={C.topFace} stroke={C.foilEdge} strokeWidth="0.9"
      />

      {/* ── side face (isometric) ── */}
      <polygon
        points={`
          ${ox + fw},${oy}
          ${ox + fw + iso},${oy - isoH}
          ${ox + fw + iso},${oy + fh - isoH}
          ${ox + fw},${oy + fh}
        `}
        fill={C.face} stroke={C.foilEdge} strokeWidth="0.9"
      />

      {/* ── foil envelope (front face) ── */}
      <rect x={ox} y={oy} width={fw} height={fh} rx={cornerR} ry={cornerR}
        fill="url(#foilGrad)" stroke={C.foilEdge} strokeWidth="1.4" />

      {/* heat-seal border seam — inset rect */}
      <rect
        x={ox + seamInset} y={oy + seamInset}
        width={fw - seamInset * 2} height={fh - seamInset * 2}
        rx={cornerR - 2} ry={cornerR - 2}
        fill="none" stroke="#3a4e64" strokeWidth="0.7" strokeDasharray="none" opacity="0.7"
      />

      {/* subtle highlight sheen top-left */}
      <rect x={ox + seamInset + 2} y={oy + seamInset + 2}
        width={fw * 0.45} height={fh * 0.08}
        rx="2" fill="white" opacity="0.04" />

      {/* ── positive tab — aluminium (silver-warm) ── */}
      {/* tab shaft */}
      <rect x={pTabX} y={oy - tabH} width={tabW} height={tabH + tabThk}
        fill="url(#tabAlGrad)" stroke="#7a8a9a" strokeWidth="0.7" />
      {/* tab top edge highlight */}
      <rect x={pTabX} y={oy - tabH} width={tabW} height={tabThk * 0.6}
        fill="#dce6ee" rx="0.5" opacity="0.6" />
      {/* polarity dot — red, subtle */}
      <circle cx={pTabX + tabW / 2} cy={oy - 4} r="2.2"
        fill="rgba(239,68,68,0.55)" stroke="rgba(220,50,50,0.8)" strokeWidth="0.5" />

      {/* ── negative tab — copper/nickel (silver-cool) ── */}
      <rect x={nTabX} y={oy - tabH} width={tabW} height={tabH + tabThk}
        fill="url(#tabCuGrad)" stroke="#6a7a8a" strokeWidth="0.7" />
      <rect x={nTabX} y={oy - tabH} width={tabW} height={tabThk * 0.6}
        fill="#c8d4dc" rx="0.5" opacity="0.6" />
      {/* polarity dot — blue, subtle */}
      <circle cx={nTabX + tabW / 2} cy={oy - 4} r="2.2"
        fill="rgba(96,165,250,0.55)" stroke="rgba(60,130,220,0.8)" strokeWidth="0.5" />

      {/* ── dim lines ── */}
      <g className="schematic-dim">
        <DimLine
          x1={ox} y1={oy + fh + 14} x2={ox + fw} y2={oy + fh + 14}
          label={`${rW} mm`} labelX={ox + fw / 2} labelY={oy + fh + 24}
        />
        <line x1={ox}      y1={oy + fh + 8}  x2={ox}      y2={oy + fh + 18} stroke={C.dimLine} strokeWidth="0.8" />
        <line x1={ox + fw} y1={oy + fh + 8}  x2={ox + fw} y2={oy + fh + 18} stroke={C.dimLine} strokeWidth="0.8" />

        <DimLine
          x1={ox - 14} y1={oy} x2={ox - 14} y2={oy + fh}
          label={`${rH} mm`} labelX={ox - 18} labelY={oy + fh / 2 + 3} anchor="end"
        />
        <line x1={ox - 8} y1={oy}      x2={ox - 18} y2={oy}      stroke={C.dimLine} strokeWidth="0.8" />
        <line x1={ox - 8} y1={oy + fh} x2={ox - 18} y2={oy + fh} stroke={C.dimLine} strokeWidth="0.8" />

        <DimLine
          x1={ox + fw} y1={oy} x2={ox + fw + iso} y2={oy - isoH}
          label={`${rT} mm`} labelX={ox + fw + iso + 18} labelY={oy - isoH - 2} anchor="start"
        />
      </g>

      {/* ── label ── */}
      <g className="schematic-label">
        <text x={W * 0.82} y={H * 0.68} fill={C.label} fontSize="10" fontWeight="600" textAnchor="middle" fontFamily="sans-serif">{cell.nom}</text>
        <text x={W * 0.82} y={H * 0.80} fill={C.labelSub} fontSize="8" textAnchor="middle" fontFamily="sans-serif">Pouch</text>
      </g>
    </g>
  )
}

// ── EMPTY STATE ───────────────────────────────────────────────────────────────
function EmptySchematic() {
  return (
    <g>
      {/* dashed placeholder rect */}
      <rect x={W*0.25} y={H*0.18} width={W*0.50} height={H*0.55}
        rx="6" fill="none" stroke={C.dimLine} strokeWidth="1" strokeDasharray="5,4" />
      <text x={W/2} y={H*0.49} fill={C.labelSub} fontSize="11" textAnchor="middle" fontFamily="sans-serif">Select a cell</text>
      <text x={W/2} y={H*0.62} fill={C.dimLine} fontSize="8.5" textAnchor="middle" fontFamily="sans-serif">schematic will appear here</text>
    </g>
  )
}

// ── CHEMISTRY BADGE ───────────────────────────────────────────────────────────
const CHEM_COLORS = {
  LFP:  '#16a34a',
  NMC:  '#3b82f6',
  NCA:  '#8b5cf6',
  LTO:  '#06b6d4',
  LCO:  '#f59e0b',
}

function ChemBadge({ cell }) {
  if (!cell?.chimie) return null
  const color = CHEM_COLORS[cell.chimie] || '#64748b'
  const label = cell.chimie
  const bw = label.length * 6.5 + 12
  return (
    <g>
      <rect x={8} y={8} width={bw} height={16} rx="4" fill={color} opacity="0.18" />
      <rect x={8} y={8} width={bw} height={16} rx="4" fill="none" stroke={color} strokeWidth="1" opacity="0.6" />
      <text x={8 + bw / 2} y={19.5} fill={color} fontSize="8.5" fontWeight="700"
        textAnchor="middle" fontFamily="sans-serif" letterSpacing="0.05em">{label}</text>
    </g>
  )
}

// ── PUBLIC COMPONENT ──────────────────────────────────────────────────────────
export default function CellSchematic({ cell }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="100%"
      style={{ display: 'block' }}
      aria-label={cell ? `${cell.nom} schematic` : 'No cell selected'}
    >
      <rect width={W} height={H} fill={C.bg} rx="6" />

      {!cell && <EmptySchematic />}
      {cell?.type_cellule === 'Cylindrical' && <CylindricalSchematic cell={cell} />}
      {cell?.type_cellule === 'Prismatic'   && <PrismaticSchematic   cell={cell} />}
      {cell?.type_cellule === 'Pouch'       && <PouchSchematic       cell={cell} />}
      {cell && <ChemBadge cell={cell} />}
    </svg>
  )
}
