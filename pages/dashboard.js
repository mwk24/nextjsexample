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
  // common wrappers
  for (const key of ['classes', 'schedule', 'checkIns', 'checkins', 'items', 'content', 'data']) {
    if (Array.isArray(x[key])) return x[key]
  }
  return []
}

function fmtTime(epochMs) {
  if (!epochMs) return ''
  return new Date(epochMs).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(epochMs) {
  if (!epochMs) return ''
  return new Date(epochMs).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

async function apiFetch(path) {
  const res = await fetch(path)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

// ─── sub-components ─────────────────────────────────────────────────────────

function BusynessCard({ data, error }) {
  if (error) return <InfoCard title="Gym Busyness" error={error} />
  if (!data) return <InfoCard title="Gym Busyness" loading />

  const pct = data.busynessPercentage ?? data.occupancyPercentage ?? data.percentage ?? null
  const label = data.busynessLabel || data.label || ''
  const count = data.currentCount ?? data.occupancy ?? null

  return (
    <div style={sc.busynessCard}>
      <div style={sc.busynessTitle}>Gym Busyness — right now</div>
      {pct != null ? (
        <>
          <div style={sc.busynessPct}>{Math.round(pct)}%</div>
          <div style={sc.busynessBar}>
            <div style={{ ...sc.busynessFill, width: `${Math.min(pct, 100)}%`, background: pct > 80 ? RED : pct > 50 ? '#f59e0b' : '#22c55e' }} />
          </div>
          {label && <div style={sc.busynessLabel}>{label}</div>}
          {count != null && <div style={sc.busynessLabel}>{count} people in gym</div>}
        </>
      ) : (
        <pre style={sc.rawJson}>{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  )
}

function ClassCard({ cls, companyUuid, exerciserUuid, onBooked }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const booked = cls.bookingStatus === 'BOOKED' || cls.isBooked || cls.exerciserBooked
  const full = cls.spotsAvailable === 0 || cls.spotsAvailable === '0'
  const classUuid = cls.classUuid || cls.uuid || cls.id

  async function handleBook() {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/gym/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyUuid,
          classUuid,
          exerciserUuid,
          action: booked ? 'cancel' : 'book',
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg(booked ? 'Cancelled' : 'Booked!')
        if (onBooked) onBooked()
      } else {
        setMsg(data.error || 'Failed')
      }
    } catch {
      setMsg('Error')
    } finally {
      setBusy(false)
    }
  }

  const name = cls.className || cls.name || cls.title || 'Class'
  const instructor = cls.instructorName || cls.instructor?.name || ''
  const startMs = cls.startDateTime || cls.startDate || cls.start
  const endMs = cls.endDateTime || cls.endDate || cls.end
  const spots = cls.spotsAvailable ?? cls.availableSpots ?? null

  return (
    <div style={{ ...sc.classCard, borderLeft: booked ? `3px solid ${RED}` : '3px solid transparent' }}>
      <div style={sc.classTime}>{fmtTime(startMs)}{endMs ? ` – ${fmtTime(endMs)}` : ''}</div>
      <div style={sc.className}>{name}</div>
      {instructor && <div style={sc.classInstructor}>{instructor}</div>}
      <div style={sc.classRow}>
        {spots != null && (
          <span style={{ ...sc.badge, background: spots === 0 ? '#3a1c1c' : '#1c2a1c', color: spots === 0 ? '#f87171' : '#4ade80' }}>
            {spots === 0 ? 'Full' : `${spots} spots`}
          </span>
        )}
        {booked && <span style={{ ...sc.badge, background: '#1a1f3a', color: '#818cf8' }}>Booked</span>}
        {classUuid && companyUuid && exerciserUuid && (
          <button
            style={{ ...sc.bookBtn, ...(busy ? { opacity: 0.6 } : {}), ...(booked ? sc.cancelBtn : {}) }}
            onClick={handleBook}
            disabled={busy || (!booked && full)}
          >
            {busy ? '…' : booked ? 'Cancel' : full ? 'Full' : 'Book'}
          </button>
        )}
      </div>
      {msg && <div style={{ fontSize: 12, color: msg === 'Booked!' ? '#4ade80' : '#f87171', marginTop: 4 }}>{msg}</div>}
    </div>
  )
}

function InfoCard({ title, loading, error, children }) {
  return (
    <div style={sc.infoCard}>
      <div style={sc.cardTitle}>{title}</div>
      {loading && <div style={sc.muted}>Loading…</div>}
      {error && <div style={sc.errorText}>{error}</div>}
      {children}
    </div>
  )
}

// ─── main dashboard ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [classes, setClasses] = useState(null)
  const [schedule, setSchedule] = useState(null)
  const [busyness, setBusyness] = useState(null)
  const [checkins, setCheckins] = useState(null)
  const [rawData, setRawData] = useState({})
  const [errors, setErrors] = useState({})
  const [tab, setTab] = useState('classes')
  const [initDone, setInitDone] = useState(false)

  function setErr(key, msg) {
    setErrors(e => ({ ...e, [key]: msg }))
  }
  function setRaw(key, val) {
    setRawData(r => ({ ...r, [key]: val }))
  }

  const loadAll = useCallback(async (s) => {
    // Profile
    apiFetch(`/api/gym/profile?exerciserUuid=${s.exerciserUuid}`)
      .then(d => { setProfile(d.exerciser || d); setRaw('profile', d) })
      .catch(e => setErr('profile', e.message))

    // Classes today (needs companyUuid)
    if (s.companyUuid) {
      const clubQ = s.homeClub?.clubUuid ? `&clubUuid=${s.homeClub.clubUuid}` : ''
      apiFetch(`/api/gym/classes?companyUuid=${s.companyUuid}&exerciserUuid=${s.exerciserUuid}${clubQ}`)
        .then(d => { setClasses(toArr(d)); setRaw('classes', d) })
        .catch(e => setErr('classes', e.message))
    }

    // Booked schedule (next 7 days)
    apiFetch(`/api/gym/schedule?exerciserUuid=${s.exerciserUuid}`)
      .then(d => { setSchedule(toArr(d)); setRaw('schedule', d) })
      .catch(e => setErr('schedule', e.message))

    // Busyness (needs gymLocationId from homeClub)
    if (s.homeClub?.gymLocationId) {
      apiFetch(`/api/gym/busyness?exerciserUuid=${s.exerciserUuid}&gymLocationId=${s.homeClub.gymLocationId}`)
        .then(d => { setBusyness(d); setRaw('busyness', d) })
        .catch(e => setErr('busyness', e.message))
    }

    // Check-in history (last 30 days)
    apiFetch(`/api/gym/checkins?exerciserUuid=${s.exerciserUuid}`)
      .then(d => { setCheckins(toArr(d)); setRaw('checkins', d) })
      .catch(e => setErr('checkins', e.message))
  }, [])

  useEffect(() => {
    const raw = localStorage.getItem('gym_session')
    if (!raw) { router.push('/'); return }
    const s = JSON.parse(raw)
    setSession(s)
    loadAll(s).finally(() => setInitDone(true))
  }, [])

  function logout() {
    localStorage.removeItem('gym_session')
    router.push('/')
  }

  if (!session) return null

  const displayName = profile?.firstName || session.firstName || 'Member'
  const homeClubName = profile?.homeClub?.name || session.homeClub?.name || 'Home gym'
  const companyUuid = session.companyUuid || profile?.companyUuid

  return (
    <div style={sc.page}>
      <Head><title>Gym Group Dashboard</title></Head>

      {/* ── Header ── */}
      <header style={sc.header}>
        <div style={sc.headerInner}>
          <div style={sc.brandRow}>
            <span style={sc.brandBar} />
            <span style={sc.brandName}>THE GYM GROUP</span>
          </div>
          <div style={sc.homeClub}>{homeClubName}</div>
        </div>
        <div style={sc.headerRight}>
          <span style={sc.greeting}>Hi, {displayName}</span>
          <button style={sc.logoutBtn} onClick={logout}>Sign out</button>
        </div>
      </header>

      <main style={sc.main}>
        {/* ── Busyness ── */}
        <BusynessCard data={busyness} error={errors.busyness} />

        {/* ── Tab bar ── */}
        <div style={sc.tabBar}>
          {[
            ['classes', 'Classes today'],
            ['schedule', 'My bookings'],
            ['checkins', 'Visits'],
            ['debug', 'Raw API'],
          ].map(([key, label]) => (
            <button
              key={key}
              style={{ ...sc.tabBtn, ...(tab === key ? sc.tabBtnActive : {}) }}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div style={sc.tabContent}>

          {tab === 'classes' && (
            errors.classes ? (
              <InfoCard title="" error={errors.classes} />
            ) : !classes ? (
              <div style={sc.muted}>{initDone ? 'No classes data — companyUuid may not be available yet.' : 'Loading…'}</div>
            ) : classes.length === 0 ? (
              <div style={sc.muted}>No classes found for today.</div>
            ) : (
              classes.map((cls, i) => (
                <ClassCard
                  key={cls.classUuid || i}
                  cls={cls}
                  companyUuid={companyUuid}
                  exerciserUuid={session.exerciserUuid}
                  onBooked={() => loadAll(session)}
                />
              ))
            )
          )}

          {tab === 'schedule' && (
            errors.schedule ? (
              <InfoCard title="" error={errors.schedule} />
            ) : !schedule ? (
              <div style={sc.muted}>Loading…</div>
            ) : schedule.length === 0 ? (
              <div style={sc.muted}>No upcoming booked classes.</div>
            ) : (
              schedule.map((cls, i) => (
                <div key={cls.classUuid || i} style={sc.scheduleRow}>
                  <div style={sc.scheduleDate}>{fmtDate(cls.startDateTime || cls.startDate || cls.start)}</div>
                  <div style={sc.scheduleTime}>{fmtTime(cls.startDateTime || cls.startDate || cls.start)}</div>
                  <div style={sc.scheduleName}>{cls.className || cls.name || cls.title || 'Class'}</div>
                  <span style={{ ...sc.badge, background: '#1a1f3a', color: '#818cf8' }}>Booked</span>
                </div>
              ))
            )
          )}

          {tab === 'checkins' && (
            errors.checkins ? (
              <InfoCard title="" error={errors.checkins} />
            ) : !checkins ? (
              <div style={sc.muted}>Loading…</div>
            ) : checkins.length === 0 ? (
              <div style={sc.muted}>No visits in the last 30 days.</div>
            ) : (
              <div>
                <div style={sc.visitCount}>{checkins.length} visit{checkins.length !== 1 ? 's' : ''} in last 30 days</div>
                {checkins.map((c, i) => {
                  const ts = c.checkInDateTime || c.date || c.timestamp || c.dateTime
                  const gym = c.clubName || c.gym?.name || c.locationName || ''
                  return (
                    <div key={i} style={sc.visitRow}>
                      <span style={sc.visitDate}>{fmtDate(ts)}</span>
                      <span style={sc.visitTime}>{fmtTime(ts)}</span>
                      {gym && <span style={sc.visitGym}>{gym}</span>}
                    </div>
                  )
                })}
              </div>
            )
          )}

          {tab === 'debug' && (
            <div>
              <p style={sc.muted}>Raw API responses — useful for mapping response shapes</p>
              {Object.entries(rawData).map(([key, val]) => (
                <div key={key} style={{ marginBottom: 20 }}>
                  <div style={sc.debugKey}>{key}</div>
                  <pre style={sc.rawJson}>{JSON.stringify(val, null, 2)}</pre>
                </div>
              ))}
              {Object.entries(errors).filter(([, v]) => v).map(([key, msg]) => (
                <div key={key} style={{ marginBottom: 12 }}>
                  <div style={sc.debugKey}>{key} — ERROR</div>
                  <div style={sc.errorText}>{msg}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// ─── styles ──────────────────────────────────────────────────────────────────

const sc = {
  page: {
    minHeight: '100vh',
    background: DARK,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: '#e5e5e5',
  },
  header: {
    background: '#161616',
    borderBottom: `2px solid ${RED}`,
    padding: '14px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  headerInner: {},
  brandRow: { display: 'flex', alignItems: 'center', gap: 8 },
  brandBar: { display: 'inline-block', width: 16, height: 3, background: RED, borderRadius: 2 },
  brandName: { color: RED, fontWeight: 800, fontSize: 12, letterSpacing: 2.5 },
  homeClub: { color: '#888', fontSize: 13, marginTop: 2 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 14 },
  greeting: { color: '#ccc', fontSize: 14 },
  logoutBtn: {
    background: 'transparent',
    border: '1px solid #444',
    color: '#888',
    padding: '5px 12px',
    borderRadius: 5,
    cursor: 'pointer',
    fontSize: 13,
  },

  main: { maxWidth: 720, margin: '0 auto', padding: '20px 16px 60px' },

  // busyness
  busynessCard: {
    background: CARD,
    border: `1px solid ${BORDER}`,
    borderRadius: 10,
    padding: '18px 20px',
    marginBottom: 16,
  },
  busynessTitle: { color: '#888', fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  busynessPct: { fontSize: 42, fontWeight: 800, color: '#fff', lineHeight: 1 },
  busynessBar: { height: 6, background: '#2a2a2a', borderRadius: 3, margin: '12px 0 8px', overflow: 'hidden' },
  busynessFill: { height: '100%', borderRadius: 3, transition: 'width 0.6s ease' },
  busynessLabel: { color: '#888', fontSize: 13, marginTop: 4 },

  // tabs
  tabBar: { display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' },
  tabBtn: {
    background: 'transparent',
    border: `1px solid ${BORDER}`,
    color: '#666',
    padding: '7px 16px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
  tabBtnActive: { background: CARD, color: '#fff', borderColor: '#444' },
  tabContent: {},

  // classes
  classCard: {
    background: CARD,
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    padding: '13px 16px',
    marginBottom: 8,
  },
  classTime: { color: '#888', fontSize: 12, fontWeight: 600, marginBottom: 4 },
  className: { color: '#fff', fontWeight: 600, fontSize: 15, marginBottom: 2 },
  classInstructor: { color: '#666', fontSize: 13, marginBottom: 8 },
  classRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4 },
  bookBtn: {
    marginLeft: 'auto',
    background: RED,
    color: '#fff',
    border: 'none',
    borderRadius: 5,
    padding: '5px 14px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  cancelBtn: { background: '#3a1c1c', color: '#f87171' },

  // schedule
  scheduleRow: {
    background: CARD,
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    padding: '12px 16px',
    marginBottom: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  scheduleDate: { color: '#888', fontSize: 12, minWidth: 90 },
  scheduleTime: { color: '#888', fontSize: 12 },
  scheduleName: { color: '#fff', fontWeight: 600, flex: 1 },

  // checkins
  visitCount: { color: '#4ade80', fontSize: 13, fontWeight: 600, marginBottom: 12 },
  visitRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 0',
    borderBottom: `1px solid ${BORDER}`,
    flexWrap: 'wrap',
  },
  visitDate: { color: '#ccc', fontSize: 13, minWidth: 110 },
  visitTime: { color: '#888', fontSize: 13, minWidth: 50 },
  visitGym: { color: '#666', fontSize: 13 },

  // misc
  infoCard: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '14px 16px', marginBottom: 8 },
  cardTitle: { color: '#888', fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  muted: { color: '#555', fontSize: 14, padding: '20px 0' },
  errorText: { color: '#f87171', fontSize: 13 },
  debugKey: { color: '#888', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  rawJson: {
    background: '#0d0d0d',
    border: `1px solid ${BORDER}`,
    borderRadius: 6,
    padding: '12px 14px',
    color: '#6ee7b7',
    fontSize: 11,
    overflowX: 'auto',
    maxHeight: 400,
    overflow: 'auto',
  },
}
