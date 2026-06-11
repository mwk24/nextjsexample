import fetch from 'node-fetch'
import { GYM_BASE, gymHeaders, getCookieValue } from '../../../utils/gymApi'

export default async function handler(req, res) {
  const jsessionid = getCookieValue(req.headers.cookie, 'gym_jsessionid')
  const { exerciserUuid } = req.query

  if (!jsessionid || !exerciserUuid) return res.status(401).json({ error: 'Not authenticated' })

  const now = Date.now()
  const params = new URLSearchParams({
    startDateTime: String(now),
    endDateTime: String(now + 7 * 86400000),
  })

  try {
    const upstream = await fetch(`${GYM_BASE}/np/exerciser/${exerciserUuid}/schedule?${params}`, {
      headers: gymHeaders(jsessionid),
    })
    const data = await upstream.json()
    return res.status(upstream.ok ? 200 : upstream.status).json(data)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
