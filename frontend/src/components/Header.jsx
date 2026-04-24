import React from 'react'

/**
 * Z-bolt badge — viewBox 0 0 180 44
 * Upper arm  (y 3–22): "BATTERY"   centroid ≈ (47, 13)
 * Lower arm  (y 22–41): "DESIGNER"  centroid ≈ (112, 31)
 * Left tip  → (3, 12)   Right tip → (177, 30)
 * Text counter-rotated +8° to cancel the SVG's -8° CSS tilt.
 */
function BoltLogo() {
  return (
    <a href="/" className="logo-lockup" aria-label="Battery Designer — home">
      <svg
        className="logo-svg"
        viewBox="0 0 180 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          {/* Deep-to-blue fill — rich, saturated core */}
          <linearGradient id="lgFill" x1="0" y1="0" x2="180" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#040e1c" />
            <stop offset="28%"  stopColor="#1e3a8a" />
            <stop offset="52%"  stopColor="#2563eb" />
            <stop offset="76%"  stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#050e1a" />
          </linearGradient>

          {/* Diagonal light streak — premium gloss overlay */}
          <linearGradient id="lgStreak" x1="20" y1="3" x2="160" y2="41" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="rgba(255,255,255,0)" />
            <stop offset="42%"  stopColor="rgba(255,255,255,0.07)" />
            <stop offset="52%"  stopColor="rgba(255,255,255,0.13)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>

          {/* Top-edge bevel — lit metal */}
          <linearGradient id="lgSheen" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="rgba(255,255,255,0)" />
            <stop offset="30%"  stopColor="rgba(255,255,255,0.28)" />
            <stop offset="70%"  stopColor="rgba(255,255,255,0.20)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>

          {/* Perimeter stroke gradient */}
          <linearGradient id="lgEdge" x1="0" y1="0" x2="180" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="rgba(59,130,246,0.12)" />
            <stop offset="40%"  stopColor="rgba(147,197,253,0.45)" />
            <stop offset="100%" stopColor="rgba(59,130,246,0.12)" />
          </linearGradient>

          {/* Ambient glow filter */}
          <filter id="fGlow" x="-30%" y="-60%" width="160%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" />
          </filter>
        </defs>

        {/* ── Ambient glow — softer, more diffuse ── */}
        <polygon
          points="3,12 6,3 108,3 95,22 177,30 162,41 57,41 70,22 3,22"
          fill="#1d4ed8"
          opacity="0.20"
          filter="url(#fGlow)"
        />

        {/* ── Bolt body ── */}
        <polygon
          points="3,12 6,3 108,3 95,22 177,30 162,41 57,41 70,22 3,22"
          fill="url(#lgFill)"
        />

        {/* ── Diagonal gloss streak ── */}
        <polygon
          points="3,12 6,3 108,3 95,22 177,30 162,41 57,41 70,22 3,22"
          fill="url(#lgStreak)"
        />

        {/* ── Perimeter edge stroke ── */}
        <polygon
          points="3,12 6,3 108,3 95,22 177,30 162,41 57,41 70,22 3,22"
          fill="none"
          stroke="url(#lgEdge)"
          strokeWidth="0.8"
        />

        {/* ── Top-edge bevel: upper arm ── */}
        <line x1="6.5" y1="3.6" x2="107" y2="3.6"
          stroke="url(#lgSheen)" strokeWidth="1.1" />
        {/* ── Top-edge bevel: lower arm ── */}
        <line x1="95" y1="22.4" x2="176" y2="30.2"
          stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />

        {/* ── Z-notch accent dots — minimal, precise ── */}
        <circle cx="95" cy="22" r="1.1" fill="rgba(186,230,253,0.95)" />
        <circle cx="70" cy="22" r="1.1" fill="rgba(186,230,253,0.95)" />

        {/* ── BATTERY — upper arm, ultra-light tracking ── */}
        <text
          x="47" y="13"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(186,230,253,0.78)"
          fontSize="9"
          fontWeight="200"
          letterSpacing="4.2"
          fontFamily="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
          textRendering="geometricPrecision"
          transform="rotate(8, 47, 13)"
        >BATTERY</text>

        {/* ── DESIGNER — lower arm, heavy weight ── */}
        <text
          x="113" y="31"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.97)"
          fontSize="13"
          fontWeight="900"
          letterSpacing="1.2"
          fontFamily="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
          textRendering="geometricPrecision"
          transform="rotate(8, 113, 31)"
        >DESIGNER</text>

      </svg>
    </a>
  )
}

function StatusPill() {
  return (
    <li className="status-pill">
      <span className="status-pill__dot" />
      API Online
    </li>
  )
}

export default function Header() {
  return (
    <header id="site-header">
      <nav className="nav-card" role="navigation" aria-label="Main navigation">
        <BoltLogo />
        <ul className="nav-links" role="list">
          <StatusPill />
        </ul>
      </nav>
    </header>
  )
}
