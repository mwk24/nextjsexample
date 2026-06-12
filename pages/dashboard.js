import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

const RED = '#e30613'
const DARK = '#111'
const CARD = '#1c1c1c'
const BORDER = '#2a2a2a'

// ─── helpers ────────────────────────────────────────────────────────────────

function toArr(x) {
  if (Array.isArray(x)) return x
  if (!x) return []
  for (const key of ['classes', 'schedule', 'checkIns', 'checkins', 'items', 'content', 'data', 'results']) {
    if (Array.isArray(x[key])) return x[key]
  }
  return []
}

function fmtTime(v) {
  if (!v) return '?'
  const d = typeof v === 'number' ? new Date(v) : new Date(v)
  if (isNaN(d)) return String(v)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(v) {
  if (!v) return '?'
  const d = typeof v === 'number' ? new Date(v) : new Date(v)
  if (isNaN(d)) return String(v)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Fetch with full status + error details
async function apiFetch(path) {
  const res = await fetch(path)
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = { _raw: text } }
  return { ok: res.ok, status: res.status, data }
}

// ─── status dot ─────────────────────────────────────────────────────────────

function Dot({ state }) {
  const color = state === 'ok' ? '#4ade80' : state === 'error' ? '#f87171' : state === 'loading' ? '#f59e0b' : '#555'
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 6 }} />
}

// ─── section wrapper ────────────────────────────────────────────────────────

function Section({ title, state, error, children, raw }) {
  const [showRaw, setShowRaw] = useState(false)
  return (
    <div style={sc.section}>
      <div style={sc.sectionHead}>
        <span><Dot state={state} /><span style={sc.sectionTitle}>{title}</span></span>
        {raw && (
          <button style={sc.rawBtn} onClick={() => setShowRaw(v => !v)}>
            {showRaw ? 'hide raw' : 'raw'}
          </button>
        )}
      </div>
      {state === 'loading' && <div style={sc.muted}>Loading…</div>}
      {state === 'error' && <div style={sc.errorText}>{error}</div>}
      {state === 'ok' && children}
      {showRaw && raw && <pre style={sc.pre}>{JSON.stringify(raw, null, 2)}</pre>}
    </div>
  )
}

// ─── busyness ───────────────────────────────────────────────────────────────

function BusynessSection({ result }) {
  const state = !result ? 'loading' : result.ok ? 'ok' : 'error'
  const d = result?.data

  const pct = d?.busynessPercentage ?? d?.occupancyPercentage ?? d?.percentage ?? d?.currentOccupancy ?? null
  const label = d?.busynessLabel || d?.label || d?.status || ''
  const count = d?.currentCount ?? d?.occupancy ?? d?.currentOccupancy ?? null

  return (
    <Section title="Gym Busyness" state={state} error={result?.data?.error || `HTTP ${result?.status}`} raw={d}>
      {pct != null ? (
        <>
          <div style={sc.pctNum}>{Math.round(pct)}%</div>
          <div style={sc.bar}><div style={{ ...sc.barFill, width: `${Math.min(pct, 100)}%`, background: pct > 80 ? RED : pct > 50 ? '#f59e0b' : '#4ade80' }} /></div>
          {label && <div style={sc.muted}>{label}</div>}
          {count != null && <div style={sc.muted}>{count} people currently</div>}
        </>
      ) : (
        <div style={sc.muted}>Data received but no busyness % found — check raw response.</div>
      )}
    </Section>
  )
}

// ─── classes ────────────────────────────────────────────────────────────────

