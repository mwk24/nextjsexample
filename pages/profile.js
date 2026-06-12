import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Nav from '../components/Nav'

const RED = '#e30613'
const CARD = '#1c1c1c'
const BORDER = '#2a2a2a'

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
const DAY_SHORT = { MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun' }

async function apiFetch(path) {
  const res = await fetch(path)
  const text = await res.text()
  let data; try { data = JSON.parse(text) } catch { data = { _raw: text } }
  return { ok: res.ok, status: res.status, data }
}

function toArr(x) {
  if (Array.isArray(x)) return x
  if (!x) return []
  for (const k of ['items', 'challenges', 'data', 'content', 'results', 'leaderboard']) {
    if (Array.isArray(x[k])) return x[k]
  }
  return []
}

// ─── Section wrapper (same as dashboard) ────────────────────────────────────

function Dot({ state }) {
  const c = state === 'ok' ? '#4ade80' : state === 'error' ? '#f87171' : state === 'loading' ? '#f59e0b' : '#333'
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: c, marginRight: 6 }} />
}

function Section({ title, result, children }) {
  const [showRaw, setShowRaw] = useState(false)
  const state = !result ? 'loading' : result.ok ? 'ok' : 'error'
  const errorMsg = result?.data?.error || result?.data?.message || `HTTP ${result?.status}`

  return (
    <div style={sc.section}>
      <div style={sc.sHead}>
        <span><Dot state={state} /><span style={sc.sTitle}>{title}</span></span>
        {result?.data && (
          <button style={sc.rawBtn} onClick={() => setShowRaw(v => !v)}>{showRaw ? 'hide' : 'raw'}</button>
        )}
      </div>
      {state === 'loading' && <div style={sc.muted}>Loading…</div>}
      {state === 'error' && <div style={sc.err}>{errorMsg}</div>}
      {state === 'ok' && children}
      {showRaw && result?.data && <pre style={sc.pre}>{JSON.stringify(result.data, null, 2)}</pre>}
    </div>
  )
}

// ─── Profile card ────────────────────────────────────────────────────────────

function ProfileSection({ result }) {
  const d = result?.data
  const ex = d?.exerciser || d || {}

  return (
    <Section title="Personal Details" result={result}>
      <div style={sc.profileGrid}>
        <Field label="Name" value={[ex.firstName, ex.lastName].filter(Boolean).join(' ') || '—'} />
        <Field label="Email" value={ex.email || ex.username || '—'} />
        <Field label="Phone" value={ex.phone || ex.mobilePhone || '—'} />
        <Field label="Member since" value={ex.joinDate || ex.createdDate ? new Date(ex.joinDate || ex.createdDate).toLocaleDateString('en-GB') : '—'} />
        <Field label="Home club" value={ex.homeClub?.name || '—'} wide />
        <Field label="Company UUID" value={ex.companyUuid || '—'} wide mono />
        <Field label="Exerciser UUID" value={ex.exerciserUuid || ex.uuid || '—'} wide mono />
      </div>
    </Section>
  )
}

// ─── Membership card ─────────────────────────────────────────────────────────

function MembershipSection({ result }) {
  const d = result?.data
  const m = d?.membership || d || {}

  return (
    <Section title="Membership" result={result}>
      <div style={sc.profileGrid}>
        <Field label="Type" value={m.membershipType || m.type || m.name || '—'} />
        <Field label="Status" value={m.status || m.membershipStatus || '—'} highlight={
          /active/i.test(m.status || '') ? 'green' : /cancel|suspend/i.test(m.status || '') ? 'red' : null
        } />
        <Field label="Start date" value={m.startDate ? new Date(m.startDate).toLocaleDateString('en-GB') : '—'} />
        <Field label="End / renews" value={m.endDate || m.renewalDate ? new Date(m.endDate || m.renewalDate).toLocaleDateString('en-GB') : '—'} />
        <Field label="Price" value={m.price != null ? `£${(m.price / 100).toFixed(2)}/mo` : m.priceString || '—'} />
        <Field label="Barcode" value={m.barcode || m.barcodeValue || '—'} mono />
      </div>
    </Section>
  )
}

// ─── Account balance ─────────────────────────────────────────────────────────

