import React, { useState, useRef, useCallback } from 'react'
import { apiService } from '../services/api'
import { useT, useLang } from '../i18n'

export default function AIFab({ cell, form, result }) {
  const t = useT()
  const { lang } = useLang()
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [text, setText]       = useState(null)
  const [error, setError]     = useState(null)
  const fetchedForRef         = useRef(null)
  const resultKey = result
    ? `${result.nb_serie}-${result.nb_parallele}-${cell?.id}-${result.verdict}-${result.energie_reelle_wh}-${lang}`
    : null

  const fetchExplanation = useCallback(async (key) => {
    if (!result || !cell) return
    if (fetchedForRef.current === key) return

    setLoading(true)
    setText(null)
    setError(null)

    const toNum = (v, fb = 0) => {
      const n = parseFloat(String(v ?? '').replace(',', '.'))
      return isNaN(n) ? fb : n
    }

    const payload = {
      cell_id:             cell.id,
      lang,
      energie_cible_wh:    form.energie_cible_wh != null && form.energie_cible_wh !== ''
                             ? toNum(form.energie_cible_wh) : undefined,
      tension_cible_v:     form.tension_cible_v  != null && form.tension_cible_v  !== ''
                             ? toNum(form.tension_cible_v)  : undefined,
      courant_cible_a:     toNum(form.courant_cible_a),
      depth_of_discharge:  toNum(form.depth_of_discharge, 80),
      cycles_per_day:      toNum(form.cycles_per_day, 1),
      housing_l:           toNum(form.housing_l),
      housing_l_small:     toNum(form.housing_l_small),
      housing_h:           toNum(form.housing_h),
      nb_serie:            result.nb_serie,
      nb_parallele:        result.nb_parallele,
      verdict:             result.verdict,
      justification:       result.justification ?? undefined,
      tension_totale_v:    result.tension_totale_v ?? undefined,
      energie_reelle_wh:   result.energie_reelle_wh ?? undefined,
      pack_l_mm:           result.dimensions_raw?.longueur_mm ?? undefined,
      pack_w_mm:           result.dimensions_raw?.largeur_mm  ?? undefined,
      pack_h_mm:           result.dimensions_raw?.hauteur_mm  ?? undefined,
      margin_l_mm:         result.marges_reelles?.L ?? undefined,
      margin_w_mm:         result.marges_reelles?.W ?? undefined,
      margin_h_mm:         result.marges_reelles?.H ?? undefined,
      lifetime_years:      result.lifetime_years      ?? undefined,
      c_rate_actual:       result.c_rate_actual       ?? undefined,
      derating_factor_pct: result.derating_factor_pct ?? undefined,
      c_rate_warning:      result.c_rate_warning      ?? undefined,
    }

    try {
      const res = await apiService.explainResult(payload)
      setText(res.data.explanation)
      fetchedForRef.current = key
    } catch (e) {
      const detail = e.response?.data?.detail ?? ''
      if (detail.includes('rate-limited')) {
        setError(t('ai.busy'))
      } else if (detail.includes('API key') || detail.includes('OPENROUTER')) {
        setError(t('ai.no_key'))
      } else {
        setError(detail || t('ai.error'))
      }
    } finally {
      setLoading(false)
    }
  }, [result, cell, form, lang, t])

  if (!result) return null

  const handleOpen = () => {
    setOpen(true)
    fetchExplanation(resultKey)
  }

  return (
    <>
      {/* FAB button */}
      <button
        onClick={handleOpen}
        title="AI Analysis"
        style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(29,78,216,0.5)',
          zIndex: 9000,
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.08)'
          e.currentTarget.style.boxShadow = '0 6px 28px rgba(29,78,216,0.65)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(29,78,216,0.5)'
        }}
      >
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      </button>

      {/* Popup overlay */}
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 9500,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
            padding: '0 28px 96px',
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              background: '#1a1c23',
              border: '1px solid #2a2c33',
              borderRadius: 12,
              width: 380,
              maxHeight: 420,
              boxShadow: '0 16px 60px rgba(0,0,0,0.6)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 16px',
              borderBottom: '1px solid #2a2c33',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#1d4ed8,#0ea5e9)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
                  </svg>
                </div>
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#f1f5f9' }}>{t('ai.title')}</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1rem', padding: '4px 6px', borderRadius: 4, lineHeight: 1 }}
              >✕</button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px' }}>
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[95, 88, 92, 70].map((w, i) => (
                    <div key={i} style={{
                      height: 12, borderRadius: 6,
                      background: 'rgba(255,255,255,0.07)',
                      width: `${w}%`,
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }} />
                  ))}
                </div>
              )}
              {error && (
                <p style={{ color: '#f87171', fontSize: '0.82rem', margin: 0 }}>{error}</p>
              )}
              {text && (
                <p style={{ color: '#cbd5e1', fontSize: '0.84rem', lineHeight: 1.65, margin: 0, wordBreak: 'break-word' }}>{text}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }`}</style>
    </>
  )
}
