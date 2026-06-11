import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/gym/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Login failed')
        return
      }

      // Dig out the exerciser object — response shape varies
      const exerciser = data.exerciser || data
      const homeClub = exerciser.homeClub || {}

      localStorage.setItem('gym_session', JSON.stringify({
        exerciserUuid: exerciser.exerciserUuid || exerciser.uuid,
        companyUuid: exerciser.companyUuid,
        firstName: exerciser.firstName,
        lastName: exerciser.lastName,
        homeClub: {
          name: homeClub.name,
          clubUuid: homeClub.clubUuid,
          // gymLocationId is needed for busyness endpoint
          gymLocationId: homeClub.gymLocationId || homeClub.locationUuid || homeClub.id,
        },
      }))

      router.push('/dashboard')
    } catch (err) {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <Head><title>The Gym Group — PoC</title></Head>
      <div style={s.card}>
        <div style={s.logo}>
          <span style={s.logoBar} />
          THE GYM GROUP
          <span style={s.logoBar} />
        </div>
        <h1 style={s.heading}>Sign in</h1>
        <p style={s.sub}>Use your app email &amp; PIN</p>

        {error && <div style={s.errorBox}>{error}</div>}

        <form onSubmit={handleLogin}>
          <input
            style={s.input}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            style={s.input}
            type="password"
            placeholder="App PIN / passcode"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <button style={{ ...s.btn, ...(loading ? s.btnDisabled : {}) }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={s.hint}>
          This PoC proxies the unofficial Gym Group mobile API.<br />
          Your credentials are sent directly to their servers.
        </p>
      </div>
    </div>
  )
}

const RED = '#e30613'

const s = {
  page: {
    minHeight: '100vh',
    background: '#111',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  card: {
    background: '#1c1c1c',
    borderRadius: 12,
    padding: '40px 48px',
    width: '100%',
    maxWidth: 380,
    textAlign: 'center',
    border: '1px solid #2a2a2a',
  },
  logo: {
    color: RED,
    fontWeight: 800,
    fontSize: 13,
    letterSpacing: 3,
    marginBottom: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  logoBar: {
    display: 'inline-block',
    width: 20,
    height: 3,
    background: RED,
    borderRadius: 2,
  },
  heading: {
    color: '#fff',
    fontSize: 26,
    fontWeight: 700,
    margin: '0 0 6px',
  },
  sub: {
    color: '#888',
    fontSize: 14,
    margin: '0 0 24px',
  },
  errorBox: {
    background: 'rgba(227,6,19,0.12)',
    border: '1px solid rgba(227,6,19,0.3)',
    color: '#ff6b6b',
    padding: '10px 14px',
    borderRadius: 6,
    marginBottom: 16,
    fontSize: 14,
    textAlign: 'left',
  },
  input: {
    width: '100%',
    padding: '13px 14px',
    marginBottom: 12,
    background: '#2a2a2a',
    border: '1px solid #3a3a3a',
    borderRadius: 7,
    color: '#fff',
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box',
  },
  btn: {
    width: '100%',
    padding: '13px',
    background: RED,
    color: '#fff',
    border: 'none',
    borderRadius: 7,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  hint: {
    color: '#555',
    fontSize: 12,
    marginTop: 20,
    lineHeight: 1.5,
  },
}