function BalanceSection({ result }) {
  const d = result?.data
  const items = Array.isArray(d) ? d : toArr(d)

  return (
    <Section title="Account Balance" result={result}>
      {items.length === 0
        ? <div style={sc.muted}>No balance data.</div>
        : items.map((item, i) => (
          <div key={i} style={sc.balanceRow}>
            <span style={sc.balanceLabel}>{item.itemType || item.type || item.name || 'Credit'}</span>
            <span style={sc.balanceVal}>{item.balance ?? item.quantity ?? item.amount ?? '?'}</span>
            {item.expiryDate && <span style={sc.muted}>Expires {new Date(item.expiryDate).toLocaleDateString('en-GB')}</span>}
          </div>
        ))
      }
    </Section>
  )
}

// ─── Activity level ──────────────────────────────────────────────────────────

function ActivitySection({ result }) {
  const d = result?.data
  const current = d?.current
  const levels = toArr(d?.levels)

  const currentLevel = current?.activityLevel || current?.level || current?.currentLevel
  const points = current?.totalPoints ?? current?.points ?? current?.score

  return (
    <Section title="Activity Level" result={result}>
      {currentLevel && (
        <div style={{ marginBottom: 12 }}>
          <span style={sc.levelBadge}>{currentLevel}</span>
          {points != null && <span style={{ color: '#888', fontSize: 13, marginLeft: 10 }}>{points} points</span>}
        </div>
      )}
      {levels.length > 0 && (
        <div style={sc.levelRow}>
          {levels.map((l, i) => {
            const name = l.name || l.levelName || l.activityLevel
            const isCurrent = name === currentLevel
            return (
              <div key={i} style={{ ...sc.levelChip, ...(isCurrent ? sc.levelChipActive : {}) }}>
                {name}
              </div>
            )
          })}
        </div>
      )}
      {!currentLevel && levels.length === 0 && <div style={sc.muted}>No activity data.</div>}
    </Section>
  )
}

// ─── Ranking ─────────────────────────────────────────────────────────────────

function RankingSection({ result }) {
  const d = result?.data
  const ranking = d?.ranking || d
  const leaderboard = toArr(d?.leaderboard || d?.rankingLeaderboard)

  const position = ranking?.rank ?? ranking?.position ?? ranking?.ranking
  const total = ranking?.totalParticipants ?? ranking?.total
  const period = ranking?.periodLabel || ranking?.period

  return (
    <Section title="Ranking & Leaderboard" result={result}>
      {position != null && (
        <div style={sc.rankDisplay}>
          <span style={sc.rankNum}>#{position}</span>
          {total && <span style={sc.rankOf}>of {total}</span>}
          {period && <span style={sc.rankPeriod}>{period}</span>}
        </div>
      )}
      {leaderboard.length > 0 && (
        <div>
          <div style={sc.lbHeader}><span>Rank</span><span>Name</span><span>Points</span></div>
          {leaderboard.slice(0, 10).map((entry, i) => {
            const isMe = entry.isCurrentUser || entry.isMe || entry.exerciserUuid === d?.exerciserUuid
            const name = entry.firstName ? `${entry.firstName} ${entry.lastName || ''}`.trim() : entry.name || `#${entry.rank || i + 1}`
            return (
              <div key={i} style={{ ...sc.lbRow, ...(isMe ? { background: 'rgba(227,6,19,0.07)', color: '#fff' } : {}) }}>
                <span style={sc.lbRank}>{entry.rank ?? i + 1}</span>
                <span style={sc.lbName}>{name}{isMe ? ' (you)' : ''}</span>
                <span style={sc.lbPts}>{entry.totalPoints ?? entry.points ?? '—'}</span>
              </div>
            )
          })}
        </div>
      )}
      {position == null && leaderboard.length === 0 && <div style={sc.muted}>No ranking data.</div>}
    </Section>
  )
}

// ─── Challenges ──────────────────────────────────────────────────────────────