function ClassRow({ cls, companyUuid, exerciserUuid, onRefresh }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const booked = cls.bookingStatus === 'BOOKED' || cls.isBooked || cls.exerciserBooked || cls.booked
  const classUuid = cls.classUuid || cls.uuid || cls.id
  const name = cls.className || cls.name || cls.title || 'Class'
  const instructor = cls.instructorName || cls.instructor?.name || cls.instructorFirstName || ''
  const startV = cls.startDateTime || cls.startDate || cls.start
  const endV = cls.endDateTime || cls.endDate || cls.end
  const spots = cls.spotsAvailable ?? cls.availableSpots ?? cls.freeSpots ?? null
  const full = spots === 0

  async function handleBook() {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/gym/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyUuid, classUuid, exerciserUuid, action: booked ? 'cancel' : 'book' }),
      })
      const data = await res.json()
      setMsg(res.ok ? (booked ? 'Cancelled' : 'Booked!') : (data.error || `Error ${res.status}`))
      if (res.ok && onRefresh) onRefresh()
    } catch { setMsg('Network error') }
    finally { setBusy(false) }
  }

  return (
    <div style={{ ...sc.classRow, borderLeft: booked ? `3px solid ${RED}` : '3px solid transparent' }}>
      <div style={sc.classTime}>{fmtTime(startV)}{endV ? ` – ${fmtTime(endV)}` : ''}</div>
      <div style={sc.className}>{name}</div>
      {instructor && <div style={sc.classSub}>{instructor}</div>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
        {spots != null && <span style={{ ...sc.badge, background: full ? '#3a1c1c' : '#1c2a1c', color: full ? '#f87171' : '#4ade80' }}>{full ? 'Full' : `${spots} spots`}</span>}
        {booked && <span style={{ ...sc.badge, background: '#1a1f3a', color: '#818cf8' }}>Booked</span>}
        {classUuid && companyUuid && exerciserUuid && (
          <button
            style={{ ...sc.bookBtn, marginLeft: 'auto', ...(booked ? { background: '#2a1a1a', color: '#f87171' } : {}), ...(busy ? { opacity: 0.5 } : {}) }}
            onClick={handleBook} disabled={busy || (!booked && full)}
          >{busy ? '…' : booked ? 'Cancel' : full ? 'Full' : 'Book'}</button>
        )}
      </div>
      {msg && <div style={{ fontSize: 12, marginTop: 4, color: msg.includes('!') || msg === 'Cancelled' ? '#4ade80' : '#f87171' }}>{msg}</div>}
    </div>
  )
}

