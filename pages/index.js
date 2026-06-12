import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

// Try every known field path for a key value
function dig(obj, ...paths) {
  for (const path of paths) {
    const parts = path.split('.')
    let v = obj
    for (const p of parts) { v = v?.[p] }
    if (v != null && v !== '') return v
  }
  return null
}

function extractSession(data) {
  return {
    exerciserUuid: dig(data,
      'exerciser.exerciserUuid', 'exerciser.uuid',
      'exerciserUuid', 'uuid', 'id'
    ),
    companyUuid: dig(data,
      'exerciser.companyUuid', 'companyUuid',
      'exerciser.company.companyUuid', 'exerciser.company.uuid'
    ),
    firstName: dig(data, 'exerciser.firstName', 'firstName'),
    lastName: dig(data, 'exerciser.lastName', 'lastName'),
    homeClub: {
      name: dig(data, 'exerciser.homeClub.name', 'homeClub.name', 'exerciser.club.name'),
      clubUuid: dig(data, 'exerciser.homeClub.clubUuid', 'homeClub.clubUuid', 'exerciser.homeClub.uuid', 'homeClub.uuid'),
      gymLocationId: dig(data,
        'exerciser.homeClub.gymLocationId', 'homeClub.gymLocationId',
        'exerciser.homeClub.locationUuid', 'homeClub.locationUuid',
        'exerciser.homeClub.id', 'homeClub.id'
      ),
    },
  }
}

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [loginData, setLoginData] = useState(null) // raw response for debug

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setLoginData(null)

    try {
      const res = await fetch('/api/gym/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Login failed')
        setLoginData(data)
        return
      }

      setLoginData(data)

      const session = extractSession(data)
      localStorage.setItem('gym_session', JSON.stringify(session))
      localStorage.setItem('gym_raw_login', JSON.stringify(data))

    } catch (err) {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  const session = loginData ? extractSession(loginData) : null
  const canProceed = session?.exerciserUuid

  return (
    <div style={s.page}>
      <Head><title>The Gym Group — PoC</title></Head>
      <div style={s.card}>
        <div style={s.logo}>
          <span style={s.logoBar} />THE GYM GROUP<span style={s.logoBar} />
        </div>
        <h1 style={s.heading}>Sign in</h1>
        <p style={s.sub}>Use your app email &amp; PIN</p>

        {error && <div style={s.errorBox}>{error}</div>}

        {!loginData && (
          <form onSubmit={handleLogin}>
            <input
              style={s.input} type="email" placeholder="Email address"
              value={email} onChange={e => setEmail(e.target.value)}
              required autoComplete="email"
            />
            <input
              style={s.input} type="password" placeholder="App PIN / passcode"
              value={password} onChange={e => setPassword(e.target.value)}
              required autoComplete="current-password"
            />
            <button style={{ ...s.btn, ...(loading ? s.btnDisabled : {}) }} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        )}

        {loginData && (
          <div>
            {canProceed ? (
              <>
                <div style={s.successBox}>
                  Logged in as <strong>{session.firstName} {session.lastName}</strong>
                  {session.homeClub?.name && <><br />{session.homeClub.name}</>}
                </div>
                <button style={s.btn} onClick={() => router.push('/dashboard')}>
                  Go to Dashboard →
                </button>
              </>
            ) : (
              <div style={s.warnBox}>
                Login returned data but couldn't find <code>exerciserUuid</code>.
                Check the raw response below and let me know the structure.
              </div>
            )}

            <details style={s.details}>
              <summary style={s.summary}>Raw login response</summary>
              <pre style={s.pre}>{JSON.stringify(loginData, null, 2)}</pre>
            </details>

            <button style={s.retryBtn} onClick={() => setLoginData(null)}>
              ← Try again
            </button>
          </div>
        )}

        {!loginData && (
          <p style={s.hint}>
            This PoC proxies the unofficial Gym Group mobile API.
          </p>
        )}
      </div>
    </div>
  )
}

const RED = '#e30613'

const s = {
  page: {
    minHeight: '100vh', background: '#111',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  card: {
    background: '#1c1c1c', borderRadius: 12, padding: '40px 40px',
    width: '100%', maxWidth: 440, textAlign: 'center', border: '1px solid #2a2a2a',
  },
  logo: {
    color: RED, fontWeight: 800, fontSize: 12, letterSpacing: 3,
    marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  logoBar: { display: 'inline-block', width: 18, height: 3, background: RED, borderRadius: 2 },
  heading: { color: '#fff', fontSize: 24, fontWeight: 700, margin: '0 0 6px' },
  sub: { color: '#888', fontSize: 13, margin: '0 0 20px' },
  errorBox: {
    background: 'rgba(227,6,19,0.1)', border: '1px solid rgba(227,6,19,0.3)',
    color: '#ff6b6b', padding: '10px 14px', borderRadius: 6, marginBottom: 14,
    fontSize: 13, textAlign: 'left',
  },
  successBox: {
    background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)',
    color: '#4ade80', padding: '12px 14px', borderRadius: 6, marginBottom: 14,
    fontSize: 14, lineHeight: 1.5,
  },
  warnBox: {
    background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)',
    color: '#fbbf24', padding: '12px 14px', borderRadius: 6, marginBottom: 14,
    fontSize: 13, textAlign: 'left', lineHeight: 1.5,
  },
  input: {
    width: '100%', padding: '12px 14px', marginBottom: 10,
    background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: 7,
    color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box',
  },
  btn: {
    width: '100%', padding: '13px', background: RED, color: '#fff',
    border: 'none', borderRadius: 7, fontSize: 15, fontWeight: 600,
    cursor: 'pointer', marginBottom: 12,
  },
  btnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  retryBtn: {
    background: 'transparent', border: '1px solid #333', color: '#666',
    padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
    width: '100%', marginTop: 4,
  },
  details: { marginBottom: 12, textAlign: 'left' },
  summary: { color: '#666', fontSize: 12, cursor: 'pointer', marginBottom: 8 },
  pre: {
    background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 6,
    padding: '12px', color: '#6ee7b7', fontSize: 11, overflowX: 'auto',
    maxHeight: 300, overflow: 'auto', textAlign: 'left', margin: 0,
  },
  hint: { color: '#444', fontSize: 12, marginTop: 16, lineHeight: 1.5 },
}
