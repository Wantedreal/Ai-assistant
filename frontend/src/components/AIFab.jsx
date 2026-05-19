import React, { useState, useRef, useCallback, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { useT, useLang } from '../i18n'

const CHAT_URL = 'http://127.0.0.1:8000/api/v1/chat'

// ── Quick-start chips (context-aware, labels translated via t()) ──────────────
function getSuggestions(result, t) {
  const chips = []
  if (result?.verdict === 'REJECT') {
    chips.push({ label: t('ai.chip.why_rejected'), msg: 'Why was my design rejected? Which axis is the binding constraint?' })
    chips.push({ label: t('ai.chip.how_fix'),      msg: 'Give me concrete steps to fix the rejection for my current design.' })
  } else if (result?.verdict === 'ACCEPT') {
    chips.push({ label: t('ai.chip.explain'),  msg: 'Explain my current result — is this design well optimised?' })
    chips.push({ label: t('ai.chip.improve'),  msg: 'How could I improve the fill ratio or free up margin in my current design?' })
  }
  chips.push({ label: t('ai.chip.how_use'), msg: 'Give me a quick guide on how to use this application to size a battery pack.' })
  chips.push({ label: t('ai.chip.dod'),     msg: 'What is Depth of Discharge and what value should I use for an EV application?' })
  return chips
}

// ── Styles (defined outside component — static objects) ──────────────────────
const S = {
  fab: {
    position: 'fixed', bottom: 28, right: 28,
    width: 52, height: 52, borderRadius: '50%',
    background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)',
    border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(29,78,216,0.5)', zIndex: 9000,
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  panel: {
    position: 'fixed', bottom: 92, right: 28, zIndex: 9500,
    width: 'min(380px, calc(100vw - 56px))',
    height: 'min(500px, calc(100vh - 120px))',
    background: '#1a1c23', border: '1px solid #2a2c33',
    borderRadius: 12, boxShadow: '0 16px 60px rgba(0,0,0,0.6)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '11px 14px', borderBottom: '1px solid #2a2c33', flexShrink: 0,
  },
  messages: {
    flex: 1, overflowY: 'auto', padding: '10px 12px',
    display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0,
  },
  userBubble: {
    alignSelf: 'flex-end',
    background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)',
    borderRadius: '10px 10px 2px 10px',
    padding: '7px 11px', maxWidth: '86%',
    color: '#e2e8f0', fontSize: '0.82rem', lineHeight: 1.55,
    wordBreak: 'break-word',
  },
  aiBubble: {
    alignSelf: 'flex-start',
    background: 'rgba(255,255,255,0.03)', border: '1px solid #2a2c33',
    borderRadius: '10px 10px 10px 2px',
    padding: '7px 11px', maxWidth: '93%',
    color: '#cbd5e1', fontSize: '0.82rem', lineHeight: 1.65,
    wordBreak: 'break-word',
  },
  inputRow: {
    display: 'flex', gap: 7, padding: '9px 11px',
    borderTop: '1px solid #2a2c33', flexShrink: 0, alignItems: 'flex-end',
  },
  textarea: {
    flex: 1, background: '#252830', border: '1px solid #3a3c44',
    borderRadius: 8, color: '#e2e8f0', fontSize: '0.82rem',
    padding: '7px 10px', resize: 'none',
    minHeight: 34, maxHeight: 96, lineHeight: 1.5,
    outline: 'none', fontFamily: 'inherit',
  },
}