// ─── main ────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [results, setResults] = useState({}) // { profile, classes, schedule, busyness, checkins }
  const [tab, setTab] = useState('classes')

  function setResult(key, val) {
    setResults(r => ({ ...r, [key]: val }))
  }

  const loadAll = useCallback(async (s) => {
    // 1. Profile first — it carries companyUuid + homeClub which login doesn't always return
    const profileResult = await apiFetch(`/api/gym/profile?exerciserUuid=${s.exerciserUuid}`)
    setResult('profile', profileResult)

    // 2. Extract the missing fields from profile, try every known nesting
    const pd = profileResult.data
    const ex = pd?.exerciser || pd || {}
    const hc = ex.homeClub || ex.club || {}

    const enriched = {
      ...s,
      firstName: s.firstName || ex.firstName,
      companyUuid: s.companyUuid || ex.companyUuid,
      homeClub: {
        name:          s.homeClub?.name         || hc.name,
        clubUuid:      s.homeClub?.clubUuid      || hc.clubUuid || hc.uuid,
        gymLocationId: s.homeClub?.gymLocationId || hc.gymLocationId || hc.locationUuid || hc.id,
      },
    }

    // Persist enriched data so refreshes don't need to re-derive
    localStorage.setItem('gym_session', JSON.stringify(enriched))
    setSession(enriched)

    // 3. Fire the rest in parallel now that we have the UUIDs
    apiFetch(`/api/gym/schedule?exerciserUuid=${enriched.exerciserUuid}`)
      .then(r => setResult('schedule', r))
    apiFetch(`/api/gym/checkins?exerciserUuid=${enriched.exerciserUuid}`)
      .then(r => setResult('checkins', r))

    if (enriched.companyUuid) {
      const clubQ = enriched.homeClub?.clubUuid ? `&clubUuid=${enriched.homeClub.clubUuid}` : ''
      apiFetch(`/api/gym/classes?companyUuid=${enriched.companyUuid}&exerciserUuid=${enriched.exerciserUuid}${clubQ}`)
        .then(r => setResult('classes', r))
    } else {
      setResult('classes', { ok: false, status: 0, data: { error: `companyUuid not found in profile response — raw: ${JSON.stringify(pd).slice(0, 200)}` } })
    }

    if (enriched.homeClub?.gymLocationId) {
      apiFetch(`/api/gym/busyness?exerciserUuid=${enriched.exerciserUuid}&gymLocationId=${enriched.homeClub.gymLocationId}`)
        .then(r => setResult('busyness', r))
    } else {
      setResult('busyness', { ok: false, status: 0, data: { error: `gymLocationId not found in profile response — raw: ${JSON.stringify(hc).slice(0, 200)}` } })
    }
  }, [])

  useEffect(() => {
    const raw = localStorage.getItem('gym_session')
    if (!raw) { router.push('/'); return }
    const s = JSON.parse(raw)
    if (!s?.exerciserUuid) { router.push('/'); return }
    setSession(s)
    loadAll(s)
  }, [])

  if (!session) return null

  const profile = results.profile?.data
  const displayName = profile?.exerciser?.firstName || profile?.firstName || session.firstName || 'Member'
  const homeClubName = profile?.exerciser?.homeClub?.name || profile?.homeClub?.name || session.homeClub?.name || '—'
  const companyUuid = session.companyUuid || profile?.exerciser?.companyUuid || profile?.companyUuid

  const classes = toArr(results.classes?.data)
  const schedule = toArr(results.schedule?.data)
  const checkins = toArr(results.checkins?.data)

  return (
    <div style={sc.page}>
      <Head><title>Gym Group Dashboard</title></Head>

      <header style={sc.header}>
        <div>
          <div style={sc.brand}><span style={sc.brandBar} />THE GYM GROUP</div>
          <div style={sc.sub}>{homeClubName}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={sc.greeting}>Hi, {displayName}</span>
          <button style={sc.logoutBtn} onClick={() => { localStorage.clear(); router.push('/') }}>Sign out</button>
        </div>
      </header>

      <main style={sc.main}>

        {/* ── Session diagnostic (always visible, collapsible) ── */}
        <details style={sc.diagCard} open={!session.companyUuid || !session.homeClub?.gymLocationId}>
          <summary style={sc.diagSummary}>
            Session
            {!session.exerciserUuid && ' ⚠ no exerciserUuid'}
            {!session.companyUuid && ' ⚠ no companyUuid'}
            {!session.homeClub?.gymLocationId && ' ⚠ no gymLocationId'}
          </summary>
          <div style={sc.diagGrid}>
            {[
              ['exerciserUuid', session.exerciserUuid],
              ['companyUuid', session.companyUuid],
              ['homeClub.name', session.homeClub?.name],
              ['homeClub.clubUuid', session.homeClub?.clubUuid],
              ['homeClub.gymLocationId', session.homeClub?.gymLocationId],
            ].map(([k, v]) => (
              <div key={k} style={sc.diagRow}>
                <span style={sc.diagKey}>{k}</span>
                <span style={{ ...sc.diagVal, color: v ? '#4ade80' : '#f87171' }}>{v || 'null'}</span>
              </div>
            ))}
          </div>
          {localStorage.getItem('gym_raw_login') && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ color: '#555', fontSize: 11, cursor: 'pointer' }}>Raw login response</summary>
              <pre style={sc.pre}>{localStorage.getItem('gym_raw_login')}</pre>
            </details>
          )}
        </details>

        {/* ── Busyness ── */}
        <BusynessSection result={results.busyness} />

        {/* ── Tabs ── */}
        <div style={sc.tabBar}>
          {[
            ['classes', `Classes (${classes.length || '…'})`],
            ['schedule', `Bookings (${schedule.length || '…'})`],
            ['checkins', `Visits (${checkins.length || '…'})`],
          ].map(([key, label]) => (
            <button key={key}
              style={{ ...sc.tabBtn, ...(tab === key ? sc.tabActive : {}) }}
              onClick={() => setTab(key)}
            >{label}</button>
          ))}
        </div>

        {tab === 'classes' && (
          <Section
            title="Classes today"
            state={!results.classes ? 'loading' : results.classes.ok ? 'ok' : 'error'}
            error={results.classes?.data?.error || `HTTP ${results.classes?.status}`}
            raw={results.classes?.data}
          >
            {classes.length === 0
              ? <div style={sc.muted}>No classes found today.</div>
              : classes.map((c, i) => (
                  <ClassRow key={c.classUuid || i} cls={c}
                    companyUuid={companyUuid} exerciserUuid={session.exerciserUuid}
                    onRefresh={() => loadAll(session)}
                  />
                ))
            }
          </Section>
        )}

        {tab === 'schedule' && (
          <Section
            title="My booked classes (next 7 days)"
            state={!results.schedule ? 'loading' : results.schedule.ok ? 'ok' : 'error'}
            error={results.schedule?.data?.error || `HTTP ${results.schedule?.status}`}
            raw={results.schedule?.data}
          >
            {schedule.length === 0
              ? <div style={sc.muted}>No upcoming bookings.</div>
              : schedule.map((c, i) => (
                  <div key={c.classUuid || i} style={sc.schedRow}>
                    <span style={sc.schedDate}>{fmtDate(c.startDateTime || c.startDate || c.start)}</span>
                    <span style={sc.schedTime}>{fmtTime(c.startDateTime || c.startDate || c.start)}</span>
                    <span style={sc.schedName}>{c.className || c.name || c.title || 'Class'}</span>
                  </div>
                ))
            }
          </Section>
        )}

        {tab === 'checkins' && (
          <Section
            title="Visit history (last 30 days)"
            state={!results.checkins ? 'loading' : results.checkins.ok ? 'ok' : 'error'}
            error={results.checkins?.data?.error || `HTTP ${results.checkins?.status}`}
            raw={results.checkins?.data}
          >
            {checkins.length === 0
              ? <div style={sc.muted}>No visits recorded.</div>
              : (
                <>
                  <div style={{ color: '#4ade80', fontSize: 13, marginBottom: 12 }}>{checkins.length} visit{checkins.length !== 1 ? 's' : ''}</div>
                  {checkins.map((c, i) => {
                    const ts = c.checkInDateTime || c.date || c.timestamp || c.dateTime || c.checkInDate
                    return (
                      <div key={i} style={sc.visitRow}>
                        <span style={sc.schedDate}>{fmtDate(ts)}</span>
                        <span style={sc.schedTime}>{fmtTime(ts)}</span>
                        <span style={{ color: '#666', fontSize: 13 }}>{c.clubName || c.gym?.name || c.locationName || ''}</span>
                      </div>
                    )
                  })}
                </>
              )
            }
          </Section>
        )}

      </main>
    </div>
  )
}

