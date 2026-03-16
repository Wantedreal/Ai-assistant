import React from 'react'

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
        <a href="/" className="nav-logo" aria-label="Battery Pack Designer — home">
          <span className="nav-logo__first">Battery</span>
          <span className="nav-logo__last">Designer</span>
        </a>
        <ul className="nav-links" role="list">
          <StatusPill />
        </ul>
      </nav>
    </header>
  )
}