function ChallengesSection({ result }) {
  const challenges = toArr(result?.data)

  return (
    <Section title="Active Challenges" result={result}>
      {challenges.length === 0
        ? <div style={sc.muted}>No active challenges.</div>
        : challenges.map((c, i) => {
          const name = c.challengeName || c.name || c.title || 'Challenge'
          const end = c.endDate || c.endDateTime
          const progress = c.progress ?? c.progressPercentage ?? c.currentValue
          const target = c.targetValue || c.goal
          const pct = target && progress != null ? Math.round((progress / target) * 100) : (c.progressPercentage != null ? Math.round(c.progressPercentage) : null)

          return (
            <div key={i} style={sc.challengeCard}>
              <div style={sc.challengeName}>{name}</div>
              {end && <div style={sc.muted}>Ends {new Date(end).toLocaleDateString('en-GB')}</div>}
              {pct != null && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', margin: '8px 0 4px' }}>
                    <span>{progress != null ? `${progress}${target ? ` / ${target}` : ''}` : ''}</span>
                    <span>{pct}%</span>
                  </div>
                  <div style={sc.bar}>
                    <div style={{ ...sc.barFill, width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </>
              )}
            </div>
          )
        })
      }
    </Section>
  )
}

// ─── Historical busyness ─────────────────────────────────────────────────────

function BusynessHeatmap({ result }) {
  const rows = Array.isArray(result?.data) ? result.data : []

  return (
    <Section title="Typical Busyness by Day" result={result}>
      {rows.length === 0
        ? <div style={sc.muted}>No historical data.</div>
        : rows.map(({ day, data }) => {
          const slots = toArr(data) // array of { hour, busynessPercentage } or similar
          const dayName = DAY_SHORT[day] || day

          return (
            <div key={day} style={sc.heatRow}>
              <div style={sc.heatDay}>{dayName}</div>
              <div style={sc.heatSlots}>
                {slots.length > 0
                  ? slots.map((slot, i) => {
                    const pct = slot.busynessPercentage ?? slot.percentage ?? slot.occupancy ?? 0
                    const hour = slot.hour ?? slot.time ?? i
                    const bg = pct > 80 ? '#7f1d1d' : pct > 60 ? '#92400e' : pct > 30 ? '#166534' : '#1a1a1a'
                    return (
                      <div key={i} title={`${hour}:00 — ${Math.round(pct)}%`}
                        style={{ ...sc.heatCell, background: bg }}>
                        {typeof hour === 'number' && hour % 4 === 0
                          ? <span style={sc.heatLabel}>{hour}</span>
                          : null}
                      </div>
                    )
                  })
                  : <div style={{ ...sc.muted, padding: 0 }}>No slot data</div>
                }
              </div>
            </div>
          )
        })
      }
      {rows.length > 0 && (
        <div style={sc.heatLegend}>
          {[['#166534','Quiet'], ['#92400e','Moderate'], ['#7f1d1d','Busy']].map(([bg, label]) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 12, height: 12, background: bg, borderRadius: 2, display: 'inline-block' }} />
              <span style={{ color: '#555', fontSize: 11 }}>{label}</span>
            </span>
          ))}
        </div>
      )}
    </Section>
  )
}

// ─── Field helper ────────────────────────────────────────────────────────────

