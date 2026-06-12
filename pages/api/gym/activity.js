import fetch from 'node-fetch'
import { GYM_BASE, gymHeaders, getCookieValue } from '../../../utils/gymApi'

export default async function handler(req, res) {
  const jsessionid = getCookieValue(req.headers.cookie, 'gym_jsessionid')
  const { exerciserUuid } = req.query
  if (!jsessionid || !exerciserUuid) return res.status(401).json({ error: 'Not authenticated' })

  try {
    const [levelsRes, currentRes] = await Promise.all([
      fetch(`${GYM_BASE}/analysis/api/v1.0/exercisers/${exerciserUuid}/activitylevels/definitions?languageCode=en`, {
        headers: gymHeaders(jsessionid),
      }),
      fetch(`${GYM_BASE}/analysis/api/v1.0/exercisers/${exerciserUuid}/activitylevels`, {
        headers: gymHeaders(jsessionid),
      }),
    ])
    const [levels, current] = await Promise.all([levelsRes.json(), currentRes.json()])
    return res.status(200).json({ levels, current })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
