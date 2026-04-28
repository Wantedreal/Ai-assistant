import React from 'react'
import { useLang, useT } from '../i18n'

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'

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
          <linearGradient id="lgFill" x1="0" y1="0" x2="180" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#040e1c" />
            <stop offset="28%"  stopColor="#1e3a8a" />
            <stop offset="52%"  stopColor="#2563eb" />
            <stop offset="76%"  stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#050e1a" />
          </linearGradient>
          <linearGradient id="lgStreak" x1="20" y1="3" x2="160" y2="41" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="rgba(255,255,255,0)" />
            <stop offset="42%"  stopColor="rgba(255,255,255,0.07)" />
            <stop offset="52%"  stopColor="rgba(255,255,255,0.13)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="lgSheen" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="rgba(255,255,255,0)" />
            <stop offset="30%"  stopColor="rgba(255,255,255,0.28)" />
            <stop offset="70%"  stopColor="rgba(255,255,255,0.20)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="lgEdge" x1="0" y1="0" x2="180" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="rgba(59,130,246,0.12)" />
            <stop offset="40%"  stopColor="rgba(147,197,253,0.45)" />
            <stop offset="100%" stopColor="rgba(59,130,246,0.12)" />
          </linearGradient>
          <filter id="fGlow" x="-30%" y="-60%" width="160%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" />
          </filter>
        </defs>
        <polygon points="3,12 6,3 108,3 95,22 177,30 162,41 57,41 70,22 3,22" fill="#1d4ed8" opacity="0.20" filter="url(#fGlow)" />
        <polygon points="3,12 6,3 108,3 95,22 177,30 162,41 57,41 70,22 3,22" fill="url(#lgFill)" />
        <polygon points="3,12 6,3 108,3 95,22 177,30 162,41 57,41 70,22 3,22" fill="url(#lgStreak)" />
        <polygon points="3,12 6,3 108,3 95,22 177,30 162,41 57,41 70,22 3,22" fill="none" stroke="url(#lgEdge)" strokeWidth="0.8" />
        <line x1="6.5" y1="3.6" x2="107" y2="3.6" stroke="url(#lgSheen)" strokeWidth="1.1" />
        <line x1="95" y1="22.4" x2="176" y2="30.2" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />
        <circle cx="95" cy="22" r="1.1" fill="rgba(186,230,253,0.95)" />
        <circle cx="70" cy="22" r="1.1" fill="rgba(186,230,253,0.95)" />
        <text x="47" y="13" textAnchor="middle" dominantBaseline="middle" fill="rgba(186,230,253,0.78)" fontSize="9" fontWeight="200" letterSpacing="4.2" fontFamily="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" textRendering="geometricPrecision" transform="rotate(8, 47, 13)">BATTERY</text>
        <text x="113" y="31" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.97)" fontSize="13" fontWeight="900" letterSpacing="1.2" fontFamily="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" textRendering="geometricPrecision" transform="rotate(8, 113, 31)">DESIGNER</text>
      </svg>
    </a>
  )
}

function LangToggle() {
  const { lang, setLang } = useLang()
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8, padding: 3, gap: 2,
    }}>
      {['en', 'fr'].map(l => (
        <button
          key={l}
          onClick={() => setLang(l)}
          style={{
            background: lang === l ? 'rgba(255,255,255,0.12)' : 'transparent',
            border: 'none',
            borderRadius: 6,
            color: lang === l ? '#e2e8f0' : '#64748b',
            cursor: lang === l ? 'default' : 'pointer',
            fontWeight: lang === l ? 700 : 400,
            fontSize: '0.75rem',
            letterSpacing: '0.06em',
            padding: '4px 10px',
            textTransform: 'uppercase',
            transition: 'all 0.15s',
          }}
          disabled={lang === l}
          aria-label={`Switch to ${l === 'en' ? 'English' : 'French'}`}
        >
          {l === 'en' ? 'EN' : 'FR'}
        </button>
      ))}
    </div>
  )
}

export default function Header({ onOpenCompare, onOpenHistory, onOpenCatalogue, historyCount }) {
  const t = useT()
  return (
    <header id="site-header">
      <nav className="nav-card" role="navigation" aria-label="Main navigation">
        <BoltLogo />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
          {!DEMO_MODE && (
            <ul className="nav-links" role="list">
              <li>
                <button className="nav-compare-btn" onClick={onOpenCatalogue} title="Browse and add cells">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                    <line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
                    <line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                  {t('nav.cells')}
                </button>
              </li>
              <li>
                <button className="nav-compare-btn" onClick={onOpenCompare} title="Compare 2–3 cells side by side">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="18" rx="1" />
                    <rect x="14" y="3" width="7" height="18" rx="1" />
                  </svg>
                  {t('nav.compare')}
                </button>
              </li>
              <li style={{ position: 'relative' }}>
                <button className="nav-history-btn" onClick={onOpenHistory} title="View calculation history">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {t('nav.history')}
                  {historyCount > 0 && (
                    <span className="nav-history-badge">{historyCount}</span>
                  )}
                </button>
              </li>
            </ul>
          )}
          {!DEMO_MODE && <LangToggle />}
        </div>
      </nav>
    </header>
  )
}
