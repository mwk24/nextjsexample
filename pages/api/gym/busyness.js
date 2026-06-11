import fetch from 'node-fetch'
import { GYM_BASE, gymHeaders, getCookieValue } from '../../../utils/gymApi'

export default async function handler(req, res) {
  const jsessionid = getCookieValue(req.headers.cookie, 'gym_jsessionid')
  const { exerciserUuid, gymLocationId } = req.query

  if (!jsessionid || !exerciserUuid || !gymLocationId) {
    return res.status(400).json({ error: 'Missing exerciserUuid or gymLocationId' })
  }

  try {
    const upstream = await fetch(
      `${GYM_BASE}/np/thegymgroup/v1.0/exerciser/${exerciserUuid}/gym-busyness?gymLocationId=${gymLocationId}`,
      { headers: gymHeaders(jsessionid) }
    )
    const data = await upstream.json()
    return res.status(upstream.ok ? 200 : upstream.status).json(data)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
