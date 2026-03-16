import React from 'react'

export default function PackPreview({ result }) {
  const ok     = result.verdict === 'ACCEPT'
  const stroke = ok ? '#22c55e' : '#ef4444'
  const fill   = ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'
  const d      = result.dimensions_array

  return (
    <div className="pack-preview">
      <div className="pack-preview__label">
        Pack dimensions (with margins)
      </div>
      <svg viewBox="0 0 220 160" width="200" style={{ overflow: 'visible' }}>
        <rect x="35" y="55" width="115" height="75" rx="3" fill={fill} stroke={stroke} strokeWidth="1.2" strokeOpacity="0.85" />
        <path d="M35 55 L62 30 L177 30 L150 55 Z" fill={fill} stroke={stroke} strokeWidth="1.2" strokeOpacity="0.65" />
        <path d="M150 55 L177 30 L177 105 L150 130 Z" fill={fill} stroke={stroke} strokeWidth="1.2" strokeOpacity="0.5" />
        <text x="92"  y="152" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="9" fontFamily="inherit">L {d.longueur_mm} mm</text>
        <text x="185" y="72"  textAnchor="start"  fill="rgba(255,255,255,0.45)" fontSize="9" fontFamily="inherit">H {d.hauteur_mm}</text>
        <text x="10"  y="100" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="9" fontFamily="inherit" transform="rotate(-90,10,100)">W {d.largeur_mm}</text>
      </svg>
      <div className={`pack-preview__verdict pack-preview__verdict--${ok ? 'accept' : 'reject'}`}>
        {result.verdict}
      </div>
      <div className="pack-preview__message">
        {ok ? 'All margins satisfied on 3 axes' : result.justification}
      </div>
    </div>
  )
}
