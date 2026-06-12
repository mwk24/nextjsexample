import { useRouter } from 'next/router'

const RED = '#e30613'

export default function Nav({ name, homeClub, onLogout }) {
  const { pathname } = useRouter()

  return (
    <header style={s.header}>
      <div style={s.brand}>
        <span style={s.brandBar} />
        THE GYM GROUP
      </div>

      <nav style={s.nav}>
        {[
          ['/dashboard', 'Dashboard'],
          ['/profile', 'Profile'],
        ].map(([href, label]) => (
          <a key={href} href={href} style={{ ...s.link, ...(pathname === href ? s.linkActive : {}) }}>
            {label}
          </a>
        ))}
      </nav>

      <div style={s.right}>
        {homeClub && <span style={s.club}>{homeClub}</span>}
        <span style={s.name}>{name}</span>
        <button style={s.logoutBtn} onClick={onLogout}>Sign out</button>
      </div>
    </header>
  )
}

const s = {
  header: {
    background: '#161616',
    borderBottom: `2px solid ${RED}`,
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    height: 52,
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  brand: {
    color: RED,
    fontWeight: 800,
    fontSize: 11,
    letterSpacing: 2.5,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    whiteSpace: 'nowrap',
  },
  brandBar: { display: 'inline-block', width: 14, height: 3, background: RED, borderRadius: 2 },
  nav: { display: 'flex', gap: 4, flex: 1 },
  link: {
    color: '#555',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 500,
    padding: '4px 12px',
    borderRadius: 5,
    transition: 'color 0.15s',
  },
  linkActive: { color: '#ddd', background: '#222' },
  right: { display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' },
  club: { color: '#444', fontSize: 12, display: 'none' },
  name: { color: '#666', fontSize: 13 },
  logoutBtn: {
    background: 'transparent',
    border: '1px solid #2a2a2a',
    color: '#555',
    padding: '4px 10px',
    borderRadius: 5,
    cursor: 'pointer',
    fontSize: 12,
  },
}