// ── Chat bubble with streaming cursor ────────────────────────────────────────
function AiBubble({ content, streaming }) {
  const isEmpty = content === '' && streaming
  return (
    <div style={S.aiBubble}>
      {isEmpty
        ? (
          <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                width: 4, height: 4, borderRadius: '50%', background: '#64748b',
                display: 'inline-block',
                animation: `tdot 1.2s ${i * 0.2}s ease-in-out infinite`,
              }} />
            ))}
          </span>
        )
        : <ReactMarkdown components={{
            p:      ({ children }) => <p style={{ margin: '0 0 6px' }}>{children}</p>,
            ul:     ({ children }) => <ul style={{ margin: '4px 0', paddingLeft: 18 }}>{children}</ul>,
            ol:     ({ children }) => <ol style={{ margin: '4px 0', paddingLeft: 18 }}>{children}</ol>,
            li:     ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
            strong: ({ children }) => <strong style={{ color: '#e2e8f0' }}>{children}</strong>,
            code:   ({ children }) => <code style={{ background: '#1e2028', borderRadius: 3, padding: '1px 5px', fontSize: '0.78rem', color: '#7dd3fc' }}>{children}</code>,
            pre:    ({ children }) => <pre style={{ background: '#1e2028', borderRadius: 6, padding: '8px 10px', overflowX: 'auto', margin: '6px 0' }}>{children}</pre>,
            h1:     ({ children }) => <p style={{ fontWeight: 700, color: '#e2e8f0', margin: '6px 0 4px' }}>{children}</p>,
            h2:     ({ children }) => <p style={{ fontWeight: 700, color: '#e2e8f0', margin: '6px 0 4px' }}>{children}</p>,
            h3:     ({ children }) => <p style={{ fontWeight: 600, color: '#cbd5e1', margin: '4px 0 2px' }}>{children}</p>,
          }}>{content}</ReactMarkdown>
      }
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AIFab({ cell, form, result }) {
  const t = useT()
  const { lang } = useLang()
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput]       = useState('')
  const [streaming, setStreaming] = useState(false)
  const [provider, setProvider] = useState('auto')
  const bottomRef  = useRef(null)
  const textaRef   = useRef(null)
  const abortRef   = useRef(null)

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text) => {
    const userText = text.trim()
    if (!userText || streaming) return

    const userMsg = { role: 'user', content: userText }
    const history = [...messages, userMsg]

    setMessages([...history, { role: 'assistant', content: '' }])
    setInput('')
    if (textaRef.current) textaRef.current.style.height = 'auto'
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    const payload = {
      messages: history,
      lang,
      provider,
      cell_id:     cell?.id ?? null,
      form_data:   form ? {
        housing_l:           form.housing_l,
        housing_l_small:     form.housing_l_small,
        housing_h:           form.housing_h,
        energie_cible_wh:    form.energie_cible_wh,
        tension_cible_v:     form.tension_cible_v,
        courant_cible_a:     form.courant_cible_a,
        depth_of_discharge:  form.depth_of_discharge,
        marge_mm:            form.marge_mm,
        cell_gap_mm:         form.cell_gap_mm,
        config_mode:         form.config_mode,
      } : null,
      result_data: result ? {
        nb_serie:             result.nb_serie,
        nb_parallele:         result.nb_parallele,
        verdict:              result.verdict,
        justification:        result.justification,
        marges_reelles:       result.marges_reelles,
        taux_occupation_pct:  result.taux_occupation_pct,
        energie_reelle_wh:    result.energie_reelle_wh,
        tension_totale_v:     result.tension_totale_v,
        lifetime_years:       result.lifetime_years,
        c_rate_actual:        result.c_rate_actual,
      } : null,
    }

    try {
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const reader  = response.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') break

          try {
            const json = JSON.parse(raw)

            // Provider sent an error object
            if (json.error) {
              setMessages(prev => {
                const u = [...prev]
                u[u.length - 1] = { role: 'assistant', content: `⚠ ${json.error}` }
                return u
              })
              return
            }

            const delta = json.choices?.[0]?.delta?.content || ''
            if (delta) {
              setMessages(prev => {
                const u = [...prev]
                const last = u[u.length - 1]
                u[u.length - 1] = { ...last, content: last.content + delta }
                return u
              })
            }
          } catch { /* skip malformed SSE line */ }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev => {
          const u = [...prev]
          u[u.length - 1] = {
            role: 'assistant',
            content: t('ai.conn_error'),
          }
          return u
        })
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [messages, streaming, cell, form, result, lang])

  const handleSend = () => sendMessage(input)

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (e) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px'
  }

  const clearChat = () => {
    abortRef.current?.abort()
    setMessages([])
    setStreaming(false)
  }

  const suggestions = getSuggestions(result, t)
  const isStreaming  = streaming
  const sendDisabled = isStreaming || !input.trim()

  return (
    <>
      {/* ── FAB button ── */}
      <button
        data-ai-fab=""
        onClick={() => setOpen(o => !o)}
        title="AI Assistant"
        style={S.fab}
        onMouseEnter={e => {
          e.currentTarget.style.transform  = 'scale(1.08)'
          e.currentTarget.style.boxShadow  = '0 6px 28px rgba(29,78,216,0.65)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform  = 'scale(1)'
          e.currentTarget.style.boxShadow  = '0 4px 20px rgba(29,78,216,0.5)'
        }}
      >
        {/* Chat bubble icon */}
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
          stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>

      {/* ── Chat panel ── */}
      {open && (
        <div data-ai-panel="" style={S.panel}>

          {/* Header */}
          <div style={S.header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'linear-gradient(135deg,#1d4ed8,#0ea5e9)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none"
                  stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <span style={{ fontWeight: 700, fontSize: '0.87rem', color: '#f1f5f9' }}>
                {t('ai.chat_title')}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <select
                value={provider}
                onChange={e => setProvider(e.target.value)}
                style={{
                  background: '#252830', border: '1px solid #3a3c44',
                  color: '#94a3b8', fontSize: '0.70rem', borderRadius: 5,
                  padding: '2px 5px', cursor: 'pointer', outline: 'none',
                }}
              >
                <option value="auto">Auto</option>
                <option value="capgemini">Capgemini</option>
                <option value="groq">Groq</option>
                <option value="openrouter">OpenRouter</option>
              </select>
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  style={{
                    background: 'none', border: '1px solid #2a2c33',
                    color: '#64748b', cursor: 'pointer',
                    fontSize: '0.71rem', padding: '3px 8px', borderRadius: 5,
                  }}
                >
                  {t('ai.new_chat')}
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'none', border: 'none', color: '#64748b',
                  cursor: 'pointer', fontSize: '1rem', padding: '3px 6px',
                  borderRadius: 4, lineHeight: 1,
                }}
              >✕</button>
            </div>
          </div>

          {/* Messages */}
          <div style={S.messages}>
            {messages.length === 0 && (
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 10,
                paddingTop: 6, alignItems: 'center',
              }}>
                <p style={{
                  color: '#475569', fontSize: '0.78rem',
                  margin: 0, textAlign: 'center', lineHeight: 1.5,
                }}>
                  {t('ai.empty_hint')}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s.msg)}
                      style={{
                        padding: '4px 10px', borderRadius: 14,
                        border: '1px solid #2a2c33',
                        background: 'rgba(255,255,255,0.03)',
                        color: '#94a3b8', fontSize: '0.75rem',
                        cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#3b82f6'
                        e.currentTarget.style.color = '#e2e8f0'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = '#2a2c33'
                        e.currentTarget.style.color = '#94a3b8'
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              msg.role === 'user'
                ? <div key={i} style={S.userBubble}>{msg.content}</div>
                : <AiBubble key={i} content={msg.content} streaming={isStreaming && i === messages.length - 1} />
            ))}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={S.inputRow}>
            <textarea
              ref={textaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={t('ai.placeholder')}
              style={{
                ...S.textarea,
                opacity: isStreaming ? 0.5 : 1,
              }}
              rows={1}
              disabled={isStreaming}
            />
            <button
              onClick={handleSend}
              disabled={sendDisabled}
              style={{
                width: 34, height: 34, flexShrink: 0, borderRadius: 7,
                background: sendDisabled
                  ? '#252830'
                  : 'linear-gradient(135deg, #1d4ed8, #0ea5e9)',
                border: '1px solid #3a3c44', cursor: sendDisabled ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
              }}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                stroke={sendDisabled ? '#475569' : '#fff'}
                strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes tdot {
          0%, 60%, 100% { opacity: 0.2; transform: translateY(0) }
          30%            { opacity: 1;   transform: translateY(-2px) }
        }
        /* Tighter margins on small / narrow windows */
        @media (max-width: 480px) {
          [data-ai-panel] { right: 8px !important; bottom: 80px !important; }
          [data-ai-fab]   { right: 8px !important; bottom: 12px !important; }
        }
        @media (max-height: 500px) {
          [data-ai-panel] { bottom: 70px !important; }
        }
      `}</style>
    </>
  )
}
