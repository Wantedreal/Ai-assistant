import React, { useState, useEffect, useCallback, useRef } from 'react'
import { apiService } from '../services/api'
import { useT } from '../i18n'

function formatTs(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export default function HistoryPanel({ isOpen, onClose, onRestore }) {
  const t = useT()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const panelRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await apiService.getHistory(50)
      setEntries(data.entries ?? [])
    } catch (_) {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) load()
  }, [isOpen, load])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        // Check if click is on the header button (let the button's own handler toggle)
        if (!e.target.closest('.nav-history-btn')) onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen, onClose])

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    await apiService.deleteHistoryEntry(id)
    setEntries(prev => prev.filter(en => en.id !== id))
  }

  const handleClearAll = async () => {
    if (!window.confirm('Clear all calculation history?')) return
    await apiService.clearHistory()
    setEntries([])
  }

  const handleRestore = (entry) => {
    try {
      const payload = JSON.parse(entry.payload_json)
      const result  = JSON.parse(entry.result_json)
      onRestore?.({ payload, result, cellId: entry.cell_id })
      onClose()
    } catch (_) {}
  }

  if (!isOpen) return null

  return (
    <div className="history-dropdown" ref={panelRef} role="dialog" aria-label="Calculation history">
      <div className="history-dropdown__header">
        <span className="history-dropdown__title">{t('history.title')}</span>
        {entries.length > 0 && (
          <button className="history-clear-btn" onClick={handleClearAll}>{t('history.clear')}</button>
        )}
        <button className="history-dropdown__close" onClick={onClose} aria-label="Close history">✕</button>
      </div>

      <div className="history-dropdown__body">
        {loading && <p className="history-empty">{t('history.loading')}</p>}
        {!loading && entries.length === 0 && (
          <p className="history-empty" style={{ whiteSpace: 'pre-line' }}>{t('history.empty')}</p>
        )}
        {!loading && entries.map(en => (
          <div
            key={en.id}
            className={`history-entry history-entry--${en.verdict.toLowerCase()}`}
            onClick={() => handleRestore(en)}
            title="Click to restore this calculation"
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && handleRestore(en)}
          >
            <div className="history-entry__top">
              <span className="history-entry__cell">{en.cell_nom}</span>
              <span className={`history-entry__verdict history-verdict--${en.verdict.toLowerCase()}`}>
                {en.verdict}
              </span>
              <button
                className="history-entry__del"
                onClick={e => handleDelete(en.id, e)}
                title="Remove entry"
                aria-label="Delete history entry"
              >×</button>
            </div>
            <div className="history-entry__meta">
              <span>{en.nb_serie}S × {en.nb_parallele}P</span>
              {en.energy_wh != null && <span>{(en.energy_wh / 1000).toFixed(2)} kWh</span>}
              <span className="history-entry__ts">{formatTs(en.timestamp)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