function Field({ label, value, wide, mono, highlight }) {
  const color = highlight === 'green' ? '#4ade80' : highlight === 'red' ? '#f87171' : '#ccc'
  return (
    <div style={{ ...(wide ? { gridColumn: 'span 2' } : {}) }}>
      <div style={sc.fieldLabel}>{label}</div>
      <div style={{ ...sc.fieldVal, color, ...(mono ? { fontFamily: 'monospace', fontSize: 11 } : {}) }}>{value}</div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function Profile() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [results, setResults] = useState({})

  function setResult(key, val) { setResults(r => ({ ...r, [key]: val })) }

  useEffect(() => {
    const raw = localStorage.getItem('gym_session')
    if (!raw) { router.push('/'); return }
    const s = JSON.parse(raw)
    if (!s?.exerciserUuid) { router.push('/'); return }
    setSession(s)

    const { exerciserUuid, homeClub } = s

    apiFetch(`/api/gym/profile?exerciserUuid=${exerciserUuid}`).then(r => setResult('profile', r))
    apiFetch(`/api/gym/membership?exerciserUuid=${exerciserUuid}`).then(r => setResult('membership', r))
    apiFetch(`/api/gym/balance?exerciserUuid=${exerciserUuid}${homeClub?.clubUuid ? `&clubUuid=${homeClub.clubUuid}` : ''}`).then(r => setResult('balance', r))
    apiFetch(`/api/gym/activity?exerciserUuid=${exerciserUuid}`).then(r => setResult('activity', r))
    apiFetch(`/api/gym/ranking?exerciserUuid=${exerciserUuid}`).then(r => setResult('ranking', r))
    apiFetch(`/api/gym/challenges?exerciserUuid=${exerciserUuid}`).then(r => setResult('challenges', r))

    if (homeClub?.gymLocationId) {
      apiFetch(`/api/gym/historical-busyness?locationUuid=${homeClub.gymLocationId}`).then(r => setResult('historicalBusyness', r))
    } else {
      setResult('historicalBusyness', { ok: false, status: 0, data: { error: 'No gymLocationId in session' } })
    }
  }, [])

  if (!session) return null

  const profileData = results.profile?.data
  const ex = profileData?.exerciser || profileData || {}
  const displayName = ex.firstName || session.firstName || 'Member'
  const homeClubName = ex.homeClub?.name || session.homeClub?.name || ''

  function logout() { localStorage.clear(); router.push('/') }

  return (
    <div style={sc.page}>
      <Head><title>Profile — Gym Group</title></Head>
      <Nav name={displayName} homeClub={homeClubName} onLogout={logout} />

      <main style={sc.main}>
        <ProfileSection result={results.profile} />
        <MembershipSection result={results.membership} />
        <BalanceSection result={results.balance} />

        <div style={sc.twoCol}>
          <ActivitySection result={results.activity} />
          <RankingSection result={results.ranking} />
        </div>

        <ChallengesSection result={results.challenges} />
        <BusynessHeatmap result={results.historicalBusyness} />
      </main>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const sc = {
  page: { minHeight: '100vh', background: '#111', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#e5e5e5' },
  main: { maxWidth: 720, margin: '0 auto', padding: '16px 16px 60px' },

  section: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '14px 16px', marginBottom: 10 },
  sHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sTitle: { color: '#888', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' },
  rawBtn: { background: 'transparent', border: '1px solid #2a2a2a', color: '#444', fontSize: 10, padding: '2px 8px', borderRadius: 4, cursor: 'pointer' },

  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 0 },

  profileGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' },
  fieldLabel: { color: '#555', fontSize: 10, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3 },
  fieldVal: { color: '#ccc', fontSize: 13 },

  balanceRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: `1px solid ${BORDER}` },
  balanceLabel: { color: '#aaa', fontSize: 13, flex: 1 },
  balanceVal: { color: '#fff', fontWeight: 600, fontSize: 18 },

  levelBadge: { background: RED, color: '#fff', padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 },
  levelRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 },
  levelChip: { background: '#2a2a2a', color: '#666', padding: '3px 10px', borderRadius: 12, fontSize: 12 },
  levelChipActive: { background: 'rgba(227,6,19,0.15)', color: RED, border: `1px solid rgba(227,6,19,0.3)` },

  rankDisplay: { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 },
  rankNum: { fontSize: 36, fontWeight: 800, color: '#fff', lineHeight: 1 },
  rankOf: { color: '#666', fontSize: 14 },
  rankPeriod: { color: '#555', fontSize: 12, marginLeft: 'auto' },
  lbHeader: { display: 'grid', gridTemplateColumns: '40px 1fr 70px', color: '#444', fontSize: 11, padding: '4px 8px', marginBottom: 4 },
  lbRow: { display: 'grid', gridTemplateColumns: '40px 1fr 70px', padding: '6px 8px', borderRadius: 5, fontSize: 13 },
  lbRank: { color: '#666' },
  lbName: { color: '#ccc' },
  lbPts: { color: '#888', textAlign: 'right' },

  challengeCard: { background: '#181818', borderRadius: 6, padding: '10px 12px', marginBottom: 8 },
  challengeName: { color: '#ddd', fontWeight: 600, fontSize: 14, marginBottom: 2 },

  bar: { height: 5, background: '#2a2a2a', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', background: RED, borderRadius: 3 },

  heatRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 },
  heatDay: { color: '#666', fontSize: 11, width: 30, flexShrink: 0 },
  heatSlots: { display: 'flex', gap: 2, flex: 1, flexWrap: 'nowrap', overflow: 'hidden' },
  heatCell: { flex: 1, height: 20, borderRadius: 2, position: 'relative', minWidth: 6, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  heatLabel: { fontSize: 9, color: '#444', position: 'absolute', bottom: -14 },
  heatLegend: { display: 'flex', gap: 16, marginTop: 20, paddingLeft: 40 },

  muted: { color: '#555', fontSize: 13, padding: '4px 0' },
  err: { color: '#f87171', fontSize: 12 },
  pre: {
    background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '10px',
    color: '#6ee7b7', fontSize: 10, overflowX: 'auto', maxHeight: 300, overflow: 'auto', marginTop: 8,
  },
}