// ─── styles ──────────────────────────────────────────────────────────────────

const sc = {
  page: { minHeight: '100vh', background: DARK, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#e5e5e5' },
  header: {
    background: '#161616', borderBottom: `2px solid ${RED}`, padding: '12px 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    position: 'sticky', top: 0, zIndex: 10,
  },
  brand: { color: RED, fontWeight: 800, fontSize: 12, letterSpacing: 2.5, display: 'flex', alignItems: 'center', gap: 8 },
  brandBar: { display: 'inline-block', width: 14, height: 3, background: RED, borderRadius: 2 },
  sub: { color: '#666', fontSize: 12, marginTop: 2 },
  greeting: { color: '#aaa', fontSize: 13 },
  logoutBtn: { background: 'transparent', border: '1px solid #333', color: '#666', padding: '4px 12px', borderRadius: 5, cursor: 'pointer', fontSize: 12 },

  main: { maxWidth: 680, margin: '0 auto', padding: '16px 16px 60px' },

  // diagnostic
  diagCard: { background: '#181818', border: `1px solid #2a2a2a`, borderRadius: 8, padding: '12px 16px', marginBottom: 12 },
  diagSummary: { color: '#555', fontSize: 12, cursor: 'pointer', userSelect: 'none' },
  diagGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginTop: 10 },
  diagRow: { display: 'flex', flexDirection: 'column', gap: 2 },
  diagKey: { color: '#555', fontSize: 10, letterSpacing: 0.5 },
  diagVal: { fontSize: 12, wordBreak: 'break-all' },

  // busyness / section
  section: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '14px 16px', marginBottom: 10 },
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { color: '#888', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' },
  rawBtn: { background: 'transparent', border: '1px solid #333', color: '#555', fontSize: 10, padding: '2px 8px', borderRadius: 4, cursor: 'pointer' },
  pctNum: { fontSize: 38, fontWeight: 800, color: '#fff', lineHeight: 1 },
  bar: { height: 5, background: '#2a2a2a', borderRadius: 3, margin: '10px 0 6px', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, transition: 'width 0.5s ease' },

  // tabs
  tabBar: { display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' },
  tabBtn: { background: 'transparent', border: `1px solid ${BORDER}`, color: '#555', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500 },
  tabActive: { background: CARD, color: '#ccc', borderColor: '#444' },

  // classes
  classRow: { borderBottom: `1px solid ${BORDER}`, padding: '10px 0 10px 10px', marginBottom: 2 },
  classTime: { color: '#666', fontSize: 11, fontWeight: 600, marginBottom: 3 },
  className: { color: '#fff', fontWeight: 600, fontSize: 14 },
  classSub: { color: '#666', fontSize: 12, marginTop: 2 },
  badge: { fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4 },
  bookBtn: { background: RED, color: '#fff', border: 'none', borderRadius: 5, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 },

  // schedule / visits
  schedRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${BORDER}`, flexWrap: 'wrap' },
  visitRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${BORDER}`, flexWrap: 'wrap' },
  schedDate: { color: '#aaa', fontSize: 12, minWidth: 90 },
  schedTime: { color: '#666', fontSize: 12, minWidth: 45 },
  schedName: { color: '#ddd', fontSize: 13, fontWeight: 500 },

  muted: { color: '#555', fontSize: 13, padding: '8px 0' },
  errorText: { color: '#f87171', fontSize: 13 },
  pre: {
    background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '10px',
    color: '#6ee7b7', fontSize: 10, overflowX: 'auto', maxHeight: 300, overflow: 'auto', margin: '8px 0 0',
  },
}
