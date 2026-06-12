import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Nav from '../components/Nav'

const RED = '#e30613'
const DARK = '#111'
const CARD = '#1c1c1c'
const BORDER = '#2a2a2a'

// ─── helpers ────────────────────────────────────────────────────────────────

function toArr(x) {
  if (Array.isArray(x)) return x
  if (!x) return []
  for (const k of ['clubs', 'classes', 'schedule', 'checkIns', 'checkins', 'items', 'content', 'data', 'results']) {
    if (Array.isArray(x[k])) return x[k]
  }
  return []
}

function fmtTime(v) {
  if (!v) return '?'
  const d = new Date(v)
  return isNaN(d) ? String(v) : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(v) {
  if (!v) return '?'
  const d = new Date(v)
  return isNaN(d) ? String(v) : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

async function apiFetch(path) {
  const res = await fetch(path)
  const text = await res.text()
  let data; try { data = JSON.parse(text) } catch { data = { _raw: text } }
  return { ok: res.ok, status: res.status, data }
}

function gymId(gym) {
  return gym?.gymLocationId || gym?.locationUuid || gym?.id || gym?.clubUuid
}

// ─── Gym picker ──────────────────────────────────────────────────────────────

function GymPicker({ locations, selected, homeClubUuid, onSelect }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = locations.filter(g => {
    const name = g.name || g.clubName || ''
    return name.toLowerCase().includes(search.toLowerCase())
  })

  function pick(gym) { onSelect(gym); setOpen(false); setSearch('') }

  const selectedName = selected?.name || selected?.clubName || 'Select a gym'

  return (
    <div style={sc.pickerWrap}>
      <div style={sc.pickerLabel}>GYM</div>
      <button style={sc.pickerBtn} onClick={() => setOpen(o => !o)}>
        <span>{selectedName}</span>
        {selected && gymId(selected) === homeClubUuid &&
          <span style={sc.homeBadge}>home</span>}
        <span style={{ marginLeft: 'auto', color: '#555' }}>▾</span>
      </button>

      {open && (
        <div style={sc.dropdown}>
          <div style={sc.searchWrap}>
            <input
              autoFocus
              style={sc.searchInput}
              placeholder="Search gyms…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={sc.dropList}>
            {filtered.length === 0 && <div style={sc.dropEmpty}>No gyms found</div>}
            {filtered.map((gym, i) => {
              const name = gym.name || gym.clubName || `Gym ${i + 1}`
              const isHome = gym.clubUuid === homeClubUuid
              const isSelected = gym.clubUuid === selected?.clubUuid
              return (
                <div key={gym.clubUuid || i}
                  style={{ ...sc.dropItem, ...(isSelected ? sc.dropItemSelected : {}) }}
                  onClick={() => pick(gym)}
                >
                  <span>{name}</span>
                  {isHome && <span style={sc.homeBadge}>home</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Busyness ────────────────────────────────────────────────────────────────

function BusynessCard({ result }) {
  const [showRaw, setShowRaw] = useState(false)
  const state = !result ? 'loading' : result.ok ? 'ok' : 'error'
  const d = result?.data
  const pct = d?.busynessPercentage ?? d?.occupancyPercentage ?? d?.percentage ?? d?.currentOccupancy ?? null
  const label = d?.busynessLabel || d?.label || d?.status || ''
  const count = d?.currentCount ?? d?.occupancy ?? null

  return (
    <div style={sc.card}>
      <div style={sc.cardHead}>
        <span style={sc.cardTitle}>HOW BUSY RIGHT NOW</span>
        {d && <button style={sc.rawBtn} onClick={() => setShowRaw(v => !v)}>{showRaw ? 'hide' : 'raw'}</button>}
      </div>
      {state === 'loading' && <div style={sc.muted}>Loading…</div>}
      {state === 'error' && <div style={sc.err}>{d?.error || `HTTP ${result?.status}`}</div>}
      {state === 'ok' && pct != null && (
        <>
          <div style={sc.pctNum}>{Math.round(pct)}%</div>
          <div style={sc.bar}>
            <div style={{ ...sc.barFill, width: `${Math.min(pct, 100)}%`, background: pct > 80 ? RED : pct > 50 ? '#f59e0b' : '#4ade80' }} />
          </div>
          {label && <div style={sc.muted}>{label}</div>}
          {count != null && <div style={sc.muted}>{count} people in gym</div>}
        </>
      )}
      {state === 'ok' && pct == null && <div style={sc.muted}>No busyness % in response — check raw.</div>}
      {showRaw && d && <pre style={sc.pre}>{JSON.stringify(d, null, 2)}</pre>}
    </div>
  )
}

// ─── Class row ───────────────────────────────────────────────────────────────

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
    <div style={{ ...sc.classRow, borderLeft: booked ? `3px solid ${RED}` : '3px solid #2a2a2a' }}>
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

// ─── Generic section ─────────────────────────────────────────────────────────

function Section({ title, result, children }) {
  const [showRaw, setShowRaw] = useState(false)
  const state = !result ? 'loading' : result.ok ? 'ok' : 'error'
  return (
    <div style={sc.card}>
      <div style={sc.cardHead}>
        <span style={sc.cardTitle}>{title}</span>
        {result?.data && <button style={sc.rawBtn} onClick={() => setShowRaw(v => !v)}>{showRaw ? 'hide' : 'raw'}</button>}
      </div>
      {state === 'loading' && <div style={sc.muted}>Loading…</div>}
      {state === 'error' && <div style={sc.err}>{result?.data?.error || `HTTP ${result?.status}`}</div>}
      {state === 'ok' && children}
      {showRaw && result?.data && <pre style={sc.pre}>{JSON.stringify(result.data, null, 2)}</pre>}
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [locations, setLocations] = useState(null)   // all gyms
  const [selectedGym, setSelectedGym] = useState(null)
  const [results, setResults] = useState({})
  const [tab, setTab] = useState('classes')

  function setResult(key, val) { setResults(r => ({ ...r, [key]: val })) }

  // Load gym-specific data whenever selectedGym changes
  useEffect(() => {
    if (!session || !selectedGym) return
    const { exerciserUuid, companyUuid } = session
    const locId = gymId(selectedGym)
    const clubQ = selectedGym.clubUuid ? `&clubUuid=${selectedGym.clubUuid}` : ''

    // Clear stale results
    setResults(r => ({ ...r, classes: null, busyness: null }))

    if (companyUuid) {
      apiFetch(`/api/gym/classes?companyUuid=${companyUuid}&exerciserUuid=${exerciserUuid}${clubQ}`)
        .then(r => setResult('classes', r))
    }
    if (locId) {
      apiFetch(`/api/gym/busyness?exerciserUuid=${exerciserUuid}&gymLocationId=${locId}`)
        .then(r => setResult('busyness', r))
    } else {
      setResult('busyness', { ok: false, status: 0, data: { error: 'No location ID for this gym (gymLocationId / locationUuid missing in API response)' } })
    }
  }, [selectedGym])

  // Initial load: profile → locations → default gym selection
  useEffect(() => {
    const raw = localStorage.getItem('gym_session')
    if (!raw) { router.push('/'); return }
    const s = JSON.parse(raw)
    if (!s?.exerciserUuid) { router.push('/'); return }

    async function init() {
      // 1. Profile
      const profileResult = await apiFetch(`/api/gym/profile?exerciserUuid=${s.exerciserUuid}`)
      setResult('profile', profileResult)

      const pd = profileResult.data
      const ex = pd?.exerciser || pd || {}
      const hc = ex.homeClub || ex.club || {}

      const enriched = {
        ...s,
        firstName: s.firstName || ex.firstName,
        companyUuid: s.companyUuid || ex.companyUuid,
        homeClub: {
          name:          hc.name,
          clubUuid:      hc.clubUuid || hc.uuid,
          gymLocationId: hc.gymLocationId || hc.locationUuid || hc.id,
        },
      }
      localStorage.setItem('gym_session', JSON.stringify(enriched))
      setSession(enriched)

      // 2. Schedule + check-ins (user-scoped, not gym-scoped)
      apiFetch(`/api/gym/schedule?exerciserUuid=${enriched.exerciserUuid}`).then(r => setResult('schedule', r))
      apiFetch(`/api/gym/checkins?exerciserUuid=${enriched.exerciserUuid}`).then(r => setResult('checkins', r))

      // 3. Locations list
      if (enriched.companyUuid) {
        const locsResult = await apiFetch(`/api/gym/locations?companyUuid=${enriched.companyUuid}`)
        setResult('locations', locsResult)
        const locs = toArr(locsResult.data)
        setLocations(locs)

        // Default: home club, or first in list
        const homeGym = locs.find(g => g.clubUuid === enriched.homeClub?.clubUuid) || locs[0]
        if (homeGym) setSelectedGym(homeGym)
      } else {
        setResult('locations', { ok: false, status: 0, data: { error: 'No companyUuid — cannot load gym list' } })
        setLocations([])
      }
    }

    init()
  }, [])

  if (!session) return null

  const profileData = results.profile?.data
  const ex = profileData?.exerciser || profileData || {}
  const displayName = ex.firstName || session.firstName || 'Member'
  const homeClubName = ex.homeClub?.name || session.homeClub?.name || ''

  const companyUuid = session.companyUuid
  const classes = toArr(results.classes?.data)
  const schedule = toArr(results.schedule?.data)
  const checkins = toArr(results.checkins?.data)

  function logout() { localStorage.clear(); router.push('/') }

  return (
    <div style={sc.page}>
      <Head><title>Dashboard — Gym Group</title></Head>
      <Nav name={displayName} homeClub={homeClubName} onLogout={logout} />

      <main style={sc.main}>

        {/* ── Gym picker ── */}
        {locations === null
          ? <div style={{ ...sc.card, color: '#555', fontSize: 13 }}>Loading gyms…</div>
          : locations.length === 0
            ? <div style={{ ...sc.card }}>
                <div style={sc.err}>{results.locations?.data?.error || 'No gyms found'}</div>
              </div>
            : <GymPicker
                locations={locations}
                selected={selectedGym}
                homeClubUuid={session.homeClub?.clubUuid}
                onSelect={setSelectedGym}
              />
        }

        {/* ── Busyness ── */}
        <BusynessCard result={results.busyness} />

        {/* ── Tabs ── */}
        <div style={sc.tabBar}>
          {[
            ['classes', `Classes today${classes.length ? ` (${classes.length})` : ''}`],
            ['schedule', `My bookings${schedule.length ? ` (${schedule.length})` : ''}`],
            ['checkins', `Visits${checkins.length ? ` (${checkins.length})` : ''}`],
          ].map(([key, label]) => (
            <button key={key}
              style={{ ...sc.tabBtn, ...(tab === key ? sc.tabActive : {}) }}
              onClick={() => setTab(key)}
            >{label}</button>
          ))}
        </div>

        {tab === 'classes' && (
          <Section title={`Classes at ${selectedGym?.name || '…'}`} result={results.classes}>
            {classes.length === 0
              ? <div style={sc.muted}>No classes found today.</div>
              : classes.map((c, i) => (
                <ClassRow key={c.classUuid || i} cls={c}
                  companyUuid={companyUuid} exerciserUuid={session.exerciserUuid}
                  onRefresh={() => selectedGym && setSelectedGym({ ...selectedGym })}
                />
              ))
            }
          </Section>
        )}

        {tab === 'schedule' && (
          <Section title="My booked classes (next 7 days)" result={results.schedule}>
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
          <Section title="Visit history (last 30 days)" result={results.checkins}>
            {checkins.length === 0
              ? <div style={sc.muted}>No visits recorded.</div>
              : <>
                  <div style={{ color: '#4ade80', fontSize: 13, marginBottom: 10 }}>
                    {checkins.length} visit{checkins.length !== 1 ? 's' : ''}
                  </div>
                  {checkins.map((c, i) => {
                    const ts = c.checkInDateTime || c.date || c.timestamp || c.dateTime || c.checkInDate
                    return (
                      <div key={i} style={sc.schedRow}>
                        <span style={sc.schedDate}>{fmtDate(ts)}</span>
                        <span style={sc.schedTime}>{fmtTime(ts)}</span>
                        <span style={{ color: '#666', fontSize: 13 }}>{c.clubName || c.gym?.name || c.locationName || ''}</span>
                      </div>
                    )
                  })}
                </>
            }
          </Section>
        )}

      </main>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const sc = {
  page: { minHeight: '100vh', background: DARK, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#e5e5e5' },
  main: { maxWidth: 680, margin: '0 auto', padding: '16px 16px 60px' },

  card: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '14px 16px', marginBottom: 10 },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { color: '#666', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' },
  rawBtn: { background: 'transparent', border: '1px solid #2a2a2a', color: '#444', fontSize: 10, padding: '2px 8px', borderRadius: 4, cursor: 'pointer' },

  // gym picker
  pickerWrap: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px', marginBottom: 10, position: 'relative' },
  pickerLabel: { color: '#555', fontSize: 10, fontWeight: 600, letterSpacing: 1, marginBottom: 6 },
  pickerBtn: {
    width: '100%', background: '#222', border: '1px solid #333', borderRadius: 6,
    color: '#ddd', padding: '10px 12px', cursor: 'pointer', fontSize: 14, fontWeight: 500,
    display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
  },
  homeBadge: { background: 'rgba(227,6,19,0.15)', color: RED, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10, border: `1px solid rgba(227,6,19,0.3)` },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
    background: '#1a1a1a', border: `1px solid #333`, borderRadius: 8,
    marginTop: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  },
  searchWrap: { padding: '10px 10px 6px' },
  searchInput: {
    width: '100%', background: '#222', border: '1px solid #333', borderRadius: 6,
    color: '#ddd', padding: '8px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  },
  dropList: { maxHeight: 280, overflowY: 'auto', padding: '4px 6px 8px' },
  dropEmpty: { color: '#555', fontSize: 13, padding: '12px 8px' },
  dropItem: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 5,
    cursor: 'pointer', fontSize: 13, color: '#ccc',
  },
  dropItemSelected: { background: '#2a2a2a', color: '#fff' },

  // busyness
  pctNum: { fontSize: 38, fontWeight: 800, color: '#fff', lineHeight: 1 },
  bar: { height: 5, background: '#2a2a2a', borderRadius: 3, margin: '10px 0 6px', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, transition: 'width 0.5s ease' },

  // tabs
  tabBar: { display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' },
  tabBtn: { background: 'transparent', border: `1px solid ${BORDER}`, color: '#555', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500 },
  tabActive: { background: CARD, color: '#ccc', borderColor: '#444' },

  // classes
  classRow: { borderBottom: `1px solid ${BORDER}`, padding: '10px 0 10px 12px', marginBottom: 2 },
  classTime: { color: '#666', fontSize: 11, fontWeight: 600, marginBottom: 3 },
  className: { color: '#fff', fontWeight: 600, fontSize: 14 },
  classSub: { color: '#666', fontSize: 12, marginTop: 2 },
  badge: { fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4 },
  bookBtn: { background: RED, color: '#fff', border: 'none', borderRadius: 5, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 },

  schedRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${BORDER}`, flexWrap: 'wrap' },
  schedDate: { color: '#aaa', fontSize: 12, minWidth: 90 },
  schedTime: { color: '#666', fontSize: 12, minWidth: 45 },
  schedName: { color: '#ddd', fontSize: 13, fontWeight: 500 },

  muted: { color: '#555', fontSize: 13, padding: '4px 0' },
  err: { color: '#f87171', fontSize: 12 },
  pre: { background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '10px', color: '#6ee7b7', fontSize: 10, overflowX: 'auto', maxHeight: 300, overflow: 'auto', marginTop: 8 },
}
